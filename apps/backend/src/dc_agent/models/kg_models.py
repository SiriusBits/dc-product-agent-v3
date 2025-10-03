"""Pydantic models for knowledge graph data structures."""

from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class KGProvenance(BaseModel):
    """Provenance information for knowledge graph data."""
    
    document_id: str
    page: Optional[int] = Field(default=None, ge=1)
    
    class Config:
        extra = "allow"  # Allow additional provenance fields


class KGEntity(BaseModel):
    """Knowledge graph entity."""
    
    id: str
    text: str
    type: str
    canonical_name: Optional[str] = None
    aliases: List[str] = Field(default_factory=list)
    source_text: Optional[str] = None
    provenance: KGProvenance
    metadata: Dict[str, Any] = Field(default_factory=dict)


class KGTriple(BaseModel):
    """Knowledge graph triple (relationship)."""
    
    subject: Union[str, KGEntity]
    predicate: str
    object: Union[str, int, float, bool, None, KGEntity]
    source_text: Optional[str] = None
    provenance: KGProvenance
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class KnowledgeGraph(BaseModel):
    """Complete knowledge graph structure."""
    
    entities: List[KGEntity] = Field(default_factory=list)
    kg_triples: List[KGTriple] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class EnhancedApplication(BaseModel):
    """Enhanced application with additional context."""
    
    application: str
    confidence: float = Field(ge=0.0, le=1.0)
    supporting_properties: List[str] = Field(default_factory=list)
    market_segments: List[str] = Field(default_factory=list)
    technical_requirements: List[str] = Field(default_factory=list)


class PropertyRelationship(BaseModel):
    """Relationship between properties."""
    
    property_name: str
    related_properties: List[str] = Field(default_factory=list)
    relationship_type: str = Field(regex="^(correlates_with|affects|depends_on|inverse_of)$")
    strength: float = Field(ge=0.0, le=1.0)


class CompetitiveAnalysis(BaseModel):
    """Competitive analysis information."""
    
    competitor_product: str
    comparison_type: str = Field(regex="^(similar|alternative|superior|inferior)$")
    key_differences: List[str] = Field(default_factory=list)
    advantages: List[str] = Field(default_factory=list)
    disadvantages: List[str] = Field(default_factory=list)


class UsageRecommendation(BaseModel):
    """Usage recommendation for a product."""
    
    application: str
    recommended_conditions: Dict[str, Any] = Field(default_factory=dict)
    performance_expectations: Dict[str, Any] = Field(default_factory=dict)
    formulation_guidelines: List[str] = Field(default_factory=list)
    safety_considerations: List[str] = Field(default_factory=list)


class DerivedInfo(BaseModel):
    """Derived information from knowledge graph analysis."""
    
    doc_id: str
    knowledge_graph: KnowledgeGraph = Field(default_factory=KnowledgeGraph)
    enhanced_applications: List[EnhancedApplication] = Field(default_factory=list)
    property_relationships: List[PropertyRelationship] = Field(default_factory=list)
    competitive_analysis: List[CompetitiveAnalysis] = Field(default_factory=list)
    usage_recommendations: List[UsageRecommendation] = Field(default_factory=list)