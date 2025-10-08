"""Simple unit tests for vector service."""

import pytest
from unittest.mock import Mock, AsyncMock

from dc_agent.services.vector_service import VectorService


class TestVectorServiceSimple:
    """Simple test cases for VectorService."""
    
    @pytest.fixture
    def mock_vector_store(self):
        """Create mock vector store."""
        mock_store = Mock()
        mock_store.collection_exists = AsyncMock(return_value=True)
        mock_store.similarity_search = AsyncMock(return_value=[])
        mock_store.add_documents = AsyncMock(return_value=True)
        mock_store.delete_documents = AsyncMock(return_value=True)
        mock_store.get_collection_stats = AsyncMock(return_value={})
        mock_store.health_check = AsyncMock(return_value={"status": "healthy"})
        return mock_store
    
    @pytest.fixture
    def mock_collection_manager(self):
        """Create mock collection manager."""
        mock_manager = Mock()
        mock_manager.initialize_default_collections = AsyncMock(return_value={"default": True})
        mock_manager.get_collection_summary = AsyncMock(return_value={"health_summary": {"unhealthy": 0}})
        mock_manager.get_all_collection_info = AsyncMock(return_value=[])
        return mock_manager
    
    @pytest.fixture
    def vector_service(self, mock_vector_store, mock_collection_manager):
        """Create vector service with mocks."""
        service = VectorService(vector_store=mock_vector_store)
        service.collection_manager = mock_collection_manager
        return service
    
    @pytest.mark.asyncio
    async def test_initialization(self, vector_service):
        """Test vector service initialization."""
        result = await vector_service.initialize()
        
        assert result is True
        assert vector_service._initialized is True
    
    @pytest.mark.asyncio
    async def test_health_check(self, vector_service):
        """Test health check."""
        health = await vector_service.health_check()
        
        assert health["status"] == "healthy"
        assert "vector_store" in health
        assert "collections" in health
        assert "timestamp" in health
    
    @pytest.mark.asyncio
    async def test_search_empty_collection(self, vector_service, mock_vector_store):
        """Test search with non-existent collection."""
        mock_vector_store.collection_exists.return_value = False
        
        results = await vector_service.search("test query", "nonexistent")
        
        assert len(results) == 0
    
    @pytest.mark.asyncio
    async def test_search_success(self, vector_service, mock_vector_store):
        """Test successful search."""
        # Mock search results
        mock_result = Mock()
        mock_result.content = "Test content"
        mock_result.score = 0.95
        mock_result.metadata = {"doc_id": "test"}
        mock_result.id = "chunk_1"
        mock_result.distance = 0.05
        
        mock_vector_store.similarity_search.return_value = [mock_result]
        
        results = await vector_service.search("test query")
        
        assert len(results) == 1
        assert results[0].content == "Test content"
        assert results[0].score == 0.95
        assert results[0].source == "vector"
    
    @pytest.mark.asyncio
    async def test_get_collection_stats(self, vector_service, mock_vector_store):
        """Test getting collection statistics."""
        mock_stats = {"document_count": 100, "chunk_count": 500}
        mock_vector_store.get_collection_stats.return_value = mock_stats
        
        stats = await vector_service.get_collection_stats("test_collection")
        
        assert stats == mock_stats
        mock_vector_store.get_collection_stats.assert_called_once_with("test_collection")
    
    @pytest.mark.asyncio
    async def test_list_collections(self, vector_service, mock_collection_manager):
        """Test listing collections."""
        mock_collections = [{"name": "collection1"}, {"name": "collection2"}]
        mock_collection_manager.get_all_collection_info.return_value = mock_collections
        
        collections = await vector_service.list_collections()
        
        assert collections == mock_collections
    
    @pytest.mark.asyncio
    async def test_search_with_filters(self, vector_service, mock_vector_store):
        """Test search with metadata filters."""
        filters = {"product_family": "ASA"}
        
        await vector_service.search("test query", filters=filters)
        
        mock_vector_store.similarity_search.assert_called_once()
        call_args = mock_vector_store.similarity_search.call_args
        assert call_args.kwargs["filter_metadata"] == filters
    
    @pytest.mark.asyncio
    async def test_search_multiple_collections(self, vector_service, mock_vector_store):
        """Test searching multiple collections."""
        # Mock search results for each collection
        mock_result1 = Mock()
        mock_result1.content = "Result from collection 1"
        mock_result1.score = 0.95
        mock_result1.metadata = {"doc_id": "test1"}
        mock_result1.id = "chunk_1"
        mock_result1.distance = 0.05
        
        mock_result2 = Mock()
        mock_result2.content = "Result from collection 2"
        mock_result2.score = 0.85
        mock_result2.metadata = {"doc_id": "test2"}
        mock_result2.id = "chunk_2"
        mock_result2.distance = 0.15
        
        # Return different results for different collections
        def mock_search(*args, **kwargs):
            collection_name = kwargs.get("collection_name", "")
            if "collection1" in collection_name:
                return [mock_result1]
            elif "collection2" in collection_name:
                return [mock_result2]
            return []
        
        mock_vector_store.similarity_search.side_effect = mock_search
        
        results = await vector_service.search_multiple_collections(
            "test query", 
            ["collection1", "collection2"]
        )
        
        assert len(results) == 2
        # Results should be sorted by score (descending)
        assert results[0].score >= results[1].score
    
    @pytest.mark.asyncio
    async def test_error_handling(self, vector_service, mock_vector_store):
        """Test error handling in search."""
        mock_vector_store.similarity_search.side_effect = Exception("Database error")
        
        results = await vector_service.search("test query")
        
        assert len(results) == 0  # Should return empty list on error