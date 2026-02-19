"""LLM service providing a unified interface to multiple model providers."""

import abc
import logging
from typing import Dict, List, Type

import httpx

from dc_agent.config import settings
from dc_agent.models.llm import (
    DEFAULT_MODEL_ID,
    ModelConfig,
    ModelProvider,
    get_model_config,
)

logger = logging.getLogger(__name__)


class LLMProvider(abc.ABC):
    """Abstract base class for LLM providers."""

    @abc.abstractmethod
    async def generate(self, messages: List[dict], model_config: ModelConfig) -> str:
        """Generate a response from a list of chat messages.

        Args:
            messages: List of dicts with ``role`` and ``content`` keys.
            model_config: The resolved model configuration.

        Returns:
            Generated response text.
        """


class OllamaProvider(LLMProvider):
    """Provider for locally-hosted Ollama models."""

    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = base_url or settings.OLLAMA_BASE_URL

    async def generate(self, messages: List[dict], model_config: ModelConfig) -> str:
        payload = {
            "model": model_config.model_id,
            "messages": messages,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            logger.debug(f"Calling Ollama at {self._base_url}/api/chat with model {model_config.model_id}")
            response = await client.post(f"{self._base_url}/api/chat", json=payload)
            response.raise_for_status()
            result = response.json()
            return result["message"]["content"]


class OpenAIProvider(LLMProvider):
    """Provider for OpenAI models using the ``openai`` library."""

    def __init__(self) -> None:
        # Import lazily so the dependency is only required when actually used.
        from openai import AsyncOpenAI  # noqa: WPS433

        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not set. Configure it in your .env file.")
        self._client = AsyncOpenAI(api_key=api_key)

    async def generate(self, messages: List[dict], model_config: ModelConfig) -> str:
        logger.debug(f"Calling OpenAI with model {model_config.model_id}")
        response = await self._client.chat.completions.create(
            model=model_config.model_id,
            messages=messages,  # type: ignore[arg-type]
        )
        content = response.choices[0].message.content
        return content or ""


class AnthropicProvider(LLMProvider):
    """Provider for Anthropic models using the ``anthropic`` library."""

    def __init__(self) -> None:
        from anthropic import AsyncAnthropic  # noqa: WPS433

        api_key = settings.ANTHROPIC_API_KEY
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY is not set. Configure it in your .env file.")
        self._client = AsyncAnthropic(api_key=api_key)

    async def generate(self, messages: List[dict], model_config: ModelConfig) -> str:
        logger.debug(f"Calling Anthropic with model {model_config.model_id}")

        # Anthropic requires the system prompt to be passed separately.
        system_text: str | None = None
        chat_messages: List[dict] = []
        for msg in messages:
            if msg["role"] == "system":
                system_text = msg["content"]
            else:
                chat_messages.append({"role": msg["role"], "content": msg["content"]})

        kwargs: dict = {
            "model": model_config.model_id,
            "max_tokens": 4096,
            "messages": chat_messages,
        }
        if system_text:
            kwargs["system"] = system_text

        response = await self._client.messages.create(**kwargs)

        # Anthropic returns a list of content blocks; concatenate all text blocks.
        parts = [block.text for block in response.content if hasattr(block, "text")]
        return "".join(parts)


# ---------------------------------------------------------------------------
# Provider registry
# ---------------------------------------------------------------------------

_PROVIDER_MAP: Dict[ModelProvider, Type[LLMProvider]] = {
    ModelProvider.OLLAMA: OllamaProvider,
    ModelProvider.OPENAI: OpenAIProvider,
    ModelProvider.ANTHROPIC: AnthropicProvider,
}

# Cache instantiated providers so we don't re-create clients on every call.
_provider_cache: Dict[ModelProvider, LLMProvider] = {}


def _get_provider(provider: ModelProvider) -> LLMProvider:
    """Return a cached provider instance for the given provider enum value."""
    if provider not in _provider_cache:
        cls = _PROVIDER_MAP[provider]
        _provider_cache[provider] = cls()
    return _provider_cache[provider]


class LLMService:
    """Unified service for generating LLM responses across providers."""

    async def generate(
        self,
        messages: List[dict],
        model_id: str | None = None,
    ) -> str:
        """Generate a response using the specified (or default) model.

        Args:
            messages: Chat messages in OpenAI-style format.
            model_id: Optional model identifier. Falls back to DEFAULT_MODEL_ID.

        Returns:
            Generated text response.

        Raises:
            ValueError: If the model_id is not recognised.
            RuntimeError: If the underlying provider call fails.
        """
        resolved_id = model_id or DEFAULT_MODEL_ID
        config = get_model_config(resolved_id)
        if config is None:
            raise ValueError(f"Unknown model: {resolved_id}")

        provider = _get_provider(config.provider)
        try:
            return await provider.generate(messages, config)
        except Exception as exc:
            logger.error(f"LLM generation failed for model {resolved_id}: {exc}")
            raise RuntimeError(f"Failed to generate response with model {resolved_id}: {exc}") from exc


# Singleton
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    """Return the singleton LLMService instance."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
