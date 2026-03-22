import time
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.services.crypto_service import crypto_service

# Cache: user_id -> (client, db, last_access_time)
_private_clients: dict[str, tuple[AsyncIOMotorClient, AsyncIOMotorDatabase, float]] = {}
_lock = asyncio.Lock()

MAX_CACHED_CONNECTIONS = 50
CONNECTION_TTL_SECONDS = 1800  # 30 minutes idle


async def get_private_db(user: dict) -> AsyncIOMotorDatabase:
    """Return a Motor db for a private-mode user. Caches clients by user_id."""
    user_id = str(user["_id"])

    async with _lock:
        if user_id in _private_clients:
            client, db, _ = _private_clients[user_id]
            _private_clients[user_id] = (client, db, time.time())
            return db

        # Evict stale connections if at capacity
        if len(_private_clients) >= MAX_CACHED_CONNECTIONS:
            await _evict_stale()

        url = crypto_service.decrypt(user["private_mongodb_url"])
        db_name = crypto_service.decrypt(user["private_mongodb_db_name"])
        client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        _private_clients[user_id] = (client, db, time.time())
        return db


async def _evict_stale():
    """Remove connections idle beyond TTL, or oldest if still at capacity."""
    now = time.time()
    to_remove = [uid for uid, (_, _, t) in _private_clients.items()
                 if now - t > CONNECTION_TTL_SECONDS]
    for uid in to_remove:
        client, _, _ = _private_clients.pop(uid)
        client.close()

    # If still at capacity, remove oldest
    if len(_private_clients) >= MAX_CACHED_CONNECTIONS:
        oldest_uid = min(_private_clients, key=lambda k: _private_clients[k][2])
        client, _, _ = _private_clients.pop(oldest_uid)
        client.close()


async def test_private_connection(url: str, db_name: str) -> bool:
    """Test if a MongoDB connection string works. Used during setup."""
    try:
        client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
        await client[db_name].command("ping")
        client.close()
        return True
    except Exception:
        return False


async def close_all_private_clients():
    """Called during app shutdown."""
    for uid, (client, _, _) in _private_clients.items():
        client.close()
    _private_clients.clear()
