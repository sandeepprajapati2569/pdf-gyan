from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ChatMessage(BaseModel):
    role: str  # user, assistant
    content: str
    timestamp: Optional[datetime] = None


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class MultiChatRequest(BaseModel):
    document_ids: List[str]
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    conversation_id: str
    sources: Optional[List[str]] = None


class ConversationResponse(BaseModel):
    id: str
    document_id: Optional[str] = None
    document_ids: Optional[List[str]] = None
    title: str
    messages: List[ChatMessage]
    created_at: datetime
