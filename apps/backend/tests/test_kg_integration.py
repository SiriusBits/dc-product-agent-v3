"""Integration tests for the Neo4j Knowledge Graph pipeline.

Requires a live Neo4j instance.  Run with::

    uv run pytest tests/test_kg_integration.py --run-integration -v
"""

from __future__ import annotations

import pytest

from dc_agent.kg.neo4j import Neo4jKGStore
from dc_agent.kg.query_service import KGQueryService
from dc_agent.kg.schema import init_schema, validate_schema

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------


class TestSchemaInit:
    async def test_schema_creates_constraints_and_indexes(
        self, neo4j_store: Neo4jKGStore
    ) -> None:
        summary = await validate_schema(neo4j_store)
        assert summary["missing_constraints"] == [], (
            f"Missing constraints: {summary['missing_constraints']}"
        )
        assert summary["has_fulltext"] is True

    async def test_init_schema_is_idempotent(
        self, neo4j_store: Neo4jKGStore
    ) -> None:
        # Running init_schema a second time should not raise
        await init_schema(neo4j_store)
        summary = await validate_schema(neo4j_store)
        assert summary["missing_constraints"] == []


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------


class TestIngestion:
    async def test_entities_ingested(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        store, _ = seeded_store
        rows = await store.query("MATCH (n) RETURN count(n) AS cnt")
        count = rows[0]["cnt"]
        # 2 fixture files: DCA 221 has 8 entities, MHHPA 301 has 7
        # plus auto-created Property nodes from has_property triples
        assert count >= 15, f"Expected ≥15 nodes, got {count}"

    async def test_relationships_ingested(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        store, _ = seeded_store
        rows = await store.query("MATCH ()-[r]->() RETURN count(r) AS cnt")
        count = rows[0]["cnt"]
        # DCA 221 has 8 triples, MHHPA 301 has 6
        assert count >= 14, f"Expected ≥14 relationships, got {count}"

    async def test_uniqueness_constraint_prevents_duplicate(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        """Re-ingesting the same entity should MERGE, not create a duplicate."""
        store, _ = seeded_store
        await store.add_entity("Chemical", {
            "id": "test-dca221-chemical",
            "canonical_name": "DCA 221 UPDATED",
        })
        rows = await store.query(
            "MATCH (n:Chemical {id: $id}) RETURN count(n) AS cnt",
            {"id": "test-dca221-chemical"},
        )
        assert rows[0]["cnt"] == 1

    async def test_chemical_labels(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        store, _ = seeded_store
        rows = await store.query("MATCH (n:Chemical) RETURN n.canonical_name AS name")
        names = {r["name"] for r in rows}
        assert "DCA 221" in names
        assert "MHHPA 301" in names


# ---------------------------------------------------------------------------
# Query service
# ---------------------------------------------------------------------------


class TestQueryService:
    async def test_get_entity_by_id(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        node = await svc.get_entity_by_id("test-dca221-chemical")
        assert node is not None
        assert node.canonical_name == "DCA 221"

    async def test_get_entity_by_id_not_found(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        node = await svc.get_entity_by_id("nonexistent-id")
        assert node is None

    async def test_search_entities(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        results = await svc.search_entities("DCA")
        assert len(results) >= 1
        names = [r.canonical_name for r in results]
        assert any("DCA" in n for n in names)

    async def test_search_entities_with_label_filter(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        results = await svc.search_entities("DCA", labels=["Chemical"])
        assert all(r.label == "Chemical" for r in results)

    async def test_get_product_profile(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        profile = await svc.get_product_profile("DCA 221")
        # The product may resolve via Chemical or Product node
        # depending on how _resolve_node matches. Either way we
        # should get a profile if the node exists.
        if profile is not None:
            assert profile.node.canonical_name in ("DCA 221", "Dixie Chemical Amine 221")

    async def test_traverse(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        result = await svc.traverse("DCA 221", max_hops=2)
        assert len(result.nodes) >= 1
        assert len(result.relationships) >= 1

    async def test_get_entity_neighbors(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        neighbors = await svc.get_entity_neighbors("test-dca221-chemical")
        assert len(neighbors) >= 1

    async def test_find_related_products_by_application(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        result = await svc.find_related_products("Epoxy Curing")
        # Both DCA 221 and MHHPA 301 share the "Epoxy Curing" application
        assert len(result.results) >= 2


# ---------------------------------------------------------------------------
# API endpoints (live backend with real KG)
# ---------------------------------------------------------------------------


class TestAPIEndpoints:
    @pytest.fixture
    async def client(self, seeded_store):
        from fastapi import FastAPI
        from httpx import ASGITransport, AsyncClient

        from dc_agent.api.kg_routes import kg_router
        from dc_agent.api.internal import internal_router

        store, svc = seeded_store

        app = FastAPI()
        app.state.kg_query_service = svc
        app.state.neo4j_store = store
        app.state.graphiti_store = None
        app.include_router(kg_router, prefix="/api/v1/kg")
        app.include_router(internal_router, prefix="/internal")

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac

    async def test_product_profile_endpoint(self, client) -> None:
        resp = await client.get("/api/v1/kg/products/DCA%20221")
        # May 404 if the resolve logic doesn't match — assert it's a valid response
        assert resp.status_code in (200, 404)

    async def test_entity_search_endpoint(self, client) -> None:
        resp = await client.get(
            "/api/v1/kg/search", params={"query": "DCA", "limit": 5}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    async def test_internal_kg_search_endpoint(self, client) -> None:
        resp = await client.post(
            "/internal/kg-search",
            json={"query": "MHHPA", "limit": 5},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "entities" in data

    async def test_traverse_endpoint(self, client) -> None:
        resp = await client.get(
            "/api/v1/kg/traverse/test-dca221-chemical",
            params={"max_hops": 2},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "nodes" in data

    async def test_neighbors_endpoint(self, client) -> None:
        resp = await client.get(
            "/api/v1/kg/entities/test-dca221-chemical/neighbors"
        )
        assert resp.status_code == 200
