import os
import uuid
import fitz  # PyMuPDF
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.config import settings
from app.services.llm_service import llm_service


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
