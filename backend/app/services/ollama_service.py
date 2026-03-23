import asyncio
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import settings


def normalize_ollama_base_url(base_url: str | None) -> str:
    value = (base_url or settings.DEFAULT_OLLAMA_BASE_URL).strip()
    if not value:
        value = settings.DEFAULT_OLLAMA_BASE_URL
    if not value.startswith(("http://", "https://")):
        value = f"http://{value}"
    return value.rstrip("/")


def normalize_ollama_model(model: str | None) -> str:
    value = (model or settings.DEFAULT_OLLAMA_MODEL).strip()
    if value.startswith("ollama/"):
        value = value.split("/", 1)[1]
    return value or settings.DEFAULT_OLLAMA_MODEL


def format_ollama_litellm_model(model: str | None) -> str:
    return f"ollama/{normalize_ollama_model(model)}"


def _fetch_ollama_models(base_url: str) -> list[dict]:
    request = Request(
        f"{base_url}/api/tags",
        headers={"Accept": "application/json"},
    )
    with urlopen(request, timeout=settings.OLLAMA_REQUEST_TIMEOUT_SECONDS) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload.get("models", [])


def _resolve_model_match(requested_model: str, models: list[dict]) -> str | None:
    normalized_requested = normalize_ollama_model(requested_model)
    candidates = {normalized_requested}
    if ":" not in normalized_requested:
        candidates.add(f"{normalized_requested}:latest")

    for candidate in candidates:
        for item in models:
            for key in ("name", "model"):
                value = item.get(key)
                if value and normalize_ollama_model(value) == candidate:
                    return normalize_ollama_model(value)
    return None


def _validate_ollama_configuration_sync(base_url: str | None, model: str | None) -> tuple[str, str]:
    normalized_base_url = normalize_ollama_base_url(base_url)
    normalized_model = normalize_ollama_model(model)

    try:
        models = _fetch_ollama_models(normalized_base_url)
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        raise ValueError(
            f'Could not reach Ollama at "{normalized_base_url}". Please check the host and make sure Ollama is running.'
        ) from exc

    resolved_model = _resolve_model_match(normalized_model, models)
    if not resolved_model:
        raise ValueError(
            f'Ollama model "{normalized_model}" is not installed on "{normalized_base_url}".'
        )

    return normalized_base_url, resolved_model


async def validate_ollama_configuration(base_url: str | None, model: str | None) -> tuple[str, str]:
    return await asyncio.to_thread(_validate_ollama_configuration_sync, base_url, model)
