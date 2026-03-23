import logging
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone
from app.database import get_db
from app.models.user import (
    UserRegister, UserLogin, UserResponse, TokenResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.services.auth_service import (
    hash_password, verify_password, create_access_token,
    create_reset_token, verify_reset_token,
)
from app.services.email_service import send_reset_email
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
async def register(data: UserRegister):
    db = get_db()

    # Check if user exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    user_doc = {
        "name": data.name,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "plan": "free",
        "mode": "public",
        "own_openai_key": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_access_token(user_id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            name=data.name,
            email=data.email,
            plan="free",
            mode="public",
            has_own_openai_key=False,
            has_private_mongodb=False,
            created_at=user_doc["created_at"],
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": data.email})

    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = str(user["_id"])
    token = create_access_token(user_id)

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            name=user["name"],
            email=user["email"],
            plan=user.get("plan", "free"),
            mode=user.get("mode", "public"),
            has_own_openai_key=bool(user.get("own_openai_key")),
            has_private_mongodb=bool(user.get("private_mongodb_url")),
            created_at=user["created_at"],
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["_id"],
        name=current_user["name"],
        email=current_user["email"],
        plan=current_user.get("plan", "free"),
        mode=current_user.get("mode", "public"),
        has_own_openai_key=bool(current_user.get("own_openai_key")),
        has_private_mongodb=bool(current_user.get("private_mongodb_url")),
        created_at=current_user["created_at"],
    )


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Send a password reset email. Always returns success to prevent email enumeration."""
    db = get_db()
    user = await db.users.find_one({"email": data.email})

    if user:
        token = create_reset_token(str(user["_id"]))
        try:
            await send_reset_email(
                to_email=data.email,
                user_name=user.get("name", "there"),
                reset_token=token,
            )
        except Exception as e:
            logger.error(f"Failed to send reset email: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not send reset email. Please try again later.",
            )

    # Always return success to prevent email enumeration
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Reset the user's password using the token from the email."""
    user_id = verify_reset_token(data.token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    if len(data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters.",
        )

    db = get_db()
    from bson import ObjectId
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password_hash": hash_password(data.password)}},
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return {"message": "Password reset successfully. You can now sign in."}
