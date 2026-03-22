from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.middleware.api_key_auth import get_api_key_user
from app.dependencies import get_user_db
from app.services.document_service import (
    upload_document,
    process_document,
    get_user_documents,
    get_document_with_tree,
)
from app.services.chat_service import chat_with_document
from app.models.conversation import ChatRequest
from app.config import settings

router = APIRouter(prefix="/api/v1", tags=["public-api"])


@router.post("/documents/upload")
async def api_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: dict = Depends(get_api_key_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    content = await file.read()
    max_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB limit",
        )

    db = await get_user_db(user)
    doc = await upload_document(db, user["_id"], content, file.filename)
    background_tasks.add_task(process_document, db, doc["_id"], user)

    return {
        "id": str(doc["_id"]),
        "filename": doc["original_filename"],
        "status": doc["status"],
        "page_count": doc.get("page_count"),
    }


@router.get("/documents")
async def api_list_documents(user: dict = Depends(get_api_key_user)):
    db = await get_user_db(user)
    docs = await get_user_documents(db, user["_id"])
    return [
        {
            "id": str(doc["_id"]),
            "filename": doc["original_filename"],
            "status": doc["status"],
            "page_count": doc.get("page_count"),
            "created_at": doc["created_at"].isoformat(),
        }
        for doc in docs
    ]


@router.post("/chat")
async def api_chat(
    request: ChatRequest,
    document_id: str,
    user: dict = Depends(get_api_key_user),
):
    db = await get_user_db(user)
    doc = await get_document_with_tree(db, document_id, user["_id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc["status"] != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Document not ready. Status: {doc['status']}",
        )

    # For API, collect full response (no streaming)
    import re
    full_response = ""
    conv_id = None
    async for chunk in chat_with_document(
        db=db,
        user=user,
        document=doc,
        message=request.message,
        conversation_id=request.conversation_id,
    ):
        # Filter out the conversation ID metadata
        if not chunk.startswith("\n\n<!--conv_id:"):
            full_response += chunk
        else:
            match = re.search(r"<!--conv_id:(.+?)-->", chunk)
            if match:
                conv_id = match.group(1)

    return {
        "response": full_response.strip(),
        "conversation_id": conv_id,
        "document_id": document_id,
    }
