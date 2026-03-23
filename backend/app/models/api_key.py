from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ApiKeyCreate(BaseModel):
    name: str


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str  # first 8 chars for identification
    created_at: datetime
    last_used: Optional[datetime] = None
    is_active: bool = True


class ApiKeyCreatedResponse(ApiKeyResponse):
    raw_key: str  # shown only once at creation


class SettingsUpdate(BaseModel):
    own_openai_key: Optional[str] = None
    mode: Optional[str] = None  # "public", "private", or "local"
    private_mongodb_url: Optional[str] = None
    private_mongodb_db_name: Optional[str] = None
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None


class SettingsResponse(BaseModel):
    has_own_openai_key: bool = False
    plan: str = "free"
    mode: str = "public"
    has_private_mongodb: bool = False
    has_ollama_config: bool = False
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None
