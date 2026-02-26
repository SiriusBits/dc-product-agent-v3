"""Request/response models for internal n8n-facing retrieval endpoints.

These endpoints are called by the n8n retrieval orchestration workflow and
return simplified shapes optimised for the fusion Code nodes.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class InternalVectorSearchRequest(BaseModel):
    """Request for /internal/vector-search."""

    query: str
    top_k: int = Field(default=5, ge=1, le=50)


class InternalKGSearchRequest(BaseModel):
    """Request for /internal/kg-search.

    When ``include_profile`` is true the endpoint also fetches the full
    product profile for the top entity match (if it resolves to a
    Chemical/Product node).
    """

    query: str
    limit: int = Field(default=5, ge=1, le=50)
    include_profile: bool = Field(
        default=True,
        description="Also fetch the product profile for the top match.",
    )


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class VectorResultItem(BaseModel):
    """Single vector search result in simplified n8n-friendly shape."""

    chunk_text: str
    product_name: str = ""
    section_name: str = ""
    relevance_score: float = 0.0
    doc_id: str | None = None
    product_id: str = ""


class InternalVectorSearchResponse(BaseModel):
    """Response from /internal/vector-search."""

    results: list[VectorResultItem] = Field(default_factory=list)
    count: int = 0


class KGEntityItem(BaseModel):
    """Single KG entity search result."""

    id: str
    label: str = ""
    canonical_name: str = ""
    score: float = 0.0


class KGProfileItem(BaseModel):
    """Condensed product profile from the knowledge graph."""

    product_name: str
    classification: list[str] = Field(default_factory=list)
    applications: list[str] = Field(default_factory=list)
    properties: list[dict[str, Any]] = Field(default_factory=list)
    identifiers: list[dict[str, str]] = Field(default_factory=list)
    manufacturer: str | None = None
    benefits: list[str] = Field(default_factory=list)


class InternalKGSearchResponse(BaseModel):
    """Response from /internal/kg-search."""

    entities: list[KGEntityItem] = Field(default_factory=list)
    profile: KGProfileItem | None = None
    count: int = 0
