"""Unit tests for vector service."""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from typing import List, Dict, Any

from dc_agent.services.vector_service import VectorService
from dc_agent.vector import VectorStore
from dc_agent.models.api_models import RetrievalResult


class MockVectorStore(VectorStore):
    """Mock vector store for testing."""
    
    def __init__(self):
        self.documents = []
        self.collections = {}
    
    async def add_documents(self, documents: List[Dict[str, Any]], collection_name: str = "default") -> None:
        """Mock add documents."""
        if collection_name not in self.collections:
            self.collections[collection_name] = []
        self.collections[collection_name].extend(documents)
    
    async def similarity_search(
        self, 
        collection_name: str = "default",
        query: str = "", 
        k: int = 10, 
        filter_metadata: Dict[str, Any] = None,
        include_distances: bool = False
    ) -> List[RetrievalResult]:
        """Mock similarity search."""
        # Return mock results
        return [
            RetrievalResult(
                content=f"Mock result {i} for query: {query}",
                score=0.9 - (i * 0.1),
                source="vector",
                metadata={"doc_id": f"doc_{i}", "collection": collection_name},
                provenance={"source": "test"}
            )
            for i in range(min(k, 3))
        ]
    
    async def delete_collection(self, collection_name: str) -> None:
        """Mock delete collection."""
        if collection_name in self.collections:
            del self.collections[collection_name]
    
    async def list_collections(self) -> List[str]:
        """Mock list collections."""
        return list(self.collections.keys())


@pytest.fixture
def mock_vector_store():
    """Create mock vector store."""
    return MockVectorStore()


@pytest.fixture
def vector_service(mock_vector_store):
    """Create vector service with mock store."""
    return VectorService(vector_store=mock_vector_store)


class TestVectorService:
    """Test cases for VectorService."""
    
    @pytest.mark.asyncio
    async def test_add_documents_success(self, vector_service, mock_vector_store):
        """Test successful document addition."""
        documents = [
            {"content": "Test document 1", "metadata": {"id": "1"}},
            {"content": "Test document 2", "metadata": {"id": "2"}}
        ]
        
        await vector_service.add_documents(documents, "test_collection")
        
        assert "test_collection" in mock_vector_store.collections
        assert len(mock_vector_store.collections["test_collection"]) == 2
    
    @pytest.mark.asyncio
    async def test_similarity_search_success(self, vector_service):
        """Test successful similarity search."""
        query = "test query"
        results = await vector_service.search(query, k=5)
        
        assert len(results) == 3  # Mock returns 3 results
        assert all(isinstance(result, RetrievalResult) for result in results)
        assert results[0].score > results[1].score  # Results should be sorted by score
        assert all(query in result.content for result in results)
    
    @pytest.mark.asyncio
    async def test_similarity_search_with_filters(self, vector_service):
        """Test similarity search with filters."""
        query = "test query"
        filters = {"product_family": "ASA"}
        
        results = await vector_service.similarity_search(
            query, k=5, collection_name="products", filter_dict=filters
        )
        
        assert len(results) == 3
        assert all(result.metadata["collection"] == "products" for result in results)
    
    @pytest.mark.asyncio
    async def test_delete_collection_success(self, vector_service, mock_vector_store):
        """Test successful collection deletion."""
        # Add a collection first
        await vector_service.add_documents([{"content": "test"}], "temp_collection")
        assert "temp_collection" in mock_vector_store.collections
        
        # Delete the collection
        await vector_service.delete_collection("temp_collection")
        assert "temp_collection" not in mock_vector_store.collections
    
    @pytest.mark.asyncio
    async def test_list_collections(self, vector_service, mock_vector_store):
        """Test listing collections."""
        # Add some collections
        await vector_service.add_documents([{"content": "test1"}], "collection1")
        await vector_service.add_documents([{"content": "test2"}], "collection2")
        
        collections = await vector_service.list_collections()
        
        assert "collection1" in collections
        assert "collection2" in collections
        assert len(collections) == 2
    
    @pytest.mark.asyncio
    async def test_search_empty_query(self, vector_service):
        """Test search with empty query."""
        results = await vector_service.similarity_search("", k=5)
        
        # Should still return results (mock behavior)
        assert len(results) == 3
    
    @pytest.mark.asyncio
    async def test_search_zero_k(self, vector_service):
        """Test search with k=0."""
        results = await vector_service.similarity_search("test", k=0)
        
        assert len(results) == 0
    
    @pytest.mark.asyncio
    async def test_add_empty_documents(self, vector_service, mock_vector_store):
        """Test adding empty document list."""
        await vector_service.add_documents([], "empty_collection")
        
        assert "empty_collection" in mock_vector_store.collections
        assert len(mock_vector_store.collections["empty_collection"]) == 0


@pytest.mark.integration
class TestVectorServiceIntegration:
    """Integration tests for VectorService with real vector store."""
    
    @pytest.mark.asyncio
    async def test_chroma_integration(self):
        """Test integration with ChromaDB (requires running Chroma)."""
        # This would test with actual ChromaDB instance
        # Skip if Chroma is not available
        pytest.skip("Integration test requires running ChromaDB instance")
    
    @pytest.mark.asyncio
    async def test_embedding_generation(self):
        """Test embedding generation with real models."""
        # This would test with actual embedding models
        pytest.skip("Integration test requires embedding models")