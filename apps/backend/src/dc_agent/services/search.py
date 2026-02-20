"""Search service for semantic search over product documents."""

import logging
import re
from typing import List, Optional, Set

from dc_agent.vector.chroma import ChromaVectorStore
from dc_agent.models.search import SearchResult, SearchResponse

logger = logging.getLogger(__name__)

# Known product short names for detection in queries
# These are the common names users would use when asking questions
KNOWN_PRODUCT_PATTERNS = [
    r'\bASA[- ]?100\b',
    r'\bASA[- ]?150\b',
    r'\bASA[- ]?155\b',
    r'\bMHHPA[- ]?301\b',
    r'\bMHHPA[- ]?NC\b',
    r'\bDCA[- ]?221\b',
    r'\bDCA[- ]?467\b',
    r'\bDCE[- ]?142\b',
    r'\bECA[- ]?100KA1\b',
    r'\bECA[- ]?608\b',
    r'\bECA[- ]?1000L\b',
    r'\bDDSA\b',
    r'\bODSA\b',
    r'\bNMA\b',
    r'\bJP[- ]?10\b',
    r'\bAP[- ]?6G\b',
    r'\bCG\b',
]

# Map patterns to normalized product names (as stored in metadata)
PRODUCT_NAME_MAP = {
    'ASA 100': 'ASA 100',
    'ASA-100': 'ASA 100',
    'ASA100': 'ASA 100',
    'ASA 150': 'ASA 150',
    'ASA-150': 'ASA 150',
    'ASA150': 'ASA 150',
    'ASA 155': 'ASA 155',
    'ASA-155': 'ASA 155',
    'ASA155': 'ASA 155',
    'MHHPA 301': 'MHHPA 301',
    'MHHPA-301': 'MHHPA 301',
    'MHHPA301': 'MHHPA 301',
    'MHHPA NC': 'MHHPA-NC',
    'MHHPA-NC': 'MHHPA-NC',
    'MHHPANC': 'MHHPA-NC',
    'DCA 221': 'DCA 221',
    'DCA-221': 'DCA 221',
    'DCA221': 'DCA 221',
    'DCA 467': 'DCA 467',
    'DCA-467': 'DCA 467',
    'DCA467': 'DCA 467',
    'DCE 142': 'DCE 142',
    'DCE-142': 'DCE 142',
    'DCE142': 'DCE 142',
    'ECA 100KA1': 'ECA 100KA1',
    'ECA-100KA1': 'ECA 100KA1',
    'ECA100KA1': 'ECA 100KA1',
    'ECA 608': 'ECA 608',
    'ECA-608': 'ECA 608',
    'ECA608': 'ECA 608',
    'ECA 1000L': 'ECA 1000L',
    'ECA-1000L': 'ECA 1000L',
    'ECA1000L': 'ECA 1000L',
    'DDSA': 'DDSA',
    'ODSA': 'ODSA',
    'NMA': 'NMA',
    'JP 10': 'JP-10',
    'JP-10': 'JP-10',
    'JP10': 'JP-10',
    'AP 6G': 'AP-6G',
    'AP-6G': 'AP-6G',
    'AP6G': 'AP-6G',
    'CG': 'CG',
}


def extract_mentioned_products(query: str) -> Set[str]:
    """Extract product names mentioned in a query.
    
    Args:
        query: The user's search query.
        
    Returns:
        Set of normalized product names found in the query.
    """
    mentioned = set()
    query_upper = query.upper()
    
    for pattern in KNOWN_PRODUCT_PATTERNS:
        matches = re.findall(pattern, query_upper, re.IGNORECASE)
        for match in matches:
            # Normalize the match to find the canonical name
            normalized = match.upper().replace('-', ' ').replace('  ', ' ')
            # Look up in our map
            for key, value in PRODUCT_NAME_MAP.items():
                if key.upper().replace('-', ' ') == normalized or key.upper().replace(' ', '') == normalized.replace(' ', ''):
                    mentioned.add(value)
                    break
    
    return mentioned


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
        
        Uses hybrid retrieval: if specific products are mentioned in the query,
        ensures each mentioned product has representation in the results.
        
        Args:
            query: Natural language search query.
            top_k: Number of results to retrieve.
            
        Returns:
            SearchResponse with results including product attribution.
        """
        logger.info(f"Performing semantic search: query='{query}', top_k={top_k}")
        
        # Detect mentioned products in the query
        mentioned_products = extract_mentioned_products(query)
        logger.info(f"Detected mentioned products: {mentioned_products}")
        
        search_results: List[SearchResult] = []
        seen_ids: set = set()
        
        # If multiple products are mentioned, query for each to ensure balanced results
        if len(mentioned_products) > 1:
            # Allocate results per product, with remainder going to semantic search
            per_product = max(2, top_k // len(mentioned_products))
            
            for product_name in mentioned_products:
                # Query with filter for this specific product
                product_results = self._vector_store.query(
                    query_text=query,
                    n_results=per_product,
                    where={"product_name": product_name}
                )
                
                if product_results and product_results.get("ids") and product_results["ids"][0]:
                    for result in self._parse_results(product_results):
                        if result.doc_id not in seen_ids:
                            seen_ids.add(result.doc_id)
                            search_results.append(result)
            
            logger.info(f"Product-specific search found {len(search_results)} results")
            
            # Fill remaining slots with general semantic search if needed
            remaining = top_k - len(search_results)
            if remaining > 0:
                general_results = self._vector_store.query(query_text=query, n_results=remaining + 5)
                for result in self._parse_results(general_results):
                    if result.doc_id not in seen_ids and len(search_results) < top_k:
                        seen_ids.add(result.doc_id)
                        search_results.append(result)
        else:
            # Single product or no product mentioned - use standard semantic search
            results = self._vector_store.query(query_text=query, n_results=top_k)
            search_results = self._parse_results(results)
        
        # Sort by relevance score descending
        search_results.sort(key=lambda x: x.relevance_score, reverse=True)
        
        # Trim to top_k
        search_results = search_results[:top_k]
        
        logger.info(f"Found {len(search_results)} results for query: '{query}'")
        
        return SearchResponse(
            query=query,
            results=search_results,
            total_results=len(search_results),
        )
    
    def _parse_results(self, results: dict) -> List[SearchResult]:
        """Parse ChromaDB query results into SearchResult objects.
        
        Args:
            results: Raw results from ChromaDB query.
            
        Returns:
            List of SearchResult objects.
        """
        search_results: List[SearchResult] = []
        
        if not results or not results.get("ids") or not results["ids"][0]:
            return search_results
        
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
                doc_id=doc_id,  # Use the actual ID from results
                page=metadata.get("page"),
            ))
        
        return search_results


# Singleton instance
_search_service: Optional[SearchService] = None


def get_search_service() -> SearchService:
    """Get the singleton SearchService instance."""
    global _search_service
    if _search_service is None:
        _search_service = SearchService()
    return _search_service
