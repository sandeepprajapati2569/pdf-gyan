"""
Webhook Service — register, dispatch, and log webhook events.

Supported events:
- document.processed — PDF indexed and ready
- document.failed — indexing failed
- website.crawled — website crawl complete
- chat.completed — chat response generated
"""

import hashlib
import hmac
import json
import logging
import secrets
import time
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

VALID_EVENTS = (
    "document.processed",
    "document.failed",
    "website.crawled",
    "chat.completed",
)
MAX_RETRIES = 3


async def register_webhook(
    db: AsyncIOMotorDatabase, user_id: str,
    event_type: str, url: str, secret: str = None,
) -> dict:
    """Register a new webhook endpoint."""
    if event_type not in VALID_EVENTS:
        raise ValueError(f"Invalid event type. Must be one of: {', '.join(VALID_EVENTS)}")

    if not secret:
        secret = secrets.token_hex(32)

    webhook = {
        "user_id": user_id,
        "event_type": event_type,
        "url": url.strip(),
        "secret": secret,
        "active": True,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.webhooks.insert_one(webhook)
    return {
        "id": str(result.inserted_id),
        "event_type": event_type,
        "url": url,
        "secret": secret,
        "active": True,
        "created_at": webhook["created_at"],
    }


async def list_webhooks(db: AsyncIOMotorDatabase, user_id: str) -> list[dict]:
    """List all webhooks for a user."""
    webhooks = []
    async for wh in db.webhooks.find({"user_id": user_id}).sort("created_at", -1):
        webhooks.append({
            "id": str(wh["_id"]),
            "event_type": wh["event_type"],
            "url": wh["url"],
            "active": wh.get("active", True),
            "created_at": wh.get("created_at"),
        })
    return webhooks


async def delete_webhook(db: AsyncIOMotorDatabase, user_id: str, webhook_id: str) -> bool:
    """Delete a webhook."""
    result = await db.webhooks.delete_one({"_id": ObjectId(webhook_id), "user_id": user_id})
    return result.deleted_count > 0


async def toggle_webhook(db: AsyncIOMotorDatabase, user_id: str, webhook_id: str, active: bool) -> bool:
    result = await db.webhooks.update_one(
        {"_id": ObjectId(webhook_id), "user_id": user_id},
        {"$set": {"active": active}},
    )
    return result.modified_count > 0


async def get_webhook_logs(db: AsyncIOMotorDatabase, webhook_id: str, limit: int = 20) -> list[dict]:
    """Get delivery logs for a webhook."""
    logs = []
    async for log in db.webhook_logs.find(
        {"webhook_id": webhook_id}
    ).sort("created_at", -1).limit(limit):
        logs.append({
            "id": str(log["_id"]),
            "event_type": log["event_type"],
            "status_code": log.get("status_code"),
            "response_time_ms": log.get("response_time_ms"),
            "attempt": log.get("attempt", 1),
            "error": log.get("error"),
            "created_at": log.get("created_at"),
        })
    return logs


def _sign_payload(payload: str, secret: str) -> str:
    """Create HMAC-SHA256 signature."""
    return "sha256=" + hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


async def dispatch_event(
    db: AsyncIOMotorDatabase, user_id: str,
    event_type: str, data: dict,
) -> int:
    """Fire all active webhooks matching this event for this user. Returns count dispatched."""
    import httpx

    webhooks = []
    async for wh in db.webhooks.find({
        "user_id": user_id,
        "event_type": event_type,
        "active": True,
    }):
        webhooks.append(wh)

    if not webhooks:
        return 0

    payload = json.dumps({
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }, default=str)

    dispatched = 0

    async with httpx.AsyncClient(timeout=10) as client:
        for wh in webhooks:
            webhook_id = str(wh["_id"])
            signature = _sign_payload(payload, wh.get("secret", ""))

            for attempt in range(1, MAX_RETRIES + 1):
                start = time.time()
                status_code = None
                error_msg = None

                try:
                    resp = await client.post(
                        wh["url"],
                        content=payload,
                        headers={
                            "Content-Type": "application/json",
                            "X-Webhook-Signature": signature,
                            "X-Webhook-Event": event_type,
                        },
                    )
                    status_code = resp.status_code
                    if 200 <= status_code < 300:
                        dispatched += 1
                        break  # Success, no retry
                    error_msg = f"HTTP {status_code}"
                except Exception as e:
                    error_msg = str(e)[:200]

                elapsed = int((time.time() - start) * 1000)

                # Log this attempt
                await db.webhook_logs.insert_one({
                    "webhook_id": webhook_id,
                    "event_type": event_type,
                    "status_code": status_code,
                    "response_time_ms": elapsed,
                    "attempt": attempt,
                    "error": error_msg,
                    "created_at": datetime.now(timezone.utc),
                })

                if attempt < MAX_RETRIES:
                    import asyncio
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff

            logger.info(f"[Webhook] Dispatched {event_type} to {wh['url']} (status={status_code})")

    return dispatched
