"""Chroma vector database implementation."""

import logging
from datetime import datetime
from typing import Any

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions

from .base import DocumentChunk, VectorSearchResult, VectorStore

logger = logging.getLogger(__name__)


class ChromaVectorStore(VectorStore):
    """Chroma vector database implementation."""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8001,
        ssl: bool = False,
        headers: dict[str, str] | None = None,
        embedding_function: Any | None = None,
    ):
        """Initialize Chroma vector store.

        Args:
            host: Chroma server host
            port: Chroma server port
            ssl: Whether to use SSL
            headers: Optional HTTP headers
            embedding_function: Optional embedding function
        """
        self.host = host
        self.port = port
        self.ssl = ssl
        self.headers = headers or {}

        # Configure Chroma client
        self.settings = Settings(
            chroma_server_host=host,
            chroma_server_http_port=port,
            chroma_server_ssl_enabled=ssl,
            chroma_server_headers=self.headers,
        )

        self.client = chromadb.HttpClient(settings=self.settings)

        # Set up embedding function
        if embedding_function is None:
            # Use default sentence transformer
            self.embedding_function = (
                embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2"
                )
            )
        else:
            self.embedding_function = embedding_function

    async def create_collection(
        self, name: str, dimension: int, metadata: dict[str, Any] | None = None
    ) -> bool:
        """Create a new collection."""
        try:
            collection_metadata = metadata or {}
            collection_metadata.update(
                {"dimension": dimension, "created_at": datetime.utcnow().isoformat()}
            )

            self.client.create_collection(
                name=name,
                embedding_function=self.embedding_function,
                metadata=collection_metadata,
            )

            logger.info(f"Created Chroma collection: {name}")
            return True

        except Exception as e:
            logger.error(f"Failed to create collection {name}: {e}")
            return False

    async def delete_collection(self, name: str) -> bool:
        """Delete a collection."""
        try:
            self.client.delete_collection(name=name)
            logger.info(f"Deleted Chroma collection: {name}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete collection {name}: {e}")
            return False

    async def list_collections(self) -> list[dict[str, Any]]:
        """List all collections."""
        try:
            collections = self.client.list_collections()

            result = []
            for collection in collections:
                collection_info = {
                    "name": collection.name,
                    "id": collection.id,
                    "metadata": collection.metadata or {},
                    "count": collection.count(),
                }
                result.append(collection_info)

            return result

        except Exception as e:
            logger.error(f"Failed to list collections: {e}")
            return []

    async def collection_exists(self, name: str) -> bool:
        """Check if collection exists."""
        try:
            collections = await self.list_collections()
            return any(col["name"] == name for col in collections)

        except Exception as e:
            logger.error(f"Failed to check collection existence {name}: {e}")
            return False

    async def add_documents(
        self, collection_name: str, documents: list[DocumentChunk]
    ) -> bool:
        """Add documents to a collection."""
        try:
            collection = self.client.get_collection(name=collection_name)

            # Prepare data for Chroma
            ids = [doc.id for doc in documents]
            documents_text = [doc.content for doc in documents]
            metadatas = [doc.metadata for doc in documents]

            # Add embeddings if provided, otherwise let Chroma generate them
            embeddings = None
            if all(doc.embedding for doc in documents):
                embeddings = [doc.embedding for doc in documents]

            collection.add(
                ids=ids,
                documents=documents_text,
                metadatas=metadatas,
                embeddings=embeddings,
            )

            logger.info(
                f"Added {len(documents)} documents to collection {collection_name}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to add documents to {collection_name}: {e}")
            return False

    async def update_documents(
        self, collection_name: str, documents: list[DocumentChunk]
    ) -> bool:
        """Update existing documents in a collection."""
        try:
            collection = self.client.get_collection(name=collection_name)

            # Prepare data for Chroma
            ids = [doc.id for doc in documents]
            documents_text = [doc.content for doc in documents]
            metadatas = [doc.metadata for doc in documents]

            # Add embeddings if provided
            embeddings = None
            if all(doc.embedding for doc in documents):
                embeddings = [doc.embedding for doc in documents]

            collection.update(
                ids=ids,
                documents=documents_text,
                metadatas=metadatas,
                embeddings=embeddings,
            )

            logger.info(
                f"Updated {len(documents)} documents in collection {collection_name}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to update documents in {collection_name}: {e}")
            return False

    async def delete_documents(
        self, collection_name: str, document_ids: list[str]
    ) -> bool:
        """Delete documents from a collection."""
        try:
            collection = self.client.get_collection(name=collection_name)
            collection.delete(ids=document_ids)

            logger.info(
                f"Deleted {len(document_ids)} documents from collection {collection_name}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to delete documents from {collection_name}: {e}")
            return False

    async def similarity_search(
        self,
        collection_name: str,
        query: str | list[float],
        k: int = 10,
        filter_metadata: dict[str, Any] | None = None,
        include_distances: bool = True,
    ) -> list[VectorSearchResult]:
        """Perform similarity search."""
        try:
            collection = self.client.get_collection(name=collection_name)

            # Prepare query
            query_texts = None
            query_embeddings = None

            if isinstance(query, str):
                query_texts = [query]
            else:
                query_embeddings = [query]

            # Perform search
            results = collection.query(
                query_texts=query_texts,
                query_embeddings=query_embeddings,
                n_results=k,
                where=filter_metadata,
                include=["documents", "metadatas", "distances"],
            )

            # Convert to VectorSearchResult objects
            search_results = []

            if results["ids"] and len(results["ids"]) > 0:
                for i, doc_id in enumerate(results["ids"][0]):
                    result = VectorSearchResult(
                        id=doc_id,
                        content=(
                            results["documents"][0][i] if results["documents"] else ""
                        ),
                        score=(
                            1.0 - results["distances"][0][i]
                            if results["distances"]
                            else 0.0
                        ),
                        metadata=(
                            results["metadatas"][0][i] if results["metadatas"] else {}
                        ),
                        distance=(
                            results["distances"][0][i] if results["distances"] else None
                        ),
                    )
                    search_results.append(result)

            logger.info(
                f"Found {len(search_results)} results for query in {collection_name}"
            )
            return search_results

        except Exception as e:
            logger.error(f"Failed to search in collection {collection_name}: {e}")
            return []

    async def get_document(
        self, collection_name: str, document_id: str
    ) -> DocumentChunk | None:
        """Get a specific document by ID."""
        try:
            collection = self.client.get_collection(name=collection_name)

            results = collection.get(
                ids=[document_id], include=["documents", "metadatas", "embeddings"]
            )

            if results["ids"] and len(results["ids"]) > 0:
                return DocumentChunk(
                    id=results["ids"][0],
                    content=results["documents"][0] if results["documents"] else "",
                    metadata=results["metadatas"][0] if results["metadatas"] else {},
                    embedding=(
                        results["embeddings"][0] if results["embeddings"] else None
                    ),
                )

            return None

        except Exception as e:
            logger.error(
                f"Failed to get document {document_id} from {collection_name}: {e}"
            )
            return None

    async def count_documents(self, collection_name: str) -> int:
        """Count documents in a collection."""
        try:
            collection = self.client.get_collection(name=collection_name)
            return collection.count()

        except Exception as e:
            logger.error(f"Failed to count documents in {collection_name}: {e}")
            return 0

    async def get_collection_stats(self, collection_name: str) -> dict[str, Any]:
        """Get collection statistics."""
        try:
            collection = self.client.get_collection(name=collection_name)

            stats = {
                "name": collection.name,
                "id": collection.id,
                "count": collection.count(),
                "metadata": collection.metadata or {},
                "created_at": (
                    collection.metadata.get("created_at")
                    if collection.metadata
                    else None
                ),
            }

            return stats

        except Exception as e:
            logger.error(f"Failed to get stats for collection {collection_name}: {e}")
            return {}

    async def health_check(self) -> dict[str, Any]:
        """Check vector store health."""
        try:
            # Try to get heartbeat
            heartbeat = self.client.heartbeat()

            # Get basic info
            collections = await self.list_collections()

            return {
                "status": "healthy",
                "service": "chroma",
                "heartbeat": heartbeat,
                "collections_count": len(collections),
                "collections": [col["name"] for col in collections],
                "host": self.host,
                "port": self.port,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            logger.error(f"Chroma health check failed: {e}")
            return {
                "status": "unhealthy",
                "service": "chroma",
                "error": str(e),
                "host": self.host,
                "port": self.port,
                "timestamp": datetime.utcnow().isoformat(),
            }
