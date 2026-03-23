import os
import sys
import threading
import asyncio
from typing import AsyncGenerator
from litellm import acompletion, token_counter
from app.config import settings
from app.services.crypto_service import crypto_service
from app.services.ollama_service import (
    format_ollama_litellm_model,
    normalize_ollama_base_url,
    normalize_ollama_model,
)
from datetime import datetime, timezone

# Add local PageIndex library to path
_pageindex_lib_path = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "libs", "pageindex"
)
_pageindex_lib_path = os.path.abspath(_pageindex_lib_path)
if _pageindex_lib_path not in sys.path:
    sys.path.insert(0, _pageindex_lib_path)

_env_lock = threading.Lock()


class LLMService:
    def get_openai_key(self, user: dict) -> tuple[str, bool]:
        """Returns (api_key, is_platform_key)."""
        if user.get("own_openai_key"):
            decrypted = crypto_service.decrypt(user["own_openai_key"])
            return decrypted, False
        return settings.PLATFORM_OPENAI_KEY, True

    def _estimate_tokens(self, text: str) -> int:
        return max(1, len(text or "") // 4) if text else 0

    def _safe_token_count(self, *, model: str, messages: list | None = None, text: str | None = None) -> int:
        try:
            if messages is not None:
                return token_counter(model=model, messages=messages)
            return token_counter(model=model, text=text or "")
        except Exception:
            if messages is not None:
                flattened = " ".join(str(message.get("content", "")) for message in messages)
                return self._estimate_tokens(flattened)
            return self._estimate_tokens(text or "")

    def _get_local_runtime(self, user: dict, model: str | None = None) -> dict:
        resolved_model = normalize_ollama_model(model or user.get("ollama_model"))
        return {
            "model": format_ollama_litellm_model(resolved_model),
            "api_key": "ollama",
            "api_base": normalize_ollama_base_url(user.get("ollama_base_url")),
            "is_platform_billed": False,
        }

    def _get_openai_runtime(
        self,
        user: dict,
        model: str,
    ) -> dict:
        api_key, is_platform = self.get_openai_key(user)
        return {
            "model": model,
            "api_key": api_key,
            "api_base": None,
            "is_platform_billed": is_platform,
        }

    def get_chat_runtime(self, user: dict, model: str | None = None) -> dict:
        if user.get("mode") == "local":
            return self._get_local_runtime(user, model=model)
        return self._get_openai_runtime(
            user,
            model or settings.DEFAULT_OPENAI_CHAT_MODEL,
        )

    def get_index_runtime(self, user: dict, model: str | None = None) -> dict:
        if user.get("mode") == "local":
            return self._get_local_runtime(user, model=model)
        return self._get_openai_runtime(
            user,
            model or settings.DEFAULT_OPENAI_INDEX_MODEL,
        )

    async def completion(
        self,
        user: dict,
        messages: list,
        model: str | None = None,
        stream: bool = False,
    ):
        runtime = self.get_chat_runtime(user, model=model)
        response = await acompletion(
            model=runtime["model"],
            messages=messages,
            api_key=runtime["api_key"],
            api_base=runtime["api_base"],
            stream=stream,
        )

        if not stream and runtime["is_platform_billed"]:
            await self._log_usage(user["_id"], response.usage, runtime["model"])

        return response

    async def stream_completion(
        self,
        user: dict,
        messages: list,
        model: str | None = None,
    ) -> AsyncGenerator[str, None]:
        runtime = self.get_chat_runtime(user, model=model)
        response = await acompletion(
            model=runtime["model"],
            messages=messages,
            api_key=runtime["api_key"],
            api_base=runtime["api_base"],
            stream=True,
        )

        full_content = ""
        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                full_content += delta.content
                yield delta.content

        if runtime["is_platform_billed"]:
            # Approximate token count for streaming
            prompt_tokens = self._safe_token_count(model=runtime["model"], messages=messages)
            completion_tokens = self._safe_token_count(model=runtime["model"], text=full_content)
            await self._log_usage(
                user["_id"],
                type(
                    "Usage",
                    (),
                    {
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens,
                        "total_tokens": prompt_tokens + completion_tokens,
                    },
                )(),
                runtime["model"],
            )

    def run_page_index(self, pdf_path: str, user: dict) -> dict:
        """Run page_index synchronously with the correct provider config."""
        from pageindex import page_index
        runtime = self.get_index_runtime(user)

        if runtime["api_base"]:
            return page_index(
                pdf_path,
                model=runtime["model"],
                api_base=runtime["api_base"],
                if_add_node_id="yes",
                if_add_node_summary="yes",
                if_add_node_text="yes",
            )

        with _env_lock:
            old_key = os.environ.get("OPENAI_API_KEY")
            os.environ["OPENAI_API_KEY"] = runtime["api_key"]
            try:
                return page_index(
                    pdf_path,
                    model=runtime["model"],
                    if_add_node_id="yes",
                    if_add_node_summary="yes",
                    if_add_node_text="yes",
                )
            finally:
                if old_key:
                    os.environ["OPENAI_API_KEY"] = old_key
                else:
                    os.environ.pop("OPENAI_API_KEY", None)

    async def run_page_index_async(self, pdf_path: str, user: dict) -> dict:
        """Run page_index in a thread pool."""
        return await asyncio.to_thread(self.run_page_index, pdf_path, user)

    async def _log_usage(self, user_id: str, usage, model: str, db=None):
        if db is None:
            from app.database import get_db
            db = get_db()
        await db.usage_logs.insert_one({
            "user_id": user_id,
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "total_tokens": usage.total_tokens,
            "model": model,
            "created_at": datetime.now(timezone.utc),
        })


llm_service = LLMService()
