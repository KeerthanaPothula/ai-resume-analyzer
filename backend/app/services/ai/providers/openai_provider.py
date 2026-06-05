import json
import logging
from typing import Any, Dict

from app.core.config import settings
from .base import BaseProvider, ProviderError

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseProvider):
    """OpenAI via the official openai SDK."""

    def __init__(self) -> None:
        self._client = None

    @property
    def name(self) -> str:
        return "openai"

    @property
    def is_available(self) -> bool:
        return bool(settings.OPENAI_API_KEY)

    def _client_instance(self):
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    async def generate_json(self, prompt: str, max_tokens: int = 2048) -> Dict[str, Any]:
        try:
            client = self._client_instance()
            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
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
                max_tokens=max_tokens,
            )
            content = response.choices[0].message.content or "{}"
            return json.loads(content)
        except ProviderError:
            raise
        except Exception as exc:
            raise _classify_error(exc, "openai")

    async def generate_text(self, prompt: str, max_tokens: int = 1024) -> str:
        try:
            client = self._client_instance()
            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are an expert AI career coach."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.6,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""
        except ProviderError:
            raise
        except Exception as exc:
            raise _classify_error(exc, "openai")


def _classify_error(exc: Exception, provider_name: str) -> ProviderError:
    msg = str(exc)
    try:
        from openai import (
            RateLimitError,
            AuthenticationError,
            APIConnectionError,
            APIStatusError,
        )
        if isinstance(exc, RateLimitError):
            logger.warning("%s: rate limit (429) — triggering fallback", provider_name)
            return ProviderError(f"{provider_name} rate limit: {msg}", is_recoverable=True, status_code=429)
        if isinstance(exc, AuthenticationError):
            logger.error("%s: invalid API key (401) — triggering fallback", provider_name)
            return ProviderError(f"{provider_name} auth error: {msg}", is_recoverable=True, status_code=401)
        if isinstance(exc, APIConnectionError):
            logger.warning("%s: connection error — triggering fallback", provider_name)
            return ProviderError(f"{provider_name} connection error: {msg}", is_recoverable=True)
        if isinstance(exc, APIStatusError):
            code = exc.status_code
            logger.warning("%s: API error %d — triggering fallback", provider_name, code)
            return ProviderError(f"{provider_name} API error ({code}): {msg}", is_recoverable=True, status_code=code)
    except ImportError:
        pass
    logger.error("%s unexpected error (%s): %s", provider_name, type(exc).__name__, msg)
    return ProviderError(f"{provider_name} error: {msg}", is_recoverable=True)
