import asyncio
import json
import logging
import re
from typing import Any, Dict, Optional

from app.core.config import settings
from .base import BaseProvider, ProviderError

logger = logging.getLogger(__name__)


class GeminiProvider(BaseProvider):
    """Google Gemini via google-genai SDK v2."""

    def __init__(self) -> None:
        self._client = None

    @property
    def name(self) -> str:
        return "gemini"

    @property
    def is_available(self) -> bool:
        return bool(settings.GEMINI_API_KEY)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _client_instance(self):
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    # ── Public interface ──────────────────────────────────────────────────────

    async def generate_json(self, prompt: str, max_tokens: int = 2048) -> Dict[str, Any]:
        try:
            from google.genai import types as genai_types

            client = self._client_instance()
            cfg = genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
                max_output_tokens=max_tokens,
            )
            response = await asyncio.wait_for(
                client.aio.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=cfg,
                ),
                timeout=25.0,
            )
            raw = (response.text or "").strip()
            result = _extract_json(raw)
            if result is None:
                raise ProviderError(
                    f"Could not parse JSON from Gemini response: {raw[:200]}",
                    is_recoverable=True,
                )
            return result

        except asyncio.TimeoutError:
            raise ProviderError("Gemini timed out after 25 s", is_recoverable=True)
        except asyncio.CancelledError:
            raise
        except ProviderError:
            raise
        except Exception as exc:
            raise _classify_error(exc)

    async def generate_text(self, prompt: str, max_tokens: int = 1024) -> str:
        try:
            from google.genai import types as genai_types

            client = self._client_instance()
            cfg = genai_types.GenerateContentConfig(
                temperature=0.6,
                max_output_tokens=max_tokens,
            )
            loop = asyncio.get_running_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: client.models.generate_content(
                        model=settings.GEMINI_MODEL,
                        contents=prompt,
                        config=cfg,
                    ),
                ),
                timeout=25.0,
            )
            return (response.text or "").strip()

        except asyncio.TimeoutError:
            raise ProviderError("Gemini timed out after 25 s", is_recoverable=True)
        except asyncio.CancelledError:
            raise
        except ProviderError:
            raise
        except Exception as exc:
            raise _classify_error(exc)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_json(raw: str) -> Optional[Dict[str, Any]]:
    """Robustly extract a JSON object from a Gemini response string."""
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    if "```" in raw:
        for part in raw.split("```"):
            candidate = part.lstrip("json").strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    logger.error("Could not extract JSON from Gemini response: %.200s", raw)
    return None


def _classify_error(exc: Exception) -> ProviderError:
    msg = str(exc)
    try:
        from google.genai import errors as genai_errors

        if isinstance(exc, genai_errors.ClientError):
            code = getattr(exc, "status_code", 0) or 0
            if code == 429 or "quota" in msg.lower() or "RATE_LIMIT" in msg.upper():
                logger.warning("Gemini: quota/rate-limit (429) — triggering fallback")
                return ProviderError(f"Gemini rate limit: {msg}", is_recoverable=True, status_code=429)
            if code == 401 or "API_KEY" in msg.upper() or "invalid" in msg.lower():
                logger.error("Gemini: invalid API key (401) — triggering fallback")
                return ProviderError(f"Gemini auth error: {msg}", is_recoverable=True, status_code=401)
            if code == 503:
                logger.warning("Gemini: service unavailable (503) — triggering fallback")
                return ProviderError(f"Gemini unavailable: {msg}", is_recoverable=True, status_code=503)
            logger.warning("Gemini: client error (%d) — triggering fallback: %s", code, msg)
            return ProviderError(f"Gemini error ({code}): {msg}", is_recoverable=True, status_code=code)

        if isinstance(exc, genai_errors.ServerError):
            logger.warning("Gemini: server error (5xx) — triggering fallback")
            return ProviderError(f"Gemini server error: {msg}", is_recoverable=True)

    except ImportError:
        pass

    logger.error("Gemini unexpected error (%s): %s", type(exc).__name__, msg)
    return ProviderError(f"Gemini error: {msg}", is_recoverable=True)
