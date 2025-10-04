"""Query-specific retrieval strategies for different types of queries."""

import logging
from abc import ABC, abstractmethod
from typing import Any

from ..models.api_models import QueryAnalysis, RetrievalResult

logger = logging.getLogger(__name__)


class RetrievalStrategy(ABC):
    """Base class for query-specific retrieval strategies."""

    def __init__(self, name: str):
        """Initialize strategy with name."""
        self.name = name

    @abstractmethod
    async def execute(
        self,
        query: str,
        analysis: QueryAnalysis,
        vector_service,
        kg_service,
        max_results: int = 20,
        **kwargs
    ) -> tuple[list[RetrievalResult], dict[str, Any]]:
        """Execute the retrieval strategy.
        
        Args:
            query: Search query
            analysis: Query analysis
            vector_service: Vector search service
            kg_service: Knowledge graph service
            max_results: Maximum number of results
            **kwargs: Additional parameters
            
        Returns:
            Tuple of (results, strategy metadata)
        """
        pass

    def calculate_confidence(self, result: RetrievalResult, query: str, entities: list[str]) -> float:
        """Calculate confidence score for a result."""
        base_score = result.score

        # Boost for entity matches
        entity_boost = 0.0
        query_lower = query.lower()
        content_lower = result.content.lower()

        for entity in entities:
            if entity.lower() in content_lower:
                entity_boost += 0.1

        # Boost for exact query matches
        query_boost = 0.0
        if query_lower in content_lower:
            query_boost = 0.1

        final_score = min(base_score + entity_boost + query_boost, 1.0)
        return round(final_score, 3)


class SpecificationStrategy(RetrievalStrategy):
    """Strategy for specification and property queries."""

    def __init__(self):
        super().__init__("specification")

    async def execute(
        self,
        query: str,
        analysis: QueryAnalysis,
        vector_service,
        kg_service,
        max_results: int = 20,
        **kwargs
    ) -> tuple[list[RetrievalResult], dict[str, Any]]:
        """Execute specification retrieval strategy."""
        try:
            results = []
            metadata = {"strategy": self.name, "focus": "properties_and_specifications"}

            # Vector search with focus on properties
            vector_results = await vector_service.search(
                query=query,
                collection_name="technical_bulletins",
                k=max_results,
                filters={"chunk_type": ["properties", "typical_properties", "product_info"]},
                min_score=0.3
            )

            # Boost results that contain property-related content
            for result in vector_results:
                if self._contains_property_keywords(result.content):
                    result.score = min(result.score + 0.1, 1.0)
                result.metadata["strategy_boost"] = "property_keywords"

            results.extend(vector_results)

            # KG search for property relationships
            if analysis.entities:
                for entity in analysis.entities[:2]:
                    try:
                        kg_response = await kg_service.get_entity_neighbors(
                            entity_name=entity,
                            relationship_types=["has_property", "measured_as", "specified_as"],
                            max_depth=1,
                            limit=10
                        )

                        # Convert property-related entities to results
                        for related_entity in kg_response.related_entities:
                            if related_entity.type in ["PROPERTY", "SPECIFICATION"]:
                                content = self._format_property_entity(related_entity, entity)

                                result = RetrievalResult(
                                    content=content,
                                    score=0.85,
                                    source="kg",
                                    metadata={
                                        "entity_id": related_entity.id,
                                        "entity_type": related_entity.type,
                                        "source_entity": entity,
                                        "strategy": self.name,
                                    },
                                    provenance={
                                        "document_id": related_entity.provenance.get("document_id"),
                                        "relationship_type": "property_relationship",
                                    }
                                )
                                results.append(result)

                    except Exception as e:
                        logger.warning(f"KG search failed for entity {entity}: {e}")

            # Sort by confidence score
            for result in results:
                result.score = self.calculate_confidence(result, query, analysis.entities)

            results.sort(key=lambda x: x.score, reverse=True)
            metadata["total_results"] = len(results)

            return results[:max_results], metadata

        except Exception as e:
            logger.error(f"Specification strategy failed: {e}")
            return [], {"strategy": self.name, "error": str(e)}

    def _contains_property_keywords(self, content: str) -> bool:
        """Check if content contains property-related keywords."""
        property_keywords = [
            "viscosity", "density", "temperature", "melting point", "boiling point",
            "molecular weight", "cas number", "formula", "properties", "specifications",
            "test method", "astm", "iso", "din", "unit", "value", "range"
        ]
        content_lower = content.lower()
        return any(keyword in content_lower for keyword in property_keywords)

    def _format_property_entity(self, entity, source_entity: str) -> str:
        """Format property entity for specification queries."""
        content = f"Property of {source_entity}: {entity.canonical_name or entity.text}\n"
        content += f"Type: {entity.type}\n"

        if entity.metadata:
            for key, value in entity.metadata.items():
                if key in ["value", "unit", "test_method", "range"]:
                    content += f"{key.title()}: {value}\n"

        return content


class ApplicationStrategy(RetrievalStrategy):
    """Strategy for application and use case queries."""

    def __init__(self):
        super().__init__("application")

    async def execute(
        self,
        query: str,
        analysis: QueryAnalysis,
        vector_service,
        kg_service,
        max_results: int = 20,
        **kwargs
    ) -> tuple[list[RetrievalResult], dict[str, Any]]:
        """Execute application retrieval strategy."""
        try:
            results = []
            metadata = {"strategy": self.name, "focus": "applications_and_uses"}

            # Vector search with focus on applications
            vector_results = await vector_service.search(
                query=query,
                collection_name="technical_bulletins",
                k=max_results,
                filters={"chunk_type": ["applications", "product_info"]},
                min_score=0.2
            )

            # Boost results that contain application-related content
            for result in vector_results:
                if self._contains_application_keywords(result.content):
                    result.score = min(result.score + 0.15, 1.0)
                result.metadata["strategy_boost"] = "application_keywords"

            results.extend(vector_results)

            # KG search for application relationships
            if analysis.entities:
                for entity in analysis.entities[:2]:
                    try:
                        kg_response = await kg_service.get_entity_neighbors(
                            entity_name=entity,
                            relationship_types=["used_in", "suitable_for", "applied_in"],
                            max_depth=2,
                            limit=15
                        )

                        # Convert application-related entities to results
                        for related_entity in kg_response.related_entities:
                            if related_entity.type in ["APPLICATION", "INDUSTRY", "USE_CASE"]:
                                content = self._format_application_entity(related_entity, entity)

                                result = RetrievalResult(
                                    content=content,
                                    score=0.8,
                                    source="kg",
                                    metadata={
                                        "entity_id": related_entity.id,
                                        "entity_type": related_entity.type,
                                        "source_entity": entity,
                                        "strategy": self.name,
                                    },
                                    provenance={
                                        "document_id": related_entity.provenance.get("document_id"),
                                        "relationship_type": "application_relationship",
                                    }
                                )
                                results.append(result)

                    except Exception as e:
                        logger.warning(f"KG search failed for entity {entity}: {e}")

            # Also search for products used in similar applications
            application_terms = self._extract_application_terms(query)
            for term in application_terms[:2]:
                try:
                    app_results = await kg_service.search_entities(
                        query=term,
                        entity_types=["APPLICATION", "INDUSTRY"],
                        limit=5
                    )
                    results.extend(app_results)
                except Exception as e:
                    logger.warning(f"Application entity search failed for {term}: {e}")

            # Calculate confidence scores
            for result in results:
                result.score = self.calculate_confidence(result, query, analysis.entities)

            results.sort(key=lambda x: x.score, reverse=True)
            metadata["total_results"] = len(results)

            return results[:max_results], metadata

        except Exception as e:
            logger.error(f"Application strategy failed: {e}")
            return [], {"strategy": self.name, "error": str(e)}

    def _contains_application_keywords(self, content: str) -> bool:
        """Check if content contains application-related keywords."""
        application_keywords = [
            "applications", "uses", "used for", "suitable for", "applied in",
            "coatings", "adhesives", "composites", "electronics", "automotive",
            "aerospace", "marine", "construction", "industrial", "consumer",
            "packaging", "textiles", "medical", "pharmaceutical"
        ]
        content_lower = content.lower()
        return any(keyword in content_lower for keyword in application_keywords)

    def _extract_application_terms(self, query: str) -> list[str]:
        """Extract application-related terms from query."""
        application_terms = []
        query_lower = query.lower()

        # Common application domains
        domains = [
            "coatings", "adhesives", "composites", "electronics", "automotive",
            "aerospace", "marine", "construction", "packaging", "textiles"
        ]

        for domain in domains:
            if domain in query_lower:
                application_terms.append(domain)

        return application_terms

    def _format_application_entity(self, entity, source_entity: str) -> str:
        """Format application entity for application queries."""
        content = f"Application for {source_entity}: {entity.canonical_name or entity.text}\n"
        content += f"Type: {entity.type}\n"

        if entity.metadata:
            for key, value in entity.metadata.items():
                if key in ["industry", "use_case", "benefits", "requirements"]:
                    content += f"{key.title()}: {value}\n"

        return content


class ComparisonStrategy(RetrievalStrategy):
    """Strategy for product comparison queries."""

    def __init__(self):
        super().__init__("comparison")

    async def execute(
        self,
        query: str,
        analysis: QueryAnalysis,
        vector_service,
        kg_service,
        max_results: int = 20,
        **kwargs
    ) -> tuple[list[RetrievalResult], dict[str, Any]]:
        """Execute comparison retrieval strategy."""
        try:
            results = []
            metadata = {"strategy": self.name, "focus": "product_comparison"}

            # Extract products to compare
            products_to_compare = analysis.entities[:4]  # Limit to 4 products

            if len(products_to_compare) < 2:
                # If not enough entities detected, try to extract from query
                products_to_compare.extend(self._extract_comparison_products(query))

            metadata["products_compared"] = products_to_compare

            # Get detailed information for each product
            for product in products_to_compare:
                # Vector search for product details
                product_results = await vector_service.search(
                    query=product,
                    collection_name="technical_bulletins",
                    k=5,
                    filters={"product_name": product},
                    min_score=0.4
                )

                # Boost comparison-relevant content
                for result in product_results:
                    if self._contains_comparison_keywords(result.content):
                        result.score = min(result.score + 0.1, 1.0)
                    result.metadata["comparison_product"] = product
                    result.metadata["strategy"] = self.name

                results.extend(product_results)

            # KG search for product relationships and similarities
            if len(products_to_compare) >= 2:
                for i, product1 in enumerate(products_to_compare):
                    for product2 in products_to_compare[i+1:]:
                        try:
                            # Find relationships between products
                            comparison_results = await self._find_product_relationships(
                                product1, product2, kg_service
                            )
                            results.extend(comparison_results)
                        except Exception as e:
                            logger.warning(f"Failed to find relationships between {product1} and {product2}: {e}")

            # Search for competitive/alternative products
            for product in products_to_compare[:2]:
                try:
                    alternatives = await kg_service.find_related_products(
                        product_name=product,
                        relationship_types=["similar_to", "competes_with", "alternative_to"],
                        limit=5
                    )

                    for alt_result in alternatives:
                        alt_result.metadata["comparison_type"] = "alternative"
                        alt_result.metadata["reference_product"] = product

                    results.extend(alternatives)
                except Exception as e:
                    logger.warning(f"Failed to find alternatives for {product}: {e}")

            # Calculate confidence scores with comparison-specific logic
            for result in results:
                result.score = self._calculate_comparison_confidence(result, query, products_to_compare)

            results.sort(key=lambda x: x.score, reverse=True)
            metadata["total_results"] = len(results)

            return results[:max_results], metadata

        except Exception as e:
            logger.error(f"Comparison strategy failed: {e}")
            return [], {"strategy": self.name, "error": str(e)}

    def _extract_comparison_products(self, query: str) -> list[str]:
        """Extract product names from comparison query."""
        import re

        # Patterns for comparison queries
        patterns = [
            r"compare\s+(\w+)\s+(?:and|vs|versus)\s+(\w+)",
            r"(\w+)\s+vs\s+(\w+)",
            r"difference\s+between\s+(\w+)\s+and\s+(\w+)",
        ]

        products = []
        for pattern in patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            for match in matches:
                products.extend(match)

        return products

    def _contains_comparison_keywords(self, content: str) -> bool:
        """Check if content contains comparison-relevant keywords."""
        comparison_keywords = [
            "properties", "specifications", "performance", "advantages", "benefits",
            "characteristics", "features", "typical", "range", "value", "compared to"
        ]
        content_lower = content.lower()
        return any(keyword in content_lower for keyword in comparison_keywords)

    async def _find_product_relationships(self, product1: str, product2: str, kg_service) -> list[RetrievalResult]:
        """Find relationships between two products."""
        results = []

        try:
            # Get neighbors for first product
            kg_response1 = await kg_service.get_entity_neighbors(
                entity_name=product1,
                max_depth=2,
                limit=10
            )

            # Check if second product appears in relationships
            for relationship in kg_response1.relationships:
                if (product2.lower() in relationship.target_entity_id.lower() or
                    product2.lower() in relationship.source_entity_id.lower()):

                    content = f"Relationship between {product1} and {product2}:\n"
                    content += f"{relationship.relationship_type}\n"
                    if relationship.source_text:
                        content += f"Context: {relationship.source_text}\n"

                    result = RetrievalResult(
                        content=content,
                        score=0.9,
                        source="kg",
                        metadata={
                            "relationship_id": relationship.id,
                            "relationship_type": relationship.relationship_type,
                            "product1": product1,
                            "product2": product2,
                            "strategy": self.name,
                        },
                        provenance=relationship.provenance
                    )
                    results.append(result)

        except Exception as e:
            logger.warning(f"Failed to find direct relationships: {e}")

        return results

    def _calculate_comparison_confidence(self, result: RetrievalResult, query: str, products: list[str]) -> float:
        """Calculate confidence score for comparison results."""
        base_score = result.score

        # Boost for multiple product mentions
        content_lower = result.content.lower()
        product_mentions = sum(1 for product in products if product.lower() in content_lower)
        product_boost = min(product_mentions * 0.1, 0.3)

        # Boost for comparison keywords
        comparison_boost = 0.1 if self._contains_comparison_keywords(result.content) else 0.0

        final_score = min(base_score + product_boost + comparison_boost, 1.0)
        return round(final_score, 3)


class RelationshipStrategy(RetrievalStrategy):
    """Strategy for relationship and similarity queries."""

    def __init__(self):
        super().__init__("relationship")

    async def execute(
        self,
        query: str,
        analysis: QueryAnalysis,
        vector_service,
        kg_service,
        max_results: int = 20,
        **kwargs
    ) -> tuple[list[RetrievalResult], dict[str, Any]]:
        """Execute relationship retrieval strategy."""
        try:
            results = []
            metadata = {"strategy": self.name, "focus": "relationships_and_similarity"}

            # This strategy heavily favors knowledge graph search
            target_entities = analysis.entities[:3]  # Focus on first 3 entities

            if not target_entities:
                # Try to extract entities from relationship queries
                target_entities = self._extract_relationship_targets(query)

            metadata["target_entities"] = target_entities

            # KG-heavy search for relationships
            for entity in target_entities:
                try:
                    # Get comprehensive entity neighborhood
                    kg_response = await kg_service.get_entity_neighbors(
                        entity_name=entity,
                        relationship_types=None,  # All relationship types
                        max_depth=3,  # Deeper traversal for relationships
                        limit=15
                    )

                    # Convert all related entities to results
                    for related_entity in kg_response.related_entities:
                        content = self._format_relationship_entity(
                            related_entity, entity, kg_response.relationships
                        )

                        # Calculate relationship strength
                        relationship_strength = self._calculate_relationship_strength(
                            entity, related_entity, kg_response.relationships
                        )

                        result = RetrievalResult(
                            content=content,
                            score=relationship_strength,
                            source="kg",
                            metadata={
                                "entity_id": related_entity.id,
                                "entity_type": related_entity.type,
                                "source_entity": entity,
                                "relationship_strength": relationship_strength,
                                "strategy": self.name,
                            },
                            provenance={
                                "document_id": related_entity.provenance.get("document_id"),
                                "relationship_count": len([
                                    r for r in kg_response.relationships
                                    if (r.source_entity_id == related_entity.id or
                                        r.target_entity_id == related_entity.id)
                                ])
                            }
                        )
                        results.append(result)

                except Exception as e:
                    logger.warning(f"KG relationship search failed for {entity}: {e}")

            # Find similar products using KG
            for entity in target_entities[:2]:
                try:
                    similar_products = await kg_service.find_related_products(
                        product_name=entity,
                        relationship_types=["similar_to", "belongs_to_family", "manufactured_by"],
                        limit=10
                    )

                    for similar_result in similar_products:
                        similar_result.metadata["similarity_type"] = "product_similarity"
                        similar_result.metadata["reference_entity"] = entity
                        similar_result.metadata["strategy"] = self.name

                    results.extend(similar_products)
                except Exception as e:
                    logger.warning(f"Similar product search failed for {entity}: {e}")

            # Limited vector search for context
            if target_entities:
                for entity in target_entities[:2]:
                    vector_results = await vector_service.search(
                        query=f"similar to {entity}",
                        collection_name="technical_bulletins",
                        k=5,
                        min_score=0.3
                    )

                    for result in vector_results:
                        result.metadata["vector_context"] = True
                        result.metadata["strategy"] = self.name
                        result.score *= 0.7  # Lower weight for vector in relationship queries

                    results.extend(vector_results)

            # Calculate final confidence scores
            for result in results:
                result.score = self._calculate_relationship_confidence(result, query, target_entities)

            results.sort(key=lambda x: x.score, reverse=True)
            metadata["total_results"] = len(results)

            return results[:max_results], metadata

        except Exception as e:
            logger.error(f"Relationship strategy failed: {e}")
            return [], {"strategy": self.name, "error": str(e)}

    def _extract_relationship_targets(self, query: str) -> list[str]:
        """Extract target entities from relationship queries."""
        import re

        patterns = [
            r"similar\s+to\s+(\w+)",
            r"related\s+to\s+(\w+)",
            r"like\s+(\w+)",
            r"equivalent\s+to\s+(\w+)",
            r"substitute\s+for\s+(\w+)",
        ]

        targets = []
        for pattern in patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            targets.extend(matches)

        return targets

    def _calculate_relationship_strength(self, source_entity: str, target_entity, relationships: list) -> float:
        """Calculate strength of relationship between entities."""
        try:
            # Count direct relationships
            direct_relationships = [
                r for r in relationships
                if ((r.source_entity_id == target_entity.id) or
                    (r.target_entity_id == target_entity.id))
            ]

            # Base score from relationship count
            relationship_count = len(direct_relationships)
            base_score = min(0.5 + (relationship_count * 0.1), 0.9)

            # Boost for strong relationship types
            strong_relationships = ["similar_to", "equivalent_to", "belongs_to_family"]
            for rel in direct_relationships:
                if rel.relationship_type in strong_relationships:
                    base_score = min(base_score + 0.1, 1.0)

            return round(base_score, 3)

        except Exception as e:
            logger.warning(f"Failed to calculate relationship strength: {e}")
            return 0.6

    def _format_relationship_entity(self, entity, source_entity: str, relationships: list) -> str:
        """Format entity with relationship context."""
        content = f"Related to {source_entity}: {entity.canonical_name or entity.text}\n"
        content += f"Type: {entity.type}\n"

        # Add relationship details
        entity_relationships = [
            r for r in relationships
            if (r.source_entity_id == entity.id or r.target_entity_id == entity.id)
        ]

        if entity_relationships:
            content += "\nRelationships:\n"
            for rel in entity_relationships[:3]:  # Limit to 3 relationships
                rel_desc = f"• {rel.relationship_type}"
                if rel.confidence:
                    rel_desc += f" (confidence: {rel.confidence:.2f})"
                content += rel_desc + "\n"

        if entity.metadata:
            content += "\nKey Properties:\n"
            for key, value in list(entity.metadata.items())[:3]:
                content += f"• {key}: {value}\n"

        return content

    def _calculate_relationship_confidence(self, result: RetrievalResult, query: str, entities: list[str]) -> float:
        """Calculate confidence for relationship results."""
        base_score = result.score

        # Boost for relationship metadata
        relationship_boost = 0.0
        if result.metadata.get("relationship_strength"):
            relationship_boost = result.metadata["relationship_strength"] * 0.2

        # Boost for multiple entity mentions
        content_lower = result.content.lower()
        entity_mentions = sum(1 for entity in entities if entity.lower() in content_lower)
        entity_boost = min(entity_mentions * 0.05, 0.15)

        final_score = min(base_score + relationship_boost + entity_boost, 1.0)
        return round(final_score, 3)
