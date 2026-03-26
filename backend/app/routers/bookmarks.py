"""
Bookmarks Router — save, list, and delete pinned AI responses.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from app.dependencies import get_current_user, get_user_db
from pydantic import BaseModel
from bson import ObjectId
from typing import Optional

router = APIRouter(prefix="/api/bookmarks", tags=["bookmarks"])


class CreateBookmarkRequest(BaseModel):
    document_id: str
    conversation_id: Optional[str] = None
    message_index: Optional[int] = None
    content: str


@router.post("")
async def create_bookmark(
    request: CreateBookmarkRequest,
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)
    bookmark = {
        "user_id": current_user["_id"],
        "document_id": request.document_id,
        "conversation_id": request.conversation_id,
        "message_index": request.message_index,
        "content": request.content[:2000],
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.bookmarks.insert_one(bookmark)
    return {
        "id": str(result.inserted_id),
        "content": bookmark["content"],
        "created_at": bookmark["created_at"],
    }


@router.get("")
async def list_bookmarks(
    document_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)
    query = {"user_id": current_user["_id"]}
    if document_id:
        query["document_id"] = document_id

    cursor = db.bookmarks.find(query).sort("created_at", -1).skip(skip).limit(limit)
    bookmarks = []
    async for bm in cursor:
        bookmarks.append({
            "id": str(bm["_id"]),
            "document_id": bm.get("document_id"),
            "conversation_id": bm.get("conversation_id"),
            "message_index": bm.get("message_index"),
            "content": bm.get("content", ""),
            "created_at": bm.get("created_at"),
        })
    return bookmarks


@router.delete("/{bookmark_id}")
async def delete_bookmark(
    bookmark_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)
    result = await db.bookmarks.delete_one({
        "_id": ObjectId(bookmark_id),
        "user_id": current_user["_id"],
    })
    if result.deleted_count == 0:
        raise HTTPException(404, "Bookmark not found")
    return {"status": "deleted"}
