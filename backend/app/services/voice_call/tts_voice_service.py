"""
Text-to-Speech Service for Voice Calls using OpenAI TTS.

Optimized for low-latency streaming with chunked audio generation.
Produces audio chunks that can be streamed over WebSocket in real-time.
"""

import base64
import io
import time
import logging
from openai import AsyncOpenAI
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)

# Voice presets optimized for conversational tone
VOICE_PRESETS = {
    "default": "coral",
    "friendly": "nova",
    "professional": "onyx",
    "warm": "shimmer",
    "energetic": "echo",
    "calm": "fable",
}


def _split_into_tts_chunks(text: str, max_chars: int = 300) -> list[str]:
    """
    Split response text into TTS-friendly chunks at sentence boundaries.
    Keeps chunks small for low-latency streaming.
    """
    if len(text) <= max_chars:
        return [text] if text.strip() else []

    chunks = []
    sentences = []
    current = ""

    # Split on sentence boundaries
    for char in text:
        current += char
        if char in ".!?" and len(current) > 20:
            sentences.append(current.strip())
            current = ""

    if current.strip():
        sentences.append(current.strip())

    # Combine sentences into chunks
    chunk = ""
    for sentence in sentences:
        if len(chunk) + len(sentence) + 1 > max_chars and chunk:
            chunks.append(chunk)
            chunk = sentence
        else:
            chunk = f"{chunk} {sentence}".strip() if chunk else sentence

    if chunk:
        chunks.append(chunk)

    return chunks


async def generate_speech_audio(
    user: dict,
    text: str,
    voice: str = None,
) -> tuple[bytes, int]:
    """
    Generate speech audio from text using OpenAI TTS.

    Args:
        user: User dict for API key resolution
        text: Text to convert to speech
        voice: Voice preset name or OpenAI voice ID

    Returns:
        Tuple of (audio_bytes_wav, latency_ms)
    """
    start_time = time.time()

    api_key, _ = llm_service.get_openai_key(user)
    client = AsyncOpenAI(api_key=api_key)

    # Resolve voice
    resolved_voice = VOICE_PRESETS.get(voice, voice) or settings.OPENAI_TTS_VOICE

    try:
        response = await client.audio.speech.create(
            model=settings.OPENAI_TTS_MODEL,
            voice=resolved_voice,
            input=text,
            response_format="wav",
            speed=1.0,
        )

        audio_bytes = response.content
        latency_ms = int((time.time() - start_time) * 1000)

        logger.info(f"TTS completed in {latency_ms}ms for {len(text)} chars")
        return audio_bytes, latency_ms

    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        logger.error(f"TTS failed after {latency_ms}ms: {e}")
        raise


async def generate_speech_chunks(
    user: dict,
    text: str,
    voice: str = None,
) -> list[tuple[bytes, str]]:
    """
    Generate speech audio in chunks for streaming playback.

    Returns list of (audio_bytes, text_chunk) tuples.
    First chunk is sent ASAP for minimal perceived latency.
    """
    chunks = _split_into_tts_chunks(text)
    results = []

    for chunk_text in chunks:
        audio_bytes, _ = await generate_speech_audio(user, chunk_text, voice)
        audio_b64 = base64.b64encode(audio_bytes).decode()
        results.append((audio_b64, chunk_text))

    return results
