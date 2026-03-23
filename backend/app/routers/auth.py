import logging
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.config import settings
from app.models.user import (
    UserRegister, UserLogin, UserResponse, TokenResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
    SignupOtpSendRequest, SignupOtpVerifyRequest,
    SignupOtpSendResponse, SignupOtpVerifyResponse,
)
from app.services.auth_service import (
    hash_password, verify_password, create_access_token,
    create_reset_token, verify_reset_token,
    generate_signup_otp, hash_signup_otp,
    create_signup_verification_token, verify_signup_verification_token,
)
from app.services.email_service import send_reset_email, send_signup_otp_email
from app.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _coerce_utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.post("/register/send-otp", response_model=SignupOtpSendResponse)
async def send_signup_otp(data: SignupOtpSendRequest):
    db = get_db()
    normalized_email = _normalize_email(data.email)

    existing = await db.users.find_one({"email": normalized_email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    now = datetime.now(timezone.utc)
    verification = await db.email_verifications.find_one(
        {"email": normalized_email, "purpose": "signup"}
    )

    last_sent_at = _coerce_utc_datetime(verification.get("last_sent_at")) if verification else None
    if last_sent_at:
        next_allowed_at = last_sent_at + timedelta(
            seconds=settings.SIGNUP_OTP_RESEND_COOLDOWN_SECONDS
        )
        if next_allowed_at > now:
            wait_seconds = max(1, int((next_allowed_at - now).total_seconds()))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {wait_seconds} seconds before requesting a new code.",
            )

    otp = generate_signup_otp()
    expires_at = now + timedelta(minutes=settings.SIGNUP_OTP_EXPIRE_MINUTES)

    await db.email_verifications.update_one(
        {"email": normalized_email, "purpose": "signup"},
        {
            "$set": {
                "email": normalized_email,
                "name": data.name.strip() if data.name else None,
                "purpose": "signup",
                "otp_hash": hash_signup_otp(otp),
                "attempts": 0,
                "verified_at": None,
                "updated_at": now,
                "last_sent_at": now,
                "expires_at": expires_at,
            },
            "$setOnInsert": {
                "created_at": now,
            },
        },
        upsert=True,
    )

    try:
        await send_signup_otp_email(
            to_email=normalized_email,
            user_name=data.name or "there",
            otp=otp,
        )
    except Exception as e:
        logger.error(f"Failed to send signup OTP email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not send verification code. Please try again later.",
        )

    return SignupOtpSendResponse(
        message="Verification code sent successfully.",
        expires_in_minutes=settings.SIGNUP_OTP_EXPIRE_MINUTES,
    )


@router.post("/register/verify-otp", response_model=SignupOtpVerifyResponse)
async def verify_signup_otp(data: SignupOtpVerifyRequest):
    db = get_db()
    normalized_email = _normalize_email(data.email)
    now = datetime.now(timezone.utc)

    verification = await db.email_verifications.find_one(
        {"email": normalized_email, "purpose": "signup"}
    )

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please request a verification code first.",
        )

    expires_at = _coerce_utc_datetime(verification.get("expires_at"))
    if expires_at and expires_at < now:
        await db.email_verifications.delete_one({"_id": verification["_id"]})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification code has expired. Please request a new one.",
        )

    if verification.get("attempts", 0) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invalid attempts. Please request a new code.",
        )

    otp = data.otp.strip()
    if hash_signup_otp(otp) != verification.get("otp_hash"):
        await db.email_verifications.update_one(
            {"_id": verification["_id"]},
            {"$inc": {"attempts": 1}, "$set": {"updated_at": now}},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code.",
        )

    await db.email_verifications.update_one(
        {"_id": verification["_id"]},
        {
            "$set": {
                "verified_at": now,
                "updated_at": now,
                "otp_hash": None,
                "attempts": 0,
            }
        },
    )

    verification_token = create_signup_verification_token(normalized_email)
    return SignupOtpVerifyResponse(
        message="Email verified successfully.",
        verification_token=verification_token,
    )


@router.post("/register", response_model=TokenResponse)
async def register(data: UserRegister):
    db = get_db()
    normalized_email = _normalize_email(data.email)
    verified_email = verify_signup_verification_token(data.verification_token)

    if verified_email != normalized_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify your email before creating an account.",
        )

    # Check if user exists
    existing = await db.users.find_one({"email": normalized_email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    user_doc = {
        "name": data.name,
        "email": normalized_email,
        "password_hash": hash_password(data.password),
        "plan": "free",
        "mode": "public",
        "own_openai_key": None,
        "email_verified_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    await db.email_verifications.delete_many({"email": normalized_email, "purpose": "signup"})

    token = create_access_token(user_id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            name=data.name,
            email=normalized_email,
            plan="free",
            mode="public",
            has_own_openai_key=False,
            has_private_mongodb=False,
            has_ollama_config=False,
            created_at=user_doc["created_at"],
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    db = get_db()
    normalized_email = _normalize_email(data.email)
    user = await db.users.find_one({"email": normalized_email})

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
            has_ollama_config=bool(user.get("ollama_base_url") and user.get("ollama_model")),
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
        has_ollama_config=bool(current_user.get("ollama_base_url") and current_user.get("ollama_model")),
        created_at=current_user["created_at"],
    )


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Send a password reset email. Always returns success to prevent email enumeration."""
    db = get_db()
    normalized_email = _normalize_email(data.email)
    user = await db.users.find_one({"email": normalized_email})

    if user:
        token = create_reset_token(str(user["_id"]))
        try:
            await send_reset_email(
                to_email=normalized_email,
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
