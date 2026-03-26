"""
WebSocket Handler for Voice Call with Document.

Manages the real-time bidirectional communication between the
frontend and the LangGraph voice pipeline.

Pipeline runs step-by-step (no LangGraph) for reliability:
    STT → Guardrails → RAG → LLM → TTS
"""

import json
import logging
import base64
import time
import traceback
from fastapi import WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.voice_call.call_session_manager import (
    create_call_session,
    add_call_turn,
    end_call_session,
)
from app.services.voice_call.tts_voice_service import generate_speech_audio
from app.services.document_service import get_document_with_tree

logger = logging.getLogger(__name__)

DEFAULT_INTRO = "Hi there! I've read through your document and I'm ready to answer any questions you have. What would you like to know?"

# Max chars of document context to send to LLM (prevent token overflow)
MAX_CONTEXT_CHARS = 12000


async def _send_json(ws: WebSocket, data: dict):
    """Send JSON message over WebSocket with error handling."""
    try:
        await ws.send_text(json.dumps(data))
    except Exception as e:
        logger.error(f"WebSocket send failed: {e}")


def _truncate_context(text: str, max_chars: int = MAX_CONTEXT_CHARS) -> str:
    """Truncate document context to fit within LLM token limits."""
    if not text or len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    # Try to cut at a sentence boundary
    last_period = truncated.rfind('. ')
    if last_period > max_chars * 0.7:
        truncated = truncated[:last_period + 1]
    return truncated + "\n\n[Document content truncated for brevity. Ask for specific sections if needed.]"


async def _run_pipeline(user, document, audio_b64, text, conversation_turns, turn_count, session_id):
    """
    Run the voice call pipeline step-by-step.
    Returns a result dict with all the needed fields.
    """
    from app.services.voice_call.stt_service import transcribe_audio
    from app.services.voice_call.guardrails import validate_input, check_off_topic, check_rate_limit
    from app.services.chat_service import _extract_relevant_content
    from app.services.llm_service import llm_service

    result = {
        "user_transcript": text,
        "assistant_response": "",
        "assistant_audio_base64": "",
        "stt_latency_ms": 0,
        "llm_latency_ms": 0,
        "tts_latency_ms": 0,
        "total_latency_ms": 0,
        "turn_count": turn_count,
        "call_status": "active",
    }

    total_start = time.time()

    # ─── Step 1: STT ──────────────────────────────────
    if audio_b64:
        try:
            logger.info(f"[VoiceCall] STT: processing audio ({len(audio_b64)} chars base64)")
            transcript, stt_latency = await transcribe_audio(user=user, audio_base64=audio_b64)
            result["user_transcript"] = transcript
            result["stt_latency_ms"] = stt_latency
            logger.info(f"[VoiceCall] STT result: '{transcript}' ({stt_latency}ms)")
        except Exception as e:
            logger.error(f"[VoiceCall] STT FAILED: {e}", exc_info=True)
            result["assistant_response"] = "I had trouble hearing you. Could you try again?"
            # Try TTS for error message
            try:
                ab, tl = await generate_speech_audio(user, result["assistant_response"])
                result["assistant_audio_base64"] = base64.b64encode(ab).decode()
                result["tts_latency_ms"] = tl
            except Exception:
                pass
            result["total_latency_ms"] = int((time.time() - total_start) * 1000)
            return result

    transcript = result["user_transcript"]
    logger.info(f"[VoiceCall] Processing transcript: '{transcript}'")

    # ─── Step 2: Guardrails ───────────────────────────
    validation = validate_input(transcript)
    if not validation["passed"]:
        logger.info(f"[VoiceCall] Guardrail blocked: {validation['reason']}")
        result["assistant_response"] = validation["reason"]
        try:
            ab, tl = await generate_speech_audio(user, validation["reason"])
            result["assistant_audio_base64"] = base64.b64encode(ab).decode()
            result["tts_latency_ms"] = tl
        except Exception:
            pass
        result["total_latency_ms"] = int((time.time() - total_start) * 1000)
        return result

    rate_check = check_rate_limit(turn_count)
    if not rate_check["passed"]:
        result["assistant_response"] = rate_check["reason"]
        result["call_status"] = "ended"
        result["total_latency_ms"] = int((time.time() - total_start) * 1000)
        return result

    # Off-topic check (after first few turns)
    if turn_count > 1:
        try:
            is_off_topic, redirect_msg = await check_off_topic(
                user=user, transcript=transcript,
                document_name=document.get("original_filename", "the document"),
            )
            if is_off_topic:
                result["assistant_response"] = redirect_msg
                try:
                    ab, tl = await generate_speech_audio(user, redirect_msg)
                    result["assistant_audio_base64"] = base64.b64encode(ab).decode()
                    result["tts_latency_ms"] = tl
                except Exception:
                    pass
                result["total_latency_ms"] = int((time.time() - total_start) * 1000)
                return result
        except Exception as e:
            logger.warning(f"[VoiceCall] Off-topic check failed (allowing): {e}")

    # ─── Step 3: RAG Retrieval ────────────────────────
    relevant_content = ""
    try:
        logger.info(f"[VoiceCall] RAG: searching document for '{transcript[:80]}'")
        relevant_content = await _extract_relevant_content(
            user=user, document=document, message=transcript,
        )
        if relevant_content:
            logger.info(f"[VoiceCall] RAG: found {len(relevant_content)} chars of content")
        else:
            logger.info("[VoiceCall] RAG: no content found")
    except Exception as e:
        logger.error(f"[VoiceCall] RAG FAILED: {e}", exc_info=True)
        relevant_content = ""

    if not relevant_content:
        relevant_content = "No relevant content found in the document for this question."

    # CRITICAL: Truncate to prevent token overflow
    relevant_content = _truncate_context(relevant_content)

    # ─── Step 4: LLM Response ─────────────────────────
    llm_start = time.time()
    document_name = document.get("original_filename", "the document")
    history = conversation_turns[-6:] if len(conversation_turns) > 6 else conversation_turns

    system_prompt = f"""You are a friendly, knowledgeable voice assistant for the document "{document_name}".
You are having a real-time voice conversation with the user about this document.

CRITICAL RULES:
1. Keep responses CONCISE and CONVERSATIONAL — this is a voice call, not a written chat.
2. Aim for 2-4 sentences per response. Longer only if the user asks for detail.
3. Use ONLY information from the document content provided. Never make up facts.
4. Speak naturally as if having a phone conversation.
5. If information isn't in the document, say so honestly.
6. Reference page numbers when available.
7. Never use markdown formatting — your response will be spoken aloud.
8. If the user greets you, respond warmly and ask how you can help with the document."""

    messages = [{"role": "system", "content": system_prompt}]
    for turn in history:
        messages.append({"role": turn.get("role", "user"), "content": turn.get("text", "")})
    messages.append({"role": "user", "content": f"User's question: {transcript}\n\nRelevant document content:\n{relevant_content}\n\nRespond conversationally in 2-4 sentences. This will be spoken aloud."})

    try:
        logger.info(f"[VoiceCall] LLM: sending {len(messages)} messages, ~{sum(len(m.get('content','')) for m in messages)} chars")
        response = await llm_service.completion(user=user, messages=messages)

        # Safely extract response text
        if response and hasattr(response, 'choices') and response.choices:
            content = response.choices[0].message.content
            assistant_text = content.strip() if content else ""
        else:
            logger.error(f"[VoiceCall] LLM returned unexpected response: {response}")
            assistant_text = ""

        if not assistant_text:
            assistant_text = "I wasn't able to generate a response for that. Could you rephrase your question?"

        result["assistant_response"] = assistant_text
        result["llm_latency_ms"] = int((time.time() - llm_start) * 1000)
        logger.info(f"[VoiceCall] LLM response: '{assistant_text[:100]}...' ({result['llm_latency_ms']}ms)")

    except Exception as e:
        logger.error(f"[VoiceCall] LLM FAILED: {type(e).__name__}: {e}", exc_info=True)
        result["llm_latency_ms"] = int((time.time() - llm_start) * 1000)

        # Provide a helpful text-only response instead of giving up
        error_msg = str(e).lower()
        if "token" in error_msg or "length" in error_msg or "context" in error_msg:
            result["assistant_response"] = "The document content is quite large. Could you ask about a specific section or topic?"
        elif "rate" in error_msg or "limit" in error_msg or "quota" in error_msg:
            result["assistant_response"] = "I'm getting rate limited right now. Please wait a moment and try again."
        elif "api" in error_msg or "key" in error_msg or "auth" in error_msg:
            result["assistant_response"] = "There's an issue with the AI service configuration. Please check your API key settings."
        else:
            result["assistant_response"] = "I'm having trouble generating a response right now. Could you try asking again?"

        # Try TTS for the error message so user hears it
        try:
            ab, tl = await generate_speech_audio(user, result["assistant_response"])
            result["assistant_audio_base64"] = base64.b64encode(ab).decode()
            result["tts_latency_ms"] = tl
        except Exception:
            pass
        result["total_latency_ms"] = int((time.time() - total_start) * 1000)
        return result

    # ─── Step 5: TTS ──────────────────────────────────
    try:
        logger.info(f"[VoiceCall] TTS: generating audio for {len(result['assistant_response'])} chars")
        audio_bytes, tts_latency = await generate_speech_audio(user=user, text=result["assistant_response"])
        result["assistant_audio_base64"] = base64.b64encode(audio_bytes).decode()
        result["tts_latency_ms"] = tts_latency
        logger.info(f"[VoiceCall] TTS completed ({tts_latency}ms)")
    except Exception as e:
        logger.error(f"[VoiceCall] TTS FAILED: {e}", exc_info=True)
        # Text-only response is fine

    result["total_latency_ms"] = int((time.time() - total_start) * 1000)
    result["turn_count"] = turn_count + 1
    logger.info(f"[VoiceCall] Turn complete in {result['total_latency_ms']}ms")
    return result


async def _process_turn(ws, graph, audio_b64, text, document, session_id, conversation_turns, turn_count, user, db):
    """Process a single conversation turn. Returns (conversation_turns, turn_count, should_end)."""
    is_audio = bool(audio_b64)
    await _send_json(ws, {"type": "processing", "stage": "stt" if is_audio else "thinking"})

    try:
        result = await _run_pipeline(
            user=user, document=document, audio_b64=audio_b64, text=text,
            conversation_turns=conversation_turns, turn_count=turn_count,
            session_id=session_id,
        )
    except Exception as e:
        logger.error(f"[VoiceCall] Pipeline CRASHED: {e}\n{traceback.format_exc()}")
        await _send_json(ws, {"type": "error", "message": "Something went wrong. Please try again."})
        return conversation_turns, turn_count, False

    transcript = result.get("user_transcript", "") or text
    response_text = result.get("assistant_response", "")
    response_audio = result.get("assistant_audio_base64", "")

    if transcript and is_audio:
        await _send_json(ws, {"type": "transcript", "text": transcript})

    if response_audio:
        await _send_json(ws, {"type": "response", "text": response_text, "audio": response_audio})
    elif response_text:
        await _send_json(ws, {"type": "response_text", "text": response_text})
    else:
        # Fallback: something went very wrong, send a generic error
        await _send_json(ws, {"type": "response_text", "text": "I couldn't process that. Could you try again?"})

    await _send_json(ws, {
        "type": "latency",
        "stt_ms": result.get("stt_latency_ms", 0),
        "llm_ms": result.get("llm_latency_ms", 0),
        "tts_ms": result.get("tts_latency_ms", 0),
        "total_ms": result.get("total_latency_ms", 0),
    })

    if transcript and response_text:
        conversation_turns = list(conversation_turns)
        conversation_turns.append({"role": "user", "text": transcript})
        conversation_turns.append({"role": "assistant", "text": response_text})
        turn_count = result.get("turn_count", turn_count + 1)
        try:
            await add_call_turn(
                db=db, session_id=session_id,
                user_text=transcript, assistant_text=response_text,
                stt_latency_ms=result.get("stt_latency_ms", 0),
                llm_latency_ms=result.get("llm_latency_ms", 0),
                tts_latency_ms=result.get("tts_latency_ms", 0),
                total_latency_ms=result.get("total_latency_ms", 0),
            )
        except Exception as e:
            logger.error(f"Failed to persist turn: {e}")

    return conversation_turns, turn_count, result.get("call_status") == "ended"


async def handle_voice_call(ws: WebSocket, user: dict, db: AsyncIOMotorDatabase):
    """Main WebSocket handler for voice call sessions."""
    await ws.accept()
    logger.info(f"[VoiceCall] WebSocket connected for user={user.get('_id')}")

    session_id = None
    document = None
    conversation_turns = []
    turn_count = 0

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")

            if msg_type == "start_call":
                document_id = msg.get("document_id", "")
                intro_message = msg.get("intro_message", "") or DEFAULT_INTRO

                if not document_id:
                    await _send_json(ws, {"type": "error", "message": "Document ID is required"})
                    continue

                logger.info(f"[VoiceCall] Starting call for document={document_id}")

                try:
                    document = await get_document_with_tree(db, document_id, user["_id"])
                except Exception as e:
                    logger.error(f"[VoiceCall] Failed to load document: {e}", exc_info=True)
                    await _send_json(ws, {"type": "error", "message": "Failed to load document"})
                    continue

                if not document:
                    await _send_json(ws, {"type": "error", "message": "Document not found"})
                    continue
                if document.get("status") != "ready":
                    await _send_json(ws, {"type": "error", "message": "Document is still processing."})
                    continue

                logger.info(f"[VoiceCall] Document loaded: {document.get('original_filename')} ({document.get('page_count')} pages)")

                try:
                    session = await create_call_session(
                        db=db, user_id=user["_id"], document_id=document_id,
                        document_name=document.get("original_filename", "Document"),
                        intro_message=intro_message,
                    )
                    session_id = session["_id"]
                except Exception as e:
                    logger.error(f"[VoiceCall] Failed to create session: {e}", exc_info=True)
                    await _send_json(ws, {"type": "error", "message": "Failed to start call"})
                    continue

                intro_audio_b64 = ""
                try:
                    audio_bytes, _ = await generate_speech_audio(user, intro_message)
                    intro_audio_b64 = base64.b64encode(audio_bytes).decode()
                except Exception as e:
                    logger.warning(f"[VoiceCall] Intro TTS failed: {e}")

                await _send_json(ws, {
                    "type": "call_started",
                    "session_id": session_id,
                    "document_name": document.get("original_filename", "Document"),
                    "intro_text": intro_message,
                    "intro_audio": intro_audio_b64,
                })
                logger.info(f"[VoiceCall] Call started: session={session_id}")

            elif msg_type == "audio_chunk":
                if not document or not session_id:
                    await _send_json(ws, {"type": "error", "message": "Call not started"})
                    continue
                audio_b64 = msg.get("audio", "")
                if not audio_b64:
                    continue
                logger.info(f"[VoiceCall] Received audio chunk ({len(audio_b64)} chars)")
                conversation_turns, turn_count, should_end = await _process_turn(
                    ws=ws, graph=None, audio_b64=audio_b64, text="",
                    document=document, session_id=session_id,
                    conversation_turns=conversation_turns, turn_count=turn_count,
                    user=user, db=db,
                )
                if should_end:
                    await _send_json(ws, {"type": "call_ended", "reason": "max_turns"})
                    break

            elif msg_type == "text_input":
                if not document or not session_id:
                    await _send_json(ws, {"type": "error", "message": "Call not started"})
                    continue
                text = msg.get("text", "").strip()
                if not text:
                    continue
                logger.info(f"[VoiceCall] Received text: '{text}'")
                conversation_turns, turn_count, should_end = await _process_turn(
                    ws=ws, graph=None, audio_b64="", text=text,
                    document=document, session_id=session_id,
                    conversation_turns=conversation_turns, turn_count=turn_count,
                    user=user, db=db,
                )
                if should_end:
                    await _send_json(ws, {"type": "call_ended", "reason": "max_turns"})
                    break

            elif msg_type == "end_call":
                await _send_json(ws, {"type": "call_ended", "reason": "user_ended"})
                break

    except WebSocketDisconnect:
        logger.info(f"[VoiceCall] Disconnected: session={session_id}")
    except json.JSONDecodeError as e:
        logger.error(f"[VoiceCall] Invalid JSON: {e}")
    except Exception as e:
        logger.error(f"[VoiceCall] Error: {e}\n{traceback.format_exc()}")
        try:
            await _send_json(ws, {"type": "error", "message": "An unexpected error occurred"})
        except Exception:
            pass
    finally:
        if session_id:
            try:
                await end_call_session(db, session_id, reason="disconnected")
            except Exception as e:
                logger.error(f"Failed to end session: {e}")
