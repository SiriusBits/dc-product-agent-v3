"""Tests for the internal n8n-facing endpoints (``/internal/*``).

All tests use mocked services — no live Neo4j or ChromaDB required.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from dc_agent.api.internal_models import (
    InternalKGSearchResponse,
    InternalVectorSearchResponse,
)


# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------


def _make_app(kg_query_service=None):
    """Create a FastAPI app with the internal router mounted."""
    from fastapi import FastAPI
    from dc_agent.api.internal import internal_router

    app = FastAPI()
    app.state.kg_query_service = kg_query_service
    app.include_router(internal_router, prefix="/internal")
    return app


@pytest.fixture
def mock_svc():
    """A fully mocked KGQueryService."""
    return AsyncMock()


@pytest.fixture
def app(mock_svc):
    return _make_app(kg_query_service=mock_svc)


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Vector search
# ---------------------------------------------------------------------------


class TestInternalVectorSearch:
    @pytest.mark.asyncio
    async def test_returns_results(self, client):
        """Vector search should return results from the search service."""
        with patch("dc_agent.api.internal.get_search_service") as mock_get:
            mock_service = MagicMock()
            mock_service.semantic_search.return_value = MagicMock(
                results=[
                    MagicMock(
                        chunk_text="Some text about DCA 221",
                        product_name="DCA 221",
                        section_name="Properties",
                        relevance_score=0.85,
                        doc_id="doc-1",
                        product_id="dca-221",
                    ),
                ]
            )
            mock_get.return_value = mock_service

            resp = await client.post(
                "/internal/vector-search",
                json={"query": "viscosity of DCA 221", "top_k": 5},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["results"][0]["product_name"] == "DCA 221"
        assert data["results"][0]["relevance_score"] == 0.85

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_results(self, client):
        with patch("dc_agent.api.internal.get_search_service") as mock_get:
            mock_service = MagicMock()
            mock_service.semantic_search.return_value = MagicMock(results=[])
            mock_get.return_value = mock_service

            resp = await client.post(
                "/internal/vector-search",
                json={"query": "nonexistent product"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["results"] == []


# ---------------------------------------------------------------------------
# KG search
# ---------------------------------------------------------------------------


class TestInternalKGSearch:
    @pytest.mark.asyncio
    async def test_returns_entities(self, client, mock_svc):
        mock_svc.search_entities.return_value = [
            MagicMock(id="e1", label="Chemical", canonical_name="DCA 221", score=0.9),
        ]
        mock_svc.get_product_profile.return_value = None

        resp = await client.post(
            "/internal/kg-search",
            json={"query": "DCA 221", "limit": 5, "include_profile": False},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["entities"][0]["canonical_name"] == "DCA 221"
        assert data["profile"] is None

    @pytest.mark.asyncio
    async def test_includes_profile_when_requested(self, client, mock_svc):
        mock_svc.search_entities.return_value = [
            MagicMock(id="e1", label="Chemical", canonical_name="DCA 221", score=0.9),
        ]
        mock_svc.get_product_profile.return_value = MagicMock(
            node=MagicMock(canonical_name="DCA 221"),
            classification=["Cycloaliphatic Amine"],
            applications=["Epoxy Curing"],
            properties=[
                MagicMock(
                    property_name="Molecular Weight",
                    value="170",
                    unit="g/mol",
                    temperature="",
                ),
            ],
            identifiers=[
                MagicMock(identifier_type="CAS", value="2855-13-2"),
            ],
            manufacturer="Dixie Chemical",
            benefits=["Low viscosity"],
        )

        resp = await client.post(
            "/internal/kg-search",
            json={"query": "DCA 221", "limit": 5, "include_profile": True},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["profile"] is not None
        assert data["profile"]["product_name"] == "DCA 221"
        assert data["profile"]["manufacturer"] == "Dixie Chemical"
        assert len(data["profile"]["properties"]) == 1

    @pytest.mark.asyncio
    async def test_returns_empty_on_search_failure(self, client, mock_svc):
        mock_svc.search_entities.side_effect = RuntimeError("Neo4j down")

        resp = await client.post(
            "/internal/kg-search",
            json={"query": "anything"},
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["entities"] == []

    @pytest.mark.asyncio
    async def test_503_when_no_kg_service(self, client):
        """If KG service is not on app state, should return 503."""
        # Create a separate app with no KG service
        from fastapi import FastAPI
        from dc_agent.api.internal import internal_router

        app_no_kg = FastAPI()
        app_no_kg.state.kg_query_service = None
        app_no_kg.include_router(internal_router, prefix="/internal")

        async with AsyncClient(
            transport=ASGITransport(app=app_no_kg), base_url="http://test"
        ) as c:
            resp = await c.post(
                "/internal/kg-search",
                json={"query": "test"},
            )

        assert resp.status_code == 503
