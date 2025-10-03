"""Pydantic models for API requests and responses."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class QueryType(str, Enum):
    """Types of queries the system can handle."""
    
    SPECIFICATION = "specification"
    APPLICATION = "application"
    COMPARISON = "comparison"
    RELATIONSHIP = "relationship"
    GENERAL = "general"


class ApiResponse(BaseModel):
    """Standard API response wrapper."""
    
    data: Any
    success: bool = True
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = Field(default_factory=lambda: str(uuid4()))


class ApiError(BaseModel):
    """Standard API error response."""
    
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: str = Field(default_factory=lambda: str(uuid4()))


class QueryAnalysis(BaseModel):
    """Analysis of a user query."""
    
    query_type: QueryType
    entities: List[str] = Field(default_factory=list)
    intent_confidence: float = Field(ge=0.0, le=1.0)
    suggested_strategy: Dict[str, Any] = Field(default_factory=dict)


class RetrievalResult(BaseModel):
    """Result from retrieval system."""
    
    content: str
    score: float = Field(ge=0.0, le=1.0)
    source: str = Field(description="Source of the result: vector, kg, or hybrid")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    provenance: Dict[str, Any] = Field(default_factory=dict)


class QueryOptions(BaseModel):
    """Options for query processing."""
    
    vector_weight: Optional[float] = Field(default=0.5, ge=0.0, le=1.0)
    kg_weight: Optional[float] = Field(default=0.5, ge=0.0, le=1.0)
    min_confidence: Optional[float] = Field(default=0.1, ge=0.0, le=1.0)
    max_depth: Optional[int] = Field(default=2, ge=1, le=5)
    include_images: Optional[bool] = Field(default=False)


class ChatRequest(BaseModel):
    """Request for chat endpoint."""
    
    query: str = Field(min_length=1, max_length=1000)
    conversation_id: Optional[str] = None
    max_results: Optional[int] = Field(default=10, ge=1, le=50)
    include_sources: Optional[bool] = Field(default=True)
    query_options: Optional[QueryOptions] = None


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    
    answer: str
    sources: List[RetrievalResult] = Field(default_factory=list)
    conversation_id: str
    query_analysis: QueryAnalysis
    response_time_ms: int = Field(ge=0)
    kg_enhanced: bool = Field(default=False)


class ChatMessage(BaseModel):
    """Individual chat message."""
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    content: str
    role: str = Field(regex="^(user|assistant)$")
    sources: Optional[List[RetrievalResult]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    conversation_id: str


class Conversation(BaseModel):
    """Chat conversation."""
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    messages: List[ChatMessage] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    title: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class PropertyFilter(BaseModel):
    """Filter for product properties."""
    
    name: str
    operator: str = Field(regex="^(eq|gt|lt|gte|lte|range)$")
    value: Union[int, float, str]
    max_value: Optional[Union[int, float]] = None


class ProductSearchRequest(BaseModel):
    """Request for product search."""
    
    query: Optional[str] = Field(default=None, max_length=500)
    family: Optional[str] = None
    applications: Optional[List[str]] = None
    properties: Optional[List[PropertyFilter]] = None
    limit: Optional[int] = Field(default=20, ge=1, le=100)
    offset: Optional[int] = Field(default=0, ge=0)
    sort_by: Optional[str] = Field(default="relevance", regex="^(name|family|relevance)$")
    sort_order: Optional[str] = Field(default="desc", regex="^(asc|desc)$")


class FacetCount(BaseModel):
    """Count for a facet value."""
    
    value: str
    count: int = Field(ge=0)


class PropertyFacet(BaseModel):
    """Facet for numeric properties."""
    
    name: str
    min_value: float
    max_value: float
    unit: Optional[str] = None
    count: int = Field(ge=0)


class SearchFacets(BaseModel):
    """Search result facets."""
    
    families: List[FacetCount] = Field(default_factory=list)
    applications: List[FacetCount] = Field(default_factory=list)
    manufacturers: List[FacetCount] = Field(default_factory=list)
    properties: List[PropertyFacet] = Field(default_factory=list)


class ProductSummary(BaseModel):
    """Summary information for a product."""
    
    id: str
    name: str
    short_name: Optional[str] = None
    family: Optional[str] = None
    cas_number: Optional[str] = None
    applications: List[str] = Field(default_factory=list)
    key_properties: List[str] = Field(default_factory=list)
    document_count: int = Field(ge=0)


class ProductSearchResponse(BaseModel):
    """Response from product search."""
    
    products: List[ProductSummary] = Field(default_factory=list)
    total_count: int = Field(ge=0)
    facets: SearchFacets = Field(default_factory=SearchFacets)
    query_info: Dict[str, Any] = Field(default_factory=dict)


class KGQueryRequest(BaseModel):
    """Request for knowledge graph query."""
    
    entity_name: str = Field(min_length=1, max_length=200)
    relationship_types: Optional[List[str]] = None
    max_depth: Optional[int] = Field(default=2, ge=1, le=5)
    limit: Optional[int] = Field(default=20, ge=1, le=100)
    include_properties: Optional[bool] = Field(default=True)


class GraphNode(BaseModel):
    """Node in graph visualization."""
    
    id: str
    label: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)
    size: Optional[float] = None
    color: Optional[str] = None
    position: Optional[Dict[str, float]] = None


class GraphEdge(BaseModel):
    """Edge in graph visualization."""
    
    id: str
    source: str
    target: str
    label: str
    type: str
    weight: Optional[float] = None
    color: Optional[str] = None


class GraphVisualizationData(BaseModel):
    """Data for graph visualization."""
    
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)
    layout_hints: Optional[Dict[str, Any]] = None


class KGRelationship(BaseModel):
    """Knowledge graph relationship."""
    
    id: str
    source_entity_id: str
    target_entity_id: str
    relationship_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    source_text: Optional[str] = None
    provenance: Dict[str, Any] = Field(default_factory=dict)


class KGQueryResponse(BaseModel):
    """Response from knowledge graph query."""
    
    central_entity: "KGEntity"
    related_entities: List["KGEntity"] = Field(default_factory=list)
    relationships: List[KGRelationship] = Field(default_factory=list)
    graph_data: GraphVisualizationData = Field(default_factory=GraphVisualizationData)


class ServiceStatus(BaseModel):
    """Status of an individual service."""
    
    name: str
    status: str = Field(regex="^(up|down|degraded)$")
    response_time_ms: Optional[int] = None
    last_check: datetime = Field(default_factory=datetime.utcnow)
    details: Optional[Dict[str, Any]] = None


class SystemStatus(BaseModel):
    """Overall system status."""
    
    status: str = Field(regex="^(healthy|degraded|unhealthy)$")
    services: List[ServiceStatus] = Field(default_factory=list)
    version: str
    uptime_seconds: int = Field(ge=0)
    last_updated: datetime = Field(default_factory=datetime.utcnow)


# Forward reference resolution
from .kg_models import KGEntity
KGQueryResponse.model_rebuild()