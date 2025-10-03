"""Integration tests for core services."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from dc_agent.services.vector_service import VectorService
from dc_agent.kg.service import KnowledgeGraphService
from dc_agent.retrieval.hybrid_retrieval import HybridRetrievalService
from dc_agent.retrieval.query_router import QueryRouter
from dc_agent.models.api_models import QueryType


class TestServicesIntegration:
    """Test integration between core services."""
    
    @pytest.fixture
    def mock_vector_store(self):
        """Mock vector store."""
        mock_store = AsyncMock()
        mock_store.health_check.return_value = {"status": "healthy"}
        mock_store.collection_exists.return_value = True
        mock_store.similarity_search.return_value = []
        return mock_store
    
    @pytest.fixture
    def mock_kg_store(self):
        """Mock knowledge graph store."""
        mock_store = AsyncMock()
        mock_store.connect.return_value = True
        mock_store.health_check.return_value = {"status": "healthy"}
        mock_store.find_entities.return_value = []
        return mock_store
    
    @pytest.fixture
    def vector_service(self, mock_vector_store):
        """Vector service with mocked store."""
        return VectorService(mock_vector_store)
    
    @pytest.fixture
    def kg_service(self, mock_kg_store):
        """KG service with mocked store."""
        return KnowledgeGraphService(mock_kg_store)
    
    @pytest.fixture
    def hybrid_service(self, vector_service, kg_service):
        """Hybrid retrieval service."""
        return HybridRetrievalService(vector_service, kg_service)
    
    def test_query_router_analysis(self):
        """Test query router analysis functionality."""
        router = QueryRouter()
        
        # Test specification query
        analysis = router.analyze_query("What is the viscosity of ASA 150?")
        assert analysis.query_type == QueryType.SPECIFICATION
        assert "ASA 150" in analysis.entities or "viscosity" in analysis.entities
        assert analysis.intent_confidence > 0.5
        
        # Test comparison query
        analysis = router.analyze_query("Compare ASA 150 vs ASA 140")
        assert analysis.query_type == QueryType.COMPARISON
        assert analysis.intent_confidence > 0.7
        
        # Test application query
        analysis = router.analyze_query("What products are good for coatings?")
        assert analysis.query_type == QueryType.APPLICATION
        assert "coatings" in analysis.entities
    
    @pytest.mark.asyncio
    async def test_vector_service_health(self, vector_service):
        """Test vector service health check."""
        health = await vector_service.health_check()
        assert "status" in health
        assert "initialized" in health
    
    @pytest.mark.asyncio
    async def test_kg_service_initialization(self, kg_service):
        """Test KG service initialization."""
        success = await kg_service.initialize()
        assert success is True
        
        health = await kg_service.health_check()
        assert "status" in health
        assert "initialized" in health
    
    @pytest.mark.asyncio
    async def test_hybrid_service_search(self, hybrid_service):
        """Test hybrid service search functionality."""
        results, analysis = await hybrid_service.search("test query")
        
        # Should return results and analysis even if empty
        assert isinstance(results, list)
        assert hasattr(analysis, 'query_type')
        assert hasattr(analysis, 'entities')
        assert hasattr(analysis, 'intent_confidence')
    
    @pytest.mark.asyncio
    async def test_hybrid_service_health(self, hybrid_service):
        """Test hybrid service health check."""
        health = await hybrid_service.health_check()
        
        assert "status" in health
        assert "components" in health
        assert "capabilities" in health
        assert "vector_service" in health["components"]
        assert "kg_service" in health["components"]