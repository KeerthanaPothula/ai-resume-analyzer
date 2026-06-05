import json
import logging
from typing import Any, Dict

from app.core.config import settings
from .base import BaseProvider, ProviderError
from .openai_provider import _classify_error  # same error taxonomy (OpenAI-compatible API)

logger = logging.getLogger(__name__)

_GROQ_BASE_URL = "https://api.groq.com/openai/v1"
_GROQ_MAX_TOKENS = 8000  # Groq free tier output cap


class GroqProvider(BaseProvider):
    """Groq via the OpenAI-compatible API (uses the openai SDK with a custom base_url).

    No extra package required — Groq's REST API is fully OpenAI-compatible.
    Model: configurable via GROQ_MODEL env var (default: llama-3.3-70b-versatile).
    """

    def __init__(self) -> None:
        self._client = None

    @property
    def name(self) -> str:
        return "groq"

    @property
    def is_available(self) -> bool:
        return bool(settings.GROQ_API_KEY)

    def _client_instance(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url=_GROQ_BASE_URL,
            )
        return self._client

    async def generate_json(self, prompt: str, max_tokens: int = 2048) -> Dict[str, Any]:
        try:
            client = self._client_instance()
            response = await client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an expert resume coach and ATS specialist. "
                            "Respond only with valid JSON."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.7,
                max_tokens=min(max_tokens, _GROQ_MAX_TOKENS),
            )
            content = response.choices[0].message.content or "{}"
            return json.loads(content)
        except ProviderError:
            raise
        except Exception as exc:
            raise _classify_error(exc, "groq")

    async def generate_text(self, prompt: str, max_tokens: int = 1024) -> str:
        try:
            client = self._client_instance()
            response = await client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert AI career coach."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.6,
                max_tokens=min(max_tokens, _GROQ_MAX_TOKENS),
            )
            return response.choices[0].message.content or ""
        except ProviderError:
            raise
        except Exception as exc:
            raise _classify_error(exc, "groq")
