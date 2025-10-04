"""Query analysis and routing for hybrid retrieval system."""

import logging
import re
from typing import Any

from ..models.api_models import QueryAnalysis, QueryType

logger = logging.getLogger(__name__)


class QueryRouter:
    """Analyzes queries and determines optimal retrieval strategies."""

    def __init__(self):
        """Initialize query router with pattern matching rules."""
        # Patterns for different query types
        self.specification_patterns = [
            r"what\s+is\s+the\s+(\w+)\s+of\s+(\w+)",
            r"(\w+)\s+of\s+(\w+)",
            r"properties\s+of\s+(\w+)",
            r"specifications?\s+for\s+(\w+)",
            r"viscosity|density|temperature|melting\s+point|boiling\s+point",
            r"cas\s+number|molecular\s+weight|formula",
        ]

        self.application_patterns = [
            r"what\s+is\s+(\w+)\s+used\s+for",
            r"applications?\s+of\s+(\w+)",
            r"uses?\s+of\s+(\w+)",
            r"where\s+can\s+i\s+use\s+(\w+)",
            r"coatings?|adhesives?|composites?|electronics?",
            r"automotive|aerospace|marine|construction",
        ]

        self.comparison_patterns = [
            r"compare\s+(\w+)\s+(?:and|vs|versus)\s+(\w+)",
            r"difference\s+between\s+(\w+)\s+and\s+(\w+)",
            r"(\w+)\s+vs\s+(\w+)",
            r"which\s+is\s+better\s+(\w+)\s+or\s+(\w+)",
            r"alternatives?\s+to\s+(\w+)",
        ]

        self.relationship_patterns = [
            r"similar\s+to\s+(\w+)",
            r"related\s+to\s+(\w+)",
            r"like\s+(\w+)",
            r"equivalent\s+to\s+(\w+)",
            r"substitute\s+for\s+(\w+)",
            r"family\s+of\s+(\w+)",
        ]

        # Product name patterns (common chemical product naming)
        self.product_patterns = [
            r"\b[A-Z]{2,4}\s*\d+[A-Z]*\b",  # ASA 150, DCA 467, etc.
            r"\b[A-Z]+\s*-\s*\d+[A-Z]*\b",  # AP-6G, etc.
            r"\b[A-Z]{3,}\b",  # DDSA, MHHPA, etc.
        ]

    def analyze_query(self, query: str) -> QueryAnalysis:
        """Analyze query and determine optimal retrieval strategy.
        
        Args:
            query: User query string
            
        Returns:
            Query analysis with type, entities, and strategy
        """
        try:
            query_lower = query.lower().strip()

            # Extract potential product names/entities
            entities = self._extract_entities(query)

            # Determine query type
            query_type = self._classify_query_type(query_lower)

            # Calculate confidence based on pattern matches
            confidence = self._calculate_confidence(query_lower, query_type)

            # Generate retrieval strategy
            strategy = self._generate_strategy(query_type, entities, confidence)

            analysis = QueryAnalysis(
                query_type=query_type,
                entities=entities,
                intent_confidence=confidence,
                suggested_strategy=strategy
            )

            logger.info(f"Query analysis: type={query_type}, entities={entities}, confidence={confidence:.2f}")
            return analysis

        except Exception as e:
            logger.error(f"Failed to analyze query '{query}': {e}")
            # Return default analysis
            return QueryAnalysis(
                query_type=QueryType.GENERAL,
                entities=[],
                intent_confidence=0.5,
                suggested_strategy={"vector_weight": 0.7, "kg_weight": 0.3}
            )

    def get_retrieval_weights(self, analysis: QueryAnalysis) -> dict[str, float]:
        """Get optimal weights for vector vs KG retrieval based on analysis.
        
        Args:
            analysis: Query analysis result
            
        Returns:
            Dictionary with vector_weight and kg_weight
        """
        try:
            # Base weights by query type
            weight_map = {
                QueryType.SPECIFICATION: {"vector": 0.8, "kg": 0.2},
                QueryType.APPLICATION: {"vector": 0.6, "kg": 0.4},
                QueryType.COMPARISON: {"vector": 0.4, "kg": 0.6},
                QueryType.RELATIONSHIP: {"vector": 0.2, "kg": 0.8},
                QueryType.GENERAL: {"vector": 0.6, "kg": 0.4},
            }

            base_weights = weight_map.get(analysis.query_type, {"vector": 0.5, "kg": 0.5})

            # Adjust based on confidence
            confidence_factor = analysis.intent_confidence

            # Adjust based on number of entities found
            entity_factor = min(len(analysis.entities) / 3.0, 1.0)  # More entities favor KG

            # Calculate final weights
            kg_boost = entity_factor * 0.2  # Up to 20% boost for KG with more entities
            vector_weight = base_weights["vector"] * confidence_factor + (1 - confidence_factor) * 0.5
            kg_weight = base_weights["kg"] * confidence_factor + (1 - confidence_factor) * 0.5 + kg_boost

            # Normalize to ensure they sum to 1
            total = vector_weight + kg_weight
            if total > 0:
                vector_weight /= total
                kg_weight /= total
            else:
                vector_weight, kg_weight = 0.5, 0.5

            return {
                "vector_weight": round(vector_weight, 2),
                "kg_weight": round(kg_weight, 2)
            }

        except Exception as e:
            logger.error(f"Failed to calculate retrieval weights: {e}")
            return {"vector_weight": 0.5, "kg_weight": 0.5}

    def _extract_entities(self, query: str) -> list[str]:
        """Extract potential product names and entities from query."""
        entities = []

        try:
            # Find product name patterns
            for pattern in self.product_patterns:
                matches = re.findall(pattern, query, re.IGNORECASE)
                entities.extend(matches)

            # Find quoted entities
            quoted_matches = re.findall(r'"([^"]+)"', query)
            entities.extend(quoted_matches)

            # Find capitalized words that might be product names
            capitalized_words = re.findall(r'\b[A-Z][A-Z0-9-]*\b', query)
            for word in capitalized_words:
                if len(word) >= 2 and word not in ["AND", "OR", "NOT", "THE", "FOR", "WITH"]:
                    entities.append(word)

            # Remove duplicates and clean up
            entities = list(set(entities))
            entities = [e.strip() for e in entities if len(e.strip()) >= 2]

            return entities[:10]  # Limit to 10 entities

        except Exception as e:
            logger.error(f"Failed to extract entities from query: {e}")
            return []

    def _classify_query_type(self, query_lower: str) -> QueryType:
        """Classify the query type based on patterns."""
        try:
            # Check specification patterns
            for pattern in self.specification_patterns:
                if re.search(pattern, query_lower):
                    return QueryType.SPECIFICATION

            # Check application patterns
            for pattern in self.application_patterns:
                if re.search(pattern, query_lower):
                    return QueryType.APPLICATION

            # Check comparison patterns
            for pattern in self.comparison_patterns:
                if re.search(pattern, query_lower):
                    return QueryType.COMPARISON

            # Check relationship patterns
            for pattern in self.relationship_patterns:
                if re.search(pattern, query_lower):
                    return QueryType.RELATIONSHIP

            # Default to general
            return QueryType.GENERAL

        except Exception as e:
            logger.error(f"Failed to classify query type: {e}")
            return QueryType.GENERAL

    def _calculate_confidence(self, query_lower: str, query_type: QueryType) -> float:
        """Calculate confidence score for the query classification."""
        try:
            confidence = 0.5  # Base confidence

            # Get relevant patterns for the classified type
            patterns = []
            if query_type == QueryType.SPECIFICATION:
                patterns = self.specification_patterns
            elif query_type == QueryType.APPLICATION:
                patterns = self.application_patterns
            elif query_type == QueryType.COMPARISON:
                patterns = self.comparison_patterns
            elif query_type == QueryType.RELATIONSHIP:
                patterns = self.relationship_patterns

            # Count pattern matches
            matches = 0
            for pattern in patterns:
                if re.search(pattern, query_lower):
                    matches += 1

            # Boost confidence based on matches
            if matches > 0:
                confidence = min(0.6 + (matches * 0.2), 1.0)

            # Boost for specific keywords
            high_confidence_keywords = {
                QueryType.SPECIFICATION: ["viscosity", "density", "properties", "specifications", "cas"],
                QueryType.APPLICATION: ["applications", "used for", "uses", "coatings", "adhesives"],
                QueryType.COMPARISON: ["compare", "vs", "versus", "difference", "better"],
                QueryType.RELATIONSHIP: ["similar", "related", "like", "equivalent", "substitute"],
            }

            keywords = high_confidence_keywords.get(query_type, [])
            for keyword in keywords:
                if keyword in query_lower:
                    confidence = min(confidence + 0.1, 1.0)

            return round(confidence, 2)

        except Exception as e:
            logger.error(f"Failed to calculate confidence: {e}")
            return 0.5

    def _generate_strategy(self, query_type: QueryType, entities: list[str], confidence: float) -> dict[str, Any]:
        """Generate retrieval strategy based on analysis."""
        try:
            strategy = {
                "query_type": query_type.value,
                "parallel_search": True,
                "fusion_algorithm": "weighted_score",
            }

            # Add type-specific parameters
            if query_type == QueryType.SPECIFICATION:
                strategy.update({
                    "vector_collections": ["technical_bulletins", "properties"],
                    "kg_entity_types": ["PRODUCT", "PROPERTY"],
                    "kg_relationship_types": ["has_property", "measured_as"],
                    "result_limit": 15,
                })
            elif query_type == QueryType.APPLICATION:
                strategy.update({
                    "vector_collections": ["technical_bulletins", "applications"],
                    "kg_entity_types": ["PRODUCT", "APPLICATION"],
                    "kg_relationship_types": ["used_in", "suitable_for"],
                    "result_limit": 20,
                })
            elif query_type == QueryType.COMPARISON:
                strategy.update({
                    "vector_collections": ["technical_bulletins"],
                    "kg_entity_types": ["PRODUCT"],
                    "kg_relationship_types": ["similar_to", "competes_with", "has_property"],
                    "result_limit": 25,
                    "kg_max_depth": 2,
                })
            elif query_type == QueryType.RELATIONSHIP:
                strategy.update({
                    "vector_collections": ["technical_bulletins"],
                    "kg_entity_types": ["PRODUCT", "FAMILY"],
                    "kg_relationship_types": ["similar_to", "belongs_to_family", "manufactured_by"],
                    "result_limit": 30,
                    "kg_max_depth": 3,
                })
            else:  # GENERAL
                strategy.update({
                    "vector_collections": ["technical_bulletins"],
                    "kg_entity_types": None,  # All types
                    "kg_relationship_types": None,  # All types
                    "result_limit": 20,
                })

            # Add confidence-based adjustments
            if confidence > 0.8:
                strategy["result_limit"] = int(strategy["result_limit"] * 0.8)  # Fewer results for high confidence
            elif confidence < 0.4:
                strategy["result_limit"] = int(strategy["result_limit"] * 1.2)  # More results for low confidence

            # Add entity-specific parameters
            if entities:
                strategy["target_entities"] = entities
                strategy["entity_boost"] = True

            return strategy

        except Exception as e:
            logger.error(f"Failed to generate strategy: {e}")
            return {"query_type": "general", "parallel_search": True}
