"""Pydantic models for Graphiti episodic memory layer.

Includes typed wrappers for search results (mapped from Graphiti's
EntityEdge) and episode ingestion input.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from graphiti_core.nodes import EpisodeType
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Search result models
# ---------------------------------------------------------------------------


class GraphitiSearchResult(BaseModel):
    """Single search result mapped from ``graphiti_core.edges.EntityEdge``."""

    uuid: str
    name: str
    fact: str
    source_node_uuid: str
    target_node_uuid: str
    created_at: Optional[datetime] = None
    valid_at: Optional[datetime] = None
    expired_at: Optional[datetime] = None
    episodes: list[str] = Field(default_factory=list)


class GraphitiSearchResponse(BaseModel):
    """Aggregated search response returned by ``GraphitiKGStore.search``."""

    query: str
    results: list[GraphitiSearchResult] = Field(default_factory=list)
    count: int = 0


# ---------------------------------------------------------------------------
# Episode ingestion models
# ---------------------------------------------------------------------------


class EpisodeInput(BaseModel):
    """Validated input for a single Graphiti episode."""

    name: str = Field(description="Episode identifier (typically doc_id)")
    body: str = Field(description="Episode text content (derived summary)")
    source_description: str = Field(description="Source attribution (filename)")
    reference_time: datetime = Field(description="Temporal anchor for the episode")
    source_type: EpisodeType = Field(default=EpisodeType.text)
    group_id: str = Field(default="dixie-products")
