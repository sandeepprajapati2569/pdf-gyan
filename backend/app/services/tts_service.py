import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import settings
from app.services.llm_service import llm_service


class TTSUnavailableError(ValueError):
    pass


def _build_tts_payload(text: str) -> bytes:
    payload = {
        "model": settings.OPENAI_TTS_MODEL,
        "voice": settings.OPENAI_TTS_VOICE,
        "input": text[:4000],
        "response_format": "wav",
        "speed": 0.96,
        "instructions": "Speak in a calm, natural, warm product assistant voice. Keep the delivery clear, polished, and steady.",
    }
    return json.dumps(payload).encode("utf-8")


def _create_openai_speech_sync(user: dict, text: str) -> bytes:
    if user.get("mode") == "local":
        raise TTSUnavailableError("AI voice is not available in local mode.")

    api_key, _ = llm_service.get_openai_key(user)
    if not api_key:
        raise TTSUnavailableError("OpenAI voice is not available for this mode right now.")

    request = Request(
        "https://api.openai.com/v1/audio/speech",
        data=_build_tts_payload(text),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=60) as response:
            return response.read()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise TTSUnavailableError(
            "OpenAI voice could not be generated right now."
        ) from RuntimeError(detail or str(exc))
    except (URLError, TimeoutError, OSError) as exc:
        raise TTSUnavailableError("OpenAI voice could not be reached right now.") from exc


async def create_openai_speech(user: dict, text: str) -> bytes:
    normalized_text = (text or "").strip()
    if not normalized_text:
        raise TTSUnavailableError("Text is required to generate voice.")

    return await asyncio.to_thread(_create_openai_speech_sync, user, normalized_text)
