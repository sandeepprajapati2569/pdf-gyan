from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, BackgroundTasks
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
from typing import List

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
        has_index=doc["status"] == "ready",
        created_at=doc["created_at"],
    )


@router.delete("/{doc_id}")
async def delete_doc(doc_id: str, current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    success = await delete_document(db, doc_id, current_user["_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}
