"""Request and response models for the KG API endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class KGSearchRequest(BaseModel):
    """Body for POST /kg/search."""

    query: str
    entity_type: str | None = Field(
        default=None,
        description="Optional node label filter (e.g. Chemical, Application).",
    )
    limit: int = Field(default=20, ge=1, le=100)


class KGCompareRequest(BaseModel):
    """Body for POST /kg/compare."""

    property_name: str = Field(description="Property canonical_name to compare.")
    temperature: str | None = Field(
        default=None,
        description="Optional temperature filter (e.g. '25°C').",
    )


class KGTraverseRequest(BaseModel):
    """Body for POST /kg/traverse."""

    start_node: str = Field(description="Name or ID of the start node.")
    relationship_types: list[str] | None = Field(
        default=None,
        description="Optional relationship types to follow.",
    )
    max_hops: int = Field(default=2, ge=1, le=3)
    limit: int = Field(default=100, ge=1, le=500)


# ---------------------------------------------------------------------------
# Response models (thin wrappers for consistency)
# ---------------------------------------------------------------------------


class KGHealthResponse(BaseModel):
    """Response for GET /kg/health."""

    neo4j: str = Field(description="'ok' or error message")
    graphiti: str = Field(description="'ok' or error message")


class LabelCount(BaseModel):
    label: str
    count: int


class RelTypeCount(BaseModel):
    type: str
    count: int


class KGStatsResponse(BaseModel):
    """Response for GET /kg/stats."""

    total_nodes: int
    total_relationships: int
    nodes_by_label: list[LabelCount] = Field(default_factory=list)
    relationships_by_type: list[RelTypeCount] = Field(default_factory=list)
