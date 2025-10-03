"""Pydantic models for knowledge graph data structures."""

from typing import Any

from pydantic import BaseModel, Field


class KGProvenance(BaseModel):
    """Provenance information for knowledge graph data."""

    document_id: str
    page: int | None = Field(default=None, ge=1)

    class Config:
        extra = "allow"  # Allow additional provenance fields


class KGEntity(BaseModel):
    """Knowledge graph entity."""

    id: str
    text: str
    type: str
    canonical_name: str | None = None
    aliases: list[str] = Field(default_factory=list)
    source_text: str | None = None
    provenance: KGProvenance
    metadata: dict[str, Any] = Field(default_factory=dict)


class KGTriple(BaseModel):
    """Knowledge graph triple (relationship)."""

    subject: str | KGEntity
    predicate: str
    object: str | int | float | bool | None | KGEntity
    source_text: str | None = None
    provenance: KGProvenance
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class KnowledgeGraph(BaseModel):
    """Complete knowledge graph structure."""

    entities: list[KGEntity] = Field(default_factory=list)
    kg_triples: list[KGTriple] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class EnhancedApplication(BaseModel):
    """Enhanced application with additional context."""

    application: str
    confidence: float = Field(ge=0.0, le=1.0)
    supporting_properties: list[str] = Field(default_factory=list)
    market_segments: list[str] = Field(default_factory=list)
    technical_requirements: list[str] = Field(default_factory=list)


class PropertyRelationship(BaseModel):
    """Relationship between properties."""

    property_name: str
    related_properties: list[str] = Field(default_factory=list)
    relationship_type: str = Field(
        pattern="^(correlates_with|affects|depends_on|inverse_of)$"
    )
    strength: float = Field(ge=0.0, le=1.0)


class CompetitiveAnalysis(BaseModel):
    """Competitive analysis information."""

    competitor_product: str
    comparison_type: str = Field(pattern="^(similar|alternative|superior|inferior)$")
    key_differences: list[str] = Field(default_factory=list)
    advantages: list[str] = Field(default_factory=list)
    disadvantages: list[str] = Field(default_factory=list)


class UsageRecommendation(BaseModel):
    """Usage recommendation for a product."""

    application: str
    recommended_conditions: dict[str, Any] = Field(default_factory=dict)
    performance_expectations: dict[str, Any] = Field(default_factory=dict)
    formulation_guidelines: list[str] = Field(default_factory=list)
    safety_considerations: list[str] = Field(default_factory=list)


class DerivedInfo(BaseModel):
    """Derived information from knowledge graph analysis."""

    doc_id: str
    knowledge_graph: KnowledgeGraph = Field(default_factory=KnowledgeGraph)
    enhanced_applications: list[EnhancedApplication] = Field(default_factory=list)
    property_relationships: list[PropertyRelationship] = Field(default_factory=list)
    competitive_analysis: list[CompetitiveAnalysis] = Field(default_factory=list)
    usage_recommendations: list[UsageRecommendation] = Field(default_factory=list)
