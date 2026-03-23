from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

client: AsyncIOMotorClient = None
db: AsyncIOMotorDatabase = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    # Create indexes (non-blocking — app starts even if DB is temporarily unavailable)
    try:
        await db.users.create_index("email", unique=True)
        await db.email_verifications.create_index(
            [("email", 1), ("purpose", 1)],
            unique=True,
        )
        await db.email_verifications.create_index("expires_at", expireAfterSeconds=0)
        await db.documents.create_index("user_id")
        await db.documents.create_index([("user_id", 1), ("status", 1)])
        await db.conversations.create_index([("user_id", 1), ("document_id", 1)])
        await db.conversations.create_index([("user_id", 1), ("document_ids", 1)])
        await db.api_keys.create_index("key_hash", unique=True)
        await db.api_keys.create_index("user_id")
        await db.usage_logs.create_index([("user_id", 1), ("created_at", -1)])
    except Exception as e:
        import logging
        logging.warning(f"Could not create indexes on startup: {e}")


async def close_db():
    global client
    if client:
        client.close()


def get_db() -> AsyncIOMotorDatabase:
    return db
