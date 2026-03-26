"""
Website Crawl Service — two-phase crawling with real-time WebSocket progress.

Phase 1 (crawl): URL → discover pages → fetch & extract → store pages → status="crawled"
Phase 2 (index): Build markdown → md_to_tree → store tree → status="ready"

User can manage (add/remove) pages between Phase 1 and Phase 2.
"""

import os
import re
import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from fnmatch import fnmatch
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree

import httpx
import trafilatura
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

USER_AGENT = "PDFGyan-Crawler/1.0 (+https://pdfgyan.com)"
REQUEST_TIMEOUT = 30
DELAY_BETWEEN_REQUESTS = 1.0

# Active WebSocket connections for progress updates (doc_id → ws)
_progress_sockets: dict[str, object] = {}


def register_progress_ws(doc_id: str, ws):
    _progress_sockets[doc_id] = ws


def unregister_progress_ws(doc_id: str):
    _progress_sockets.pop(doc_id, None)


async def _send_progress(doc_id: str, data: dict):
    """Send progress update to connected WebSocket if any."""
    ws = _progress_sockets.get(doc_id)
    if ws:
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            unregister_progress_ws(doc_id)


# ─── URL Categorization & Storage ────────────────────────────────


def _categorize_urls(urls: list[str]) -> tuple[list[dict], dict[str, str]]:
    """Auto-detect route groups from URL paths. Returns (categories_summary, url_to_category_map)."""
    from collections import Counter
    prefixes = Counter()

    url_prefix_map = {}
    for u in urls:
        parts = urlparse(u).path.strip("/").split("/")
        if len(parts) >= 2:
            prefix = f"/{parts[0]}/*"
            prefixes[prefix] += 1
            url_prefix_map[u] = prefix

    # Only keep prefixes with 3+ URLs
    valid_prefixes = {p for p, c in prefixes.items() if c >= 3}
    categories = []
    for prefix, count in prefixes.most_common():
        if count >= 3:
            label = prefix.strip("/*").replace("-", " ").replace("_", " ").title()
            categories.append({"pattern": prefix, "label": label, "count": count})

    # Map each URL to its category (or None)
    url_to_category = {}
    for u in urls:
        prefix = url_prefix_map.get(u)
        if prefix and prefix in valid_prefixes:
            url_to_category[u] = prefix.strip("/*").replace("-", " ").replace("_", " ").title().lower()
        else:
            url_to_category[u] = None

    return categories, url_to_category


async def _store_discovered_urls(
    db: AsyncIOMotorDatabase, doc_id: str, user_id: str,
    urls: list[str], url_categories: dict[str, str],
) -> int:
    """Bulk insert discovered URLs into website_pages collection. Returns count inserted."""
    if not urls:
        return 0

    now = datetime.now(timezone.utc)
    docs = []
    for u in urls:
        docs.append({
            "doc_id": doc_id,
            "user_id": user_id,
            "url": u,
            "title": None,
            "text": None,
            "char_count": 0,
            "status": "discovered",
            "included": True,
            "category": url_categories.get(u),
            "crawled_at": None,
            "error": None,
            "created_at": now,
        })

    try:
        result = await db.website_pages.insert_many(docs, ordered=False)
        return len(result.inserted_ids)
    except Exception as e:
        # Partial insert if some URLs already exist (unique index on doc_id+url)
        logger.warning(f"[Crawl] Partial insert for discovered URLs: {e}")
        return 0


async def _get_next_batch(
    db: AsyncIOMotorDatabase, doc_id: str, limit: int, category: str = None,
) -> list[dict]:
    """Get next batch of discovered-but-uncrawled URLs."""
    query = {"doc_id": doc_id, "status": "discovered", "included": True}
    if category:
        query["category"] = category.lower()
    cursor = db.website_pages.find(query).sort("created_at", 1).limit(limit)
    return await cursor.to_list(limit)


async def _update_page_counts(db: AsyncIOMotorDatabase, doc_id: str):
    """Update summary counts on the document record."""
    pipeline = [
        {"$match": {"doc_id": doc_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
        }},
    ]
    counts = {"crawled": 0, "discovered": 0, "failed": 0}
    async for row in db.website_pages.aggregate(pipeline):
        counts[row["_id"]] = row["count"]

    total = sum(counts.values())
    await db.documents.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {
            "discovered_count": counts["discovered"],
            "crawled_count": counts["crawled"],
            "failed_count": counts["failed"],
            "page_count": counts["crawled"],
        }},
    )


# ─── Phase 1: Submit & Crawl ─────────────────────────────────────


async def submit_website(
    db: AsyncIOMotorDatabase,
    user_id: str,
    url: str,
    max_pages: int = 50,
    max_depth: int = 3,
    include_patterns: list[str] | None = None,
    exclude_patterns: list[str] | None = None,
) -> dict:
    """Create a document record for a website crawl. Returns doc with status='processing'."""
    url = url.strip().rstrip("/")
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"

    parsed = urlparse(url)
    domain = parsed.netloc or parsed.path.split("/")[0]

    doc_id = str(ObjectId())
    user_dir = os.path.join(settings.UPLOAD_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)

    filename = f"{doc_id}.md"
    file_path = os.path.join(user_dir, filename)

    doc = {
        "_id": ObjectId(doc_id),
        "user_id": user_id,
        "filename": filename,
        "original_filename": domain,
        "file_path": file_path,
        "status": "processing",
        "page_count": 0,
        "page_index_tree": None,
        "error_message": None,
        "source_type": "website",
        "source_url": url,
        "crawl_config": {
            "max_pages": max_pages,
            "max_depth": max_depth,
            "include_patterns": include_patterns or [],
            "exclude_patterns": exclude_patterns or [],
        },
        "crawled_pages": [],
        "crawl_stats": None,
        "created_at": datetime.now(timezone.utc),
    }

    await db.documents.insert_one(doc)
    doc["_id"] = doc_id
    return doc


async def crawl_website_pages(
    db: AsyncIOMotorDatabase,
    doc_id: str,
    user: dict,
) -> None:
    """
    Phase 1 background task: crawl pages, store them, set status='crawled'.
    Sends real-time progress via WebSocket.
    """
    doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
    if not doc:
        return

    url = doc.get("source_url", "")
    user_id = doc.get("user_id", user.get("_id", ""))
    config = doc.get("crawl_config", {})
    crawl_start = time.time()

    try:
        logger.info(f"[Crawl] Phase 1: starting crawl for {url}")
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
            limits=httpx.Limits(max_connections=5),
        ) as client:

            # ── Discovery phase: find ALL URLs ──
            await _send_progress(doc_id, {"type": "discovery", "phase": "sitemap", "urls_found": 0})

            all_discovered = await _discover_from_sitemap(client, base_url)
            logger.info(f"[Crawl] Sitemap: {len(all_discovered)} URLs")

            include = config.get("include_patterns")
            exclude = config.get("exclude_patterns")
            all_discovered = [u for u in all_discovered if _matches_patterns(u, include, exclude)]

            if len(all_discovered) < 5:
                await _send_progress(doc_id, {"type": "discovery", "phase": "bfs", "urls_found": len(all_discovered)})
                bfs_urls = await _discover_bfs(client, url, base_url, config.get("max_depth", 3), config.get("max_pages", 50) * 2)
                bfs_urls = [u for u in bfs_urls if _matches_patterns(u, include, exclude)]
                seen = set(all_discovered)
                for u in bfs_urls:
                    if u not in seen:
                        all_discovered.append(u)
                        seen.add(u)

            if url not in all_discovered:
                all_discovered.insert(0, url)

            # ── Categorize and store ALL discovered URLs ──
            categories, url_cat_map = _categorize_urls(all_discovered)
            inserted = await _store_discovered_urls(db, doc_id, user_id, all_discovered, url_cat_map)
            logger.info(f"[Crawl] Stored {inserted} discovered URLs in {len(categories)} categories")

            # Store categories on document
            await db.documents.update_one(
                {"_id": ObjectId(doc_id)},
                {"$set": {"url_categories": categories, "discovered_count": len(all_discovered)}},
            )

            await _send_progress(doc_id, {
                "type": "discovery", "phase": "complete",
                "urls_found": len(all_discovered),
                "categories": categories,
            })

            # ── Crawl first batch (up to max_pages) ──
            max_pages = config.get("max_pages", 50)
            batch = await _get_next_batch(db, doc_id, max_pages)
            total_urls = len(batch)
            crawled_count = 0

            for i, page_doc in enumerate(batch):
                page_url = page_doc["url"]
                await _send_progress(doc_id, {
                    "type": "page_crawling",
                    "url": page_url,
                    "page_num": i + 1,
                    "total": total_urls,
                })

                page = await _fetch_and_extract(client, page_url)
                if page and page.get("text", "").strip():
                    crawled_count += 1
                    await db.website_pages.update_one(
                        {"_id": page_doc["_id"]},
                        {"$set": {
                            "status": "crawled",
                            "title": page["title"],
                            "text": page["text"],
                            "char_count": len(page["text"]),
                            "included": True,
                            "crawled_at": datetime.now(timezone.utc),
                        }},
                    )
                    await _send_progress(doc_id, {
                        "type": "page_crawled",
                        "url": page_url,
                        "title": page.get("title", ""),
                        "page_num": i + 1,
                        "total": total_urls,
                        "success": True,
                        "crawled_count": crawled_count,
                    })
                else:
                    await db.website_pages.update_one(
                        {"_id": page_doc["_id"]},
                        {"$set": {"status": "failed", "error": "Empty or unreachable"}},
                    )
                    await _send_progress(doc_id, {
                        "type": "page_failed",
                        "url": page_url,
                        "page_num": i + 1,
                        "total": total_urls,
                        "crawled_count": crawled_count,
                    })

                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

        if crawled_count == 0:
            raise ValueError("No pages could be crawled from this website")

        # Update summary counts and status
        crawl_duration = int((time.time() - crawl_start) * 1000)
        await _update_page_counts(db, doc_id)

        total_chars = 0
        async for p in db.website_pages.find({"doc_id": doc_id, "status": "crawled"}, {"char_count": 1}):
            total_chars += p.get("char_count", 0)

        crawl_stats = {
            "pages_crawled": crawled_count,
            "pages_failed": total_urls - crawled_count,
            "total_discovered": len(all_discovered),
            "total_chars": total_chars,
            "crawl_duration_ms": crawl_duration,
        }

        # Also keep backward-compat crawled_pages array (lightweight — up to 200)
        legacy_pages = []
        async for p in db.website_pages.find(
            {"doc_id": doc_id, "status": "crawled"},
            {"url": 1, "title": 1, "text": 1, "included": 1},
        ).limit(200):
            legacy_pages.append({"url": p["url"], "title": p.get("title", ""), "text": p.get("text", ""), "included": p.get("included", True)})

        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {
                "status": "crawled",
                "page_count": crawled_count,
                "crawled_pages": legacy_pages,
                "crawl_stats": crawl_stats,
            }},
        )

        await _send_progress(doc_id, {
            "type": "crawl_complete",
            "total_crawled": crawled_count,
            "total_failed": total_urls - crawled_count,
            "total_discovered": len(all_discovered),
        })

        logger.info(f"[Crawl] Phase 1 done: {crawled_count}/{total_urls} pages crawled, {len(all_discovered)} total discovered in {crawl_duration}ms")

    except Exception as e:
        logger.error(f"[Crawl] Phase 1 failed for {url}: {e}", exc_info=True)
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {"status": "failed", "error_message": str(e)[:500]}},
        )
        await _send_progress(doc_id, {"type": "error", "message": str(e)[:300]})


# ─── Phase 2: Index ──────────────────────────────────────────────


async def index_website(
    db: AsyncIOMotorDatabase,
    doc_id: str,
    user: dict,
) -> None:
    """Phase 2: build markdown from included pages, run md_to_tree, set status='ready'."""
    doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
    if not doc:
        return

    file_path = doc["file_path"]

    # Try new collection first, fall back to embedded array
    included_pages = []
    async for p in db.website_pages.find(
        {"doc_id": doc_id, "status": "crawled", "included": True},
        {"url": 1, "title": 1, "text": 1, "category": 1},
    ).sort("category", 1):
        included_pages.append(p)

    if not included_pages:
        # Fallback to legacy embedded array
        pages = doc.get("crawled_pages", [])
        included_pages = [p for p in pages if p.get("included", True)]

    if not included_pages:
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {"status": "failed", "error_message": "No pages selected for indexing"}},
        )
        return

    try:
        logger.info(f"[Crawl] Phase 2: indexing {len(included_pages)} pages for doc {doc_id}")

        # Update status
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {"status": "processing", "error_message": None}},
        )

        # Build markdown
        parsed = urlparse(doc.get("source_url", ""))
        domain = parsed.netloc or "website"
        markdown = _build_markdown(included_pages, domain)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(markdown)

        # Run md_to_tree
        runtime = llm_service.get_index_runtime(user)
        old_key = os.environ.get("OPENAI_API_KEY")
        if runtime.get("api_key") and not runtime.get("api_base"):
            os.environ["OPENAI_API_KEY"] = runtime["api_key"]

        try:
            from pageindex.page_index_md import md_to_tree
            tree = await md_to_tree(
                md_path=file_path,
                if_add_node_id="yes",
                if_add_node_text="yes",
                if_add_node_summary="yes",
                summary_token_threshold=200,
                model=runtime["model"],
            )
        finally:
            if old_key:
                os.environ["OPENAI_API_KEY"] = old_key
            elif "OPENAI_API_KEY" in os.environ and runtime.get("api_key"):
                os.environ.pop("OPENAI_API_KEY", None)

        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {
                "status": "ready",
                "page_count": len(included_pages),
                "page_index_tree": tree,
            }},
        )

        logger.info(f"[Crawl] Phase 2 done: {len(included_pages)} pages indexed")

    except Exception as e:
        logger.error(f"[Crawl] Phase 2 failed: {e}", exc_info=True)
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {"status": "failed", "error_message": str(e)[:500]}},
        )


# ─── Page Management ─────────────────────────────────────────────


async def get_crawled_pages(
    db: AsyncIOMotorDatabase, doc_id: str, user_id: str,
    page: int = 1, per_page: int = 50,
    status_filter: str = None, category_filter: str = None,
    search: str = None,
) -> dict:
    """Get paginated pages for a website document."""
    doc = await db.documents.find_one(
        {"_id": ObjectId(doc_id), "user_id": user_id},
        {"source_type": 1, "crawled_pages": 1, "url_categories": 1},
    )
    if not doc or doc.get("source_type") != "website":
        return None

    # Check if new collection has data
    new_count = await db.website_pages.count_documents({"doc_id": doc_id})

    if new_count > 0:
        # Use new paginated collection
        query = {"doc_id": doc_id}
        if status_filter:
            query["status"] = status_filter
        if category_filter:
            query["category"] = category_filter.lower()
        if search:
            query["$or"] = [
                {"url": {"$regex": search, "$options": "i"}},
                {"title": {"$regex": search, "$options": "i"}},
            ]

        total = await db.website_pages.count_documents(query)
        skip = (page - 1) * per_page

        cursor = db.website_pages.find(
            query,
            {"text": 0},  # Exclude full text for performance
        ).sort("created_at", 1).skip(skip).limit(per_page)

        pages = []
        async for p in cursor:
            pages.append({
                "id": str(p["_id"]),
                "url": p["url"],
                "title": p.get("title"),
                "char_count": p.get("char_count", 0),
                "status": p.get("status", "discovered"),
                "included": p.get("included", False),
                "category": p.get("category"),
                "crawled_at": p.get("crawled_at"),
                "error": p.get("error"),
            })

        # Stats
        stats = {}
        for s in ["crawled", "discovered", "failed"]:
            stats[s] = await db.website_pages.count_documents({"doc_id": doc_id, "status": s})
        stats["included"] = await db.website_pages.count_documents({"doc_id": doc_id, "included": True, "status": "crawled"})

        return {
            "pages": pages,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
            "categories": doc.get("url_categories", []),
            "stats": stats,
        }
    else:
        # Fallback to legacy embedded array
        all_pages = doc.get("crawled_pages", [])
        formatted = [{
            "url": p["url"],
            "title": p.get("title"),
            "char_count": len(p.get("text", "")),
            "status": "crawled",
            "included": p.get("included", True),
            "category": None,
        } for p in all_pages]

        # Client-side filtering for legacy
        if search:
            formatted = [p for p in formatted if search.lower() in (p["url"] + (p["title"] or "")).lower()]

        total = len(formatted)
        start = (page - 1) * per_page
        paginated = formatted[start:start + per_page]

        return {
            "pages": paginated,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
            "categories": [],
            "stats": {"crawled": total, "discovered": 0, "failed": 0, "included": sum(1 for p in formatted if p["included"])},
        }


async def update_page_inclusion(db: AsyncIOMotorDatabase, doc_id: str, user_id: str, updates: list[dict]) -> bool:
    """Update which pages are included/excluded."""
    # Try new collection first
    new_count = await db.website_pages.count_documents({"doc_id": doc_id})

    if new_count > 0:
        for upd in updates:
            await db.website_pages.update_one(
                {"doc_id": doc_id, "url": upd["url"]},
                {"$set": {"included": upd["included"]}},
            )
        return True

    # Legacy fallback
    doc = await db.documents.find_one(
        {"_id": ObjectId(doc_id), "user_id": user_id},
        {"crawled_pages": 1, "source_type": 1},
    )
    if not doc or doc.get("source_type") != "website":
        return False

    pages = doc.get("crawled_pages", [])
    update_map = {u["url"]: u["included"] for u in updates}

    for page in pages:
        if page["url"] in update_map:
            page["included"] = update_map[page["url"]]

    await db.documents.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {"crawled_pages": pages}},
    )
    return True


async def crawl_more_pages(
    db: AsyncIOMotorDatabase, doc_id: str, user: dict,
    batch_size: int = 50, category: str = None,
) -> None:
    """Crawl next batch of discovered-but-uncrawled URLs."""
    doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
    if not doc:
        return

    batch = await _get_next_batch(db, doc_id, batch_size, category)
    if not batch:
        logger.info(f"[Crawl] No more URLs to crawl for {doc_id}")
        await _send_progress(doc_id, {"type": "crawl_complete", "total_crawled": 0, "message": "No more pages to crawl"})
        return

    total = len(batch)
    crawled = 0

    await db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": {"status": "processing"}})

    try:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT, follow_redirects=True,
            headers={"User-Agent": USER_AGENT},
            limits=httpx.Limits(max_connections=5),
        ) as client:
            for i, page_doc in enumerate(batch):
                page_url = page_doc["url"]
                await _send_progress(doc_id, {"type": "page_crawling", "url": page_url, "page_num": i + 1, "total": total})

                page = await _fetch_and_extract(client, page_url)
                if page and page.get("text", "").strip():
                    crawled += 1
                    await db.website_pages.update_one(
                        {"_id": page_doc["_id"]},
                        {"$set": {
                            "status": "crawled", "title": page["title"],
                            "text": page["text"], "char_count": len(page["text"]),
                            "included": True, "crawled_at": datetime.now(timezone.utc),
                        }},
                    )
                    await _send_progress(doc_id, {"type": "page_crawled", "url": page_url, "title": page.get("title", ""), "page_num": i + 1, "total": total, "crawled_count": crawled})
                else:
                    await db.website_pages.update_one(
                        {"_id": page_doc["_id"]},
                        {"$set": {"status": "failed", "error": "Empty or unreachable"}},
                    )
                    await _send_progress(doc_id, {"type": "page_failed", "url": page_url, "page_num": i + 1, "total": total, "crawled_count": crawled})

                await asyncio.sleep(DELAY_BETWEEN_REQUESTS)

        await _update_page_counts(db, doc_id)
        await db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": {"status": "crawled"}})
        await _send_progress(doc_id, {"type": "crawl_complete", "total_crawled": crawled, "total_failed": total - crawled})
        logger.info(f"[Crawl] Crawl-more done: {crawled}/{total} new pages for {doc_id}")

    except Exception as e:
        logger.error(f"[Crawl] Crawl-more failed: {e}", exc_info=True)
        await db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": {"status": "crawled"}})
        await _send_progress(doc_id, {"type": "error", "message": str(e)[:300]})


async def add_page_to_crawl(db: AsyncIOMotorDatabase, doc_id: str, user_id: str, url: str) -> dict | None:
    """Crawl a single additional URL and add it to the pages list."""
    doc = await db.documents.find_one(
        {"_id": ObjectId(doc_id), "user_id": user_id},
        {"crawled_pages": 1, "source_type": 1},
    )
    if not doc or doc.get("source_type") != "website":
        return None

    # Check if already crawled
    existing_urls = {p["url"] for p in doc.get("crawled_pages", [])}
    if url in existing_urls:
        return None

    async with httpx.AsyncClient(
        timeout=REQUEST_TIMEOUT, follow_redirects=True,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        page = await _fetch_and_extract(client, url)

    if not page or not page.get("text", "").strip():
        return None

    page["included"] = True

    await db.documents.update_one(
        {"_id": ObjectId(doc_id)},
        {"$push": {"crawled_pages": page}, "$inc": {"page_count": 1}},
    )
    return page


# ─── Crawling Logic (unchanged) ──────────────────────────────────


async def _discover_from_sitemap(client: httpx.AsyncClient, base_url: str) -> list[str]:
    urls = []
    sitemap_urls = [f"{base_url}/sitemap.xml", f"{base_url}/sitemap_index.xml"]

    for sitemap_url in sitemap_urls:
        try:
            resp = await client.get(sitemap_url)
            if resp.status_code != 200:
                continue
            root = ElementTree.fromstring(resp.text)
            ns = ""
            if root.tag.startswith("{"):
                ns = root.tag.split("}")[0] + "}"

            for sitemap in root.findall(f".//{ns}sitemap"):
                loc = sitemap.find(f"{ns}loc")
                if loc is not None and loc.text:
                    try:
                        sub_resp = await client.get(loc.text.strip())
                        if sub_resp.status_code == 200:
                            sub_root = ElementTree.fromstring(sub_resp.text)
                            for url_elem in sub_root.findall(f".//{ns}url"):
                                loc_elem = url_elem.find(f"{ns}loc")
                                if loc_elem is not None and loc_elem.text:
                                    urls.append(loc_elem.text.strip())
                    except Exception:
                        continue

            for url_elem in root.findall(f".//{ns}url"):
                loc = url_elem.find(f"{ns}loc")
                if loc is not None and loc.text:
                    urls.append(loc.text.strip())

            if urls:
                break
        except Exception as e:
            logger.debug(f"[Crawl] Sitemap failed for {sitemap_url}: {e}")
            continue
    return urls


async def _discover_bfs(client, start_url, base_url, max_depth, max_urls):
    visited = set()
    queue = [(start_url, 0)]
    discovered = []
    parsed_base = urlparse(base_url)

    while queue and len(discovered) < max_urls:
        current_url, depth = queue.pop(0)
        if current_url in visited:
            continue
        visited.add(current_url)
        discovered.append(current_url)
        if depth >= max_depth:
            continue
        try:
            resp = await client.get(current_url)
            if resp.status_code != 200:
                continue
            if "text/html" not in resp.headers.get("content-type", ""):
                continue
            links = _extract_links(resp.text, current_url, parsed_base.netloc)
            for link in links:
                if link not in visited:
                    queue.append((link, depth + 1))
            await asyncio.sleep(0.5)
        except Exception:
            continue
    return discovered


def _extract_links(html, page_url, allowed_domain):
    links = []
    for match in re.finditer(r'href=["\']([^"\']+)["\']', html):
        href = match.group(1)
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("javascript:"):
            continue
        absolute = urljoin(page_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc != allowed_domain:
            continue
        clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        if clean.endswith("/"):
            clean = clean[:-1]
        ext = os.path.splitext(parsed.path)[1].lower()
        if ext in (".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".css", ".js", ".zip", ".mp4", ".mp3"):
            continue
        links.append(clean)
    return list(set(links))


async def _fetch_and_extract(client, url):
    try:
        resp = await client.get(url)
        if resp.status_code != 200:
            return None
        content_type = resp.headers.get("content-type", "")
        if "text/html" not in content_type and "application/xhtml" not in content_type:
            return None
        html = resp.text
        text = trafilatura.extract(html, include_links=False, include_images=False, include_tables=True, favor_recall=True)
        if not text or len(text.strip()) < 50:
            return None
        title = _extract_title(html, url)
        return {"url": url, "title": title, "text": text.strip()}
    except Exception as e:
        logger.debug(f"[Crawl] Fetch failed {url}: {e}")
        return None


def _extract_title(html, url):
    match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    if match:
        title = match.group(1).strip()
        for sep in [" | ", " - ", " :: ", " – ", " — "]:
            if sep in title:
                parts = title.split(sep)
                if len(parts[0]) > 10:
                    title = parts[0].strip()
                    break
        return title[:200]
    path = urlparse(url).path.strip("/")
    if path:
        return path.replace("-", " ").replace("/", " > ").title()[:200]
    return urlparse(url).netloc


def _build_markdown(pages, domain):
    """Build category-grouped markdown for better tree search accuracy."""
    parts = [f"# Website: {domain}\n"]

    # Group pages by category
    from collections import defaultdict
    by_category = defaultdict(list)
    for page in pages:
        cat = page.get("category") or "general"
        by_category[cat].append(page)

    # If only one category or few pages, use flat structure (backwards compat)
    if len(by_category) <= 1 or len(pages) <= 30:
        for page in pages:
            title = page.get("title", "Untitled Page")
            url = page.get("url", "")
            text = page.get("text", "")
            parts.append(f"\n## {title}")
            if url:
                parts.append(f"\nSource: {url}\n")
            parts.append(text)
            parts.append("")
    else:
        # Category-grouped structure for large sites
        for cat, cat_pages in by_category.items():
            cat_label = cat.replace("-", " ").replace("_", " ").title() if cat != "general" else "General"
            parts.append(f"\n## {cat_label}\n")
            for page in cat_pages:
                title = page.get("title", "Untitled Page")
                url = page.get("url", "")
                text = page.get("text", "")
                parts.append(f"\n### {title}")
                if url:
                    parts.append(f"\nSource: {url}\n")
                parts.append(text)
                parts.append("")

    return "\n".join(parts)


def _matches_patterns(url, include_patterns=None, exclude_patterns=None):
    path = urlparse(url).path
    if exclude_patterns:
        for pattern in exclude_patterns:
            if fnmatch(path, pattern) or fnmatch(url, pattern):
                return False
    if include_patterns:
        for pattern in include_patterns:
            if fnmatch(path, pattern) or fnmatch(url, pattern):
                return True
        return False
    return True
