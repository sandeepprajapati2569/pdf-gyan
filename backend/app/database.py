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
        # Voice call indexes
        await db.call_sessions.create_index("user_id")
        await db.call_sessions.create_index([("user_id", 1), ("document_id", 1)])
        await db.call_sessions.create_index([("user_id", 1), ("status", 1)])
        # Bookmarks
        await db.bookmarks.create_index([("user_id", 1), ("document_id", 1)])
        # Website pages (scalable crawl)
        await db.website_pages.create_index([("doc_id", 1), ("status", 1)])
        await db.website_pages.create_index([("doc_id", 1), ("category", 1)])
        await db.website_pages.create_index([("doc_id", 1), ("url", 1)], unique=True)
        await db.website_pages.create_index([("doc_id", 1), ("included", 1)])
        # Webhooks
        await db.webhooks.create_index([("user_id", 1), ("event_type", 1)])
        await db.webhook_logs.create_index([("webhook_id", 1), ("created_at", -1)])
        # Shared files (Sharespace)
        await db.shared_files.create_index("share_token", unique=True)
        await db.shared_files.create_index("expires_at", expireAfterSeconds=0)
        await db.shared_files.create_index([("owner_id", 1), ("file_id", 1)])
        await db.shared_files.create_index([("owner_id", 1), ("is_active", 1)])
        await db.share_verifications.create_index([("share_token", 1), ("email", 1)])
        await db.share_verifications.create_index("session_token")
        await db.share_access_log.create_index([("email", 1), ("share_token", 1)])
        # Workspace files + folders
        await db.workspace_files.create_index([("user_id", 1), ("status", 1)])
        await db.workspace_files.create_index([("user_id", 1), ("file_type", 1)])
        await db.workspace_files.create_index([("user_id", 1), ("folder_id", 1)])
        await db.workspace_folders.create_index([("user_id", 1), ("parent_id", 1)])
        await db.workspace_conversations.create_index([("user_id", 1)])
        # Teams
        await db.teams.create_index("owner_id")
        await db.team_members.create_index([("team_id", 1), ("user_id", 1)])
        await db.team_members.create_index("email")
        # Shared conversations
        await db.shared_conversations.create_index("share_token", unique=True)
        await db.shared_conversations.create_index("expires_at", expireAfterSeconds=0)
        # Website crawl index
        await db.documents.create_index([("user_id", 1), ("source_type", 1)])
        # Embed token indexes
        await db.embed_tokens.create_index("token_hash", unique=True)
        await db.embed_tokens.create_index("user_id")
    except Exception as e:
        import logging
        logging.warning(f"Could not create indexes on startup: {e}")


async def close_db():
    global client
    if client:
        client.close()


def get_db() -> AsyncIOMotorDatabase:
    return db
