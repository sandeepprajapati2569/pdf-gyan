from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.database import get_db as get_platform_db
from app.dependencies import get_current_user, get_user_db
from app.models.api_key import SettingsResponse, SettingsUpdate
from app.services.crypto_service import crypto_service
from app.services.ollama_service import (
    normalize_ollama_base_url,
    normalize_ollama_model,
    validate_ollama_configuration,
)
from app.services.private_db_service import reset_private_db, test_private_connection
from app.services.usage_service import get_usage_summary

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _has_ollama_config(user: dict, update: dict | None = None) -> bool:
    source = update or {}
    base_url = source.get("ollama_base_url", user.get("ollama_base_url"))
    model = source.get("ollama_model", user.get("ollama_model"))
    return bool(base_url and model)


def _current_ollama_base_url(user: dict) -> str:
    return normalize_ollama_base_url(user.get("ollama_base_url"))


def _current_ollama_model(user: dict) -> str:
    return normalize_ollama_model(user.get("ollama_model"))


def _resolve_private_mongodb_url(data: SettingsUpdate, current_user: dict) -> str | None:
    if data.private_mongodb_url:
        return data.private_mongodb_url

    current_private_mongodb_url = current_user.get("private_mongodb_url")
    if current_private_mongodb_url:
        return crypto_service.decrypt(current_private_mongodb_url)
    return None


def _resolve_private_db_name(data: SettingsUpdate, current_user: dict) -> str:
    if data.private_mongodb_db_name:
        return data.private_mongodb_db_name

    current_db_name = current_user.get("private_mongodb_db_name")
    if current_db_name:
        return crypto_service.decrypt(current_db_name)
    return "pdf_gyan"


@router.get("/keys", response_model=SettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    return SettingsResponse(
        has_own_openai_key=bool(current_user.get("own_openai_key")),
        plan=current_user.get("plan", "free"),
        mode=current_user.get("mode", "public"),
        has_private_mongodb=bool(current_user.get("private_mongodb_url")),
        has_ollama_config=_has_ollama_config(current_user),
        ollama_base_url=_current_ollama_base_url(current_user),
        ollama_model=_current_ollama_model(current_user),
    )


@router.put("/keys", response_model=SettingsResponse)
async def update_settings(
    data: SettingsUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_platform_db()  # User record always in platform DB
    update = {}
    mongo_settings_changed = False

    if data.own_openai_key is not None:
        if data.own_openai_key == "":
            update["own_openai_key"] = None
        else:
            update["own_openai_key"] = crypto_service.encrypt(data.own_openai_key)

    if data.mode is not None:
        if data.mode == "private":
            has_key = bool(update.get("own_openai_key")) or bool(current_user.get("own_openai_key"))
            if not has_key and data.own_openai_key != "":
                raise HTTPException(
                    status_code=400,
                    detail="OpenAI API key is required for private mode. Please add your key first.",
                )

            private_mongodb_url = _resolve_private_mongodb_url(data, current_user)
            if not private_mongodb_url:
                raise HTTPException(
                    status_code=400,
                    detail="MongoDB URL is required for private mode",
                )

            db_name = _resolve_private_db_name(data, current_user)
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
                mongo_settings_changed = True
            update["private_mode_activated_at"] = datetime.now(timezone.utc)

        elif data.mode == "local":
            private_mongodb_url = _resolve_private_mongodb_url(data, current_user)
            if not private_mongodb_url:
                raise HTTPException(
                    status_code=400,
                    detail="MongoDB URL is required for local mode",
                )

            db_name = _resolve_private_db_name(data, current_user)
            mongo_ok = await test_private_connection(private_mongodb_url, db_name)
            if not mongo_ok:
                raise HTTPException(
                    status_code=400,
                    detail="Could not connect to the provided MongoDB URL. Please check your connection string.",
                )

            ollama_base_url = data.ollama_base_url or current_user.get(
                "ollama_base_url"
            )
            ollama_model = data.ollama_model or current_user.get(
                "ollama_model"
            )

            try:
                normalized_base_url, normalized_model = await validate_ollama_configuration(
                    ollama_base_url or settings.DEFAULT_OLLAMA_BASE_URL,
                    ollama_model or settings.DEFAULT_OLLAMA_MODEL,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

            update["mode"] = "local"
            update["ollama_base_url"] = normalized_base_url
            update["ollama_model"] = normalized_model
            update["local_mode_activated_at"] = datetime.now(timezone.utc)

            if data.private_mongodb_url is not None or data.private_mongodb_db_name is not None:
                update["private_mongodb_url"] = crypto_service.encrypt(private_mongodb_url)
                update["private_mongodb_db_name"] = crypto_service.encrypt(db_name)
                mongo_settings_changed = True

        elif data.mode == "public":
            update["mode"] = "public"
        else:
            raise HTTPException(status_code=400, detail="Unsupported mode")

    if update:
        await db.users.update_one(
            {"_id": ObjectId(current_user["_id"])},
            {"$set": update},
        )
        if mongo_settings_changed:
            await reset_private_db(current_user["_id"])

    has_key = bool(update.get("own_openai_key")) if "own_openai_key" in update else bool(current_user.get("own_openai_key"))
    mode = update.get("mode", current_user.get("mode", "public"))
    has_private = bool(update.get("private_mongodb_url")) or bool(current_user.get("private_mongodb_url"))
    has_ollama = _has_ollama_config(current_user, update)
    ollama_base_url = update.get("ollama_base_url", _current_ollama_base_url(current_user))
    ollama_model = update.get("ollama_model", _current_ollama_model(current_user))

    return SettingsResponse(
        has_own_openai_key=has_key,
        plan=current_user.get("plan", "free"),
        mode=mode,
        has_private_mongodb=has_private,
        has_ollama_config=has_ollama,
        ollama_base_url=ollama_base_url,
        ollama_model=ollama_model,
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

    ok = await test_private_connection(url, db_name)
    return {"success": ok}


@router.get("/usage")
async def get_usage(current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    return await get_usage_summary(db, current_user["_id"])
