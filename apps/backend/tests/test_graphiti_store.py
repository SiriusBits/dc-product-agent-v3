"""Tests for GraphitiKGStore lifecycle, search, and episode operations.

All tests mock the Graphiti SDK so no live Neo4j/Ollama is needed.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dc_agent.kg.graphiti_models import EpisodeInput, GraphitiSearchResponse
from dc_agent.kg.graphiti_store import GraphitiKGStore


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_graphiti() -> MagicMock:
    """Return a mock Graphiti client."""
    client = MagicMock()
    client.build_indices_and_constraints = AsyncMock()
    client.close = AsyncMock()
    client.add_episode = AsyncMock()
    client.search = AsyncMock(return_value=[])
    # Mock the driver for health_check
    client.driver = MagicMock()
    client.driver.execute_query = AsyncMock(return_value=None)
    return client


def _make_mock_edge(
    uuid: str = "edge-1",
    name: str = "test_edge",
    fact: str = "A is related to B",
    source_node_uuid: str = "node-1",
    target_node_uuid: str = "node-2",
) -> MagicMock:
    """Create a mock EntityEdge."""
    edge = MagicMock()
    edge.uuid = uuid
    edge.name = name
    edge.fact = fact
    edge.source_node_uuid = source_node_uuid
    edge.target_node_uuid = target_node_uuid
    edge.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    edge.valid_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    edge.expired_at = None
    edge.episodes = ["ep-1", "ep-2"]
    return edge


@pytest.fixture
def mock_graphiti_class():
    """Patch Graphiti constructor to return a mock client."""
    with patch("dc_agent.kg.graphiti_store.Graphiti") as MockGraphiti:
        client = _mock_graphiti()
        MockGraphiti.return_value = client
        yield client


# ---------------------------------------------------------------------------
# Lifecycle tests
# ---------------------------------------------------------------------------


class TestLifecycle:
    @pytest.mark.asyncio
    async def test_context_manager_initializes_and_closes(self, mock_graphiti_class):
        async with GraphitiKGStore() as store:
            assert store._initialized is True
            mock_graphiti_class.build_indices_and_constraints.assert_awaited_once()

        mock_graphiti_class.close.assert_awaited_once()
        assert store._initialized is False

    @pytest.mark.asyncio
    async def test_lazy_init_only_once(self, mock_graphiti_class):
        store = GraphitiKGStore()
        await store._ensure_initialized()
        await store._ensure_initialized()  # second call should be no-op
        mock_graphiti_class.build_indices_and_constraints.assert_awaited_once()
        await store.close()

    @pytest.mark.asyncio
    async def test_client_property_raises_before_init(self):
        store = GraphitiKGStore()
        with pytest.raises(RuntimeError, match="not initialized"):
            _ = store.client

    @pytest.mark.asyncio
    async def test_close_is_idempotent(self, mock_graphiti_class):
        store = GraphitiKGStore()
        await store._ensure_initialized()
        await store.close()
        await store.close()  # should not raise
        mock_graphiti_class.close.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_close_handles_error(self, mock_graphiti_class):
        mock_graphiti_class.close.side_effect = RuntimeError("connection lost")
        store = GraphitiKGStore()
        await store._ensure_initialized()
        # Should not raise
        await store.close()
        assert store._initialized is False


# ---------------------------------------------------------------------------
# Health check tests
# ---------------------------------------------------------------------------


class TestHealthCheck:
    @pytest.mark.asyncio
    async def test_health_check_not_initialized(self):
        store = GraphitiKGStore()
        health = await store.health_check()
        assert health["graphiti_initialized"] is False
        assert health["neo4j"] == "not_initialized"

    @pytest.mark.asyncio
    async def test_health_check_initialized_openai(self, mock_graphiti_class):
        """Health check with OpenAI LLM provider (default)."""
        with (
            patch("dc_agent.kg.graphiti_store.httpx.AsyncClient") as MockHttp,
            patch("dc_agent.kg.graphiti_store.settings") as mock_settings,
        ):
            # Configure settings for OpenAI provider
            mock_settings.NEO4J_URI = "bolt://localhost:7687"
            mock_settings.NEO4J_USER = "neo4j"
            mock_settings.NEO4J_PASSWORD = "password"
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_EMBEDDING_MODEL = "nomic-embed-text:latest"
            mock_settings.OLLAMA_LLM_MODEL = "llama3.1:8b"
            mock_settings.GRAPHITI_LLM_PROVIDER = "openai"
            mock_settings.GRAPHITI_LLM_MODEL = "gpt-4o-mini"
            mock_settings.OPENAI_API_KEY = "sk-test"

            # Mock Ollama tags response (embeddings only)
            http_instance = AsyncMock()
            mock_resp = MagicMock()
            mock_resp.json.return_value = {
                "models": [{"name": "nomic-embed-text:latest"}]
            }
            mock_resp.raise_for_status = MagicMock()
            http_instance.get.return_value = mock_resp
            http_instance.__aenter__ = AsyncMock(return_value=http_instance)
            http_instance.__aexit__ = AsyncMock(return_value=None)
            MockHttp.return_value = http_instance

            # Mock OpenAI models.retrieve
            mock_openai_client = AsyncMock()
            mock_openai_client.models.retrieve = AsyncMock(return_value=MagicMock())
            with patch("dc_agent.kg.graphiti_store.AsyncOpenAI", return_value=mock_openai_client):
                store = GraphitiKGStore()
                await store._ensure_initialized()
                health = await store.health_check()

            assert health["graphiti_initialized"] is True
            assert health["neo4j"] == "ok"
            assert health["ollama_embeddings"] == "ok"
            assert health["llm"] == "ok"
            assert health["llm_provider"] == "openai"
            await store.close()

    @pytest.mark.asyncio
    async def test_health_check_initialized_ollama(self, mock_graphiti_class):
        """Health check with Ollama LLM provider fallback."""
        with (
            patch("dc_agent.kg.graphiti_store.httpx.AsyncClient") as MockHttp,
            patch("dc_agent.kg.graphiti_store.settings") as mock_settings,
        ):
            mock_settings.NEO4J_URI = "bolt://localhost:7687"
            mock_settings.NEO4J_USER = "neo4j"
            mock_settings.NEO4J_PASSWORD = "password"
            mock_settings.OLLAMA_BASE_URL = "http://localhost:11434"
            mock_settings.OLLAMA_EMBEDDING_MODEL = "nomic-embed-text:latest"
            mock_settings.OLLAMA_LLM_MODEL = "llama3.1:8b"
            mock_settings.GRAPHITI_LLM_PROVIDER = "ollama"
            mock_settings.GRAPHITI_LLM_MODEL = "llama3.1:8b"
            mock_settings.OPENAI_API_KEY = None

            # Mock Ollama tags response (both embed + LLM)
            http_instance = AsyncMock()
            mock_resp = MagicMock()
            mock_resp.json.return_value = {
                "models": [
                    {"name": "nomic-embed-text:latest"},
                    {"name": "llama3.1:8b"},
                ]
            }
            mock_resp.raise_for_status = MagicMock()
            http_instance.get.return_value = mock_resp
            http_instance.__aenter__ = AsyncMock(return_value=http_instance)
            http_instance.__aexit__ = AsyncMock(return_value=None)
            MockHttp.return_value = http_instance

            store = GraphitiKGStore()
            await store._ensure_initialized()
            health = await store.health_check()

            assert health["graphiti_initialized"] is True
            assert health["neo4j"] == "ok"
            assert health["ollama_embeddings"] == "ok"
            assert health["llm"] == "ok"
            assert health["llm_provider"] == "ollama"
            await store.close()


# ---------------------------------------------------------------------------
# Search tests
# ---------------------------------------------------------------------------


class TestSearch:
    @pytest.mark.asyncio
    async def test_search_returns_typed_response(self, mock_graphiti_class):
        edges = [_make_mock_edge(), _make_mock_edge(uuid="edge-2", fact="C relates to D")]
        mock_graphiti_class.search.return_value = edges

        async with GraphitiKGStore() as store:
            resp = await store.search("test query")

        assert isinstance(resp, GraphitiSearchResponse)
        assert resp.query == "test query"
        assert resp.count == 2
        assert resp.results[0].uuid == "edge-1"
        assert resp.results[0].fact == "A is related to B"
        assert resp.results[0].episodes == ["ep-1", "ep-2"]
        assert resp.results[1].uuid == "edge-2"

    @pytest.mark.asyncio
    async def test_search_empty_results(self, mock_graphiti_class):
        mock_graphiti_class.search.return_value = []

        async with GraphitiKGStore() as store:
            resp = await store.search("nothing")

        assert resp.count == 0
        assert resp.results == []

    @pytest.mark.asyncio
    async def test_search_passes_params(self, mock_graphiti_class):
        mock_graphiti_class.search.return_value = []

        async with GraphitiKGStore() as store:
            await store.search("q", num_results=5, group_ids=["g1"])

        mock_graphiti_class.search.assert_awaited_once_with(
            query="q", num_results=5, group_ids=["g1"]
        )

    @pytest.mark.asyncio
    async def test_search_error_returns_empty(self, mock_graphiti_class):
        mock_graphiti_class.search.side_effect = RuntimeError("Neo4j down")

        async with GraphitiKGStore() as store:
            resp = await store.search("broken")

        assert resp.count == 0
        assert resp.query == "broken"


# ---------------------------------------------------------------------------
# Episode tests
# ---------------------------------------------------------------------------


class TestAddEpisode:
    @pytest.mark.asyncio
    async def test_add_episode_calls_client(self, mock_graphiti_class):
        episode = EpisodeInput(
            name="doc-123",
            body="Test summary",
            source_description="test.pdf",
            reference_time=datetime(2026, 1, 15, tzinfo=timezone.utc),
        )

        async with GraphitiKGStore() as store:
            await store.add_episode(episode)

        mock_graphiti_class.add_episode.assert_awaited_once()
        call_kwargs = mock_graphiti_class.add_episode.call_args[1]
        assert call_kwargs["name"] == "doc-123"
        assert call_kwargs["episode_body"] == "Test summary"
        assert call_kwargs["source_description"] == "test.pdf"
        assert isinstance(call_kwargs["reference_time"], datetime)
        assert call_kwargs["group_id"] == "dixie-products"

    @pytest.mark.asyncio
    async def test_add_episode_auto_initializes(self, mock_graphiti_class):
        """add_episode should call _ensure_initialized automatically."""
        store = GraphitiKGStore()
        episode = EpisodeInput(
            name="doc-456",
            body="Another summary",
            source_description="test2.pdf",
            reference_time=datetime(2026, 2, 1, tzinfo=timezone.utc),
        )
        await store.add_episode(episode)
        assert store._initialized is True
        mock_graphiti_class.add_episode.assert_awaited_once()
        await store.close()
