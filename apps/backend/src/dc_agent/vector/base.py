"""Abstract base classes for vector database operations."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class DocumentChunk:
    """Represents a document chunk for vector storage."""

    id: str
    content: str
    metadata: dict[str, Any]
    embedding: list[float] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "id": self.id,
            "content": self.content,
            "metadata": self.metadata,
            "embedding": self.embedding,
        }


@dataclass
class VectorSearchResult:
    """Represents a search result from vector database."""

    id: str
    content: str
    score: float
    metadata: dict[str, Any]
    distance: float | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "content": self.content,
            "score": self.score,
            "metadata": self.metadata,
            "distance": self.distance,
        }


class VectorStore(ABC):
    """Abstract base class for vector database implementations."""

    @abstractmethod
    async def create_collection(
        self, name: str, dimension: int, metadata: dict[str, Any] | None = None
    ) -> bool:
        """Create a new collection.

        Args:
            name: Collection name
            dimension: Vector dimension
            metadata: Optional collection metadata

        Returns:
            True if created successfully
        """
        pass

    @abstractmethod
    async def delete_collection(self, name: str) -> bool:
        """Delete a collection.

        Args:
            name: Collection name

        Returns:
            True if deleted successfully
        """
        pass

    @abstractmethod
    async def list_collections(self) -> list[dict[str, Any]]:
        """List all collections.

        Returns:
            List of collection information
        """
        pass

    @abstractmethod
    async def collection_exists(self, name: str) -> bool:
        """Check if collection exists.

        Args:
            name: Collection name

        Returns:
            True if collection exists
        """
        pass

    @abstractmethod
    async def add_documents(
        self, collection_name: str, documents: list[DocumentChunk]
    ) -> bool:
        """Add documents to a collection.

        Args:
            collection_name: Target collection
            documents: List of document chunks

        Returns:
            True if added successfully
        """
        pass

    @abstractmethod
    async def update_documents(
        self, collection_name: str, documents: list[DocumentChunk]
    ) -> bool:
        """Update existing documents in a collection.

        Args:
            collection_name: Target collection
            documents: List of document chunks to update

        Returns:
            True if updated successfully
        """
        pass

    @abstractmethod
    async def delete_documents(
        self, collection_name: str, document_ids: list[str]
    ) -> bool:
        """Delete documents from a collection.

        Args:
            collection_name: Target collection
            document_ids: List of document IDs to delete

        Returns:
            True if deleted successfully
        """
        pass

    @abstractmethod
    async def similarity_search(
        self,
        collection_name: str,
        query: str | list[float],
        k: int = 10,
        filter_metadata: dict[str, Any] | None = None,
        include_distances: bool = True,
    ) -> list[VectorSearchResult]:
        """Perform similarity search.

        Args:
            collection_name: Collection to search
            query: Query text or embedding vector
            k: Number of results to return
            filter_metadata: Optional metadata filters
            include_distances: Whether to include distance scores

        Returns:
            List of search results
        """
        pass

    @abstractmethod
    async def get_document(
        self, collection_name: str, document_id: str
    ) -> DocumentChunk | None:
        """Get a specific document by ID.

        Args:
            collection_name: Collection name
            document_id: Document ID

        Returns:
            Document chunk if found, None otherwise
        """
        pass

    @abstractmethod
    async def count_documents(self, collection_name: str) -> int:
        """Count documents in a collection.

        Args:
            collection_name: Collection name

        Returns:
            Number of documents
        """
        pass

    @abstractmethod
    async def get_collection_stats(self, collection_name: str) -> dict[str, Any]:
        """Get collection statistics.

        Args:
            collection_name: Collection name

        Returns:
            Collection statistics
        """
        pass

    @abstractmethod
    async def health_check(self) -> dict[str, Any]:
        """Check vector store health.

        Returns:
            Health status information
        """
        pass
