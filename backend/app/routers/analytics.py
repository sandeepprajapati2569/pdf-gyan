"""
Analytics Router — aggregate stats from documents and conversations.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, get_user_db
from bson import ObjectId

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview(current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    user_id = current_user["_id"]

    # Total documents
    total_docs = await db.documents.count_documents({"user_id": user_id})
    total_websites = await db.websites.count_documents({"user_id": user_id})

    # Total conversations and messages
    pipeline_totals = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": None,
            "total_conversations": {"$sum": 1},
            "total_messages": {"$sum": {"$size": {"$ifNull": ["$messages", []]}}},
        }},
    ]
    totals_cursor = db.conversations.aggregate(pipeline_totals)
    totals = await totals_cursor.to_list(1)
    total_convs = totals[0]["total_conversations"] if totals else 0
    total_msgs = totals[0]["total_messages"] if totals else 0

    # Top 5 most-chatted documents
    pipeline_top_docs = [
        {"$match": {"user_id": user_id, "document_id": {"$exists": True}}},
        {"$group": {
            "_id": "$document_id",
            "conversation_count": {"$sum": 1},
            "message_count": {"$sum": {"$size": {"$ifNull": ["$messages", []]}}},
        }},
        {"$sort": {"conversation_count": -1}},
        {"$limit": 5},
    ]
    top_docs_cursor = db.conversations.aggregate(pipeline_top_docs)
    top_docs_raw = await top_docs_cursor.to_list(5)

    # Enrich with document names
    top_documents = []
    for item in top_docs_raw:
        doc = await db.documents.find_one({"_id": ObjectId(item["_id"])}, {"original_filename": 1})
        top_documents.append({
            "document_id": item["_id"],
            "name": doc.get("original_filename", "Unknown") if doc else "Deleted",
            "conversations": item["conversation_count"],
            "messages": item["message_count"],
        })

    # Activity over last 7 days
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    pipeline_activity = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": seven_days_ago}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    activity_cursor = db.conversations.aggregate(pipeline_activity)
    activity_raw = await activity_cursor.to_list(7)

    # Fill in missing days
    activity = []
    for i in range(7):
        day = (datetime.now(timezone.utc) - timedelta(days=6 - i)).strftime("%Y-%m-%d")
        found = next((a for a in activity_raw if a["_id"] == day), None)
        activity.append({"date": day, "conversations": found["count"] if found else 0})

    # Recent conversations
    recent_cursor = db.conversations.find(
        {"user_id": user_id},
        {"title": 1, "document_id": 1, "created_at": 1, "messages": {"$slice": -1}},
    ).sort("created_at", -1).limit(10)
    recent_convs = []
    async for conv in recent_cursor:
        recent_convs.append({
            "id": str(conv["_id"]),
            "title": conv.get("title", "Untitled"),
            "document_id": conv.get("document_id"),
            "created_at": conv.get("created_at"),
            "last_message_preview": (conv.get("messages", [{}])[-1].get("content", "")[:100] if conv.get("messages") else ""),
        })

    return {
        "total_documents": total_docs,
        "total_websites": total_websites,
        "total_conversations": total_convs,
        "total_messages": total_msgs,
        "avg_messages_per_conversation": round(total_msgs / max(total_convs, 1), 1),
        "top_documents": top_documents,
        "activity": activity,
        "recent_conversations": recent_convs,
    }
