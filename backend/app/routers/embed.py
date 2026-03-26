"""
Unified Embed Router — manage embed tokens and serve embedded chat for third-party websites.

Endpoints:
    POST   /api/embed/tokens          — create embed token (chat or call)
    GET    /api/embed/tokens          — list all embed tokens
    DELETE /api/embed/tokens/{id}     — revoke token
    POST   /api/embed/chat            — chat with document via embed token (SSE)
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from app.dependencies import get_current_user, get_user_db
from app.services.voice_call.embed_token_service import (
    create_embed_token,
    validate_embed_token,
    list_embed_tokens,
    revoke_embed_token,
)
from app.services.document_service import get_document_with_tree
from app.services.chat_service import chat_with_document
from app.models.voice_call import CreateEmbedTokenRequest
from app.database import get_db
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/embed", tags=["embed"])


class EmbedChatRequest(BaseModel):
    token: str
    message: str
    conversation_id: Optional[str] = None


def _format_sse_data(chunk: str) -> str:
    normalized = chunk.replace("\r\n", "\n").replace("\r", "\n")
    return "".join(f"data: {line}\n" for line in normalized.split("\n")) + "\n"


# ─── Token Management ─────────────────────────────────────────────


@router.post("/tokens")
async def create_token(
    request: CreateEmbedTokenRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create an embed token for chat or call widget. Supports single or multiple documents."""
    db = await get_user_db(current_user)

    # Resolve document IDs (support both single and multi)
    doc_ids = request.document_ids or ([request.document_id] if request.document_id else [])
    if not doc_ids:
        raise HTTPException(400, "At least one document_id is required")
    if len(doc_ids) > 10:
        raise HTTPException(400, "Maximum 10 documents per widget")

    # Verify all documents exist
    for did in doc_ids:
        doc = await get_document_with_tree(db, did, current_user["_id"])
        if not doc:
            raise HTTPException(404, f"Document {did} not found")

    if request.widget_type not in ("chat", "call"):
        raise HTTPException(400, "widget_type must be 'chat' or 'call'")

    # Store first doc as primary (backward compat), all in document_ids
    primary_doc_id = doc_ids[0]

    token = await create_embed_token(
        db=db,
        user_id=current_user["_id"],
        document_id=primary_doc_id,
        allowed_origins=request.allowed_origins,
        ttl_hours=request.ttl_hours,
        custom_intro=request.custom_intro,
        custom_voice=request.custom_voice,
        widget_type=request.widget_type,
    )

    # Store all document_ids on the token record
    if len(doc_ids) > 1:
        from bson import ObjectId
        await db.embed_tokens.update_one(
            {"_id": ObjectId(token.get("_id") or token.get("id"))},
            {"$set": {"document_ids": doc_ids}},
        )

    return {
        "token": token.get("raw_token"),
        "token_prefix": token.get("token_prefix"),
        "widget_type": request.widget_type,
        "document_id": primary_doc_id,
        "document_ids": doc_ids,
        "expires_at": token.get("expires_at"),
        "allowed_origins": request.allowed_origins,
    }


@router.get("/tokens")
async def list_tokens(
    current_user: dict = Depends(get_current_user),
):
    """List all embed tokens for the current user."""
    db = await get_user_db(current_user)
    tokens = await list_embed_tokens(db, current_user["_id"])
    return [
        {
            "id": t["_id"],
            "token_prefix": t.get("token_prefix"),
            "widget_type": t.get("widget_type", "call"),
            "document_id": t.get("document_id"),
            "document_ids": t.get("document_ids", [t.get("document_id")] if t.get("document_id") else []),
            "allowed_origins": t.get("allowed_origins", []),
            "is_active": t.get("is_active", False),
            "is_expired": t.get("is_expired", False),
            "usage_count": t.get("usage_count", 0),
            "created_at": t.get("created_at"),
            "expires_at": t.get("expires_at"),
            "last_used": t.get("last_used"),
        }
        for t in tokens
    ]


@router.delete("/tokens/{token_id}")
async def revoke_token(
    token_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Revoke an embed token."""
    db = await get_user_db(current_user)
    success = await revoke_embed_token(db, token_id, current_user["_id"])
    if not success:
        raise HTTPException(404, "Token not found")
    return {"status": "revoked"}


# ─── Embed Chat (SSE) ─────────────────────────────────────────────


@router.post("/chat")
async def embed_chat(request: EmbedChatRequest):
    """Chat with a document using an embed token. Returns SSE stream."""
    db = get_db()

    # Validate token
    token_data = await validate_embed_token(db, request.token)
    if not token_data:
        raise HTTPException(401, "Invalid or expired embed token")

    user = token_data["user"]
    document_id = token_data["document_id"]

    # Get user DB (may be private)
    from app.dependencies import get_user_db as _get_user_db
    try:
        user_db = await _get_user_db(user)
    except Exception:
        user_db = db

    # Load document
    doc = await get_document_with_tree(user_db, document_id, user["_id"])
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.get("status") != "ready":
        raise HTTPException(400, "Document is not ready for chat")

    async def generate():
        async for chunk in chat_with_document(
            db=user_db,
            user=user,
            document=doc,
            message=request.message,
            conversation_id=request.conversation_id,
        ):
            yield _format_sse_data(chunk)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
