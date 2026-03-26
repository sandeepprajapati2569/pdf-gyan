"""Pydantic models for Voice Call with Document feature."""

from pydantic import BaseModel, Field
from typing import Optional


class StartCallRequest(BaseModel):
    document_id: str
    intro_message: Optional[str] = ""


class CreateEmbedTokenRequest(BaseModel):
    document_id: Optional[str] = None  # single doc (backward compat)
    document_ids: Optional[list[str]] = None  # multiple docs
    widget_type: str = "call"  # "chat" | "call"
    allowed_origins: list[str] = Field(default_factory=list)
    ttl_hours: int = Field(default=24, ge=1, le=720)  # max 30 days
    custom_intro: str = ""
    custom_voice: str = ""


class RevokeEmbedTokenRequest(BaseModel):
    token_id: str
