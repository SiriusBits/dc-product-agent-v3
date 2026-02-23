"""Pydantic response models for KG query results.

These models provide typed, serialisable representations of the data
returned by :class:`~dc_agent.kg.query_service.KGQueryService`.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------


class KGNode(BaseModel):
    """A single graph node."""

    id: str
    label: str
    canonical_name: str
    properties: dict[str, Any] = Field(default_factory=dict)


class KGRelationship(BaseModel):
    """A single directed relationship."""

    type: str
    source_id: str
    target_id: str
    properties: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Product profile
# ---------------------------------------------------------------------------


class PropertyEntry(BaseModel):
    """A property attached to a product / chemical via HAS_PROPERTY."""

    property_name: str
    value: str = ""
    numeric_value: float | None = None
    unit: str = ""
    temperature: str = ""
    source_predicate: str = ""


class IdentifierEntry(BaseModel):
    """An identifier (CAS, REACH, …) linked via HAS_IDENTIFIER."""

    identifier_type: str = ""
    value: str = ""


class ProductProfile(BaseModel):
    """Full product / chemical profile assembled from the graph."""

    node: KGNode
    classification: list[str] = Field(
        default_factory=list,
        description="ChemicalClass names via IS_A",
    )
    applications: list[str] = Field(default_factory=list)
    properties: list[PropertyEntry] = Field(default_factory=list)
    identifiers: list[IdentifierEntry] = Field(default_factory=list)
    manufacturer: str | None = None
    benefits: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Safety profile
# ---------------------------------------------------------------------------


class HazardEntry(BaseModel):
    description: str
    hazard_type: str = ""
    severity: str = ""


class PPEEntry(BaseModel):
    ppe_type: str
    description: str = ""


class FirstAidEntry(BaseModel):
    instruction: str
    route: str = ""


class StorageEntry(BaseModel):
    requirement: str
    requirement_type: str = ""


class ToxicityEntry(BaseModel):
    test_type: str = ""
    value: str = ""
    route: str = ""
    species: str = ""


class SafetyProfile(BaseModel):
    """Safety data for a chemical node."""

    node: KGNode
    hazards: list[HazardEntry] = Field(default_factory=list)
    ppe: list[PPEEntry] = Field(default_factory=list)
    first_aid: list[FirstAidEntry] = Field(default_factory=list)
    storage: list[StorageEntry] = Field(default_factory=list)
    toxicity: list[ToxicityEntry] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Property comparison
# ---------------------------------------------------------------------------


class PropertyComparisonRow(BaseModel):
    """One row in a cross-product property comparison."""

    chemical_name: str
    value: str = ""
    numeric_value: float | None = None
    unit: str = ""


class PropertyComparisonResult(BaseModel):
    """Cross-product comparison for a named property."""

    property_name: str
    temperature: str | None = None
    rows: list[PropertyComparisonRow] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Formulation
# ---------------------------------------------------------------------------


class FormulationComponent(BaseModel):
    """A single component in a formulation."""

    component_name: str
    amount: str = ""
    amount_unit: str = ""
    role: str = ""
    source_predicate: str = ""


class FormulationResult(BaseModel):
    """Formulation data for a chemical."""

    chemical_name: str
    formulation_name: str | None = None
    components: list[FormulationComponent] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Entity search (fulltext)
# ---------------------------------------------------------------------------


class EntitySearchResult(BaseModel):
    """A hit from the full-text entity search."""

    id: str
    label: str
    canonical_name: str
    score: float


# ---------------------------------------------------------------------------
# Traversal
# ---------------------------------------------------------------------------


class TraversalResult(BaseModel):
    """A subgraph returned by variable-length path traversal."""

    nodes: list[KGNode] = Field(default_factory=list)
    relationships: list[KGRelationship] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Related products
# ---------------------------------------------------------------------------


class RelatedProductEntry(BaseModel):
    """A product related via a shared entity."""

    product_id: str
    product_name: str
    shared_entity: str
    relationship_type: str


class RelatedProductsResult(BaseModel):
    """Products sharing a given entity (application, class, property)."""

    query_entity: str
    results: list[RelatedProductEntry] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Neighbors
# ---------------------------------------------------------------------------


class NeighborEntry(BaseModel):
    """A neighbor node with the connecting relationship."""

    relationship: KGRelationship
    node: KGNode
