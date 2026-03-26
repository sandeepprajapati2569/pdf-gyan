"""
Shared Content Router — public read-only access to shared conversations.
"""

import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from app.dependencies import get_current_user, get_user_db
from app.database import get_db
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(tags=["shared"])


@router.post("/api/chat/share/{conversation_id}")
async def share_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Generate a public share link for a conversation."""
    db = await get_user_db(current_user)

    conv = await db.conversations.find_one({
        "_id": ObjectId(conversation_id),
        "user_id": current_user["_id"],
    })
    if not conv:
        raise HTTPException(404, "Conversation not found")

    # Check if already shared
    existing = await db.shared_conversations.find_one({
        "conversation_id": conversation_id,
        "user_id": current_user["_id"],
    })
    if existing:
        return {
            "share_token": existing.get("share_token"),
            "url": f"/shared/{existing.get('share_token')}",
            "expires_at": existing.get("expires_at"),
        }

    share_token = secrets.token_urlsafe(16)
    await db.shared_conversations.insert_one({
        "share_token": share_token,
        "conversation_id": conversation_id,
        "user_id": current_user["_id"],
        "document_id": conv.get("document_id"),
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
    })

    return {
        "share_token": share_token,
        "url": f"/shared/{share_token}",
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
    }


@router.get("/api/shared/{share_token}")
async def get_shared_conversation(share_token: str):
    """Public endpoint — returns a read-only conversation (no auth required)."""
    db = get_db()

    shared = await db.shared_conversations.find_one({
        "share_token": share_token,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    })
    if not shared:
        raise HTTPException(404, "Shared conversation not found or expired")

    conv_id = shared["conversation_id"]
    user_id = shared["user_id"]

    # Try to find conversation — first in main DB, then try private DB
    conv = await db.conversations.find_one({"_id": ObjectId(conv_id)})
    if not conv:
        # Try private DB for users in private/local mode
        try:
            from app.services.private_db_service import get_private_db
            user = await db.users.find_one({"_id": user_id})
            if user and user.get("private_mongodb_url"):
                private_db = await get_private_db(user["private_mongodb_url"])
                conv = await private_db.conversations.find_one({"_id": ObjectId(conv_id)})
        except Exception:
            pass
    if not conv:
        raise HTTPException(404, "Conversation not found")

    # Get document name
    doc_name = "Document"
    doc_id = conv.get("document_id") or shared.get("document_id")
    if doc_id:
        doc = await db.documents.find_one({"_id": ObjectId(doc_id)}, {"original_filename": 1})
        if doc:
            doc_name = doc.get("original_filename", "Document")

    return {
        "title": conv.get("title", "Shared Conversation"),
        "document_name": doc_name,
        "messages": conv.get("messages", []),
        "created_at": conv.get("created_at"),
        "shared_at": shared.get("created_at"),
    }
