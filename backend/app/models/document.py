from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    status: str  # processing, crawled, ready, failed
    page_count: Optional[int] = None
    error_message: Optional[str] = None
    source_type: str = "pdf"  # pdf | website
    source_url: Optional[str] = None
    tags: list[str] = []
    created_at: datetime


class DocumentDetailResponse(DocumentResponse):
    has_index: bool = False
    auto_summary: Optional[str] = None
    auto_faq: Optional[list[dict]] = None
