"""
LangGraph State Definitions for Voice Call with Document.

Uses a simple TypedDict compatible with LangGraph StateGraph.
All fields are optional (total=False) — nodes use .get() with defaults.
"""

from typing import Literal
from typing_extensions import TypedDict


class VoiceCallState(TypedDict, total=False):
    """
    Full state for the voice call LangGraph pipeline.

    Each field is optional. Nodes read via state.get("key", default).
    Conversation history is managed externally by the ws_handler —
    each graph invocation receives the full history as input and
    the graph does NOT accumulate it (no reducer).
    """
    # --- Call Session ---
    call_session_id: str
    user_id: str
    document_id: str
    document_name: str

    # --- Current Turn ---
    user_audio_base64: str
    user_transcript: str
    assistant_response: str
    assistant_audio_base64: str

    # --- Document RAG Context ---
    relevant_content: str
    page_references: list

    # --- Conversation History (passed in, not accumulated) ---
    conversation_turns: list
    turn_count: int

    # --- Guardrails ---
    guardrail_result: dict
    is_off_topic: bool

    # --- Call Metadata ---
    call_status: str
    intro_message: str
    error_message: str

    # --- Latency Tracking ---
    stt_latency_ms: int
    llm_latency_ms: int
    tts_latency_ms: int
    total_latency_ms: int

    # --- Internal context ---
    _user_context: dict
    _document_context: dict
