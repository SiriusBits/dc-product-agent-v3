"""Query analysis and routing for optimal retrieval strategy."""

import logging
import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

from ..models.api_models import QueryType, QueryAnalysis

logger = logging.getLogger(__name__)


@dataclass
class EntityMention:
    """Represents a potential entity mention in a query."""
    
    text: str
    start: int
    end: int
    entity_type: Optional[str] = None
    confidence: float = 1.0


@dataclass
class QueryIntent:
    """Represents the intent analysis of a query."""
    
    primary_intent: QueryType
    secondary_intents: List[QueryType]
    confidence: float
    reasoning: str


class QueryAnalyzer:
    """Analyzes queries to extract entities and determine intent."""
    
    def __init__(self):
        """Initialize query analyzer with patterns and rules."""
        # Product name patterns (common chemical product naming conventions)
        self.product_patterns = [
            r'\b[A-Z]{2,4}[-\s]?\d{2,4}[A-Z]?\b',  # ASA-150, DCA 467, etc.
            r'\b[A-Z]{3,6}\s*\d{2,4}[A-Z]?\b',     # MHHPA 301, etc.
            r'\b[A-Z]+[-\s]?\d+[A-Z]*\b',          # General alphanumeric products
        ]
        
        # Property/specification keywords
        self.property_keywords = [
            'viscosity', 'density', 'temperature', 'melting point', 'boiling point',
            'molecular weight', 'flash point', 'specific gravity', 'tensile strength',
            'modulus', 'elongation', 'hardness', 'tg', 'glass transition',
            'cure time', 'pot life', 'shelf life', 'color', 'appearance'
        ]
        
        # Application keywords
        self.application_keywords = [
            'coating', 'adhesive', 'composite', 'laminate', 'encapsulant',
            'potting', 'casting', 'molding', 'aerospace', 'automotive',
            'electronics', 'marine', 'construction', 'wind energy'
        ]
        
        # Comparison keywords
        self.comparison_keywords = [
            'compare', 'comparison', 'versus', 'vs', 'difference', 'better',
            'alternative', 'substitute', 'similar', 'equivalent', 'replace'
        ]
        
        # Relationship keywords
        self.relationship_keywords = [
            'related', 'similar', 'compatible', 'works with', 'used with',
            'recommended', 'suitable', 'alternative', 'equivalent'
        ]
        
        # Question words and patterns
        self.question_patterns = [
            r'\bwhat\s+is\b',
            r'\bhow\s+(?:much|many|long|often)\b',
            r'\bwhen\s+(?:should|can|do)\b',
            r'\bwhere\s+(?:can|is|are)\b',
            r'\bwhy\s+(?:is|are|should|would)\b',
            r'\bwhich\s+(?:is|are|should|would)\b'
        ]
    
    def extract_entities(self, query: str) -> List[EntityMention]:
        """Extract potential entity mentions from query.
        
        Args:
            query: Query text
            
        Returns:
            List of entity mentions
        """
        entities = []
        query_lower = query.lower()
        
        # Extract product names using patterns
        for pattern in self.product_patterns:
            matches = re.finditer(pattern, query, re.IGNORECASE)
            for match in matches:
                entities.append(EntityMention(
                    text=match.group(),
                    start=match.start(),
                    end=match.end(),
                    entity_type="PRODUCT",
                    confidence=0.8
                ))
        
        # Extract property mentions
        for prop in self.property_keywords:
            if prop in query_lower:
                start = query_lower.find(prop)
                entities.append(EntityMention(
                    text=prop,
                    start=start,
                    end=start + len(prop),
                    entity_type="PROPERTY",
                    confidence=0.9
                ))
        
        # Extract application mentions
        for app in self.application_keywords:
            if app in query_lower:
                start = query_lower.find(app)
                entities.append(EntityMention(
                    text=app,
                    start=start,
                    end=start + len(app),
                    entity_type="APPLICATION",
                    confidence=0.9
                ))
        
        # Remove overlapping entities (keep highest confidence)
        entities = self._remove_overlapping_entities(entities)
        
        return entities
    
    def analyze_intent(self, query: str, entities: List[EntityMention]) -> QueryIntent:
        """Analyze query intent based on text patterns and entities.
        
        Args:
            query: Query text
            entities: Extracted entities
            
        Returns:
            Query intent analysis
        """
        query_lower = query.lower()
        
        # Count different types of indicators
        comparison_score = sum(1 for keyword in self.comparison_keywords if keyword in query_lower)
        relationship_score = sum(1 for keyword in self.relationship_keywords if keyword in query_lower)
        
        # Check for question patterns
        question_score = sum(1 for pattern in self.question_patterns if re.search(pattern, query_lower))
        
        # Analyze entity types
        product_entities = [e for e in entities if e.entity_type == "PRODUCT"]
        property_entities = [e for e in entities if e.entity_type == "PROPERTY"]
        application_entities = [e for e in entities if e.entity_type == "APPLICATION"]
        
        # Determine primary intent
        primary_intent = QueryType.GENERAL
        confidence = 0.5
        reasoning = "Default classification"
        secondary_intents = []
        
        # Comparison queries
        if comparison_score > 0 and len(product_entities) >= 2:
            primary_intent = QueryType.COMPARISON
            confidence = 0.9
            reasoning = f"Found comparison keywords and {len(product_entities)} products"
        elif comparison_score > 0 and len(product_entities) == 1:
            primary_intent = QueryType.COMPARISON
            confidence = 0.7
            reasoning = "Found comparison keywords with one product"
            secondary_intents.append(QueryType.RELATIONSHIP)
        
        # Relationship queries
        elif relationship_score > 0:
            primary_intent = QueryType.RELATIONSHIP
            confidence = 0.8
            reasoning = "Found relationship keywords"
            if len(product_entities) > 0:
                secondary_intents.append(QueryType.SPECIFICATION)
        
        # Specification queries
        elif len(property_entities) > 0 and len(product_entities) > 0:
            primary_intent = QueryType.SPECIFICATION
            confidence = 0.9
            reasoning = f"Found {len(property_entities)} properties and {len(product_entities)} products"
        elif len(property_entities) > 0:
            primary_intent = QueryType.SPECIFICATION
            confidence = 0.7
            reasoning = f"Found {len(property_entities)} properties"
            secondary_intents.append(QueryType.GENERAL)
        
        # Application queries
        elif len(application_entities) > 0:
            primary_intent = QueryType.APPLICATION
            confidence = 0.8
            reasoning = f"Found {len(application_entities)} applications"
            if len(product_entities) > 0:
                secondary_intents.append(QueryType.SPECIFICATION)
        
        # Product-specific queries
        elif len(product_entities) > 0:
            if question_score > 0:
                primary_intent = QueryType.SPECIFICATION
                confidence = 0.8
                reasoning = f"Found question about {len(product_entities)} products"
            else:
                primary_intent = QueryType.GENERAL
                confidence = 0.6
                reasoning = f"Found {len(product_entities)} products without clear intent"
                secondary_intents.extend([QueryType.SPECIFICATION, QueryType.APPLICATION])
        
        # General queries with questions
        elif question_score > 0:
            primary_intent = QueryType.GENERAL
            confidence = 0.7
            reasoning = "Found question patterns"
        
        return QueryIntent(
            primary_intent=primary_intent,
            secondary_intents=secondary_intents,
            confidence=confidence,
            reasoning=reasoning
        )
    
    def _remove_overlapping_entities(self, entities: List[EntityMention]) -> List[EntityMention]:
        """Remove overlapping entity mentions, keeping highest confidence."""
        if not entities:
            return entities
        
        # Sort by start position
        entities.sort(key=lambda e: e.start)
        
        filtered = []
        for entity in entities:
            # Check if this entity overlaps with any already filtered entity
            overlaps = False
            for existing in filtered:
                if (entity.start < existing.end and entity.end > existing.start):
                    # Overlapping - keep the one with higher confidence
                    if entity.confidence > existing.confidence:
                        filtered.remove(existing)
                        break
                    else:
                        overlaps = True
                        break
            
            if not overlaps:
                filtered.append(entity)
        
        return filtered


class QueryRouter:
    """Routes queries to optimal retrieval strategies based on analysis."""
    
    def __init__(self):
        """Initialize query router."""
        self.analyzer = QueryAnalyzer()
        
        # Default retrieval weights for different query types
        self.default_weights = {
            QueryType.SPECIFICATION: {"vector": 0.3, "kg": 0.7},
            QueryType.APPLICATION: {"vector": 0.6, "kg": 0.4},
            QueryType.COMPARISON: {"vector": 0.4, "kg": 0.6},
            QueryType.RELATIONSHIP: {"vector": 0.2, "kg": 0.8},
            QueryType.GENERAL: {"vector": 0.7, "kg": 0.3}
        }
    
    def analyze_query(self, query: str) -> QueryAnalysis:
        """Analyze query and determine optimal retrieval strategy.
        
        Args:
            query: Query text
            
        Returns:
            Query analysis with routing strategy
        """
        try:
            # Extract entities
            entities = self.analyzer.extract_entities(query)
            
            # Analyze intent
            intent = self.analyzer.analyze_intent(query, entities)
            
            # Get retrieval weights
            weights = self.get_retrieval_weights(intent)
            
            # Create suggested strategy
            suggested_strategy = {
                "vector_weight": weights["vector"],
                "kg_weight": weights["kg"],
                "max_results": self._get_max_results(intent.primary_intent),
                "collections": self._get_target_collections(intent.primary_intent, entities),
                "kg_relationship_types": self._get_kg_relationship_types(intent.primary_intent),
                "reasoning": intent.reasoning
            }
            
            return QueryAnalysis(
                query_type=intent.primary_intent,
                entities=[e.text for e in entities],
                intent_confidence=intent.confidence,
                suggested_strategy=suggested_strategy
            )
            
        except Exception as e:
            logger.error(f"Failed to analyze query: {e}")
            # Return default analysis
            return QueryAnalysis(
                query_type=QueryType.GENERAL,
                entities=[],
                intent_confidence=0.5,
                suggested_strategy={
                    "vector_weight": 0.7,
                    "kg_weight": 0.3,
                    "max_results": 10,
                    "collections": ["technical_bulletins"],
                    "kg_relationship_types": None,
                    "reasoning": "Default fallback due to analysis error"
                }
            )
    
    def get_retrieval_weights(self, intent: QueryIntent) -> Dict[str, float]:
        """Get optimal retrieval weights for a query intent.
        
        Args:
            intent: Query intent analysis
            
        Returns:
            Dictionary with vector and kg weights
        """
        base_weights = self.default_weights.get(
            intent.primary_intent,
            {"vector": 0.5, "kg": 0.5}
        )
        
        # Adjust weights based on confidence and secondary intents
        vector_weight = base_weights["vector"]
        kg_weight = base_weights["kg"]
        
        # Lower confidence means more balanced approach
        if intent.confidence < 0.7:
            # Move towards more balanced weights
            vector_weight = 0.4 + (vector_weight - 0.5) * 0.6
            kg_weight = 0.4 + (kg_weight - 0.5) * 0.6
        
        # Adjust for secondary intents
        if QueryType.SPECIFICATION in intent.secondary_intents:
            kg_weight += 0.1
            vector_weight -= 0.1
        
        if QueryType.APPLICATION in intent.secondary_intents:
            vector_weight += 0.1
            kg_weight -= 0.1
        
        # Ensure weights sum to 1.0
        total = vector_weight + kg_weight
        if total > 0:
            vector_weight /= total
            kg_weight /= total
        
        return {
            "vector": max(0.1, min(0.9, vector_weight)),
            "kg": max(0.1, min(0.9, kg_weight))
        }
    
    def _get_max_results(self, query_type: QueryType) -> int:
        """Get maximum results for query type."""
        result_limits = {
            QueryType.SPECIFICATION: 15,
            QueryType.APPLICATION: 20,
            QueryType.COMPARISON: 10,
            QueryType.RELATIONSHIP: 25,
            QueryType.GENERAL: 10
        }
        return result_limits.get(query_type, 10)
    
    def _get_target_collections(
        self,
        query_type: QueryType,
        entities: List[EntityMention]
    ) -> List[str]:
        """Get target collections for search based on query type and entities."""
        # Default collections
        collections = ["technical_bulletins"]
        
        # Add specific collections based on query type
        if query_type == QueryType.APPLICATION:
            collections.extend(["application_guides"])
        elif query_type == QueryType.SPECIFICATION:
            collections.extend(["product_specifications"])
        
        # Add collections based on entities
        has_safety_terms = any(
            term in " ".join([e.text.lower() for e in entities])
            for term in ["safety", "toxicity", "hazard", "msds", "sds"]
        )
        
        if has_safety_terms:
            collections.append("safety_data_sheets")
        
        return list(set(collections))  # Remove duplicates
    
    def _get_kg_relationship_types(self, query_type: QueryType) -> Optional[List[str]]:
        """Get relevant relationship types for knowledge graph queries."""
        relationship_filters = {
            QueryType.SPECIFICATION: ["has_property", "measured_as"],
            QueryType.APPLICATION: ["used_in", "suitable_for", "recommended_for"],
            QueryType.COMPARISON: ["similar_to", "alternative_to", "competes_with"],
            QueryType.RELATIONSHIP: None,  # No filter - get all relationships
            QueryType.GENERAL: None
        }
        return relationship_filters.get(query_type)