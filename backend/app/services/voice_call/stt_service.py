"""
Speech-to-Text Service using OpenAI Whisper API.

Handles audio transcription with latency tracking.
Supports both base64 audio input and raw bytes.
"""

import base64
import io
import time
import logging
from openai import AsyncOpenAI
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)


async def transcribe_audio(
    user: dict,
    audio_base64: str,
    audio_format: str = "webm",
) -> tuple[str, int]:
    """
    Transcribe audio using OpenAI Whisper API.

    Args:
        user: User dict for API key resolution
        audio_base64: Base64-encoded audio data
        audio_format: Audio format (webm, wav, mp3, etc.)

    Returns:
        Tuple of (transcript_text, latency_ms)
    """
    start_time = time.time()

    api_key, _ = llm_service.get_openai_key(user)
    client = AsyncOpenAI(api_key=api_key)

    # Decode base64 audio
    audio_bytes = base64.b64decode(audio_base64)
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = f"audio.{audio_format}"

    try:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en",
            response_format="text",
        )

        transcript = response.strip() if isinstance(response, str) else response.text.strip()
        latency_ms = int((time.time() - start_time) * 1000)

        logger.info(f"STT completed in {latency_ms}ms: '{transcript[:80]}...'")
        return transcript, latency_ms

    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        logger.error(f"STT failed after {latency_ms}ms: {e}")
        raise


async def transcribe_audio_streaming(
    user: dict,
    audio_chunks: list[str],
    audio_format: str = "webm",
) -> tuple[str, int]:
    """
    Transcribe accumulated audio chunks.
    Combines chunks and sends as single request for lower latency.
    """
    combined = b""
    for chunk in audio_chunks:
        combined += base64.b64decode(chunk)

    combined_b64 = base64.b64encode(combined).decode()
    return await transcribe_audio(user, combined_b64, audio_format)
