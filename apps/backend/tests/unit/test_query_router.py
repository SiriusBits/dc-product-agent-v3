"""Unit tests for query router."""

import pytest
from unittest.mock import Mock, patch
from typing import Dict, Any

from dc_agent.retrieval.query_router import QueryRouter, QueryType, QueryAnalysis


class TestQueryRouter:
    """Test cases for QueryRouter."""
    
    @pytest.fixture
    def query_router(self):
        """Create query router instance."""
        return QueryRouter()
    
    def test_analyze_specification_query(self, query_router):
        """Test analysis of specification queries."""
        queries = [
            "What is the viscosity of ASA 150?",
            "ASA 140 melting point",
            "DCA 467 chemical properties",
            "Show me the specifications for ECA 100"
        ]
        
        for query in queries:
            analysis = query_router.analyze_query(query)
            
            assert isinstance(analysis, QueryAnalysis)
            assert analysis.query_type == QueryType.SPECIFICATION
            assert analysis.intent_confidence > 0.5
            assert len(analysis.entities) > 0
    
    def test_analyze_application_query(self, query_router):
        """Test analysis of application queries."""
        queries = [
            "What products work for coatings?",
            "Which chemicals are used in adhesives?",
            "Find products for automotive applications",
            "What can I use for high temperature applications?"
        ]
        
        for query in queries:
            analysis = query_router.analyze_query(query)
            
            assert analysis.query_type == QueryType.APPLICATION
            assert analysis.intent_confidence > 0.5
    
    def test_analyze_comparison_query(self, query_router):
        """Test analysis of comparison queries."""
        queries = [
            "Compare ASA 150 vs ASA 140",
            "What's the difference between DCA 467 and DCA 221?",
            "ASA 150 versus ECA 100 properties",
            "How does ASA 140 compare to ASA 155?"
        ]
        
        for query in queries:
            analysis = query_router.analyze_query(query)
            
            assert analysis.query_type == QueryType.COMPARISON
            assert analysis.intent_confidence > 0.5
            assert len(analysis.entities) >= 2  # Should detect multiple products
    
    def test_analyze_relationship_query(self, query_router):
        """Test analysis of relationship queries."""
        queries = [
            "What's similar to DCA 467?",
            "Find products related to ASA 150",
            "What alternatives exist for ECA 100?",
            "Show me products in the same family as ASA 140"
        ]
        
        for query in queries:
            analysis = query_router.analyze_query(query)
            
            assert analysis.query_type == QueryType.RELATIONSHIP
            assert analysis.intent_confidence > 0.5
            assert len(analysis.entities) > 0
    
    def test_analyze_general_query(self, query_router):
        """Test analysis of general queries."""
        queries = [
            "Tell me about chemical products",
            "How do I choose the right product?",
            "What is an anhydride?",
            "Explain chemical compatibility"
        ]
        
        for query in queries:
            analysis = query_router.analyze_query(query)
            
            assert analysis.query_type == QueryType.GENERAL
            assert analysis.intent_confidence >= 0.0
    
    def test_entity_extraction(self, query_router):
        """Test entity extraction from queries."""
        test_cases = [
            ("What is the viscosity of ASA 150?", ["ASA 150"]),
            ("Compare DCA 467 and ECA 100", ["DCA 467", "ECA 100"]),
            ("ASA 140 vs ASA 155 properties", ["ASA 140", "ASA 155"]),
            ("Find alternatives to DDSA", ["DDSA"])
        ]
        
        for query, expected_entities in test_cases:
            analysis = query_router.analyze_query(query)
            
            for entity in expected_entities:
                assert any(entity.lower() in detected.lower() for detected in analysis.entities), \
                    f"Entity '{entity}' not found in {analysis.entities} for query '{query}'"
    
    def test_get_retrieval_weights_specification(self, query_router):
        """Test retrieval weights for specification queries."""
        analysis = QueryAnalysis(
            query_type=QueryType.SPECIFICATION,
            entities=["ASA 150"],
            intent_confidence=0.9,
            suggested_strategy={}
        )
        
        weights = query_router.get_retrieval_weights(analysis)
        
        assert "vector" in weights
        assert "kg" in weights
        assert weights["vector"] > 0.5  # Should favor vector search for specifications
        assert abs(weights["vector"] + weights["kg"] - 1.0) < 0.01  # Should sum to 1
    
    def test_get_retrieval_weights_relationship(self, query_router):
        """Test retrieval weights for relationship queries."""
        analysis = QueryAnalysis(
            query_type=QueryType.RELATIONSHIP,
            entities=["DCA 467"],
            intent_confidence=0.8,
            suggested_strategy={}
        )
        
        weights = query_router.get_retrieval_weights(analysis)
        
        assert weights["kg"] > 0.5  # Should favor KG for relationships
        assert abs(weights["vector"] + weights["kg"] - 1.0) < 0.01
    
    def test_get_retrieval_weights_comparison(self, query_router):
        """Test retrieval weights for comparison queries."""
        analysis = QueryAnalysis(
            query_type=QueryType.COMPARISON,
            entities=["ASA 150", "ASA 140"],
            intent_confidence=0.85,
            suggested_strategy={}
        )
        
        weights = query_router.get_retrieval_weights(analysis)
        
        # Comparison should use both vector and KG fairly equally
        assert 0.3 <= weights["vector"] <= 0.7
        assert 0.3 <= weights["kg"] <= 0.7
        assert abs(weights["vector"] + weights["kg"] - 1.0) < 0.01
    
    def test_confidence_scoring(self, query_router):
        """Test confidence scoring for different query types."""
        high_confidence_queries = [
            "What is the viscosity of ASA 150?",  # Clear specification
            "Compare ASA 150 vs ASA 140",         # Clear comparison
        ]
        
        low_confidence_queries = [
            "Tell me something",                   # Vague
            "What about products?",                # Unclear intent
        ]
        
        for query in high_confidence_queries:
            analysis = query_router.analyze_query(query)
            assert analysis.intent_confidence > 0.7, f"Low confidence for clear query: {query}"
        
        for query in low_confidence_queries:
            analysis = query_router.analyze_query(query)
            assert analysis.intent_confidence < 0.7, f"High confidence for vague query: {query}"
    
    def test_empty_query(self, query_router):
        """Test handling of empty queries."""
        analysis = query_router.analyze_query("")
        
        assert analysis.query_type == QueryType.GENERAL
        assert analysis.intent_confidence == 0.0
        assert len(analysis.entities) == 0
    
    def test_whitespace_query(self, query_router):
        """Test handling of whitespace-only queries."""
        analysis = query_router.analyze_query("   \n\t  ")
        
        assert analysis.query_type == QueryType.GENERAL
        assert analysis.intent_confidence == 0.0
        assert len(analysis.entities) == 0
    
    def test_very_long_query(self, query_router):
        """Test handling of very long queries."""
        long_query = "What is the viscosity " * 100 + "of ASA 150?"
        
        analysis = query_router.analyze_query(long_query)
        
        # Should still work but might have lower confidence
        assert isinstance(analysis, QueryAnalysis)
        assert "ASA 150" in str(analysis.entities)
    
    def test_special_characters_query(self, query_router):
        """Test handling of queries with special characters."""
        queries_with_special_chars = [
            "What's the viscosity of ASA-150?",
            "Compare ASA 150 & ECA 100",
            "DCA 467 @ 25°C properties",
            "ASA 140 (high viscosity) specs"
        ]
        
        for query in queries_with_special_chars:
            analysis = query_router.analyze_query(query)
            
            # Should not crash and should extract entities
            assert isinstance(analysis, QueryAnalysis)
            assert len(analysis.entities) > 0
    
    def test_suggested_strategy_generation(self, query_router):
        """Test generation of suggested retrieval strategies."""
        query = "What is the viscosity of ASA 150?"
        analysis = query_router.analyze_query(query)
        
        assert "suggested_strategy" in analysis.__dict__
        assert isinstance(analysis.suggested_strategy, dict)
    
    def test_case_insensitive_entity_detection(self, query_router):
        """Test case insensitive entity detection."""
        queries = [
            "what is the viscosity of asa 150?",
            "COMPARE DCA 467 AND ECA 100",
            "Find alternatives to ddsa"
        ]
        
        for query in queries:
            analysis = query_router.analyze_query(query)
            assert len(analysis.entities) > 0, f"No entities detected in: {query}"


class TestQueryAnalysis:
    """Test cases for QueryAnalysis model."""
    
    def test_query_analysis_creation(self):
        """Test creating QueryAnalysis instance."""
        analysis = QueryAnalysis(
            query_type=QueryType.SPECIFICATION,
            entities=["ASA 150"],
            intent_confidence=0.9,
            suggested_strategy={"primary": "vector", "secondary": "kg"}
        )
        
        assert analysis.query_type == QueryType.SPECIFICATION
        assert analysis.entities == ["ASA 150"]
        assert analysis.intent_confidence == 0.9
        assert analysis.suggested_strategy["primary"] == "vector"
    
    def test_query_analysis_validation(self):
        """Test QueryAnalysis validation."""
        # Test confidence bounds
        with pytest.raises(ValueError):
            QueryAnalysis(
                query_type=QueryType.SPECIFICATION,
                entities=[],
                intent_confidence=1.5,  # Invalid confidence > 1
                suggested_strategy={}
            )
        
        with pytest.raises(ValueError):
            QueryAnalysis(
                query_type=QueryType.SPECIFICATION,
                entities=[],
                intent_confidence=-0.1,  # Invalid confidence < 0
                suggested_strategy={}
            )