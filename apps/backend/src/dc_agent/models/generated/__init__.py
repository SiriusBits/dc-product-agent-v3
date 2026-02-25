"""Generated Pydantic models from JSON Schema definitions.

Run `uv run python scripts/generate_models.py` to regenerate.
"""

# Re-export key models for convenient imports
from .common_defs_described_schema import (
    ContactInfo,
    Registration,
    PropertySpecRow,
    EpoxyResinRow,
    TableNote,
    Image,
)
from .kg_entity_schema import KgEntity
from .kg_entity_schema import Type as EntityType
from .kg_triple_schema import KgTriple
from .chunk_schema import EmbeddingChunkSchema, Metadata as ChunkMetadata
from .derived_info_with_knowledge_graph_with_defs_described_schema import (
    DerivedInformationKnowledgeGraphSchemaIdsRequired as DerivedInfoSchema,
    KnowledgeGraph,
    DerivedInfo,
)
from .base_technical_bulletin_with_defs_described_schema import (
    BaseTechnicalBulletinExtractionSchema,
    ProductInfo,
)

__all__ = [
    "BaseTechnicalBulletinExtractionSchema",
    "ChunkMetadata",
    "ContactInfo",
    "DerivedInfo",
    "DerivedInfoSchema",
    "EmbeddingChunkSchema",
    "EntityType",
    "EpoxyResinRow",
    "Image",
    "KgEntity",
    "KgTriple",
    "KnowledgeGraph",
    "ProductInfo",
    "PropertySpecRow",
    "Registration",
    "TableNote",
]
