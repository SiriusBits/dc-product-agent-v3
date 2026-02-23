"""KG API endpoints — exposes KGQueryService over HTTP.

Mounted at ``/api/v1/kg`` by ``main.py``.  All endpoints retrieve the
``KGQueryService`` and ``GraphitiKGStore`` from ``request.app.state``.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from dc_agent.api.kg_models import (
    KGCompareRequest,
    KGHealthResponse,
    KGSearchRequest,
    KGStatsResponse,
    KGTraverseRequest,
    LabelCount,
    RelTypeCount,
)
from dc_agent.kg.query_models import (
    EntitySearchResult,
    FormulationResult,
    KGNode,
    NeighborEntry,
    ProductProfile,
    PropertyComparisonResult,
    RelatedProductsResult,
    SafetyProfile,
    TraversalResult,
)

logger = logging.getLogger(__name__)

kg_router = APIRouter(tags=["Knowledge Graph"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_query_service(request: Request):
    """Retrieve the KGQueryService from app state, or raise 503."""
    svc = getattr(request.app.state, "kg_query_service", None)
    if svc is None:
        raise HTTPException(
            status_code=503,
            detail="Knowledge graph query service is not available",
        )
    return svc


def _get_neo4j_store(request: Request):
    """Retrieve the Neo4jKGStore from app state, or raise 503."""
    store = getattr(request.app.state, "neo4j_store", None)
    if store is None:
        raise HTTPException(
            status_code=503,
            detail="Neo4j store is not available",
        )
    return store


# ---------------------------------------------------------------------------
# Product endpoints
# ---------------------------------------------------------------------------


@kg_router.get("/products/{name}", response_model=ProductProfile)
async def get_product_profile(name: str, request: Request):
    """Full product profile from the knowledge graph."""
    svc = _get_query_service(request)
    profile = await svc.get_product_profile(name)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Product not found: {name}")
    return profile


@kg_router.get("/products/{name}/safety", response_model=SafetyProfile)
async def get_product_safety(name: str, request: Request):
    """Safety profile (hazards, PPE, first-aid, storage, toxicity)."""
    svc = _get_query_service(request)
    profile = await svc.get_safety_profile(name)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Product not found: {name}")
    return profile


@kg_router.get("/products/{name}/related", response_model=RelatedProductsResult)
async def get_related_products(
    name: str,
    request: Request,
    relationship_type: str | None = None,
):
    """Products sharing a relationship with the given entity."""
    svc = _get_query_service(request)
    try:
        return await svc.find_related_products(
            name, relationship_type=relationship_type
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@kg_router.get("/products/{name}/formulations", response_model=FormulationResult)
async def get_product_formulations(
    name: str,
    request: Request,
    formulation_name: str | None = None,
):
    """Formulation components for a product."""
    svc = _get_query_service(request)
    result = await svc.get_formulations(name, formulation_name=formulation_name)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Product not found: {name}")
    return result


# ---------------------------------------------------------------------------
# Compare
# ---------------------------------------------------------------------------


@kg_router.post("/compare", response_model=PropertyComparisonResult)
async def compare_property(body: KGCompareRequest, request: Request):
    """Compare a property across all chemicals that have it."""
    svc = _get_query_service(request)
    return await svc.compare_property(
        body.property_name, temperature=body.temperature
    )


# ---------------------------------------------------------------------------
# Entity / search endpoints
# ---------------------------------------------------------------------------


@kg_router.post("/search", response_model=list[EntitySearchResult])
async def search_entities(body: KGSearchRequest, request: Request):
    """Full-text entity search across the knowledge graph."""
    svc = _get_query_service(request)
    labels = [body.entity_type] if body.entity_type else None
    try:
        return await svc.search_entities(body.query, labels=labels, limit=body.limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@kg_router.get("/entity/{entity_id}", response_model=KGNode)
async def get_entity(entity_id: str, request: Request):
    """Look up a single entity by ID or name."""
    svc = _get_query_service(request)
    node = await svc.get_entity_by_id(entity_id)
    if node is None:
        raise HTTPException(status_code=404, detail=f"Entity not found: {entity_id}")
    return node


@kg_router.get("/entity/{entity_id}/neighbors", response_model=list[NeighborEntry])
async def get_entity_neighbors(
    entity_id: str,
    request: Request,
    direction: str = "both",
    limit: int = 50,
):
    """One-hop neighbors of a node."""
    svc = _get_query_service(request)
    if direction not in ("out", "in", "both"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid direction: {direction!r} (must be out, in, or both)",
        )
    return await svc.get_entity_neighbors(
        entity_id, direction=direction, limit=limit
    )


# ---------------------------------------------------------------------------
# Traversal
# ---------------------------------------------------------------------------


@kg_router.post("/traverse", response_model=TraversalResult)
async def traverse(body: KGTraverseRequest, request: Request):
    """Variable-length path traversal from a start node."""
    svc = _get_query_service(request)
    try:
        return await svc.traverse(
            body.start_node,
            max_hops=body.max_hops,
            rel_types=body.relationship_types,
            limit=body.limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ---------------------------------------------------------------------------
# Admin / health
# ---------------------------------------------------------------------------


@kg_router.get("/health", response_model=KGHealthResponse)
async def kg_health(request: Request):
    """Health check for Neo4j and Graphiti."""
    # Neo4j
    neo4j_status = "unavailable"
    store = getattr(request.app.state, "neo4j_store", None)
    if store is not None:
        try:
            if await store.verify_connectivity():
                neo4j_status = "ok"
            else:
                neo4j_status = "unreachable"
        except Exception as exc:
            neo4j_status = f"error: {exc}"

    # Graphiti
    graphiti_status = "unavailable"
    graphiti = getattr(request.app.state, "graphiti_store", None)
    if graphiti is not None and graphiti._initialized:
        try:
            health = await graphiti.health_check()
            graphiti_status = "ok" if health.get("status") == "ok" else str(health)
        except Exception as exc:
            graphiti_status = f"error: {exc}"

    return KGHealthResponse(neo4j=neo4j_status, graphiti=graphiti_status)


@kg_router.get("/stats", response_model=KGStatsResponse)
async def kg_stats(request: Request):
    """Node and relationship counts by label/type."""
    store = _get_neo4j_store(request)

    # Node counts by label
    rows: list[dict[str, Any]] = await store.query(
        "MATCH (n) "
        "WITH labels(n) AS lbls "
        "UNWIND lbls AS lbl "
        "RETURN lbl, count(*) AS cnt "
        "ORDER BY cnt DESC"
    )
    nodes_by_label = [LabelCount(label=r["lbl"], count=r["cnt"]) for r in rows]
    total_nodes = sum(lc.count for lc in nodes_by_label)

    # Relationship counts by type
    rows = await store.query(
        "MATCH ()-[r]->() "
        "RETURN type(r) AS rtype, count(*) AS cnt "
        "ORDER BY cnt DESC"
    )
    rels_by_type = [RelTypeCount(type=r["rtype"], count=r["cnt"]) for r in rows]
    total_rels = sum(rc.count for rc in rels_by_type)

    return KGStatsResponse(
        total_nodes=total_nodes,
        total_relationships=total_rels,
        nodes_by_label=nodes_by_label,
        relationships_by_type=rels_by_type,
    )
