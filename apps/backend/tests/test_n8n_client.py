"""Tests for the n8n retrieval client and response parsing.

All tests mock httpx so no live n8n instance is required.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from dc_agent.models.n8n import (
    N8nRetrievalResponse,
    N8nResultItem,
    N8nTraceMetadata,
    QueryIntent,
)
from dc_agent.services.n8n_client import (
    N8nClient,
    N8nClientError,
    _parse_response,
    _coerce_item,
)


# ---------------------------------------------------------------------------
# _parse_response unit tests
# ---------------------------------------------------------------------------


class TestParseResponse:
    """Test the response parsing logic for various n8n output shapes."""

    def test_standard_shape(self):
        data = {
            "results": [
                {"content": "Viscosity is 50 cPs", "source_type": "vector", "score": 0.9}
            ],
            "metadata": {
                "execution_id": "exec-1",
                "intent": "vector",
                "sources_queried": ["vector"],
                "timing_ms": {"vector": 42},
                "total_ms": 50,
            },
        }
        resp = _parse_response(data, 100.0)
        assert len(resp.results) == 1
        assert resp.results[0].content == "Viscosity is 50 cPs"
        assert resp.metadata.total_ms == 100.0  # overridden by elapsed

    def test_single_element_array_unwrap(self):
        """n8n often wraps responses in a single-element array."""
        data = [
            {
                "results": [
                    {"content": "DCA 221 info", "source_type": "kg", "score": 0.8}
                ],
                "metadata": {"intent": "kg"},
            }
        ]
        resp = _parse_response(data, 75.0)
        assert len(resp.results) == 1
        assert resp.results[0].source_type == "kg"

    def test_flat_list_of_items(self):
        data = [
            {"content": "item 1", "score": 0.9},
            {"content": "item 2", "score": 0.7},
        ]
        resp = _parse_response(data, 50.0)
        assert len(resp.results) == 2

    def test_empty_dict(self):
        resp = _parse_response({}, 10.0)
        assert len(resp.results) == 0

    def test_single_content_item(self):
        data = {"content": "standalone fact", "score": 0.5}
        resp = _parse_response(data, 30.0)
        assert len(resp.results) == 1
        assert resp.results[0].content == "standalone fact"

    def test_non_dict_input(self):
        resp = _parse_response("unexpected", 5.0)
        assert len(resp.results) == 0


class TestCoerceItem:
    def test_standard_fields(self):
        item = _coerce_item({
            "content": "Some text",
            "source": "DCA 221",
            "source_type": "kg",
            "score": 0.85,
            "product_name": "DCA 221",
        })
        assert item.content == "Some text"
        assert item.source == "DCA 221"
        assert item.source_type == "kg"
        assert item.score == 0.85

    def test_alternate_field_names(self):
        """Handles chunk_text, text, relevance_score aliases."""
        item = _coerce_item({
            "chunk_text": "From vector store",
            "relevance_score": 0.7,
            "product_name": "ECA 608",
        })
        assert item.content == "From vector store"
        assert item.score == 0.7
        assert item.product_name == "ECA 608"

    def test_extra_fields_in_metadata(self):
        item = _coerce_item({
            "content": "text",
            "section": "Properties",
            "doc_id": "abc",
        })
        assert item.metadata.get("section") == "Properties"
        assert item.metadata.get("doc_id") == "abc"


# ---------------------------------------------------------------------------
# N8nClient tests
# ---------------------------------------------------------------------------


class TestN8nClientRetrieve:
    @pytest.mark.asyncio
    async def test_successful_retrieve(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {
                    "content": "DCA 221 has low viscosity",
                    "source_type": "vector",
                    "score": 0.9,
                    "product_name": "DCA 221",
                }
            ],
            "metadata": {
                "execution_id": "exec-123",
                "intent": "vector",
                "sources_queried": ["vector"],
            },
        }

        with patch("dc_agent.services.n8n_client.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.post.return_value = mock_response
            instance.aclose = AsyncMock()
            MockClient.return_value = instance

            client = N8nClient(webhook_url="http://fake:5678/webhook/retrieval")
            client._client = instance

            resp = await client.retrieve("What is DCA 221?")

            assert len(resp.results) == 1
            assert resp.results[0].content == "DCA 221 has low viscosity"
            assert resp.metadata.intent == QueryIntent.VECTOR

    @pytest.mark.asyncio
    async def test_timeout_raises_error(self):
        with patch("dc_agent.services.n8n_client.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.post.side_effect = httpx.TimeoutException("timed out")
            instance.aclose = AsyncMock()
            MockClient.return_value = instance

            client = N8nClient(webhook_url="http://fake:5678/webhook/retrieval")
            client._client = instance

            with pytest.raises(N8nClientError, match="timed out"):
                await client.retrieve("slow query")

    @pytest.mark.asyncio
    async def test_connect_error_raises(self):
        with patch("dc_agent.services.n8n_client.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.post.side_effect = httpx.ConnectError("refused")
            instance.aclose = AsyncMock()
            MockClient.return_value = instance

            client = N8nClient(webhook_url="http://fake:5678/webhook/retrieval")
            client._client = instance

            with pytest.raises(N8nClientError, match="unreachable"):
                await client.retrieve("test")

    @pytest.mark.asyncio
    async def test_non_200_raises_error(self):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch("dc_agent.services.n8n_client.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.post.return_value = mock_response
            instance.aclose = AsyncMock()
            MockClient.return_value = instance

            client = N8nClient(webhook_url="http://fake:5678/webhook/retrieval")
            client._client = instance

            with pytest.raises(N8nClientError, match="HTTP 500"):
                await client.retrieve("test")

    @pytest.mark.asyncio
    async def test_invalid_json_raises_error(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = ValueError("bad json")

        with patch("dc_agent.services.n8n_client.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.post.return_value = mock_response
            instance.aclose = AsyncMock()
            MockClient.return_value = instance

            client = N8nClient(webhook_url="http://fake:5678/webhook/retrieval")
            client._client = instance

            with pytest.raises(N8nClientError, match="Invalid JSON"):
                await client.retrieve("test")


class TestN8nClientHealthCheck:
    @pytest.mark.asyncio
    async def test_healthy_returns_true(self):
        mock_response = MagicMock()
        mock_response.status_code = 200

        with patch("dc_agent.services.n8n_client.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.post.return_value = mock_response
            instance.aclose = AsyncMock()
            MockClient.return_value = instance

            client = N8nClient(webhook_url="http://fake:5678/webhook/retrieval")
            client._client = instance

            assert await client.health_check() is True

    @pytest.mark.asyncio
    async def test_unreachable_returns_false(self):
        with patch("dc_agent.services.n8n_client.httpx.AsyncClient") as MockClient:
            instance = AsyncMock()
            instance.post.side_effect = httpx.ConnectError("refused")
            instance.aclose = AsyncMock()
            MockClient.return_value = instance

            client = N8nClient(webhook_url="http://fake:5678/webhook/retrieval")
            client._client = instance

            assert await client.health_check() is False


class TestN8nClientLifecycle:
    @pytest.mark.asyncio
    async def test_context_manager(self):
        async with N8nClient(webhook_url="http://fake:5678/webhook/retrieval") as client:
            assert client._client is not None
        assert client._client is None

    @pytest.mark.asyncio
    async def test_ensure_client_creates_lazily(self):
        client = N8nClient(webhook_url="http://fake:5678/webhook/retrieval")
        assert client._client is None
        http = client._ensure_client()
        assert http is not None
        assert client._client is http
        await client.close()


# ---------------------------------------------------------------------------
# ChatService n8n integration
# ---------------------------------------------------------------------------


class TestChatServiceN8nFallback:
    """Test that ChatService falls back to direct search when n8n fails."""

    @pytest.mark.asyncio
    async def test_fallback_on_n8n_error(self):
        """When n8n raises N8nClientError, ChatService should use direct search."""
        from dc_agent.services.chat import ChatService

        mock_search = MagicMock()
        mock_search.semantic_search.return_value = MagicMock(
            results=[
                MagicMock(
                    product_id="p1",
                    product_name="DCA 221",
                    section_name="Properties",
                    chunk_text="DCA 221 is an amine curing agent",
                    relevance_score=0.85,
                    chunk_type="section",
                    doc_id="doc-1",
                )
            ]
        )

        mock_llm = AsyncMock()
        mock_llm.generate.return_value = "DCA 221 is an amine curing agent."

        mock_n8n = AsyncMock()
        mock_n8n.retrieve.side_effect = N8nClientError("n8n down")

        svc = ChatService(
            search_service=mock_search,
            llm_service=mock_llm,
            n8n_client=mock_n8n,
        )

        resp = await svc.chat(query="Tell me about DCA 221", model_id=None)

        # n8n was attempted
        mock_n8n.retrieve.assert_called_once()
        # Fell back to direct search
        mock_search.semantic_search.assert_called_once()
        assert resp.answer == "DCA 221 is an amine curing agent."

    @pytest.mark.asyncio
    async def test_n8n_disabled_uses_direct(self):
        """When n8n_client is None, ChatService uses direct search only."""
        from dc_agent.services.chat import ChatService

        mock_search = MagicMock()
        mock_search.semantic_search.return_value = MagicMock(
            results=[
                MagicMock(
                    product_id="p1",
                    product_name="DCA 221",
                    section_name="Properties",
                    chunk_text="DCA 221 info",
                    relevance_score=0.9,
                    chunk_type="section",
                    doc_id="doc-1",
                )
            ]
        )

        mock_llm = AsyncMock()
        mock_llm.generate.return_value = "Direct answer"

        svc = ChatService(
            search_service=mock_search,
            llm_service=mock_llm,
            n8n_client=None,
        )
        # Force n8n off
        svc._n8n_client = None

        resp = await svc.chat(query="Tell me about DCA 221", model_id=None)

        mock_search.semantic_search.assert_called_once()
        assert resp.answer == "Direct answer"
