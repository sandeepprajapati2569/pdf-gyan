"""
Guardrails for Voice Call with Document.

Provides safety checks, off-topic detection, and input validation
for the voice call pipeline. Runs as a node in the LangGraph.
"""

import logging
import re
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

# Maximum allowed transcript length (prevent abuse)
MAX_TRANSCRIPT_LENGTH = 2000

# Minimum transcript length to process
MIN_TRANSCRIPT_LENGTH = 2

# Blocked patterns (prompt injection, harmful content)
BLOCKED_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"you\s+are\s+now\s+(?:a\s+)?(?:new|different)",
    r"disregard\s+(?:all\s+)?(?:your\s+)?(?:previous|earlier)",
    r"forget\s+(?:all\s+)?(?:your\s+)?(?:previous|earlier)\s+(?:instructions|rules)",
    r"system\s*prompt",
    r"jailbreak",
]

# Compiled patterns for performance
_compiled_blocked = [re.compile(p, re.IGNORECASE) for p in BLOCKED_PATTERNS]


def validate_input(transcript: str) -> dict:
    """
    Validate the user's transcribed input.

    Returns:
        dict with keys: passed, reason, action
    """
    # Empty or too short
    if not transcript or len(transcript.strip()) < MIN_TRANSCRIPT_LENGTH:
        return {
            "passed": False,
            "reason": "I didn't catch that. Could you say that again?",
            "action": "warn",
        }

    # Too long (possible abuse)
    if len(transcript) > MAX_TRANSCRIPT_LENGTH:
        return {
            "passed": False,
            "reason": "That was quite long. Could you ask a shorter question?",
            "action": "warn",
        }

    # Check for blocked patterns (prompt injection)
    for pattern in _compiled_blocked:
        if pattern.search(transcript):
            logger.warning(f"Blocked pattern detected in voice call: {transcript[:100]}")
            return {
                "passed": False,
                "reason": "I can only help with questions about your document.",
                "action": "block",
            }

    return {"passed": True, "reason": "", "action": "allow"}


async def check_off_topic(
    user: dict,
    transcript: str,
    document_name: str,
) -> tuple[bool, str]:
    """
    Quick LLM check to determine if the question is about the document
    or completely off-topic. Uses a fast, cheap prompt.

    Returns:
        (is_off_topic: bool, redirect_message: str)
    """
    check_prompt = f"""You are a topic checker for a document called "{document_name}".
The user is in a voice call to ask questions about this document.

User said: "{transcript}"

Is this question related to the document or could reasonably be answered using document content?
Consider that greetings, follow-up questions, clarifications, and general questions about the document's topic are ON-TOPIC.
Only flag as off-topic if the question is completely unrelated (e.g., asking about weather, sports, coding help, etc.).

Reply with exactly one word: ON_TOPIC or OFF_TOPIC"""

    try:
        response = await llm_service.completion(
            user=user,
            messages=[{"role": "user", "content": check_prompt}],
        )
        result = response.choices[0].message.content.strip().upper()

        if "OFF_TOPIC" in result:
            return True, f"I'm here to help with questions about {document_name}. Could you ask something related to the document?"

        return False, ""

    except Exception as e:
        logger.error(f"Off-topic check failed: {e}")
        # Default to allowing through if check fails
        return False, ""


def check_rate_limit(turn_count: int, max_turns: int = 100) -> dict:
    """
    Check if the call has exceeded the maximum number of turns.
    """
    if turn_count >= max_turns:
        return {
            "passed": False,
            "reason": "We've had a great conversation! This call has reached its limit. Feel free to start a new call anytime.",
            "action": "block",
        }
    return {"passed": True, "reason": "", "action": "allow"}
