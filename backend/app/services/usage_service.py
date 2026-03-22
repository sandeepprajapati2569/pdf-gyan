from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase


async def get_usage_summary(db: AsyncIOMotorDatabase, user_id: str, days: int = 30) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": since}}},
        {
            "$group": {
                "_id": None,
                "total_tokens": {"$sum": "$total_tokens"},
                "total_requests": {"$sum": 1},
                "prompt_tokens": {"$sum": "$prompt_tokens"},
                "completion_tokens": {"$sum": "$completion_tokens"},
            }
        },
    ]

    result = await db.usage_logs.aggregate(pipeline).to_list(1)
    if result:
        return {
            "total_tokens": result[0]["total_tokens"],
            "total_requests": result[0]["total_requests"],
            "prompt_tokens": result[0]["prompt_tokens"],
            "completion_tokens": result[0]["completion_tokens"],
            "period_days": days,
        }
    return {
        "total_tokens": 0,
        "total_requests": 0,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "period_days": days,
    }
