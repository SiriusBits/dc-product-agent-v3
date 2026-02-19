import chromadb
from typing import List, Dict, Any, Optional
from dc_agent.vector.store import VectorStore
from dc_agent.config import settings

class ChromaVectorStore(VectorStore):
    """ChromaDB implementation of the Vector Store."""

    def __init__(self):
        self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        self.collection = self.client.get_or_create_collection(name=settings.CHROMA_COLLECTION_NAME)

    def add_documents(self, documents: List[str], metadatas: List[Dict[str, Any]], ids: List[str]) -> None:
        """Add documents to the vector store."""
        self.collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )

    def query(self, query_text: str, n_results: int = 5, where: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Query the vector store for similar documents."""
        results = self.collection.query(
            query_texts=[query_text],
            n_results=n_results,
            where=where
        )
        return results

    def delete_document(self, doc_id: str) -> None:
        """Delete a document from the vector store."""
        self.collection.delete(ids=[doc_id])

    def list_unique_products(self) -> List[str]:
        """List all unique product names in the vector store."""
        # Get all metadata (limit could be an issue if dataset is huge, but for 17 products it's fine)
        result = self.collection.get(include=["metadatas"])
        
        products = set()
        if result["metadatas"]:
            for metadata in result["metadatas"]:
                if metadata and "product" in metadata:
                    products.add(metadata["product"])
        
        return sorted(list(products))

    def clear_all(self) -> int:
        """Clear all documents from the collection.
        
        Returns:
            Number of documents deleted.
        """
        # Get all document IDs
        result = self.collection.get()
        ids = result.get("ids", [])
        count = len(ids)
        
        if ids:
            self.collection.delete(ids=ids)
        
        return count

    def count(self) -> int:
        """Return the total number of documents in the collection."""
        return self.collection.count()

    def get_all_metadata(self) -> Dict[str, Any]:
        """Get all documents with their metadata.
        
        Returns:
            Dictionary containing ids, documents, and metadatas.
        """
        return self.collection.get(include=["documents", "metadatas"])

    def get_documents_by_product(self, product_name: str) -> Dict[str, Any]:
        """Get all documents for a specific product.
        
        Args:
            product_name: The product name to filter by.
            
        Returns:
            Dictionary containing ids, documents, and metadatas for the product.
        """
        return self.collection.get(
            where={"product_name": product_name},
            include=["documents", "metadatas"]
        )
