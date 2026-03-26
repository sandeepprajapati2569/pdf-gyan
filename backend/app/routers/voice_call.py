"""
Voice Call Router — REST + WebSocket endpoints for Call with Document.

Provides:
    - WebSocket: /api/voice-call/ws  (authenticated voice call)
    - WebSocket: /api/voice-call/embed/ws  (embed token voice call)
    - REST: Call history, embed token management
"""

import logging
from fastapi import APIRouter, HTTPException, Depends, WebSocket, Query
from app.dependencies import get_current_user, get_user_db
from app.services.voice_call.ws_handler import handle_voice_call
from app.services.voice_call.call_session_manager import (
    get_call_history,
    get_call_session,
)
from app.services.voice_call.embed_token_service import (
    create_embed_token,
    validate_embed_token,
    list_embed_tokens,
    revoke_embed_token,
)
from app.models.voice_call import CreateEmbedTokenRequest, RevokeEmbedTokenRequest
from app.services.auth_service import verify_token
from app.database import get_db
from bson import ObjectId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice-call", tags=["voice-call"])


# ─── WebSocket: Authenticated Voice Call ──────────────────────────────


@router.websocket("/ws")
async def voice_call_websocket(
    ws: WebSocket,
    token: str = Query(...),
):
    """
    WebSocket endpoint for authenticated voice calls.

    Connect with: ws://host/api/voice-call/ws?token=<jwt>
    """
    # Authenticate via JWT token in query param
    payload = verify_token(token)
    if not payload:
        await ws.close(code=4001, reason="Invalid token")
        return

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        await ws.close(code=4001, reason="User not found")
        return

    user["_id"] = str(user["_id"])

    # Get user's database (supports private DB)
    from app.dependencies import get_user_db as _get_user_db
    try:
        user_db = await _get_user_db(user)
    except Exception:
        user_db = db

    await handle_voice_call(ws, user, user_db)


# ─── WebSocket: Embed Token Voice Call ────────────────────────────────


@router.websocket("/embed/ws")
async def embed_voice_call_websocket(
    ws: WebSocket,
    embed_token: str = Query(...),
    origin: str = Query(default=""),
):
    """
    WebSocket endpoint for embedded voice calls on third-party websites.

    Connect with: ws://host/api/voice-call/embed/ws?embed_token=<token>&origin=<origin>
    """
    db = get_db()

    # Validate embed token
    token_data = await validate_embed_token(db, embed_token, origin)
    if not token_data:
        await ws.close(code=4001, reason="Invalid or expired embed token")
        return

    user = token_data["user"]

    # Get user's database
    from app.dependencies import get_user_db as _get_user_db
    try:
        user_db = await _get_user_db(user)
    except Exception:
        user_db = db

    # Handle embed call with pre-set document context
    await _handle_embed_call(ws, user, user_db, token_data)


async def _handle_embed_call(ws, user, db, token_data):
    """Handle embedded voice calls with pre-set document context."""
    from app.services.voice_call.ws_handler import _send_json, _process_turn, DEFAULT_INTRO
    from app.services.voice_call.call_session_manager import (
        create_call_session, end_call_session,
    )
    from app.services.voice_call.tts_voice_service import generate_speech_audio
    from app.services.document_service import get_document_with_tree
    import json
    import base64
    from fastapi import WebSocketDisconnect

    await ws.accept()

    document_id = token_data["document_id"]
    custom_intro = token_data.get("custom_intro", "") or DEFAULT_INTRO
    session_id = None

    try:
        # Load document
        document = await get_document_with_tree(db, document_id, user["_id"])
        if not document or document.get("status") != "ready":
            await _send_json(ws, {"type": "error", "message": "Document not available"})
            return

        # Auto-start the call
        session = await create_call_session(
            db=db,
            user_id=user["_id"],
            document_id=document_id,
            document_name=document.get("original_filename", "Document"),
            intro_message=custom_intro,
        )
        session_id = session["_id"]

        # Generate intro audio
        intro_audio_b64 = ""
        try:
            audio_bytes, _ = await generate_speech_audio(user, custom_intro)
            intro_audio_b64 = base64.b64encode(audio_bytes).decode()
        except Exception:
            pass

        await _send_json(ws, {
            "type": "call_started",
            "session_id": session_id,
            "document_name": document.get("original_filename", "Document"),
            "intro_text": custom_intro,
            "intro_audio": intro_audio_b64,
        })

        # Run the turn loop
        conversation_turns = []
        turn_count = 0

        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")

            if msg_type in ("audio_chunk", "text_input"):
                audio_b64 = msg.get("audio", "") if msg_type == "audio_chunk" else ""
                text = msg.get("text", "").strip() if msg_type == "text_input" else ""

                if not audio_b64 and not text:
                    continue

                conversation_turns, turn_count, should_end = await _process_turn(
                    ws=ws,
                    graph=None,
                    audio_b64=audio_b64,
                    text=text,
                    document=document,
                    session_id=session_id,
                    conversation_turns=conversation_turns,
                    turn_count=turn_count,
                    user=user,
                    db=db,
                )

                if should_end:
                    await _send_json(ws, {"type": "call_ended", "reason": "max_turns"})
                    break

            elif msg_type == "end_call":
                await _send_json(ws, {"type": "call_ended", "reason": "user_ended"})
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Embed call error: {e}", exc_info=True)
    finally:
        if session_id:
            try:
                await end_call_session(db, session_id, reason="disconnected")
            except Exception:
                pass


# ─── REST: Call History ───────────────────────────────────────────────


@router.get("/history")
async def get_voice_call_history(
    document_id: str = None,
    current_user: dict = Depends(get_current_user),
):
    """Get voice call history for the current user."""
    db = await get_user_db(current_user)
    sessions = await get_call_history(db, current_user["_id"], document_id)
    return [
        {
            "id": s["_id"],
            "document_id": s.get("document_id"),
            "document_name": s.get("document_name"),
            "status": s.get("status"),
            "turn_count": s.get("turn_count", 0),
            "total_duration_ms": s.get("total_duration_ms", 0),
            "avg_latency_ms": s.get("avg_latency_ms", 0),
            "created_at": s.get("created_at"),
            "ended_at": s.get("ended_at"),
        }
        for s in sessions
    ]


@router.get("/session/{session_id}")
async def get_voice_call_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get a specific call session with full transcript."""
    db = await get_user_db(current_user)
    session = await get_call_session(db, session_id, current_user["_id"])
    if not session:
        raise HTTPException(status_code=404, detail="Call session not found")
    return session


# ─── REST: Embed Token Management ────────────────────────────────────


@router.post("/embed/tokens")
async def create_embed_token_endpoint(
    request: CreateEmbedTokenRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create an embed token for the voice call widget."""
    db = await get_user_db(current_user)

    # Verify document exists and belongs to user
    from app.services.document_service import get_document_with_tree
    doc = await get_document_with_tree(db, request.document_id, current_user["_id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    token = await create_embed_token(
        db=db,
        user_id=current_user["_id"],
        document_id=request.document_id,
        allowed_origins=request.allowed_origins,
        ttl_hours=request.ttl_hours,
        custom_intro=request.custom_intro,
        custom_voice=request.custom_voice,
    )

    return {
        "token": token.get("raw_token"),
        "token_prefix": token.get("token_prefix"),
        "document_id": request.document_id,
        "expires_at": token.get("expires_at"),
        "allowed_origins": request.allowed_origins,
    }


@router.get("/embed/tokens")
async def list_embed_tokens_endpoint(
    current_user: dict = Depends(get_current_user),
):
    """List all embed tokens for the current user."""
    db = await get_user_db(current_user)
    tokens = await list_embed_tokens(db, current_user["_id"])
    return [
        {
            "id": t["_id"],
            "token_prefix": t.get("token_prefix"),
            "document_id": t.get("document_id"),
            "allowed_origins": t.get("allowed_origins", []),
            "is_active": t.get("is_active", False),
            "is_expired": t.get("is_expired", False),
            "usage_count": t.get("usage_count", 0),
            "created_at": t.get("created_at"),
            "expires_at": t.get("expires_at"),
            "last_used": t.get("last_used"),
        }
        for t in tokens
    ]


@router.delete("/embed/tokens/{token_id}")
async def revoke_embed_token_endpoint(
    token_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Revoke an embed token."""
    db = await get_user_db(current_user)
    success = await revoke_embed_token(db, token_id, current_user["_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Token not found")
    return {"status": "revoked"}


# ─── Diagnostic: Test Pipeline ─────────────────────────────────────


@router.post("/test-pipeline")
async def test_voice_pipeline(
    document_id: str,
    text: str = "What is this document about?",
    current_user: dict = Depends(get_current_user),
):
    """
    Diagnostic endpoint: test the voice call pipeline with text input.
    Runs STT(skip) → Guardrails → RAG → LLM → TTS and returns each step's result.
    """
    import traceback
    db = await get_user_db(current_user)
    steps = {}

    # Load document
    try:
        from app.services.document_service import get_document_with_tree
        document = await get_document_with_tree(db, document_id, current_user["_id"])
        if not document:
            return {"error": "Document not found"}
        if document.get("status") != "ready":
            return {"error": f"Document status: {document.get('status')}"}
        steps["document"] = {"ok": True, "name": document.get("original_filename"), "pages": document.get("page_count")}
    except Exception as e:
        return {"error": f"Document load failed: {e}", "trace": traceback.format_exc()}

    # Guardrails
    try:
        from app.services.voice_call.guardrails import validate_input
        validation = validate_input(text)
        steps["guardrails"] = validation
        if not validation["passed"]:
            return {"steps": steps, "error": f"Guardrails blocked: {validation['reason']}"}
    except Exception as e:
        steps["guardrails"] = {"error": str(e)}

    # RAG
    try:
        from app.services.chat_service import _extract_relevant_content
        content = await _extract_relevant_content(user=current_user, document=document, message=text)
        steps["rag"] = {"ok": True, "content_length": len(content or ""), "preview": (content or "")[:200]}
    except Exception as e:
        steps["rag"] = {"error": str(e), "trace": traceback.format_exc()}

    # LLM
    try:
        from app.services.llm_service import llm_service
        from app.services.voice_call.ws_handler import _truncate_context
        truncated = _truncate_context(content or "")
        messages = [
            {"role": "system", "content": f"You are a voice assistant for '{document.get('original_filename')}'. Respond in 2 sentences."},
            {"role": "user", "content": f"Question: {text}\n\nDocument content:\n{truncated}\n\nRespond briefly."},
        ]
        total_chars = sum(len(m["content"]) for m in messages)
        steps["llm_input"] = {"message_count": len(messages), "total_chars": total_chars}

        response = await llm_service.completion(user=current_user, messages=messages)
        assistant_text = response.choices[0].message.content.strip() if response.choices else ""
        steps["llm"] = {"ok": True, "response": assistant_text[:200]}
    except Exception as e:
        steps["llm"] = {"error": str(e), "type": type(e).__name__, "trace": traceback.format_exc()}

    # TTS
    try:
        from app.services.voice_call.tts_voice_service import generate_speech_audio
        test_text = steps.get("llm", {}).get("response", "Hello, this is a test.")
        _, tts_latency = await generate_speech_audio(current_user, test_text[:100])
        steps["tts"] = {"ok": True, "latency_ms": tts_latency}
    except Exception as e:
        steps["tts"] = {"error": str(e), "type": type(e).__name__, "trace": traceback.format_exc()}

    return {"steps": steps}
