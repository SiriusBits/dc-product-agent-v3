"""Pydantic models for search functionality."""

from pydantic import BaseModel, Field
from typing import List, Optional


class SearchRequest(BaseModel):
    """Request model for the search endpoint."""
    
    query: str = Field(..., description="The natural language search query.")
    top_k: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Number of results to retrieve (1-100)."
    )


class SearchResult(BaseModel):
    """Individual search result with product attribution."""
    
    product_id: str = Field(..., description="Short product identifier (e.g., 'MHHPA_301').")
    product_name: str = Field(..., description="Full product name.")
    section_name: str = Field(..., description="Section name within the document.")
    chunk_text: str = Field(..., description="The text content of the matching chunk.")
    relevance_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Relevance score (0-1, higher is more relevant)."
    )
    chunk_type: Optional[str] = Field(
        default=None,
        description="Type of chunk (e.g., 'section', 'properties', 'summary')."
    )
    doc_id: Optional[str] = Field(
        default=None,
        description="Document ID from the source file."
    )
    page: Optional[int] = Field(
        default=None,
        description="Page number in the original document."
    )


class SearchResponse(BaseModel):
    """Response model for the search endpoint."""
    
    query: str = Field(..., description="The original search query.")
    results: List[SearchResult] = Field(
        default_factory=list,
        description="List of search results."
    )
    total_results: int = Field(..., description="Total number of results returned.")
