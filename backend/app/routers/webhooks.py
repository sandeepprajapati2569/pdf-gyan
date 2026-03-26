"""
Webhooks Router — register, manage, and test webhook endpoints.
Uses API key authentication (same as public API).
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from app.middleware.api_key_auth import get_api_key_user
from app.dependencies import get_current_user, get_user_db
from app.services.webhook_service import (
    register_webhook, list_webhooks, delete_webhook,
    toggle_webhook, get_webhook_logs, dispatch_event, VALID_EVENTS,
)
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


# ─── Also expose via authenticated user routes ─────────────
user_router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


class WebhookCreateRequest(BaseModel):
    event_type: str
    url: str
    secret: Optional[str] = None


# ─── API Key authenticated (for Zapier/external tools) ─────


@router.post("")
async def create_webhook_api(request: WebhookCreateRequest, user: dict = Depends(get_api_key_user)):
    db = await get_user_db(user)
    try:
        return await register_webhook(db, user["_id"], request.event_type, request.url, request.secret)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("")
async def list_webhooks_api(user: dict = Depends(get_api_key_user)):
    db = await get_user_db(user)
    return await list_webhooks(db, user["_id"])


@router.delete("/{webhook_id}")
async def delete_webhook_api(webhook_id: str, user: dict = Depends(get_api_key_user)):
    db = await get_user_db(user)
    if not await delete_webhook(db, user["_id"], webhook_id):
        raise HTTPException(404, "Webhook not found")
    return {"status": "deleted"}


# ─── User authenticated (for dashboard UI) ─────────────────


@user_router.post("")
async def create_webhook_user(request: WebhookCreateRequest, current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    try:
        return await register_webhook(db, current_user["_id"], request.event_type, request.url, request.secret)
    except ValueError as e:
        raise HTTPException(400, str(e))


@user_router.get("")
async def list_webhooks_user(current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    return await list_webhooks(db, current_user["_id"])


@user_router.delete("/{webhook_id}")
async def delete_webhook_user(webhook_id: str, current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    if not await delete_webhook(db, current_user["_id"], webhook_id):
        raise HTTPException(404, "Webhook not found")
    return {"status": "deleted"}


@user_router.patch("/{webhook_id}/toggle")
async def toggle_webhook_user(webhook_id: str, active: bool = Query(...), current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    if not await toggle_webhook(db, current_user["_id"], webhook_id, active):
        raise HTTPException(404, "Webhook not found")
    return {"status": "updated", "active": active}


@user_router.get("/{webhook_id}/logs")
async def get_logs(webhook_id: str, current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    return await get_webhook_logs(db, webhook_id)


@user_router.post("/{webhook_id}/test")
async def test_webhook(webhook_id: str, current_user: dict = Depends(get_current_user)):
    """Send a test event to this webhook."""
    db = await get_user_db(current_user)
    from bson import ObjectId
    wh = await db.webhooks.find_one({"_id": ObjectId(webhook_id), "user_id": current_user["_id"]})
    if not wh:
        raise HTTPException(404, "Webhook not found")

    count = await dispatch_event(db, current_user["_id"], wh["event_type"], {
        "test": True,
        "message": "This is a test event from PDF Gyan",
        "webhook_id": webhook_id,
    })
    return {"status": "sent", "dispatched": count}


@user_router.get("/events")
async def list_events(current_user: dict = Depends(get_current_user)):
    """List all available event types."""
    return [
        {"type": "document.processed", "description": "When a PDF is indexed and ready for chat"},
        {"type": "document.failed", "description": "When document indexing fails"},
        {"type": "website.crawled", "description": "When a website crawl completes"},
        {"type": "chat.completed", "description": "When a chat response is fully generated"},
    ]
