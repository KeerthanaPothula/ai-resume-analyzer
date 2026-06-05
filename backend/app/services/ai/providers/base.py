from abc import ABC, abstractmethod
from typing import Any, Dict


class ProviderError(Exception):
    """Raised by a provider when an API call fails."""

    def __init__(
        self,
        message: str,
        is_recoverable: bool = True,
        status_code: int = 0,
    ) -> None:
        super().__init__(message)
        self.is_recoverable = is_recoverable
        self.status_code = status_code


class BaseProvider(ABC):
    """Abstract base for all LLM providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier: 'gemini' | 'openai' | 'groq'."""

    @property
    @abstractmethod
    def is_available(self) -> bool:
        """True when the API key is configured."""

    @abstractmethod
    async def generate_json(self, prompt: str, max_tokens: int = 2048) -> Dict[str, Any]:
        """Call the API and return a parsed JSON dict.

        Raises ProviderError on failure so the router can fall through.
        """

    @abstractmethod
    async def generate_text(self, prompt: str, max_tokens: int = 1024) -> str:
        """Call the API and return raw prose text.

        Raises ProviderError on failure so the router can fall through.
        """
