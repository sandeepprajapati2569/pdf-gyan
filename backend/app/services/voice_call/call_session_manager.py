"""
Call Session Manager — MongoDB-backed session lifecycle management.

Handles creating, updating, and closing call sessions.
Stores conversation transcripts and call metadata for analytics.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def create_call_session(
    db: AsyncIOMotorDatabase,
    user_id: str,
    document_id: str,
    document_name: str,
    intro_message: str = "",
) -> dict:
    """Create a new call session in the database."""
    session = {
        "user_id": user_id,
        "document_id": document_id,
        "document_name": document_name,
        "status": "active",
        "intro_message": intro_message,
        "turns": [],
        "turn_count": 0,
        "total_duration_ms": 0,
        "avg_latency_ms": 0,
        "created_at": datetime.now(timezone.utc),
        "ended_at": None,
        "call_type": "voice",  # voice | embed
    }

    result = await db.call_sessions.insert_one(session)
    session["_id"] = str(result.inserted_id)
    return session


async def add_call_turn(
    db: AsyncIOMotorDatabase,
    session_id: str,
    user_text: str,
    assistant_text: str,
    stt_latency_ms: int = 0,
    llm_latency_ms: int = 0,
    tts_latency_ms: int = 0,
    total_latency_ms: int = 0,
) -> None:
    """Add a conversation turn to the call session."""
    turn = {
        "user_text": user_text,
        "assistant_text": assistant_text,
        "stt_latency_ms": stt_latency_ms,
        "llm_latency_ms": llm_latency_ms,
        "tts_latency_ms": tts_latency_ms,
        "total_latency_ms": total_latency_ms,
        "timestamp": datetime.now(timezone.utc),
    }

    await db.call_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {
            "$push": {"turns": turn},
            "$inc": {"turn_count": 1},
        },
    )


async def end_call_session(
    db: AsyncIOMotorDatabase,
    session_id: str,
    reason: str = "user_ended",
) -> None:
    """End a call session and calculate final metrics."""
    session = await db.call_sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        return

    # Calculate total duration and avg latency
    turns = session.get("turns", [])
    total_latency = sum(t.get("total_latency_ms", 0) for t in turns)
    avg_latency = total_latency // len(turns) if turns else 0

    # Calculate call duration
    created_at = session.get("created_at", datetime.now(timezone.utc))
    ended_at = datetime.now(timezone.utc)
    duration_ms = int((ended_at - created_at).total_seconds() * 1000)

    await db.call_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {
            "$set": {
                "status": "ended",
                "ended_at": ended_at,
                "end_reason": reason,
                "total_duration_ms": duration_ms,
                "avg_latency_ms": avg_latency,
            }
        },
    )


async def get_call_session(
    db: AsyncIOMotorDatabase,
    session_id: str,
    user_id: str,
) -> Optional[dict]:
    """Get a call session by ID."""
    session = await db.call_sessions.find_one({
        "_id": ObjectId(session_id),
        "user_id": user_id,
    })
    if session:
        session["_id"] = str(session["_id"])
    return session


async def get_call_history(
    db: AsyncIOMotorDatabase,
    user_id: str,
    document_id: Optional[str] = None,
    limit: int = 20,
) -> list:
    """Get call history for a user, optionally filtered by document."""
    query = {"user_id": user_id}
    if document_id:
        query["document_id"] = document_id

    cursor = db.call_sessions.find(
        query,
        {
            "turns": {"$slice": -1},
            "document_name": 1,
            "document_id": 1,
            "status": 1,
            "turn_count": 1,
            "total_duration_ms": 1,
            "avg_latency_ms": 1,
            "created_at": 1,
            "ended_at": 1,
        },
    ).sort("created_at", -1).limit(limit)

    sessions = []
    async for session in cursor:
        session["_id"] = str(session["_id"])
        sessions.append(session)
    return sessions


async def ensure_call_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes for call_sessions collection."""
    try:
        await db.call_sessions.create_index("user_id")
        await db.call_sessions.create_index([("user_id", 1), ("document_id", 1)])
        await db.call_sessions.create_index([("user_id", 1), ("status", 1)])
    except Exception as e:
        logger.warning(f"Could not create call session indexes: {e}")
