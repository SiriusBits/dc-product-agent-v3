"""Tests for the KG API endpoints (``/api/v1/kg/*``).

All tests use a mocked ``KGQueryService`` and ``Neo4jKGStore`` so that no
live Neo4j instance is required.
"""

import pytest
from unittest.mock import AsyncMock, patch, PropertyMock

from httpx import ASGITransport, AsyncClient

from dc_agent.kg.query_models import (
    EntitySearchResult,
    FormulationComponent,
    FormulationResult,
    KGNode,
    KGRelationship,
    NeighborEntry,
    ProductProfile,
    PropertyComparisonResult,
    PropertyComparisonRow,
    RelatedProductEntry,
    RelatedProductsResult,
    SafetyProfile,
    TraversalResult,
)


# ---------------------------------------------------------------------------
# App fixture — bypass real lifespan and inject mocks
# ---------------------------------------------------------------------------


def _make_app(kg_query_service=None, neo4j_store=None, graphiti_store=None):
    """Create a FastAPI app with mocked state (no real lifespan).

    State is set directly on the app — ASGITransport does not trigger
    lifespan events, so we bypass the lifespan context manager.
    """
    from fastapi import FastAPI
    from dc_agent.api.routes import router as api_router
    from dc_agent.api.kg_routes import kg_router

    app = FastAPI()
    app.state.kg_query_service = kg_query_service
    app.state.neo4j_store = neo4j_store
    app.state.graphiti_store = graphiti_store
    app.include_router(api_router, prefix="/api/v1")
    app.include_router(kg_router, prefix="/api/v1/kg")
    return app


@pytest.fixture
def mock_svc():
    """A fully mocked KGQueryService."""
    return AsyncMock()


@pytest.fixture
def mock_store():
    """A mocked Neo4jKGStore."""
    store = AsyncMock()
    store.verify_connectivity = AsyncMock(return_value=True)
    store.query = AsyncMock(return_value=[])
    return store


@pytest.fixture
def mock_graphiti():
    """A mocked GraphitiKGStore."""
    g = AsyncMock()
    g._initialized = True
    g.health_check = AsyncMock(return_value={"status": "ok"})
    return g


@pytest.fixture
def app(mock_svc, mock_store, mock_graphiti):
    return _make_app(
        kg_query_service=mock_svc,
        neo4j_store=mock_store,
        graphiti_store=mock_graphiti,
    )


@pytest.fixture
async def client(app):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SAMPLE_NODE = KGNode(
    id="node-1",
    label="Chemical",
    canonical_name="Dixie Chemical Amine 221",
    properties={"id": "node-1", "canonical_name": "Dixie Chemical Amine 221"},
)

SAMPLE_PROFILE = ProductProfile(
    node=SAMPLE_NODE,
    classification=["Cycloaliphatic Amine"],
    applications=["Epoxy Curing"],
    properties=[],
    identifiers=[],
    manufacturer="Dixie Chemical",
    benefits=["Low viscosity"],
)

SAMPLE_SAFETY = SafetyProfile(
    node=SAMPLE_NODE,
    hazards=[],
    ppe=[],
    first_aid=[],
    storage=[],
    toxicity=[],
)


# ---------------------------------------------------------------------------
# Product endpoints
# ---------------------------------------------------------------------------


class TestProductProfile:
    @pytest.mark.asyncio
    async def test_returns_profile(self, client, mock_svc):
        mock_svc.get_product_profile.return_value = SAMPLE_PROFILE
        resp = await client.get("/api/v1/kg/products/DCA%20221")
        assert resp.status_code == 200
        data = resp.json()
        assert data["node"]["id"] == "node-1"
        assert data["manufacturer"] == "Dixie Chemical"

    @pytest.mark.asyncio
    async def test_returns_404_when_not_found(self, client, mock_svc):
        mock_svc.get_product_profile.return_value = None
        resp = await client.get("/api/v1/kg/products/nonexistent")
        assert resp.status_code == 404


class TestProductSafety:
    @pytest.mark.asyncio
    async def test_returns_safety(self, client, mock_svc):
        mock_svc.get_safety_profile.return_value = SAMPLE_SAFETY
        resp = await client.get("/api/v1/kg/products/DCA%20221/safety")
        assert resp.status_code == 200
        data = resp.json()
        assert data["node"]["id"] == "node-1"

    @pytest.mark.asyncio
    async def test_returns_404_when_not_found(self, client, mock_svc):
        mock_svc.get_safety_profile.return_value = None
        resp = await client.get("/api/v1/kg/products/nonexistent/safety")
        assert resp.status_code == 404


class TestRelatedProducts:
    @pytest.mark.asyncio
    async def test_returns_related(self, client, mock_svc):
        mock_svc.find_related_products.return_value = RelatedProductsResult(
            query_entity="Epoxy Curing",
            results=[
                RelatedProductEntry(
                    product_id="p1",
                    product_name="DCA 221",
                    shared_entity="Epoxy Curing",
                    relationship_type="HAS_APPLICATION",
                )
            ],
        )
        resp = await client.get("/api/v1/kg/products/Epoxy%20Curing/related")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 1

    @pytest.mark.asyncio
    async def test_returns_400_on_invalid_rel_type(self, client, mock_svc):
        mock_svc.find_related_products.side_effect = ValueError("Invalid relationship type")
        resp = await client.get(
            "/api/v1/kg/products/Epoxy%20Curing/related",
            params={"relationship_type": "FAKE"},
        )
        assert resp.status_code == 400


class TestFormulations:
    @pytest.mark.asyncio
    async def test_returns_formulations(self, client, mock_svc):
        mock_svc.get_formulations.return_value = FormulationResult(
            chemical_name="DCA 221",
            formulation_name=None,
            components=[
                FormulationComponent(
                    component_name="ECA 608",
                    amount="100",
                    amount_unit="phr",
                    role="resin",
                )
            ],
        )
        resp = await client.get("/api/v1/kg/products/DCA%20221/formulations")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["components"]) == 1

    @pytest.mark.asyncio
    async def test_returns_404_when_not_found(self, client, mock_svc):
        mock_svc.get_formulations.return_value = None
        resp = await client.get("/api/v1/kg/products/nonexistent/formulations")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Compare
# ---------------------------------------------------------------------------


class TestCompare:
    @pytest.mark.asyncio
    async def test_compare_property(self, client, mock_svc):
        mock_svc.compare_property.return_value = PropertyComparisonResult(
            property_name="Viscosity",
            temperature="25°C",
            rows=[
                PropertyComparisonRow(
                    chemical_name="DCA 221", value="50", numeric_value=50.0, unit="cPs"
                ),
            ],
        )
        resp = await client.post(
            "/api/v1/kg/compare",
            json={"property_name": "Viscosity", "temperature": "25°C"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["property_name"] == "Viscosity"
        assert len(data["rows"]) == 1


# ---------------------------------------------------------------------------
# Search / Entity
# ---------------------------------------------------------------------------


class TestSearch:
    @pytest.mark.asyncio
    async def test_search_entities(self, client, mock_svc):
        mock_svc.search_entities.return_value = [
            EntitySearchResult(id="e1", label="Chemical", canonical_name="DCA 221", score=3.5),
        ]
        resp = await client.post(
            "/api/v1/kg/search", json={"query": "amine"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["canonical_name"] == "DCA 221"

    @pytest.mark.asyncio
    async def test_search_with_entity_type(self, client, mock_svc):
        mock_svc.search_entities.return_value = []
        resp = await client.post(
            "/api/v1/kg/search",
            json={"query": "amine", "entity_type": "Chemical", "limit": 5},
        )
        assert resp.status_code == 200
        mock_svc.search_entities.assert_called_once_with(
            "amine", labels=["Chemical"], limit=5
        )

    @pytest.mark.asyncio
    async def test_search_bad_label_returns_400(self, client, mock_svc):
        mock_svc.search_entities.side_effect = ValueError("Invalid node label: 'Fake'")
        resp = await client.post(
            "/api/v1/kg/search",
            json={"query": "amine", "entity_type": "Fake"},
        )
        assert resp.status_code == 400


class TestGetEntity:
    @pytest.mark.asyncio
    async def test_returns_entity(self, client, mock_svc):
        mock_svc.get_entity_by_id.return_value = SAMPLE_NODE
        resp = await client.get("/api/v1/kg/entity/node-1")
        assert resp.status_code == 200
        assert resp.json()["id"] == "node-1"

    @pytest.mark.asyncio
    async def test_returns_404_when_not_found(self, client, mock_svc):
        mock_svc.get_entity_by_id.return_value = None
        resp = await client.get("/api/v1/kg/entity/nonexistent")
        assert resp.status_code == 404


class TestNeighbors:
    @pytest.mark.asyncio
    async def test_returns_neighbors(self, client, mock_svc):
        neighbor_node = KGNode(
            id="n2", label="Application", canonical_name="Epoxy Curing", properties={}
        )
        mock_svc.get_entity_neighbors.return_value = [
            NeighborEntry(
                relationship=KGRelationship(
                    type="HAS_APPLICATION", source_id="node-1", target_id="n2", properties={}
                ),
                node=neighbor_node,
            ),
        ]
        resp = await client.get("/api/v1/kg/entity/node-1/neighbors")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1

    @pytest.mark.asyncio
    async def test_invalid_direction_returns_400(self, client, mock_svc):
        resp = await client.get(
            "/api/v1/kg/entity/node-1/neighbors", params={"direction": "sideways"}
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Traversal
# ---------------------------------------------------------------------------


class TestTraversal:
    @pytest.mark.asyncio
    async def test_traverse(self, client, mock_svc):
        mock_svc.traverse.return_value = TraversalResult(
            nodes=[SAMPLE_NODE],
            relationships=[
                KGRelationship(
                    type="HAS_APPLICATION",
                    source_id="node-1",
                    target_id="n2",
                    properties={},
                )
            ],
        )
        resp = await client.post(
            "/api/v1/kg/traverse",
            json={"start_node": "DCA 221", "max_hops": 2},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["nodes"]) == 1
        assert len(data["relationships"]) == 1

    @pytest.mark.asyncio
    async def test_traverse_bad_rel_type(self, client, mock_svc):
        mock_svc.traverse.side_effect = ValueError("Invalid relationship type: 'FAKE'")
        resp = await client.post(
            "/api/v1/kg/traverse",
            json={"start_node": "DCA 221", "relationship_types": ["FAKE"]},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Health / Stats
# ---------------------------------------------------------------------------


class TestHealth:
    @pytest.mark.asyncio
    async def test_health_ok(self, client, mock_store, mock_graphiti):
        resp = await client.get("/api/v1/kg/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["neo4j"] == "ok"
        assert data["graphiti"] == "ok"

    @pytest.mark.asyncio
    async def test_health_neo4j_down(self, mock_svc, mock_graphiti):
        """Neo4j store set but verify_connectivity returns False."""
        store = AsyncMock()
        store.verify_connectivity = AsyncMock(return_value=False)
        app = _make_app(
            kg_query_service=mock_svc,
            neo4j_store=store,
            graphiti_store=mock_graphiti,
        )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/api/v1/kg/health")
        assert resp.status_code == 200
        assert resp.json()["neo4j"] == "unreachable"

    @pytest.mark.asyncio
    async def test_health_no_stores(self, mock_svc):
        """Both stores are None."""
        app = _make_app(kg_query_service=mock_svc, neo4j_store=None, graphiti_store=None)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/api/v1/kg/health")
        data = resp.json()
        assert data["neo4j"] == "unavailable"
        assert data["graphiti"] == "unavailable"


class TestStats:
    @pytest.mark.asyncio
    async def test_stats(self, client, mock_store):
        mock_store.query.side_effect = [
            # nodes by label
            [{"lbl": "Chemical", "cnt": 100}, {"lbl": "Application", "cnt": 50}],
            # rels by type
            [{"rtype": "HAS_APPLICATION", "cnt": 80}],
        ]
        resp = await client.get("/api/v1/kg/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_nodes"] == 150
        assert data["total_relationships"] == 80
        assert len(data["nodes_by_label"]) == 2
        assert len(data["relationships_by_type"]) == 1

    @pytest.mark.asyncio
    async def test_stats_503_when_store_unavailable(self, mock_svc, mock_graphiti):
        """Stats returns 503 when neo4j_store is None."""
        app = _make_app(
            kg_query_service=mock_svc,
            neo4j_store=None,
            graphiti_store=mock_graphiti,
        )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/api/v1/kg/stats")
        assert resp.status_code == 503


# ---------------------------------------------------------------------------
# Service unavailable (503)
# ---------------------------------------------------------------------------


class TestServiceUnavailable:
    """All query endpoints return 503 when KGQueryService is not set."""

    @pytest.fixture
    async def no_svc_client(self, mock_store, mock_graphiti):
        app = _make_app(
            kg_query_service=None,
            neo4j_store=mock_store,
            graphiti_store=mock_graphiti,
        )
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac

    @pytest.mark.asyncio
    async def test_product_profile_503(self, no_svc_client):
        resp = await no_svc_client.get("/api/v1/kg/products/DCA%20221")
        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_safety_503(self, no_svc_client):
        resp = await no_svc_client.get("/api/v1/kg/products/DCA%20221/safety")
        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_search_503(self, no_svc_client):
        resp = await no_svc_client.post(
            "/api/v1/kg/search", json={"query": "amine"}
        )
        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_entity_503(self, no_svc_client):
        resp = await no_svc_client.get("/api/v1/kg/entity/node-1")
        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_traverse_503(self, no_svc_client):
        resp = await no_svc_client.post(
            "/api/v1/kg/traverse", json={"start_node": "DCA 221"}
        )
        assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_compare_503(self, no_svc_client):
        resp = await no_svc_client.post(
            "/api/v1/kg/compare", json={"property_name": "Viscosity"}
        )
        assert resp.status_code == 503
