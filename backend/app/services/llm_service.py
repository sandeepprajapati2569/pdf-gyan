import os
import sys
import threading
import asyncio
import json
from typing import AsyncGenerator, Optional
from litellm import acompletion
from app.config import settings
from app.services.crypto_service import crypto_service
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

    async def completion(
        self,
        user: dict,
        messages: list,
        model: str = "gpt-4o",
        stream: bool = False,
    ):
        api_key, is_platform = self.get_openai_key(user)
        response = await acompletion(
            model=model,
            messages=messages,
            api_key=api_key,
            stream=stream,
        )

        if not stream and is_platform:
            await self._log_usage(user["_id"], response.usage, model)

        return response

    async def stream_completion(
        self,
        user: dict,
        messages: list,
        model: str = "gpt-4o",
    ) -> AsyncGenerator[str, None]:
        api_key, is_platform = self.get_openai_key(user)
        response = await acompletion(
            model=model,
            messages=messages,
            api_key=api_key,
            stream=True,
        )

        full_content = ""
        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                full_content += delta.content
                yield delta.content

        if is_platform:
            # Approximate token count for streaming
            from litellm import token_counter
            prompt_tokens = token_counter(model=model, messages=messages)
            completion_tokens = token_counter(model=model, text=full_content)
            await self._log_usage(
                user["_id"],
                type("Usage", (), {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens, "total_tokens": prompt_tokens + completion_tokens})(),
                model,
            )

    def run_page_index_with_key(self, pdf_path: str, api_key: str) -> dict:
        """Run page_index synchronously with the correct API key."""
        from pageindex import page_index

        with _env_lock:
            old_key = os.environ.get("OPENAI_API_KEY")
            os.environ["OPENAI_API_KEY"] = api_key
            try:
                result = page_index(
                    pdf_path,
                    if_add_node_id="yes",
                    if_add_node_summary="yes",
                    if_add_node_text="yes",
                )
                return result
            finally:
                if old_key:
                    os.environ["OPENAI_API_KEY"] = old_key
                else:
                    os.environ.pop("OPENAI_API_KEY", None)

    async def run_page_index_async(self, pdf_path: str, user: dict) -> dict:
        """Run page_index in a thread pool."""
        api_key, _ = self.get_openai_key(user)
        return await asyncio.to_thread(
            self.run_page_index_with_key, pdf_path, api_key
        )

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
