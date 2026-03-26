import fitz
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, BackgroundTasks, Query
from fastapi.responses import Response
from app.dependencies import get_current_user, get_user_db
from app.services.document_service import (
    upload_document,
    process_document,
    get_user_documents,
    get_document,
    delete_document,
)
from app.models.document import DocumentResponse, DocumentDetailResponse
from app.config import settings
from bson import ObjectId
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentResponse)
async def upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    # Read and validate size
    content = await file.read()
    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit",
        )

    mode = current_user.get("mode", "public")
    if mode == "public":
        if not settings.PLATFORM_OPENAI_KEY:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The platform OpenAI key is not configured right now. Please try again later.",
            )
    elif mode == "private":
        if not current_user.get("own_openai_key"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OpenAI API key is required for private mode. Please add your key in Settings.",
            )
        if not current_user.get("private_mongodb_url"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MongoDB is required for private mode. Please reconnect your database in Settings.",
            )
    elif mode == "local":
        if not current_user.get("private_mongodb_url"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MongoDB is required for local mode. Please reconnect your database in Settings.",
            )
        if not current_user.get("ollama_base_url") or not current_user.get("ollama_model"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ollama is required for local mode. Please finish local mode setup in Settings.",
            )

    db = await get_user_db(current_user)
    doc = await upload_document(db, current_user["_id"], content, file.filename)

    # Start background indexing — pass user so background task can re-acquire db
    background_tasks.add_task(process_document, db, doc["_id"], current_user)

    return DocumentResponse(
        id=str(doc["_id"]),
        filename=doc["filename"],
        original_filename=doc["original_filename"],
        status=doc["status"],
        page_count=doc.get("page_count"),
        created_at=doc["created_at"],
    )


@router.get("", response_model=List[DocumentResponse])
async def list_documents(current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    docs = await get_user_documents(db, current_user["_id"])
    return [
        DocumentResponse(
            id=str(doc["_id"]),
            filename=doc["filename"],
            original_filename=doc["original_filename"],
            status=doc["status"],
            page_count=doc.get("page_count"),
            error_message=doc.get("error_message"),
            source_type=doc.get("source_type", "pdf"),
            source_url=doc.get("source_url"),
            tags=doc.get("tags", []),
            created_at=doc["created_at"],
        )
        for doc in docs
    ]


@router.get("/{doc_id}", response_model=DocumentDetailResponse)
async def get_doc(doc_id: str, current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    doc = await get_document(db, doc_id, current_user["_id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentDetailResponse(
        id=str(doc["_id"]),
        filename=doc["filename"],
        original_filename=doc["original_filename"],
        status=doc["status"],
        page_count=doc.get("page_count"),
        error_message=doc.get("error_message"),
        source_type=doc.get("source_type", "pdf"),
        source_url=doc.get("source_url"),
        tags=doc.get("tags", []),
        has_index=doc["status"] == "ready",
        auto_summary=doc.get("auto_summary"),
        auto_faq=doc.get("auto_faq"),
        created_at=doc["created_at"],
    )


@router.delete("/{doc_id}")
async def delete_doc(doc_id: str, current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    success = await delete_document(db, doc_id, current_user["_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}


class UpdateTagsRequest(BaseModel):
    tags: list[str]


@router.patch("/{doc_id}/tags")
async def update_tags(
    doc_id: str,
    request: UpdateTagsRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update tags for a document."""
    db = await get_user_db(current_user)
    doc = await get_document(db, doc_id, current_user["_id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Normalize tags
    tags = list(set(t.strip().lower() for t in request.tags if t.strip()))[:20]

    await db.documents.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {"tags": tags}},
    )
    return {"tags": tags}


class PersonaRequest(BaseModel):
    name: str = "Document Reader"
    tone: str = "neutral"  # neutral, formal, friendly, technical, casual
    custom_instructions: str = ""


@router.put("/{doc_id}/persona")
async def update_persona(
    doc_id: str,
    request: PersonaRequest,
    current_user: dict = Depends(get_current_user),
):
    """Set custom AI persona for a document."""
    db = await get_user_db(current_user)
    doc = await get_document(db, doc_id, current_user["_id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    persona = {
        "name": request.name[:100],
        "tone": request.tone,
        "custom_instructions": request.custom_instructions[:500],
    }
    await db.documents.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {"persona": persona}},
    )
    return {"persona": persona}


@router.get("/{doc_id}/page/{page_num}")
async def get_page_image(
    doc_id: str,
    page_num: int,
    highlight: str = Query(None, description="Text to highlight on the page"),
    current_user: dict = Depends(get_current_user),
):
    """Render a PDF page as a PNG image with optional text highlighting."""
    db = await get_user_db(current_user)
    doc = await get_document(db, doc_id, current_user["_id"])
    if not doc:
        raise HTTPException(404, "Document not found")

    if doc.get("source_type") == "website":
        raise HTTPException(400, "Page images only available for PDF documents")

    file_path = doc.get("file_path", "")
    if not file_path or not file_path.endswith(".pdf"):
        raise HTTPException(400, "No PDF file available")

    try:
        pdf = fitz.open(file_path)
        if page_num < 1 or page_num > len(pdf):
            pdf.close()
            raise HTTPException(400, f"Page {page_num} not found (document has {len(pdf)} pages)")

        page = pdf[page_num - 1]  # 0-indexed

        # Draw highlight rectangles if text is provided
        if highlight and highlight.strip():
            highlight_text = highlight.strip()[:200]  # limit search text length
            rects = page.search_for(highlight_text)
            if not rects and len(highlight_text) > 40:
                # Try shorter snippet if full text not found
                rects = page.search_for(highlight_text[:40])
            for rect in rects:
                # Yellow semi-transparent highlight
                annot = page.add_highlight_annot(rect)
                annot.set_colors(stroke=(1, 0.9, 0))  # yellow
                annot.set_opacity(0.35)
                annot.update()

        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        pdf.close()

        cache = "no-cache" if highlight else "public, max-age=3600"
        return Response(content=img_bytes, media_type="image/png", headers={"Cache-Control": cache})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to render page: {str(e)}")
