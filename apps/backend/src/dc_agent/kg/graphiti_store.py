"""Graphiti episodic memory store with managed async lifecycle.

Provides lazy initialization, health checks, graceful shutdown, and
typed search / episode ingestion over the Graphiti SDK.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx
from graphiti_core import Graphiti
from graphiti_core.edges import EntityEdge
from graphiti_core.graphiti import AddEpisodeResults
from graphiti_core.llm_client import LLMConfig, OpenAIClient
from graphiti_core.nodes import EpisodeType
from openai import AsyncOpenAI

from dc_agent.config import settings
from dc_agent.kg.graphiti_models import (
    EpisodeInput,
    GraphitiSearchResponse,
    GraphitiSearchResult,
)
from dc_agent.kg.ollama_adapter import OllamaEmbedder, OllamaLLMClient

logger = logging.getLogger(__name__)


class GraphitiKGStore:
    """Async Graphiti store with lazy init and managed lifecycle.

    Usage::

        async with GraphitiKGStore() as store:
            results = await store.search("viscosity")
    """

    def __init__(self) -> None:
        self._client: Graphiti | None = None
        self._initialized: bool = False
        self._llm_provider: str = ""

    # ------------------------------------------------------------------
    # Async context manager
    # ------------------------------------------------------------------

    async def __aenter__(self) -> GraphitiKGStore:
        await self._ensure_initialized()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> None:
        await self.close()

    # ------------------------------------------------------------------
    # Lifecycle helpers
    # ------------------------------------------------------------------

    async def _ensure_initialized(self) -> None:
        """Lazily create the Graphiti client and build indexes."""
        if self._initialized:
            return

        embedder = OllamaEmbedder(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_EMBEDDING_MODEL,
        )

        provider = settings.GRAPHITI_LLM_PROVIDER.lower()
        if provider == "openai":
            llm_client = OpenAIClient(
                config=LLMConfig(
                    api_key=settings.OPENAI_API_KEY,
                    model=settings.GRAPHITI_LLM_MODEL,
                    small_model=settings.GRAPHITI_LLM_MODEL,
                ),
            )
            logger.info(
                "Graphiti LLM: OpenAI %s", settings.GRAPHITI_LLM_MODEL,
            )
        else:
            llm_client = OllamaLLMClient(
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_LLM_MODEL,
            )
            logger.info(
                "Graphiti LLM: Ollama %s", settings.OLLAMA_LLM_MODEL,
            )

        self._client = Graphiti(
            uri=settings.NEO4J_URI,
            user=settings.NEO4J_USER,
            password=settings.NEO4J_PASSWORD,
            embedder=embedder,
            llm_client=llm_client,
        )

        # Idempotent — safe to call on every startup.
        await self._client.build_indices_and_constraints()
        self._initialized = True
        self._llm_provider = provider
        logger.info("GraphitiKGStore initialized (indices built)")

    @property
    def client(self) -> Graphiti:
        """Return the underlying Graphiti client, raising if not yet initialized."""
        if self._client is None:
            raise RuntimeError("GraphitiKGStore not initialized — use `async with` or call _ensure_initialized()")
        return self._client

    async def close(self) -> None:
        """Gracefully shut down the Graphiti client."""
        if self._client is not None:
            try:
                await self._client.close()
                logger.info("GraphitiKGStore closed")
            except Exception:
                logger.exception("Error closing GraphitiKGStore")
            finally:
                self._client = None
                self._initialized = False

    async def health_check(self) -> dict[str, Any]:
        """Return health status of Neo4j, Ollama embeddings, and LLM provider."""
        status: dict[str, Any] = {
            "graphiti_initialized": self._initialized,
            "llm_provider": self._llm_provider or settings.GRAPHITI_LLM_PROVIDER,
            "neo4j": "unknown",
            "ollama_embeddings": "unknown",
            "llm": "unknown",
        }

        # Neo4j connectivity
        try:
            if self._client is not None:
                driver = self._client.driver
                await driver.execute_query("RETURN 1 AS ping")
                status["neo4j"] = "ok"
            else:
                status["neo4j"] = "not_initialized"
        except Exception as exc:
            status["neo4j"] = f"error: {exc}"

        # Ollama embedding model availability
        try:
            async with httpx.AsyncClient(timeout=5.0) as http:
                resp = await http.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                resp.raise_for_status()
                models = [m["name"] for m in resp.json().get("models", [])]
                embed_ok = any(settings.OLLAMA_EMBEDDING_MODEL in m for m in models)
                status["ollama_embeddings"] = "ok" if embed_ok else "missing_model"
        except Exception as exc:
            status["ollama_embeddings"] = f"error: {exc}"

        # LLM provider health
        provider = self._llm_provider or settings.GRAPHITI_LLM_PROVIDER.lower()
        if provider == "openai":
            try:
                client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                await client.models.retrieve(settings.GRAPHITI_LLM_MODEL)
                status["llm"] = "ok"
            except Exception as exc:
                status["llm"] = f"error: {exc}"
        else:
            # Ollama LLM check
            try:
                async with httpx.AsyncClient(timeout=5.0) as http:
                    resp = await http.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                    resp.raise_for_status()
                    models = [m["name"] for m in resp.json().get("models", [])]
                    llm_ok = any(settings.OLLAMA_LLM_MODEL in m for m in models)
                    status["llm"] = "ok" if llm_ok else "missing_model"
            except Exception as exc:
                status["llm"] = f"error: {exc}"

        return status

    # ------------------------------------------------------------------
    # Episode operations
    # ------------------------------------------------------------------

    async def add_episode(self, episode: EpisodeInput) -> AddEpisodeResults:
        """Ingest a single episode into Graphiti."""
        await self._ensure_initialized()
        return await self.client.add_episode(
            name=episode.name,
            episode_body=episode.body,
            source_description=episode.source_description,
            reference_time=episode.reference_time,
            source=episode.source_type,
            group_id=episode.group_id,
        )

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    async def search(
        self,
        query: str,
        *,
        num_results: int = 10,
        group_ids: list[str] | None = None,
    ) -> GraphitiSearchResponse:
        """Search Graphiti and return typed results."""
        await self._ensure_initialized()
        try:
            edges: list[EntityEdge] = await self.client.search(
                query=query,
                num_results=num_results,
                group_ids=group_ids,
            )
        except Exception:
            logger.exception("Graphiti search failed for query=%s", query)
            return GraphitiSearchResponse(query=query)

        results = [
            GraphitiSearchResult(
                uuid=edge.uuid,
                name=edge.name,
                fact=edge.fact,
                source_node_uuid=edge.source_node_uuid,
                target_node_uuid=edge.target_node_uuid,
                created_at=edge.created_at,
                valid_at=edge.valid_at,
                expired_at=edge.expired_at,
                episodes=edge.episodes or [],
            )
            for edge in edges
        ]

        return GraphitiSearchResponse(
            query=query,
            results=results,
            count=len(results),
        )
