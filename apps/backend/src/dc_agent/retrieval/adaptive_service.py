"""Adaptive retrieval service that selects and executes query-specific strategies."""

import logging
import time
from typing import Any

from ..models.api_models import QueryAnalysis, QueryType, RetrievalResult
from .strategies import (
    ApplicationStrategy,
    ComparisonStrategy,
    RelationshipStrategy,
    RetrievalStrategy,
    SpecificationStrategy,
)

logger = logging.getLogger(__name__)


class AdaptiveRetrievalService:
    """Service that adapts retrieval strategy based on query analysis."""

    def __init__(self, vector_service=None, kg_service=None):
        """Initialize adaptive retrieval service.
        
        Args:
            vector_service: Vector search service
            kg_service: Knowledge graph service
        """
        self.vector_service = vector_service
        self.kg_service = kg_service

        # Initialize strategies
        self.strategies = {
            QueryType.SPECIFICATION: SpecificationStrategy(),
            QueryType.APPLICATION: ApplicationStrategy(),
            QueryType.COMPARISON: ComparisonStrategy(),
            QueryType.RELATIONSHIP: RelationshipStrategy(),
        }

    async def execute_strategy(
        self,
        query: str,
        analysis: QueryAnalysis,
        max_results: int = 20,
        **kwargs
    ) -> tuple[list[RetrievalResult], dict[str, Any]]:
        """Execute the appropriate strategy based on query analysis.
        
        Args:
            query: Search query
            analysis: Query analysis result
            max_results: Maximum number of results
            **kwargs: Additional parameters
            
        Returns:
            Tuple of (results, execution metadata)
        """
        try:
            start_time = time.time()

            # Select strategy based on query type
            strategy = self._select_strategy(analysis)

            # Execute the strategy
            results, strategy_metadata = await strategy.execute(
                query=query,
                analysis=analysis,
                vector_service=self.vector_service,
                kg_service=self.kg_service,
                max_results=max_results,
                **kwargs
            )

            # Add execution metadata
            execution_time = time.time() - start_time
            execution_metadata = {
                "strategy_used": strategy.name,
                "query_type": analysis.query_type.value,
                "execution_time_ms": int(execution_time * 1000),
                "confidence": analysis.intent_confidence,
                "entities_detected": analysis.entities,
                "strategy_metadata": strategy_metadata,
            }

            # Add source attribution and confidence scores
            for result in results:
                result.metadata.update({
                    "adaptive_strategy": strategy.name,
                    "query_confidence": analysis.intent_confidence,
                    "execution_time_ms": int(execution_time * 1000),
                })

                # Add confidence explanation
                result.provenance.update({
                    "strategy_reasoning": self._get_strategy_reasoning(analysis),
                    "confidence_factors": self._get_confidence_factors(result, analysis),
                })

            logger.info(
                f"Executed {strategy.name} strategy: {len(results)} results in {execution_time:.2f}s"
            )

            return results, execution_metadata

        except Exception as e:
            logger.error(f"Failed to execute adaptive strategy: {e}")
            return [], {
                "strategy_used": "error",
                "error": str(e),
                "query_type": analysis.query_type.value,
            }

    def _select_strategy(self, analysis: QueryAnalysis) -> RetrievalStrategy:
        """Select the appropriate strategy based on query analysis."""
        try:
            # Get strategy for query type
            strategy = self.strategies.get(analysis.query_type)

            if strategy is None:
                # Fallback: select based on confidence and entities
                if analysis.intent_confidence > 0.7:
                    if len(analysis.entities) >= 2:
                        strategy = self.strategies[QueryType.COMPARISON]
                    elif analysis.entities:
                        strategy = self.strategies[QueryType.SPECIFICATION]
                    else:
                        strategy = self.strategies[QueryType.APPLICATION]
                else:
                    # Low confidence: use specification strategy as default
                    strategy = self.strategies[QueryType.SPECIFICATION]

            return strategy

        except Exception as e:
            logger.error(f"Failed to select strategy: {e}")
            # Ultimate fallback
            return self.strategies[QueryType.SPECIFICATION]

    def _get_strategy_reasoning(self, analysis: QueryAnalysis) -> str:
        """Get human-readable reasoning for strategy selection."""
        reasoning_map = {
            QueryType.SPECIFICATION: "Query appears to ask for specific product properties or specifications",
            QueryType.APPLICATION: "Query appears to ask about product uses or applications",
            QueryType.COMPARISON: "Query appears to compare multiple products or ask for alternatives",
            QueryType.RELATIONSHIP: "Query appears to ask about product relationships or similarities",
            QueryType.GENERAL: "General query without specific intent detected",
        }

        base_reasoning = reasoning_map.get(analysis.query_type, "Unknown query type")

        # Add confidence and entity information
        if analysis.intent_confidence > 0.8:
            confidence_desc = "high confidence"
        elif analysis.intent_confidence > 0.5:
            confidence_desc = "medium confidence"
        else:
            confidence_desc = "low confidence"

        entity_desc = f"{len(analysis.entities)} entities detected" if analysis.entities else "no entities detected"

        return f"{base_reasoning} ({confidence_desc}, {entity_desc})"

    def _get_confidence_factors(self, result: RetrievalResult, analysis: QueryAnalysis) -> dict[str, Any]:
        """Get factors that contributed to result confidence."""
        factors = {
            "base_score": result.score,
            "source": result.source,
            "query_confidence": analysis.intent_confidence,
        }

        # Add strategy-specific factors
        if "strategy_boost" in result.metadata:
            factors["strategy_boost"] = result.metadata["strategy_boost"]

        if "entity_matches" in result.metadata:
            factors["entity_matches"] = result.metadata["entity_matches"]

        if "relationship_strength" in result.metadata:
            factors["relationship_strength"] = result.metadata["relationship_strength"]

        return factors

    async def get_strategy_recommendations(self, query: str, analysis: QueryAnalysis) -> dict[str, Any]:
        """Get recommendations for improving query results.
        
        Args:
            query: Original query
            analysis: Query analysis
            
        Returns:
            Dictionary with recommendations
        """
        try:
            recommendations = {
                "current_strategy": analysis.query_type.value,
                "confidence": analysis.intent_confidence,
                "suggestions": [],
            }

            # Low confidence suggestions
            if analysis.intent_confidence < 0.5:
                recommendations["suggestions"].append({
                    "type": "query_refinement",
                    "message": "Try being more specific about what you're looking for",
                    "examples": self._get_query_examples(analysis.query_type),
                })

            # Entity detection suggestions
            if not analysis.entities:
                recommendations["suggestions"].append({
                    "type": "entity_specification",
                    "message": "Include specific product names or chemical identifiers",
                    "examples": ["ASA 150", "DCA 467", "DDSA"],
                })

            # Strategy-specific suggestions
            if analysis.query_type == QueryType.COMPARISON and len(analysis.entities) < 2:
                recommendations["suggestions"].append({
                    "type": "comparison_products",
                    "message": "Specify at least two products to compare",
                    "examples": ["Compare ASA 150 vs ASA 140", "Difference between DCA 467 and DCE 142"],
                })

            return recommendations

        except Exception as e:
            logger.error(f"Failed to get strategy recommendations: {e}")
            return {"error": str(e)}

    def _get_query_examples(self, query_type: QueryType) -> list[str]:
        """Get example queries for a given query type."""
        examples_map = {
            QueryType.SPECIFICATION: [
                "What is the viscosity of ASA 150?",
                "Properties of DCA 467",
                "CAS number for DDSA",
            ],
            QueryType.APPLICATION: [
                "What is ASA 150 used for?",
                "Applications of DCA 467",
                "Uses of DDSA in coatings",
            ],
            QueryType.COMPARISON: [
                "Compare ASA 150 vs ASA 140",
                "Difference between DCA 467 and DCE 142",
                "Which is better ASA 150 or ASA 155?",
            ],
            QueryType.RELATIONSHIP: [
                "Products similar to ASA 150",
                "Alternatives to DCA 467",
                "What is related to DDSA?",
            ],
            QueryType.GENERAL: [
                "Tell me about epoxy curing agents",
                "What products are available for coatings?",
                "Chemical products for adhesives",
            ],
        }

        return examples_map.get(query_type, [])
