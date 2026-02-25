"""Models for n8n retrieval orchestration."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class QueryIntent(str, Enum):
    """Query classification intent."""

    VECTOR = "vector"
    KG = "kg"
    HYBRID = "hybrid"


class N8nRetrievalRequest(BaseModel):
    """Request sent to the n8n retrieval webhook."""

    query: str
    conversation_id: str | None = None
    intent_hint: QueryIntent | None = Field(
        default=None,
        description="Optional hint to override automatic classification.",
    )
    top_k: int = Field(default=5, ge=1, le=20)


class N8nResultItem(BaseModel):
    """A single result from n8n retrieval orchestration."""

    content: str
    source: str = ""
    source_type: str = Field(
        default="vector",
        description="Origin: 'vector', 'kg', or 'graphiti'.",
    )
    score: float = 0.0
    product_name: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class N8nTraceMetadata(BaseModel):
    """Execution metadata returned by n8n for debugging."""

    execution_id: str = ""
    intent: QueryIntent = QueryIntent.HYBRID
    sources_queried: list[str] = Field(default_factory=list)
    timing_ms: dict[str, float] = Field(
        default_factory=dict,
        description="Per-source timing in milliseconds.",
    )
    total_ms: float = 0.0


class N8nRetrievalResponse(BaseModel):
    """Response from the n8n retrieval webhook."""

    results: list[N8nResultItem] = Field(default_factory=list)
    metadata: N8nTraceMetadata = Field(default_factory=N8nTraceMetadata)
