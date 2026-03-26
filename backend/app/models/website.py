"""Pydantic models for Website Crawl feature."""

from pydantic import BaseModel, Field
from typing import Optional


class WebsiteCrawlRequest(BaseModel):
    url: str = Field(..., description="Website URL to crawl")
    max_pages: int = Field(default=50, ge=1, le=2000)
    max_depth: int = Field(default=3, ge=1, le=5)
    include_patterns: Optional[list[str]] = None
    exclude_patterns: Optional[list[str]] = None


class PageUpdate(BaseModel):
    url: str
    included: bool


class UpdatePagesRequest(BaseModel):
    pages: list[PageUpdate]


class AddPageRequest(BaseModel):
    url: str


class BulkUpdateRequest(BaseModel):
    action: str = Field(..., pattern="^(include|exclude)$")
    category: Optional[str] = None
    status: Optional[str] = None
    urls: Optional[list[str]] = None


class CrawlMoreRequest(BaseModel):
    batch_size: int = Field(default=50, ge=10, le=200)
    category: Optional[str] = None
