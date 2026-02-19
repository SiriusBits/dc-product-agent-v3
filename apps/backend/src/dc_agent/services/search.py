"""Search service for semantic search over product documents."""

import logging
from typing import List, Optional

from dc_agent.vector.chroma import ChromaVectorStore
from dc_agent.models.search import SearchResult, SearchResponse

logger = logging.getLogger(__name__)


class SearchService:
    """Service for semantic search over product documents using ChromaDB."""
    
    def __init__(self, vector_store: Optional[ChromaVectorStore] = None):
        """Initialize the SearchService.
        
        Args:
            vector_store: ChromaVectorStore instance. If not provided, creates a new one.
        """
        self._vector_store = vector_store or ChromaVectorStore()
    
    @property
    def vector_store(self) -> ChromaVectorStore:
        """Get the underlying vector store."""
        return self._vector_store
    
    def semantic_search(self, query: str, top_k: int = 10) -> SearchResponse:
        """Perform semantic search over product documents.
        
        Args:
            query: Natural language search query.
            top_k: Number of results to retrieve.
            
        Returns:
            SearchResponse with results including product attribution.
        """
        logger.info(f"Performing semantic search: query='{query}', top_k={top_k}")
        
        # Query the vector store
        results = self._vector_store.query(query_text=query, n_results=top_k)
        
        search_results: List[SearchResult] = []
        
        if results and results.get("ids") and results["ids"][0]:
            ids = results["ids"][0]
            documents = results.get("documents", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]
            
            for i, doc_id in enumerate(ids):
                metadata = metadatas[i] if i < len(metadatas) else {}
                document = documents[i] if i < len(documents) else ""
                distance = distances[i] if i < len(distances) else 1.0
                
                # Convert distance to relevance score (ChromaDB uses L2 distance by default)
                # Lower distance = more similar, so we convert to 0-1 scale
                # Using 1 / (1 + distance) for bounded 0-1 score
                relevance_score = 1.0 / (1.0 + distance)
                
                search_results.append(SearchResult(
                    product_id=metadata.get("product_id", metadata.get("product", "unknown")),
                    product_name=metadata.get("product_name", "Unknown Product"),
                    section_name=metadata.get("section", "Unknown Section"),
                    chunk_text=document,
                    relevance_score=round(relevance_score, 4),
                    chunk_type=metadata.get("chunk_type"),
                    doc_id=metadata.get("doc_id"),
                    page=metadata.get("page"),
                ))
        
        logger.info(f"Found {len(search_results)} results for query: '{query}'")
        
        return SearchResponse(
            query=query,
            results=search_results,
            total_results=len(search_results),
        )


# Singleton instance
_search_service: Optional[SearchService] = None


def get_search_service() -> SearchService:
    """Get the singleton SearchService instance."""
    global _search_service
    if _search_service is None:
        _search_service = SearchService()
    return _search_service
