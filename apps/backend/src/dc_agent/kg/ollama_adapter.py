"""Ollama adapters for Graphiti's LLM and Embedder interfaces.

Provides OllamaEmbedder (embedding) and OllamaLLMClient (chat/JSON)
with retry logic for transient network failures.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional, Type, Union

import httpx
from graphiti_core.embedder.client import EmbedderClient
from graphiti_core.llm_client.client import LLMClient
from graphiti_core.llm_client.config import ModelSize
from graphiti_core.prompts.models import Message
from pydantic import BaseModel
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

_TRANSIENT_ERRORS = (httpx.ConnectError, httpx.TimeoutException, httpx.RemoteProtocolError)

_RETRY = retry(
    retry=retry_if_exception_type(_TRANSIENT_ERRORS),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)


class OllamaAdapterError(Exception):
    """Raised when an Ollama adapter call fails non-transiently."""


class OllamaEmbedder(EmbedderClient):
    """Ollama implementation of EmbedderClient."""

    def __init__(self, base_url: str, model: str) -> None:
        self.base_url = base_url
        self.model = model

    @_RETRY
    async def create(self, input_data: Union[str, List[str], Any]) -> List[float]:
        """Create an embedding for a single input."""
        if isinstance(input_data, list) and input_data and isinstance(input_data[0], str):
            text = " ".join(input_data)
        else:
            text = str(input_data)

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
            )
            response.raise_for_status()
            return response.json()["embedding"]

    async def create_batch(self, input_data_list: List[str]) -> List[List[float]]:
        """Create embeddings for a batch of inputs (sequential — Ollama has no batch API)."""
        embeddings: list[list[float]] = []
        for text in input_data_list:
            embeddings.append(await self.create(text))
        return embeddings


class DummyTracer:
    """No-op tracer satisfying Graphiti's internal tracing interface."""

    def start_span(self, name: str, **kwargs: Any) -> "DummyTracer":
        return self

    def __enter__(self) -> "DummyTracer":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        pass

    def end(self, **kwargs: Any) -> None:
        pass

    def add_attributes(self, *args: Any, **kwargs: Any) -> None:
        pass

    def set_status(self, *args: Any, **kwargs: Any) -> None:
        pass

    def add_event(self, *args: Any, **kwargs: Any) -> None:
        pass

    def record_exception(self, *args: Any, **kwargs: Any) -> None:
        pass


class OllamaLLMClient(LLMClient):
    """Ollama implementation of LLMClient."""

    def __init__(self, base_url: str, model: str) -> None:
        self.base_url = base_url
        self.model = model
        self.max_tokens = 4096
        self.tracer = DummyTracer()
        self.cache_enabled = False

    @staticmethod
    def _clean_json(content: str) -> str:
        """Strip Markdown code fences from JSON content."""
        if "```" in content:
            match = re.search(r"```(?:json)?\s*(.*?)\s*```", content, re.DOTALL)
            if match:
                return match.group(1)
            content = content.replace("```json", "").replace("```", "")
        return content.strip()

    @_RETRY
    async def _generate_response(
        self,
        messages: List[Message],
        response_model: Optional[Type[BaseModel]] = None,
        max_tokens: Optional[int] = None,
        model_size: ModelSize = ModelSize.medium,
        group_id: Optional[str] = None,
        prompt_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a response using Ollama."""
        ollama_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": ollama_messages,
            "stream": False,
        }

        if response_model:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(f"{self.base_url}/api/chat", json=payload)
            response.raise_for_status()
            result = response.json()

            content: str = result["message"]["content"]
            logger.debug("Ollama response (first 300 chars): %s", content[:300])

            if response_model:
                cleaned_content = self._clean_json(content)
                try:
                    data = json.loads(cleaned_content)
                except json.JSONDecodeError as exc:
                    logger.error(
                        "JSON parse failed for prompt=%s: %s — raw: %s",
                        prompt_name,
                        exc,
                        cleaned_content[:500],
                    )
                    raise OllamaAdapterError(
                        f"Ollama returned invalid JSON for prompt={prompt_name}"
                    ) from exc

                try:
                    validated = response_model.model_validate(data)
                    return validated.model_dump()
                except Exception as exc:
                    logger.error(
                        "Pydantic validation failed for %s: %s — data keys: %s",
                        response_model.__name__,
                        exc,
                        list(data.keys()) if isinstance(data, dict) else type(data).__name__,
                    )
                    raise OllamaAdapterError(
                        f"Ollama JSON did not match {response_model.__name__}"
                    ) from exc

            return {"content": content}

    def set_tracer(self, tracer: Any) -> None:
        pass
