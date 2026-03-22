import secrets
import hashlib
from datetime import datetime, timezone
from bson import ObjectId
from app.database import get_db


def generate_api_key() -> tuple[str, str]:
    """Returns (raw_key, key_hash). Raw key shown once; hash stored in DB."""
    raw_key = "pgyan_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    return raw_key, key_hash


async def create_api_key(user_id: str, name: str) -> dict:
    db = get_db()
    raw_key, key_hash = generate_api_key()

    api_key_doc = {
        "user_id": user_id,
        "name": name,
        "key_hash": key_hash,
        "key_prefix": raw_key[:12],
        "created_at": datetime.now(timezone.utc),
        "last_used": None,
        "is_active": True,
    }
    result = await db.api_keys.insert_one(api_key_doc)
    api_key_doc["_id"] = str(result.inserted_id)
    api_key_doc["raw_key"] = raw_key
    return api_key_doc


async def get_user_api_keys(user_id: str) -> list:
    db = get_db()
    cursor = db.api_keys.find({"user_id": user_id}).sort("created_at", -1)
    keys = []
    async for key in cursor:
        key["_id"] = str(key["_id"])
        keys.append(key)
    return keys


async def delete_api_key(key_id: str, user_id: str) -> bool:
    db = get_db()
    result = await db.api_keys.delete_one(
        {"_id": ObjectId(key_id), "user_id": user_id}
    )
    return result.deleted_count > 0


async def validate_api_key(raw_key: str) -> dict | None:
    """Validate an API key and return the associated user."""
    db = get_db()
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    api_key = await db.api_keys.find_one({"key_hash": key_hash, "is_active": True})

    if not api_key:
        return None

    # Update last used
    await db.api_keys.update_one(
        {"_id": api_key["_id"]},
        {"$set": {"last_used": datetime.now(timezone.utc)}},
    )

    # Get user
    user = await db.users.find_one({"_id": ObjectId(api_key["user_id"])})
    if user:
        user["_id"] = str(user["_id"])
    return user
