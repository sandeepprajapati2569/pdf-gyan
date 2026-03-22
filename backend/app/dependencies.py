from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database import get_db
from app.services.auth_service import verify_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    db = get_db()
    from bson import ObjectId

    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    user["_id"] = str(user["_id"])
    return user


async def get_user_db(user: dict) -> AsyncIOMotorDatabase:
    """Returns the correct database for this user based on their mode."""
    if user.get("mode") == "private" and user.get("private_mongodb_url"):
        try:
            from app.services.private_db_service import get_private_db
            return await get_private_db(user)
        except Exception:
            raise HTTPException(
                status_code=503,
                detail="Could not connect to your private database. Please check your MongoDB settings.",
            )
    return get_db()
