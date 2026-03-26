"""
Website Crawl Router — endpoints for crawling, page management, and indexing.

Endpoints:
    POST   /api/websites/crawl             — start crawling a URL
    WS     /api/websites/{id}/progress     — real-time crawl progress
    GET    /api/websites/{id}/pages        — list crawled pages
    PATCH  /api/websites/{id}/pages        — update page inclusion
    POST   /api/websites/{id}/pages/add    — add a single URL
    POST   /api/websites/{id}/index        — trigger indexing (Phase 2)
    POST   /api/websites/{id}/recrawl      — re-crawl from scratch
"""

import logging
from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks, WebSocket, Query
from app.dependencies import get_current_user, get_user_db
from app.services.crawl_service import (
    submit_website, crawl_website_pages, crawl_more_pages, index_website,
    get_crawled_pages, update_page_inclusion, add_page_to_crawl,
    register_progress_ws, unregister_progress_ws,
)
from app.services.document_service import get_document
from app.models.document import DocumentResponse
from app.models.website import WebsiteCrawlRequest, UpdatePagesRequest, AddPageRequest, BulkUpdateRequest
from app.services.auth_service import verify_token
from app.config import settings
from app.database import get_db
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/websites", tags=["websites"])


def _validate_user_mode(current_user: dict):
    """Validate user has required API keys for their mode."""
    mode = current_user.get("mode", "public")
    if mode == "public" and not settings.PLATFORM_OPENAI_KEY:
        raise HTTPException(400, "Platform OpenAI key not configured.")
    elif mode == "private":
        if not current_user.get("own_openai_key"):
            raise HTTPException(400, "OpenAI API key required. Add it in Settings.")
        if not current_user.get("private_mongodb_url"):
            raise HTTPException(400, "MongoDB required for private mode.")
    elif mode == "local":
        if not current_user.get("private_mongodb_url"):
            raise HTTPException(400, "MongoDB required for local mode.")
        if not current_user.get("ollama_base_url") or not current_user.get("ollama_model"):
            raise HTTPException(400, "Ollama required for local mode.")


# ─── Start Crawl ─────────────────────────────────────────────────


@router.post("/crawl", response_model=DocumentResponse)
async def crawl_website(
    request: WebsiteCrawlRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Submit a website URL for crawling. Pages are crawled in background."""
    _validate_user_mode(current_user)

    url = str(request.url).strip()
    if not url:
        raise HTTPException(400, "URL is required")

    db = await get_user_db(current_user)
    doc = await submit_website(
        db=db, user_id=current_user["_id"], url=url,
        max_pages=request.max_pages, max_depth=request.max_depth,
        include_patterns=request.include_patterns,
        exclude_patterns=request.exclude_patterns,
    )

    background_tasks.add_task(crawl_website_pages, db, doc["_id"], current_user)

    return DocumentResponse(
        id=str(doc["_id"]), filename=doc["filename"],
        original_filename=doc["original_filename"],
        status=doc["status"], page_count=0,
        source_type="website", source_url=url,
        created_at=doc["created_at"],
    )


# ─── Real-time Progress WebSocket ────────────────────────────────


@router.websocket("/{doc_id}/progress")
async def crawl_progress_ws(
    ws: WebSocket,
    doc_id: str,
    token: str = Query(...),
):
    """WebSocket for real-time crawl progress updates."""
    payload = verify_token(token)
    if not payload:
        await ws.close(code=4001, reason="Invalid token")
        return

    await ws.accept()
    register_progress_ws(doc_id, ws)

    try:
        # Keep connection alive until client disconnects or crawl ends
        while True:
            # We just wait for the client to close
            # Progress is sent by the crawl_website_pages background task
            await ws.receive_text()
    except Exception:
        pass
    finally:
        unregister_progress_ws(doc_id)


# ─── Page Management ─────────────────────────────────────────────


@router.get("/{doc_id}/pages")
async def get_pages(
    doc_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=10, le=200),
    status: str = Query(None),
    category: str = Query(None),
    search: str = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Get paginated list of crawled/discovered pages with filters."""
    db = await get_user_db(current_user)
    result = await get_crawled_pages(
        db, doc_id, current_user["_id"],
        page=page, per_page=per_page,
        status_filter=status, category_filter=category,
        search=search,
    )
    if result is None:
        raise HTTPException(404, "Website document not found")
    return result


@router.patch("/{doc_id}/pages")
async def update_pages(
    doc_id: str,
    request: UpdatePagesRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update inclusion status of crawled pages."""
    db = await get_user_db(current_user)
    success = await update_page_inclusion(
        db, doc_id, current_user["_id"],
        [{"url": p.url, "included": p.included} for p in request.pages],
    )
    if not success:
        raise HTTPException(404, "Website document not found")
    return {"status": "updated"}


@router.post("/{doc_id}/pages/add")
async def add_page(
    doc_id: str,
    request: AddPageRequest,
    current_user: dict = Depends(get_current_user),
):
    """Crawl a single additional URL and add it to the page list."""
    db = await get_user_db(current_user)
    page = await add_page_to_crawl(db, doc_id, current_user["_id"], request.url)
    if page is None:
        raise HTTPException(400, "Could not crawl this URL (already exists, empty, or failed)")
    return {
        "url": page["url"],
        "title": page.get("title", ""),
        "text_preview": page.get("text", "")[:200],
        "char_count": len(page.get("text", "")),
        "included": True,
    }


# ─── Crawl More & Bulk Operations ────────────────────────────────


@router.post("/{doc_id}/crawl-more")
async def crawl_more(
    doc_id: str,
    batch_size: int = Query(50, ge=10, le=200),
    category: str = Query(None),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user),
):
    """Crawl the next batch of discovered-but-uncrawled URLs."""
    _validate_user_mode(current_user)
    db = await get_user_db(current_user)
    doc = await get_document(db, doc_id, current_user["_id"])
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.get("source_type") != "website":
        raise HTTPException(400, "Not a website document")

    # Check if there are uncrawled URLs
    uncrawled = await db.website_pages.count_documents(
        {"doc_id": doc_id, "status": "discovered", "included": True}
    )
    if uncrawled == 0:
        raise HTTPException(400, "No more pages to crawl")

    background_tasks.add_task(crawl_more_pages, db, doc_id, current_user, batch_size, category)
    return {"message": f"Crawling next {min(batch_size, uncrawled)} pages", "uncrawled_remaining": uncrawled}


@router.patch("/{doc_id}/pages/bulk")
async def bulk_update_pages(
    doc_id: str,
    action: str = Query(..., pattern="^(include|exclude)$"),
    category: str = Query(None),
    status: str = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Bulk include/exclude pages by category or status."""
    db = await get_user_db(current_user)
    doc = await get_document(db, doc_id, current_user["_id"])
    if not doc:
        raise HTTPException(404, "Document not found")

    query = {"doc_id": doc_id}
    if category:
        query["category"] = category.lower()
    if status:
        query["status"] = status

    included_val = action == "include"
    result = await db.website_pages.update_many(query, {"$set": {"included": included_val}})
    return {"updated": result.modified_count, "action": action}


# ─── Index (Phase 2) ─────────────────────────────────────────────


@router.post("/{doc_id}/index", response_model=DocumentResponse)
async def index_website_endpoint(
    doc_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Trigger indexing of crawled pages (builds tree for chat/call)."""
    _validate_user_mode(current_user)

    db = await get_user_db(current_user)
    doc = await get_document(db, doc_id, current_user["_id"])
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.get("source_type") != "website":
        raise HTTPException(400, "Not a website document")
    if doc.get("status") not in ("crawled", "failed", "ready"):
        raise HTTPException(400, f"Cannot index: current status is '{doc.get('status')}'")

    background_tasks.add_task(index_website, db, doc_id, current_user)

    return DocumentResponse(
        id=doc_id, filename=doc["filename"],
        original_filename=doc["original_filename"],
        status="processing", page_count=doc.get("page_count"),
        source_type="website", source_url=doc.get("source_url"),
        created_at=doc["created_at"],
    )


# ─── Re-crawl ────────────────────────────────────────────────────


@router.post("/{doc_id}/recrawl", response_model=DocumentResponse)
async def recrawl_website(
    doc_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Re-crawl from scratch."""
    _validate_user_mode(current_user)

    db = await get_user_db(current_user)
    doc = await get_document(db, doc_id, current_user["_id"])
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.get("source_type") != "website":
        raise HTTPException(400, "Not a website document")

    await db.documents.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {
            "status": "processing",
            "page_index_tree": None,
            "error_message": None,
            "crawled_pages": [],
            "crawl_stats": None,
        }},
    )

    background_tasks.add_task(crawl_website_pages, db, doc_id, current_user)

    return DocumentResponse(
        id=doc_id, filename=doc["filename"],
        original_filename=doc["original_filename"],
        status="processing", page_count=0,
        source_type="website", source_url=doc.get("source_url"),
        created_at=doc["created_at"],
    )


class RecrawlScheduleRequest(BaseModel):
    schedule: Optional[str] = None  # "daily", "weekly", "monthly", or None to disable


@router.put("/{doc_id}/schedule")
async def set_recrawl_schedule(
    doc_id: str,
    request: RecrawlScheduleRequest,
    current_user: dict = Depends(get_current_user),
):
    """Set an auto re-crawl schedule for a website."""
    db = await get_user_db(current_user)
    doc = await get_document(db, doc_id, current_user["_id"])
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.get("source_type") != "website":
        raise HTTPException(400, "Not a website document")

    valid_schedules = {None, "daily", "weekly", "monthly"}
    if request.schedule not in valid_schedules:
        raise HTTPException(400, f"Invalid schedule. Use: daily, weekly, monthly, or null to disable.")

    from datetime import datetime, timezone
    await db.documents.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {
            "recrawl_schedule": request.schedule,
            "recrawl_schedule_set_at": datetime.now(timezone.utc),
        }},
    )

    return {
        "document_id": doc_id,
        "schedule": request.schedule,
        "message": f"Re-crawl schedule {'set to ' + request.schedule if request.schedule else 'disabled'}.",
    }


@router.get("/{doc_id}/schedule")
async def get_recrawl_schedule(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get current re-crawl schedule for a website."""
    db = await get_user_db(current_user)
    doc = await get_document(db, doc_id, current_user["_id"])
    if not doc:
        raise HTTPException(404, "Document not found")

    return {
        "document_id": doc_id,
        "schedule": doc.get("recrawl_schedule"),
        "last_crawled": doc.get("crawl_stats", {}).get("completed_at") if doc.get("crawl_stats") else None,
    }
