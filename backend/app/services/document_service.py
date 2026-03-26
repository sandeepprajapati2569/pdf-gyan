import os
import json
import uuid
import logging
import fitz  # PyMuPDF
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.config import settings
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


async def upload_document(db: AsyncIOMotorDatabase, user_id: str, file_content: bytes, original_filename: str) -> dict:
    """Save uploaded PDF and create document record."""
    doc_id = str(ObjectId())

    # Create user upload directory
    user_dir = os.path.join(settings.UPLOAD_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)

    # Save file
    filename = f"{doc_id}.pdf"
    file_path = os.path.join(user_dir, filename)
    with open(file_path, "wb") as f:
        f.write(file_content)

    # Get page count
    page_count = 0
    try:
        pdf_doc = fitz.open(file_path)
        page_count = len(pdf_doc)
        pdf_doc.close()
    except Exception:
        pass

    # Create document record
    document = {
        "_id": ObjectId(doc_id),
        "user_id": user_id,
        "filename": filename,
        "original_filename": original_filename,
        "file_path": file_path,
        "status": "processing",
        "page_count": page_count,
        "page_index_tree": None,
        "error_message": None,
        "created_at": datetime.now(timezone.utc),
    }
    await db.documents.insert_one(document)

    document["_id"] = doc_id
    return document


async def process_document(db: AsyncIOMotorDatabase, doc_id: str, user: dict):
    """Background task to index a document with PageIndex."""
    try:
        doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
        if not doc:
            return

        result = await llm_service.run_page_index_async(doc["file_path"], user)

        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {
                "$set": {
                    "status": "ready",
                    "page_index_tree": result,
                }
            },
        )

        # Generate auto-summary + FAQ (non-blocking — doc is already "ready")
        try:
            await _generate_auto_summary(db, doc_id, user, doc)
        except Exception as e:
            logger.warning(f"Auto-summary generation failed for {doc_id}: {e}")

        # Dispatch webhook: document.processed
        try:
            from app.services.webhook_service import dispatch_event
            await dispatch_event(db, user["_id"], "document.processed", {
                "document_id": doc_id,
                "name": doc.get("original_filename", ""),
                "status": "ready",
                "page_count": doc.get("page_count", 0),
            })
        except Exception:
            pass

    except Exception as e:
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {
                "$set": {
                    "status": "failed",
                    "error_message": str(e),
                }
            },
        )
        # Dispatch webhook: document.failed
        try:
            from app.services.webhook_service import dispatch_event
            await dispatch_event(db, user["_id"], "document.failed", {
                "document_id": doc_id,
                "error": str(e)[:200],
            })
        except Exception:
            pass


async def get_user_documents(db: AsyncIOMotorDatabase, user_id: str) -> list:
    cursor = db.documents.find(
        {"user_id": user_id},
        {"page_index_tree": 0},  # Exclude large tree data from list
    ).sort("created_at", -1)
    documents = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        documents.append(doc)
    return documents


async def get_document(db: AsyncIOMotorDatabase, doc_id: str, user_id: str, include_tree: bool = False) -> dict:
    projection = None if include_tree else {"page_index_tree": 0}
    doc = await db.documents.find_one(
        {"_id": ObjectId(doc_id), "user_id": user_id},
        projection,
    )
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


async def get_document_with_tree(db: AsyncIOMotorDatabase, doc_id: str, user_id: str) -> dict:
    return await get_document(db, doc_id, user_id, include_tree=True)


async def delete_document(db: AsyncIOMotorDatabase, doc_id: str, user_id: str) -> bool:
    doc = await db.documents.find_one(
        {"_id": ObjectId(doc_id), "user_id": user_id}
    )
    if not doc:
        return False

    # Delete file
    if os.path.exists(doc["file_path"]):
        os.remove(doc["file_path"])

    # Delete document record
    await db.documents.delete_one({"_id": ObjectId(doc_id)})

    # Delete related conversations
    await db.conversations.delete_many({"document_id": doc_id})

    return True


async def _generate_auto_summary(db: AsyncIOMotorDatabase, doc_id: str, user: dict, doc: dict):
    """Generate an executive summary + FAQ for a document after indexing."""
    file_path = doc.get("file_path", "")
    is_website = doc.get("source_type") == "website"

    # Extract content sample (first ~8000 chars)
    content = ""
    try:
        if is_website and file_path.endswith(".md"):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()[:8000]
        elif file_path:
            pdf_doc = fitz.open(file_path)
            for page_num in range(min(len(pdf_doc), 10)):
                text = pdf_doc[page_num].get_text()
                content += text
                if len(content) > 8000:
                    break
            pdf_doc.close()
            content = content[:8000]
    except Exception as e:
        logger.warning(f"Failed to extract content for summary: {e}")
        return

    if not content or len(content) < 100:
        return

    doc_name = doc.get("original_filename", "Document")
    prompt = f"""You are analyzing a document called "{doc_name}".

Based on the content below, generate:
1. An executive summary (3-5 sentences, clear and informative)
2. A list of 5-8 frequently asked questions with concise answers

Document content:
{content}

Respond in this exact JSON format:
{{
  "summary": "Your executive summary here...",
  "faq": [
    {{"q": "Question 1?", "a": "Answer 1."}},
    {{"q": "Question 2?", "a": "Answer 2."}}
  ]
}}

Only return valid JSON. No other text."""

    try:
        response = await llm_service.completion(
            user=user,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.choices[0].message.content.strip()

        # Parse JSON (handle markdown code blocks)
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        parsed = json.loads(text)

        summary = parsed.get("summary", "")
        faq = parsed.get("faq", [])

        if summary:
            await db.documents.update_one(
                {"_id": ObjectId(doc_id)},
                {"$set": {"auto_summary": summary, "auto_faq": faq}},
            )
            logger.info(f"Auto-summary generated for {doc_id}: {len(faq)} FAQs")
    except Exception as e:
        logger.warning(f"Auto-summary LLM call failed: {e}")
