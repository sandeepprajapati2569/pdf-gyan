from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from app.dependencies import get_current_user, get_user_db
from app.database import get_db as get_platform_db
from app.models.api_key import SettingsUpdate, SettingsResponse
from app.services.crypto_service import crypto_service
from app.services.usage_service import get_usage_summary

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/keys", response_model=SettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    return SettingsResponse(
        has_own_openai_key=bool(current_user.get("own_openai_key")),
        plan=current_user.get("plan", "free"),
        mode=current_user.get("mode", "public"),
        has_private_mongodb=bool(current_user.get("private_mongodb_url")),
    )


@router.put("/keys", response_model=SettingsResponse)
async def update_settings(
    data: SettingsUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_platform_db()  # User record always in platform DB
    update = {}

    if data.own_openai_key is not None:
        if data.own_openai_key == "":
            # Clear the key
            update["own_openai_key"] = None
        else:
            # Encrypt and store
            update["own_openai_key"] = crypto_service.encrypt(data.own_openai_key)

    # Handle mode switch
    if data.mode is not None:
        if data.mode == "private":
            # Require OpenAI key
            has_key = bool(update.get("own_openai_key")) or bool(current_user.get("own_openai_key"))
            if not has_key and data.own_openai_key != "":
                raise HTTPException(
                    status_code=400,
                    detail="OpenAI API key is required for private mode. Please add your key first.",
                )

            # Test connection before saving
            from app.services.private_db_service import test_private_connection
            private_mongodb_url = data.private_mongodb_url
            current_private_mongodb_url = current_user.get("private_mongodb_url")

            if not private_mongodb_url and current_private_mongodb_url:
                private_mongodb_url = crypto_service.decrypt(current_private_mongodb_url)

            if not private_mongodb_url:
                raise HTTPException(
                    status_code=400,
                    detail="MongoDB URL is required for private mode",
                )

            current_db_name = current_user.get("private_mongodb_db_name")
            db_name = data.private_mongodb_db_name or (
                crypto_service.decrypt(current_db_name) if current_db_name else "pdf_gyan"
            )

            ok = await test_private_connection(private_mongodb_url, db_name)
            if not ok:
                raise HTTPException(
                    status_code=400,
                    detail="Could not connect to the provided MongoDB URL. Please check your connection string.",
                )

            update["mode"] = "private"
            if data.private_mongodb_url is not None or data.private_mongodb_db_name is not None:
                update["private_mongodb_url"] = crypto_service.encrypt(private_mongodb_url)
                update["private_mongodb_db_name"] = crypto_service.encrypt(db_name)
            from datetime import datetime, timezone
            update["private_mode_activated_at"] = datetime.now(timezone.utc)

        elif data.mode == "public":
            update["mode"] = "public"
            # Keep credentials in case they switch back

    if update:
        await db.users.update_one(
            {"_id": ObjectId(current_user["_id"])},
            {"$set": update},
        )

    has_key = bool(update.get("own_openai_key")) if "own_openai_key" in update else bool(current_user.get("own_openai_key"))
    mode = update.get("mode", current_user.get("mode", "public"))
    has_private = bool(update.get("private_mongodb_url")) or bool(current_user.get("private_mongodb_url"))

    return SettingsResponse(
        has_own_openai_key=has_key,
        plan=current_user.get("plan", "free"),
        mode=mode,
        has_private_mongodb=has_private,
    )


@router.post("/test-connection")
async def test_connection(
    data: dict,
    current_user: dict = Depends(get_current_user),
):
    url = data.get("url", "")
    db_name = data.get("db_name", "pdf_gyan")
    if not url:
        raise HTTPException(status_code=400, detail="MongoDB URL is required")

    from app.services.private_db_service import test_private_connection
    ok = await test_private_connection(url, db_name)
    return {"success": ok}


@router.get("/usage")
async def get_usage(current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    return await get_usage_summary(db, current_user["_id"])
