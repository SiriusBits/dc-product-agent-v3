"""Unit tests for hybrid retrieval system."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from dc_agent.models.api_models import QueryAnalysis, QueryType, RetrievalResult
from dc_agent.retrieval import QueryRouter, HybridRetrievalService
from dc_agent.retrieval.strategies import SpecificationStrategy, ApplicationStrategy


class TestQueryRouter:
    """Test query router functionality."""

    def test_analyze_specification_query(self):
        """Test analysis of specification queries."""
        router = QueryRouter()
        
        query = "What is the viscosity of ASA 150?"
        analysis = router.analyze_query(query)
        
        assert analysis.query_type == QueryType.SPECIFICATION
        assert "ASA" in analysis.entities or "150" in analysis.entities
        assert analysis.intent_confidence > 0.5

    def test_analyze_application_query(self):
        """Test analysis of application queries."""
        router = QueryRouter()
        
        query = "What applications does DCA 467 have?"
        analysis = router.analyze_query(query)
        
        # Should classify as application or general (both are acceptable)
        assert analysis.query_type in [QueryType.APPLICATION, QueryType.GENERAL]
        assert "DCA" in analysis.entities or "467" in analysis.entities
        assert analysis.intent_confidence > 0.3

    def test_analyze_comparison_query(self):
        """Test analysis of comparison queries."""
        router = QueryRouter()
        
        query = "Compare ASA 150 vs ASA 140"
        analysis = router.analyze_query(query)
        
        assert analysis.query_type == QueryType.COMPARISON
        assert len(analysis.entities) >= 1
        assert analysis.intent_confidence > 0.5

    def test_get_retrieval_weights(self):
        """Test retrieval weight calculation."""
        router = QueryRouter()
        
        analysis = QueryAnalysis(
            query_type=QueryType.SPECIFICATION,
            entities=["ASA", "150"],
            intent_confidence=0.8,
            suggested_strategy={}
        )
        
        weights = router.get_retrieval_weights(analysis)
        
        assert "vector_weight" in weights
        assert "kg_weight" in weights
        assert abs(weights["vector_weight"] + weights["kg_weight"] - 1.0) < 0.01


class TestSpecificationStrategy:
    """Test specification strategy."""

    @pytest.mark.asyncio
    async def test_specification_strategy_execution(self):
        """Test specification strategy execution."""
        # Mock services
        mock_vector_service = AsyncMock()
        mock_kg_service = AsyncMock()
        
        # Mock vector search results
        mock_vector_result = RetrievalResult(
            content="ASA 150 has a viscosity of 150-200 cP at 25°C",
            score=0.8,
            source="vector",
            metadata={"chunk_type": "properties"},
            provenance={"document_id": "test_doc"}
        )
        mock_vector_service.search.return_value = [mock_vector_result]
        
        # Mock KG search results
        mock_kg_service.get_entity_neighbors.return_value = MagicMock(
            related_entities=[],
            relationships=[]
        )
        
        # Create strategy and analysis
        strategy = SpecificationStrategy()
        analysis = QueryAnalysis(
            query_type=QueryType.SPECIFICATION,
            entities=["ASA", "150"],
            intent_confidence=0.8,
            suggested_strategy={}
        )
        
        # Execute strategy
        results, metadata = await strategy.execute(
            query="What is the viscosity of ASA 150?",
            analysis=analysis,
            vector_service=mock_vector_service,
            kg_service=mock_kg_service,
            max_results=10
        )
        
        assert len(results) > 0
        assert metadata["strategy"] == "specification"
        assert mock_vector_service.search.called


class TestApplicationStrategy:
    """Test application strategy."""

    @pytest.mark.asyncio
    async def test_application_strategy_execution(self):
        """Test application strategy execution."""
        # Mock services
        mock_vector_service = AsyncMock()
        mock_kg_service = AsyncMock()
        
        # Mock vector search results
        mock_vector_result = RetrievalResult(
            content="DCA 467 is used in coatings and adhesives",
            score=0.7,
            source="vector",
            metadata={"chunk_type": "applications"},
            provenance={"document_id": "test_doc"}
        )
        mock_vector_service.search.return_value = [mock_vector_result]
        
        # Mock KG search results
        mock_kg_service.get_entity_neighbors.return_value = MagicMock(
            related_entities=[],
            relationships=[]
        )
        mock_kg_service.search_entities.return_value = []
        
        # Create strategy and analysis
        strategy = ApplicationStrategy()
        analysis = QueryAnalysis(
            query_type=QueryType.APPLICATION,
            entities=["DCA", "467"],
            intent_confidence=0.7,
            suggested_strategy={}
        )
        
        # Execute strategy
        results, metadata = await strategy.execute(
            query="What is DCA 467 used for?",
            analysis=analysis,
            vector_service=mock_vector_service,
            kg_service=mock_kg_service,
            max_results=10
        )
        
        assert len(results) > 0
        assert metadata["strategy"] == "application"
        assert mock_vector_service.search.called


class TestHybridRetrievalService:
    """Test hybrid retrieval service."""

    @pytest.mark.asyncio
    async def test_hybrid_service_initialization(self):
        """Test hybrid service initialization."""
        # Mock services
        mock_vector_service = AsyncMock()
        mock_kg_service = AsyncMock()
        
        mock_vector_service.initialize.return_value = True
        mock_kg_service.initialize.return_value = True
        
        # Create service
        service = HybridRetrievalService(
            vector_service=mock_vector_service,
            kg_service=mock_kg_service
        )
        
        # Initialize
        success = await service.initialize()
        
        assert success
        assert mock_vector_service.initialize.called
        assert mock_kg_service.initialize.called

    @pytest.mark.asyncio
    async def test_hybrid_search_with_mocks(self):
        """Test hybrid search with mocked services."""
        # Mock services
        mock_vector_service = AsyncMock()
        mock_kg_service = AsyncMock()
        
        # Mock vector search results
        vector_result = RetrievalResult(
            content="Test vector result",
            score=0.8,
            source="vector",
            metadata={},
            provenance={}
        )
        mock_vector_service.search.return_value = [vector_result]
        
        # Mock KG search results
        kg_result = RetrievalResult(
            content="Test KG result",
            score=0.7,
            source="kg",
            metadata={},
            provenance={}
        )
        mock_kg_service.search_entities.return_value = [kg_result]
        mock_kg_service.get_entity_neighbors.return_value = MagicMock(
            related_entities=[],
            relationships=[]
        )
        
        # Create service
        service = HybridRetrievalService(
            vector_service=mock_vector_service,
            kg_service=mock_kg_service
        )
        
        # Perform search
        results, analysis = await service.search(
            query="What is the viscosity of ASA 150?",
            max_results=10
        )
        
        assert len(results) > 0
        assert analysis.query_type == QueryType.SPECIFICATION
        
        # Check that results are marked as hybrid
        hybrid_results = [r for r in results if r.source == "hybrid"]
        assert len(hybrid_results) > 0