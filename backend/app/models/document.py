from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    status: str  # processing, ready, failed
    page_count: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime


class DocumentDetailResponse(DocumentResponse):
    has_index: bool = False
