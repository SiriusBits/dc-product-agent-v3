"""Pydantic models for API requests and responses."""

from datetime import datetime
from enum import Enum
from typing import Any, Generic, TypeVar
from uuid import uuid4

from pydantic import BaseModel, Field

T = TypeVar('T')


class QueryType(str, Enum):
    """Types of queries the system can handle."""

    SPECIFICATION = "specification"
    APPLICATION = "application"
    COMPARISON = "comparison"
    RELATIONSHIP = "relationship"
    GENERAL = "general"


class ApiResponse(BaseModel, Generic[T]):
    """Standard API response wrapper."""

    data: T
    success: bool = True
    message: str | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: str | None = Field(default_factory=lambda: str(uuid4()))


class ApiError(BaseModel):
    """Standard API error response."""

    error_code: str
    message: str
    details: dict[str, Any] | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: str = Field(default_factory=lambda: str(uuid4()))


class QueryAnalysis(BaseModel):
    """Analysis of a user query."""

    query_type: QueryType
    entities: list[str] = Field(default_factory=list)
    intent_confidence: float = Field(ge=0.0, le=1.0)
    suggested_strategy: dict[str, Any] = Field(default_factory=dict)


class RetrievalResult(BaseModel):
    """Result from retrieval system."""

    content: str
    score: float = Field(ge=0.0, le=1.0)
    source: str = Field(description="Source of the result: vector, kg, or hybrid")
    metadata: dict[str, Any] = Field(default_factory=dict)
    provenance: dict[str, Any] = Field(default_factory=dict)


class QueryOptions(BaseModel):
    """Options for query processing."""

    vector_weight: float | None = Field(default=0.5, ge=0.0, le=1.0)
    kg_weight: float | None = Field(default=0.5, ge=0.0, le=1.0)
    min_confidence: float | None = Field(default=0.1, ge=0.0, le=1.0)
    max_depth: int | None = Field(default=2, ge=1, le=5)
    include_images: bool | None = Field(default=False)


class ChatRequest(BaseModel):
    """Request for chat endpoint."""

    query: str = Field(min_length=1, max_length=1000)
    conversation_id: str | None = None
    max_results: int | None = Field(default=10, ge=1, le=50)
    include_sources: bool | None = Field(default=True)
    query_options: QueryOptions | None = None


class ChatResponse(BaseModel):
    """Response from chat endpoint."""

    answer: str
    sources: list[RetrievalResult] = Field(default_factory=list)
    conversation_id: str
    query_analysis: QueryAnalysis
    response_time_ms: int = Field(ge=0)
    kg_enhanced: bool = Field(default=False)


class ChatMessage(BaseModel):
    """Individual chat message."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    content: str
    role: str = Field(pattern="^(user|assistant)$")
    sources: list[RetrievalResult] | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    conversation_id: str


class Conversation(BaseModel):
    """Chat conversation."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    messages: list[ChatMessage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    title: str | None = None
    metadata: dict[str, Any] | None = None


class PropertyFilter(BaseModel):
    """Filter for product properties."""

    name: str
    operator: str = Field(pattern="^(eq|gt|lt|gte|lte|range)$")
    value: int | float | str
    max_value: int | float | None = None


class ProductSearchRequest(BaseModel):
    """Request for product search."""

    query: str | None = Field(default=None, max_length=500)
    family: str | None = None
    applications: list[str] | None = None
    properties: list[PropertyFilter] | None = None
    limit: int | None = Field(default=20, ge=1, le=100)
    offset: int | None = Field(default=0, ge=0)
    sort_by: str | None = Field(
        default="relevance", pattern="^(name|family|relevance)$"
    )
    sort_order: str | None = Field(default="desc", pattern="^(asc|desc)$")


class FacetCount(BaseModel):
    """Count for a facet value."""

    value: str
    count: int = Field(ge=0)


class PropertyFacet(BaseModel):
    """Facet for numeric properties."""

    name: str
    min_value: float
    max_value: float
    unit: str | None = None
    count: int = Field(ge=0)


class SearchFacets(BaseModel):
    """Search result facets."""

    families: list[FacetCount] = Field(default_factory=list)
    applications: list[FacetCount] = Field(default_factory=list)
    manufacturers: list[FacetCount] = Field(default_factory=list)
    properties: list[PropertyFacet] = Field(default_factory=list)


class ProductSummary(BaseModel):
    """Summary information for a product."""

    id: str
    name: str
    short_name: str | None = None
    family: str | None = None
    cas_number: str | None = None
    applications: list[str] = Field(default_factory=list)
    key_properties: list[str] = Field(default_factory=list)
    document_count: int = Field(ge=0)


class ProductSearchResponse(BaseModel):
    """Response from product search."""

    products: list[ProductSummary] = Field(default_factory=list)
    total_count: int = Field(ge=0)
    facets: SearchFacets = Field(default_factory=SearchFacets)
    query_info: dict[str, Any] = Field(default_factory=dict)


class KGQueryRequest(BaseModel):
    """Request for knowledge graph query."""

    entity_name: str = Field(min_length=1, max_length=200)
    relationship_types: list[str] | None = None
    max_depth: int | None = Field(default=2, ge=1, le=5)
    limit: int | None = Field(default=20, ge=1, le=100)
    include_properties: bool | None = Field(default=True)


class GraphNode(BaseModel):
    """Node in graph visualization."""

    id: str
    label: str
    type: str
    properties: dict[str, Any] = Field(default_factory=dict)
    size: float | None = None
    color: str | None = None
    position: dict[str, float] | None = None


class GraphEdge(BaseModel):
    """Edge in graph visualization."""

    id: str
    source: str
    target: str
    label: str
    type: str
    weight: float | None = None
    color: str | None = None


class GraphVisualizationData(BaseModel):
    """Data for graph visualization."""

    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    layout_hints: dict[str, Any] | None = None


class KGRelationship(BaseModel):
    """Knowledge graph relationship."""

    id: str
    source_entity_id: str
    target_entity_id: str
    relationship_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    source_text: str | None = None
    provenance: dict[str, Any] = Field(default_factory=dict)


class KGQueryResponse(BaseModel):
    """Response from knowledge graph query."""

    central_entity: "KGEntity"
    related_entities: list["KGEntity"] = Field(default_factory=list)
    relationships: list[KGRelationship] = Field(default_factory=list)
    graph_data: GraphVisualizationData = Field(default_factory=GraphVisualizationData)


class ServiceStatus(BaseModel):
    """Status of an individual service."""

    name: str
    status: str = Field(pattern="^(up|down|degraded)$")
    response_time_ms: int | None = None
    last_check: datetime = Field(default_factory=datetime.utcnow)
    details: dict[str, Any] | None = None


class SystemStatus(BaseModel):
    """Overall system status."""

    status: str = Field(pattern="^(healthy|degraded|unhealthy)$")
    services: list[ServiceStatus] = Field(default_factory=list)
    version: str
    uptime_seconds: int = Field(ge=0)
    last_updated: datetime = Field(default_factory=datetime.utcnow)


# Forward reference resolution
from .kg_models import KGEntity

KGQueryResponse.model_rebuild()
