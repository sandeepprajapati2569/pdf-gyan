from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.services.api_key_service import create_api_key, get_user_api_keys, delete_api_key
from app.models.api_key import ApiKeyCreate, ApiKeyResponse, ApiKeyCreatedResponse
from typing import List

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


@router.post("", response_model=ApiKeyCreatedResponse)
async def create_key(
    data: ApiKeyCreate,
    current_user: dict = Depends(get_current_user),
):
    key = await create_api_key(current_user["_id"], data.name)
    return ApiKeyCreatedResponse(
        id=key["_id"],
        name=key["name"],
        key_prefix=key["key_prefix"],
        raw_key=key["raw_key"],
        created_at=key["created_at"],
        is_active=True,
    )


@router.get("", response_model=List[ApiKeyResponse])
async def list_keys(current_user: dict = Depends(get_current_user)):
    keys = await get_user_api_keys(current_user["_id"])
    return [
        ApiKeyResponse(
            id=key["_id"],
            name=key["name"],
            key_prefix=key["key_prefix"],
            created_at=key["created_at"],
            last_used=key.get("last_used"),
            is_active=key.get("is_active", True),
        )
        for key in keys
    ]


@router.delete("/{key_id}")
async def remove_key(
    key_id: str,
    current_user: dict = Depends(get_current_user),
):
    success = await delete_api_key(key_id, current_user["_id"])
    if not success:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key deleted"}
