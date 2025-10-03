"""Vector database interface and implementations."""

from .base import VectorStore, VectorSearchResult, DocumentChunk
from .chroma_store import ChromaVectorStore
from .collection_manager import CollectionManager

__all__ = [
    "VectorStore",
    "VectorSearchResult", 
    "DocumentChunk",
    "ChromaVectorStore",
    "CollectionManager"
]