"""
Embed Token Service for the embeddable voice call widget.

Generates short-lived tokens that third-party websites use to
authenticate their embedded call widgets. Tokens are scoped to
a specific document and user.
"""

import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Embed token TTL (24 hours by default, configurable per token)
DEFAULT_EMBED_TOKEN_TTL_HOURS = 24


async def create_embed_token(
    db: AsyncIOMotorDatabase,
    user_id: str,
    document_id: str,
    allowed_origins: list[str] = None,
    ttl_hours: int = DEFAULT_EMBED_TOKEN_TTL_HOURS,
    custom_intro: str = "",
    custom_voice: str = "",
    widget_type: str = "call",
) -> dict:
    """
    Create an embed token for the voice call widget.

    Args:
        db: Database instance
        user_id: Owner user ID
        document_id: Document to scope the token to
        allowed_origins: List of allowed origins (CORS). Empty = all origins.
        ttl_hours: Token validity duration in hours
        custom_intro: Custom intro message for the widget
        custom_voice: Custom voice preset

    Returns:
        Token document with the raw token (only shown once)
    """
    prefix = "pgchat" if widget_type == "chat" else "pgcall"
    raw_token = f"{prefix}_{secrets.token_urlsafe(32)}"
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    token_doc = {
        "user_id": user_id,
        "document_id": document_id,
        "token_hash": token_hash,
        "token_prefix": raw_token[:12],
        "widget_type": widget_type,
        "allowed_origins": allowed_origins or [],
        "custom_intro": custom_intro,
        "custom_voice": custom_voice,
        "is_active": True,
        "usage_count": 0,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
        "last_used": None,
    }

    result = await db.embed_tokens.insert_one(token_doc)
    token_doc["_id"] = str(result.inserted_id)
    token_doc["raw_token"] = raw_token  # Only returned on creation

    return token_doc


async def validate_embed_token(
    db: AsyncIOMotorDatabase,
    raw_token: str,
    origin: str = "",
) -> Optional[dict]:
    """
    Validate an embed token and return the associated user + document info.

    Returns None if token is invalid, expired, or revoked.
    """
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    token_doc = await db.embed_tokens.find_one({
        "token_hash": token_hash,
        "is_active": True,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    })

    if not token_doc:
        return None

    # Check origin if origins are restricted
    allowed = token_doc.get("allowed_origins", [])
    if allowed and origin and origin not in allowed:
        logger.warning(f"Embed token origin mismatch: {origin} not in {allowed}")
        return None

    # Update usage stats
    await db.embed_tokens.update_one(
        {"_id": token_doc["_id"]},
        {
            "$inc": {"usage_count": 1},
            "$set": {"last_used": datetime.now(timezone.utc)},
        },
    )

    # Load the user
    user = await db.users.find_one({"_id": ObjectId(token_doc["user_id"])})
    if not user:
        return None

    user["_id"] = str(user["_id"])

    return {
        "user": user,
        "document_id": token_doc["document_id"],
        "custom_intro": token_doc.get("custom_intro", ""),
        "custom_voice": token_doc.get("custom_voice", ""),
        "token_id": str(token_doc["_id"]),
    }


async def list_embed_tokens(
    db: AsyncIOMotorDatabase,
    user_id: str,
) -> list:
    """List all embed tokens for a user."""
    cursor = db.embed_tokens.find(
        {"user_id": user_id},
        {"token_hash": 0},  # Don't expose hash
    ).sort("created_at", -1)

    tokens = []
    async for token in cursor:
        token["_id"] = str(token["_id"])
        expires_at = token.get("expires_at")
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        token["is_expired"] = (expires_at or datetime.min.replace(tzinfo=timezone.utc)) < datetime.now(timezone.utc)
        tokens.append(token)
    return tokens


async def revoke_embed_token(
    db: AsyncIOMotorDatabase,
    token_id: str,
    user_id: str,
) -> bool:
    """Revoke an embed token."""
    result = await db.embed_tokens.update_one(
        {"_id": ObjectId(token_id), "user_id": user_id},
        {"$set": {"is_active": False}},
    )
    return result.modified_count > 0


async def ensure_embed_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes for embed_tokens collection."""
    try:
        await db.embed_tokens.create_index("token_hash", unique=True)
        await db.embed_tokens.create_index("user_id")
        await db.embed_tokens.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning(f"Could not create embed token indexes: {e}")
