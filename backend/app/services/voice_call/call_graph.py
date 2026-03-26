"""
LangGraph Pipeline for Voice Call with Document.

This is the core orchestration engine that manages the complete
voice call flow:

    User Audio → STT → Guardrails → RAG Retrieval → LLM Response → TTS → Audio Output

The graph manages state across turns, handles errors gracefully,
and tracks latency at each node for optimization.
"""

import time
import logging
from typing import Literal
from langgraph.graph import StateGraph, END, START

from app.services.voice_call.call_state import VoiceCallState
from app.services.voice_call.stt_service import transcribe_audio
from app.services.voice_call.tts_voice_service import generate_speech_audio
from app.services.voice_call.guardrails import (
    validate_input,
    check_off_topic,
    check_rate_limit,
)
from app.services.chat_service import _extract_relevant_content
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


# ─── Graph Node Functions ───────────────────────────────────────────────


async def speech_to_text_node(state: VoiceCallState) -> dict:
    """Node 1: Convert user's audio to text via Whisper."""
    if not state.get("user_audio_base64"):
        # Text-only mode (user typed instead of speaking)
        return {"user_transcript": state.get("user_transcript", "")}

    try:
        user = state.get("_user_context", {})
        transcript, latency = await transcribe_audio(
            user=user,
            audio_base64=state["user_audio_base64"],
        )
        return {
            "user_transcript": transcript,
            "stt_latency_ms": latency,
        }
    except Exception as e:
        logger.error(f"STT node failed: {e}")
        return {
            "user_transcript": "",
            "error_message": "I had trouble hearing you. Could you try again?",
            "call_status": "active",
        }


async def guardrails_node(state: VoiceCallState) -> dict:
    """Node 2: Run guardrail checks on the transcript."""
    transcript = state.get("user_transcript", "")

    # Input validation
    validation = validate_input(transcript)
    if not validation["passed"]:
        return {
            "guardrail_result": validation,
            "assistant_response": validation["reason"],
        }

    # Rate limit check
    rate_check = check_rate_limit(state.get("turn_count", 0))
    if not rate_check["passed"]:
        return {
            "guardrail_result": rate_check,
            "assistant_response": rate_check["reason"],
            "call_status": "ended",
        }

    # Off-topic check (only after first few turns to allow greetings)
    user = state.get("_user_context", {})
    if state.get("turn_count", 0) > 1:
        is_off_topic, redirect_msg = await check_off_topic(
            user=user,
            transcript=transcript,
            document_name=state.get("document_name", "the document"),
        )
        if is_off_topic:
            return {
                "guardrail_result": {"passed": False, "reason": redirect_msg, "action": "warn"},
                "is_off_topic": True,
                "assistant_response": redirect_msg,
            }

    return {
        "guardrail_result": {"passed": True, "reason": "", "action": "allow"},
        "is_off_topic": False,
    }


async def rag_retrieval_node(state: VoiceCallState) -> dict:
    """Node 3: Retrieve relevant document content for the user's question."""
    user = state.get("_user_context", {})
    document = state.get("_document_context", {})
    transcript = state.get("user_transcript", "")

    try:
        relevant_content = await _extract_relevant_content(
            user=user,
            document=document,
            message=transcript,
        )
        return {"relevant_content": relevant_content or "No relevant content found in the document."}
    except Exception as e:
        logger.error(f"RAG retrieval failed: {e}")
        return {"relevant_content": "Unable to search the document right now."}


async def llm_response_node(state: VoiceCallState) -> dict:
    """Node 4: Generate conversational response using LLM."""
    start_time = time.time()

    user = state.get("_user_context", {})
    document_name = state.get("document_name", "the document")
    transcript = state.get("user_transcript", "")
    relevant_content = state.get("relevant_content", "")

    # Build conversation history for context
    history = state.get("conversation_turns", [])
    recent_history = history[-6:] if len(history) > 6 else history

    system_prompt = f"""You are a friendly, knowledgeable voice assistant for the document "{document_name}".
You are having a real-time voice conversation with the user about this document.

CRITICAL RULES:
1. Keep responses CONCISE and CONVERSATIONAL — this is a voice call, not a written chat.
2. Aim for 2-4 sentences per response. Longer only if the user asks for detail.
3. Use ONLY information from the document content provided. Never make up facts.
4. Speak naturally as if having a phone conversation. Use phrases like "Based on what I see in the document..." or "The document mentions that..."
5. If information isn't in the document, say so honestly: "I don't see that information in this document."
6. Reference page numbers when available (e.g., "On page 5, it says...")
7. Never use markdown formatting — your response will be spoken aloud.
8. If the user greets you, respond warmly and ask how you can help with the document.
9. Avoid long lists — summarize or offer to go through items one by one."""

    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history
    for turn in recent_history:
        messages.append({
            "role": turn.get("role", "user"),
            "content": turn.get("text", ""),
        })

    # Add current turn with document context
    user_message = f"""User's question: {transcript}

Relevant document content:
{relevant_content}

Respond conversationally in 2-4 sentences. This will be spoken aloud."""

    messages.append({"role": "user", "content": user_message})

    try:
        response = await llm_service.completion(
            user=user,
            messages=messages,
        )
        assistant_text = response.choices[0].message.content.strip()
        latency_ms = int((time.time() - start_time) * 1000)

        return {
            "assistant_response": assistant_text,
            "llm_latency_ms": latency_ms,
            "turn_count": state.get("turn_count", 0) + 1,
        }

    except Exception as e:
        logger.error(f"LLM response failed: {e}")
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "assistant_response": "I'm having trouble processing that right now. Could you try asking again?",
            "llm_latency_ms": latency_ms,
            "error_message": str(e),
        }


async def text_to_speech_node(state: VoiceCallState) -> dict:
    """Node 5: Convert assistant response to audio."""
    response_text = state.get("assistant_response", "")
    if not response_text:
        return {}

    user = state.get("_user_context", {})

    try:
        import base64
        audio_bytes, latency = await generate_speech_audio(
            user=user,
            text=response_text,
        )
        audio_b64 = base64.b64encode(audio_bytes).decode()

        total_latency = (
            state.get("stt_latency_ms", 0)
            + state.get("llm_latency_ms", 0)
            + latency
        )

        return {
            "assistant_audio_base64": audio_b64,
            "tts_latency_ms": latency,
            "total_latency_ms": total_latency,
        }

    except Exception as e:
        logger.error(f"TTS node failed: {e}")
        # Return text-only response if TTS fails
        return {
            "assistant_audio_base64": "",
            "tts_latency_ms": 0,
            "error_message": "Voice output unavailable, showing text response.",
        }


# ─── Conditional Edges ──────────────────────────────────────────────────


def should_continue_after_guardrails(state: VoiceCallState) -> Literal["rag_retrieval", "text_to_speech", "end"]:
    """Decide flow after guardrails check."""
    result = state.get("guardrail_result", {})

    if not result.get("passed", True):
        if result.get("action") == "block" and state.get("call_status") == "ended":
            return "end"
        # For warns/blocks, skip RAG and go straight to TTS with the guardrail message
        return "text_to_speech"

    return "rag_retrieval"


def should_generate_audio(state: VoiceCallState) -> Literal["text_to_speech", "end"]:
    """Decide if we should generate audio or end."""
    if state.get("call_status") == "ended":
        return "end"
    if state.get("assistant_response"):
        return "text_to_speech"
    return "end"


# ─── Build the Graph ─────────────────────────────────────────────────────


def build_voice_call_graph() -> StateGraph:
    """
    Build and compile the LangGraph for voice call processing.

    Graph Flow:
        START → speech_to_text → guardrails → [rag_retrieval | text_to_speech | END]
                                                    ↓
                                              llm_response → text_to_speech → END
    """
    graph = StateGraph(VoiceCallState)

    # Add nodes
    graph.add_node("speech_to_text", speech_to_text_node)
    graph.add_node("guardrails", guardrails_node)
    graph.add_node("rag_retrieval", rag_retrieval_node)
    graph.add_node("llm_response", llm_response_node)
    graph.add_node("text_to_speech", text_to_speech_node)

    # Define edges
    graph.add_edge(START, "speech_to_text")
    graph.add_edge("speech_to_text", "guardrails")

    # Conditional: after guardrails, either continue to RAG or skip to TTS
    graph.add_conditional_edges(
        "guardrails",
        should_continue_after_guardrails,
        {
            "rag_retrieval": "rag_retrieval",
            "text_to_speech": "text_to_speech",
            "end": END,
        },
    )

    graph.add_edge("rag_retrieval", "llm_response")

    # Conditional: after LLM response, generate audio or end
    graph.add_conditional_edges(
        "llm_response",
        should_generate_audio,
        {
            "text_to_speech": "text_to_speech",
            "end": END,
        },
    )

    graph.add_edge("text_to_speech", END)

    return graph.compile()


# Singleton compiled graph
_voice_call_graph = None


def get_voice_call_graph():
    """Get the compiled voice call graph (singleton)."""
    global _voice_call_graph
    if _voice_call_graph is None:
        _voice_call_graph = build_voice_call_graph()
    return _voice_call_graph
