from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class VectorStore(ABC):
    """Abstract base class for Vector Store operations."""

    @abstractmethod
    def add_documents(self, documents: List[str], metadatas: List[Dict[str, Any]], ids: List[str]) -> None:
        """Add documents to the vector store."""
        pass

    @abstractmethod
    def query(self, query_text: str, n_results: int = 5, where: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Query the vector store for similar documents."""
        pass

    @abstractmethod
    def delete_document(self, doc_id: str) -> None:
        """Delete a document from the vector store."""
        pass
