from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class QueryRequest(BaseModel):
    """Request model for the query endpoint."""
    query: str = Field(..., description="The natural language query.")
    top_k: int = Field(5, description="Number of results to retrieve.")

class Source(BaseModel):
    """Model representing a source document."""
    id: str
    content: str
    metadata: Dict[str, Any]

class QueryResponse(BaseModel):
    """Response model for the query endpoint."""
    answer: str = Field(..., description="The generated answer.")
    sources: List[Source] = Field(..., description="List of source documents used.")

class IngestRequest(BaseModel):
    """Request model for the ingest endpoint."""
    source_dir: Optional[str] = Field(None, description="Directory containing documents to ingest.")
