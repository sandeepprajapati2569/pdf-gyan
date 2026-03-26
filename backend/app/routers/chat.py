from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response, StreamingResponse
from app.dependencies import get_current_user, get_user_db
from app.services.document_service import get_document_with_tree
from app.services.chat_service import (
    chat_with_document,
    chat_with_multiple_documents,
    get_conversations,
    get_multi_conversations,
    get_conversation,
)
from app.models.conversation import ChatRequest, MultiChatRequest, TtsRequest, ConversationResponse, ChatMessage
from app.services.tts_service import TTSUnavailableError, create_openai_speech
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _format_sse_data(chunk: str) -> str:
    normalized = chunk.replace("\r\n", "\n").replace("\r", "\n")
    return "".join(f"data: {line}\n" for line in normalized.split("\n")) + "\n"


@router.post("/tts")
async def create_tts_audio(
    request: TtsRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        audio_bytes = await create_openai_speech(current_user, request.text)
    except TTSUnavailableError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(
        content=audio_bytes,
        media_type="audio/wav",
        headers={"Cache-Control": "no-store"},
    )


class VoiceNoteRequest(BaseModel):
    audio: str
    format: str = "webm"


@router.post("/voice-note")
async def voice_note(
    request: VoiceNoteRequest,
    current_user: dict = Depends(get_current_user),
):
    """Transcribe a voice note to text using Whisper."""
    from app.services.voice_call.stt_service import transcribe_audio
    try:
        text, latency_ms = await transcribe_audio(
            user=current_user,
            audio_base64=request.audio,
            audio_format=request.format,
        )
        return {"text": text, "latency_ms": latency_ms}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Transcription failed: {str(e)}")


# Static routes MUST come before parameterized routes
@router.post("/multi")
async def multi_chat(
    request: MultiChatRequest,
    current_user: dict = Depends(get_current_user),
):
    if len(request.document_ids) < 2:
        raise HTTPException(status_code=400, detail="Multi-chat requires at least 2 documents")
    if len(request.document_ids) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 documents per multi-chat")

    db = await get_user_db(current_user)

    documents = []
    for doc_id in request.document_ids:
        doc = await get_document_with_tree(db, doc_id, current_user["_id"])
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")
        if doc["status"] != "ready":
            raise HTTPException(
                status_code=400,
                detail=f"Document {doc.get('original_filename', doc_id)} is not ready for chat",
            )
        documents.append(doc)

    async def generate():
        async for chunk in chat_with_multiple_documents(
            db=db,
            user=current_user,
            documents=documents,
            message=request.message,
            conversation_id=request.conversation_id,
        ):
            yield _format_sse_data(chunk)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/multi/history")
async def get_multi_chat_history(current_user: dict = Depends(get_current_user)):
    db = await get_user_db(current_user)
    conversations = await get_multi_conversations(db, current_user["_id"])
    return [
        {
            "id": conv["_id"],
            "title": conv.get("title", "Untitled"),
            "document_ids": conv.get("document_ids", []),
            "created_at": conv["created_at"],
            "last_message": conv.get("messages", [{}])[-1] if conv.get("messages") else None,
        }
        for conv in conversations
    ]


# Parameterized routes come after static routes
@router.post("/{document_id}")
async def chat(
    document_id: str,
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)
    doc = await get_document_with_tree(db, document_id, current_user["_id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc["status"] != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Document is not ready for chat. Status: {doc['status']}",
        )

    async def generate():
        async for chunk in chat_with_document(
            db=db,
            user=current_user,
            document=doc,
            message=request.message,
            conversation_id=request.conversation_id,
        ):
            yield _format_sse_data(chunk)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/history/{document_id}", response_model=List[dict])
async def get_chat_history(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)
    conversations = await get_conversations(db, current_user["_id"], document_id)
    return [
        {
            "id": conv["_id"],
            "title": conv.get("title", "Untitled"),
            "created_at": conv["created_at"],
            "last_message": conv.get("messages", [{}])[-1] if conv.get("messages") else None,
        }
        for conv in conversations
    ]


@router.get("/conversation/{conversation_id}")
async def get_conv(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = await get_user_db(current_user)
    conv = await get_conversation(db, conversation_id, current_user["_id"])
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "id": conv["_id"],
        "document_id": conv.get("document_id"),
        "document_ids": conv.get("document_ids"),
        "title": conv.get("title", "Untitled"),
        "messages": conv.get("messages", []),
        "created_at": conv["created_at"],
    }


@router.get("/conversation/{conversation_id}/export")
async def export_conversation(
    conversation_id: str,
    format: str = Query("md", regex="^(md|json)$"),
    current_user: dict = Depends(get_current_user),
):
    """Export a conversation as Markdown or JSON."""
    db = await get_user_db(current_user)
    conv = await get_conversation(db, conversation_id, current_user["_id"])
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    title = conv.get("title", "Untitled")
    messages = conv.get("messages", [])
    created = conv.get("created_at", datetime.now(timezone.utc))

    if format == "json":
        import json
        export_data = {
            "title": title,
            "created_at": created.isoformat() if hasattr(created, 'isoformat') else str(created),
            "messages": [
                {"role": m.get("role", ""), "content": m.get("content", "")}
                for m in messages
            ],
        }
        content = json.dumps(export_data, indent=2, ensure_ascii=False)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{title}.json"'},
        )

    # Markdown format
    lines = [f"# {title}\n"]
    lines.append(f"*Exported on {datetime.now(timezone.utc).strftime('%B %d, %Y')}*\n\n---\n")

    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        if role == "user":
            lines.append(f"\n## You\n\n{content}\n")
        else:
            lines.append(f"\n## AI Assistant\n\n{content}\n")

    md_content = "\n".join(lines)
    return Response(
        content=md_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{title}.md"'},
    )
