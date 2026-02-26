"""Internal endpoints consumed by the n8n retrieval orchestration workflow.

Mounted at ``/internal`` — these are NOT part of the public API.
They provide simplified request/response shapes optimised for n8n
Code-node fusion logic.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from dc_agent.api.internal_models import (
    InternalKGSearchRequest,
    InternalKGSearchResponse,
    InternalVectorSearchRequest,
    InternalVectorSearchResponse,
    KGEntityItem,
    KGProfileItem,
    VectorResultItem,
)
from dc_agent.services.search import get_search_service

logger = logging.getLogger(__name__)

internal_router = APIRouter(tags=["Internal — n8n"])


# ---------------------------------------------------------------------------
# Vector search
# ---------------------------------------------------------------------------


@internal_router.post(
    "/vector-search",
    response_model=InternalVectorSearchResponse,
)
async def internal_vector_search(body: InternalVectorSearchRequest) -> InternalVectorSearchResponse:
    """Semantic vector search over product documents.

    Wraps :pymethod:`SearchService.semantic_search` and returns a
    flattened result list for the n8n fusion node.
    """
    search_service = get_search_service()
    response = search_service.semantic_search(query=body.query, top_k=body.top_k)

    items = [
        VectorResultItem(
            chunk_text=r.chunk_text,
            product_name=r.product_name,
            section_name=r.section_name,
            relevance_score=r.relevance_score,
            doc_id=r.doc_id,
            product_id=r.product_id,
        )
        for r in response.results
    ]

    return InternalVectorSearchResponse(results=items, count=len(items))


# ---------------------------------------------------------------------------
# Knowledge graph search
# ---------------------------------------------------------------------------


def _get_kg_query_service(request: Request):
    """Retrieve the KGQueryService from app state, or raise 503."""
    svc = getattr(request.app.state, "kg_query_service", None)
    if svc is None:
        raise HTTPException(
            status_code=503,
            detail="Knowledge graph query service is not available",
        )
    return svc


@internal_router.post(
    "/kg-search",
    response_model=InternalKGSearchResponse,
)
async def internal_kg_search(
    body: InternalKGSearchRequest,
    request: Request,
) -> InternalKGSearchResponse:
    """KG entity search with optional product profile enrichment.

    1. Runs fulltext entity search via :pymethod:`KGQueryService.search_entities`.
    2. If ``include_profile`` is true **and** the top hit is a Chemical or
       Product node, fetches its full profile.
    """
    svc = _get_kg_query_service(request)

    try:
        entities = await svc.search_entities(body.query, limit=body.limit)
    except Exception as exc:
        logger.warning("KG entity search failed: %s", exc)
        return InternalKGSearchResponse()

    entity_items = [
        KGEntityItem(
            id=e.id,
            label=e.label,
            canonical_name=e.canonical_name,
            score=e.score,
        )
        for e in entities
    ]

    profile: KGProfileItem | None = None

    if body.include_profile and entity_items:
        top = entity_items[0]
        if top.label in ("Chemical", "Product"):
            try:
                pp = await svc.get_product_profile(top.canonical_name)
                if pp is not None:
                    profile = KGProfileItem(
                        product_name=pp.node.canonical_name,
                        classification=pp.classification,
                        applications=pp.applications,
                        properties=[
                            {
                                "name": p.property_name,
                                "value": p.value,
                                "unit": p.unit,
                                "temperature": p.temperature,
                            }
                            for p in pp.properties
                        ],
                        identifiers=[
                            {"type": i.identifier_type, "value": i.value}
                            for i in pp.identifiers
                        ],
                        manufacturer=pp.manufacturer,
                        benefits=pp.benefits,
                    )
            except Exception as exc:
                logger.warning("KG profile fetch failed for %s: %s", top.canonical_name, exc)

    return InternalKGSearchResponse(
        entities=entity_items,
        profile=profile,
        count=len(entity_items),
    )
