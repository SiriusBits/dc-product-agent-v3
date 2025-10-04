"""Hybrid retrieval service combining vector search and knowledge graph reasoning."""

import asyncio
import logging
import time
from typing import Any

from ..kg.service import KnowledgeGraphService
from ..models.api_models import QueryAnalysis, RetrievalResult
from ..services.vector_service import VectorService
from .query_router import QueryRouter

logger = logging.getLogger(__name__)


class HybridRetrievalService:
    """Service that combines vector search and knowledge graph retrieval."""

    def __init__(
        self,
        vector_service: VectorService,
        kg_service: KnowledgeGraphService,
        query_router: QueryRouter | None = None,
    ):
        """Initialize hybrid retrieval service.

        Args:
            vector_service: Vector database service
            kg_service: Knowledge graph service
            query_router: Query router (creates default if None)
        """
        self.vector_service = vector_service
        self.kg_service = kg_service
        self.query_router = query_router or QueryRouter()

    async def search(
        self,
        query: str,
        max_results: int = 10,
        vector_weight: float | None = None,
        kg_weight: float | None = None,
        collections: list[str] | None = None,
        kg_relationship_types: list[str] | None = None,
        min_score: float = 0.1,
    ) -> tuple[list[RetrievalResult], QueryAnalysis]:
        """Perform hybrid search combining vector and knowledge graph results.

        Args:
            query: Search query
            max_results: Maximum number of results to return
            vector_weight: Weight for vector search results (auto-determined if None)
            kg_weight: Weight for knowledge graph results (auto-determined if None)
            collections: Vector collections to search (auto-determined if None)
            kg_relationship_types: KG relationship types to consider (auto-determined if None)
            min_score: Minimum score threshold for results

        Returns:
            Tuple of (search results, query analysis)
        """
        try:
            start_time = time.time()

            # Analyze query to determine optimal strategy
            query_analysis = self.query_router.analyze_query(query)

            # Use provided weights or fall back to analyzed strategy
            if vector_weight is None or kg_weight is None:
                strategy = query_analysis.suggested_strategy
                vector_weight = vector_weight or strategy.get("vector_weight", 0.5)
                kg_weight = kg_weight or strategy.get("kg_weight", 0.5)

            # Use provided collections or fall back to analyzed strategy
            if collections is None:
                collections = query_analysis.suggested_strategy.get(
                    "collections", ["technical_bulletins"]
                )

            # Use provided relationship types or fall back to analyzed strategy
            if kg_relationship_types is None:
                kg_relationship_types = query_analysis.suggested_strategy.get(
                    "kg_relationship_types"
                )

            # Determine number of results to fetch from each source
            vector_k = max(
                1, int(max_results * vector_weight * 1.5)
            )  # Fetch extra for fusion
            kg_k = max(1, int(max_results * kg_weight * 1.5))

            logger.info(
                f"Hybrid search: vector_weight={vector_weight:.2f}, kg_weight={kg_weight:.2f}"
            )

            # Perform parallel retrieval
            vector_results, kg_results = await asyncio.gather(
                self._vector_search(query, collections, vector_k, min_score),
                self._kg_search(query, kg_relationship_types, kg_k, min_score),
                return_exceptions=True,
            )

            # Handle exceptions
            if isinstance(vector_results, Exception):
                logger.error(f"Vector search failed: {vector_results}")
                vector_results = []

            if isinstance(kg_results, Exception):
                logger.error(f"KG search failed: {kg_results}")
                kg_results = []

            # Fuse and rank results
            fused_results = self._fuse_results(
                vector_results, kg_results, vector_weight, kg_weight, max_results
            )

            # Filter by minimum score
            final_results = [r for r in fused_results if r.score >= min_score]

            processing_time = time.time() - start_time
            logger.info(
                f"Hybrid search completed in {processing_time:.3f}s: "
                f"{len(vector_results)} vector + {len(kg_results)} KG -> {len(final_results)} final"
            )

            return final_results, query_analysis

        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            # Return empty results with error analysis
            error_analysis = QueryAnalysis(
                query_type=(
                    query_analysis.query_type
                    if "query_analysis" in locals()
                    else "general"
                ),
                entities=[],
                intent_confidence=0.0,
                suggested_strategy={"error": str(e)},
            )
            return [], error_analysis

    async def _vector_search(
        self, query: str, collections: list[str], k: int, min_score: float
    ) -> list[RetrievalResult]:
        """Perform vector search across specified collections."""
        try:
            if not collections:
                logger.warning("No collections specified for vector search")
                return []

            # Search across multiple collections
            results = await self.vector_service.search_multiple_collections(
                query=query,
                collection_names=collections,
                k_per_collection=max(1, k // len(collections)),
                min_score=min_score,
            )

            logger.debug(f"Vector search found {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

    async def _kg_search(
        self,
        query: str,
        relationship_types: list[str] | None,
        k: int,
        min_score: float,
    ) -> list[RetrievalResult]:
        """Perform knowledge graph search."""
        try:
            # Search for entities matching the query
            entity_results = await self.kg_service.search_entities(query=query, limit=k)

            # Filter by minimum score
            filtered_results = [r for r in entity_results if r.score >= min_score]

            logger.debug(f"KG search found {len(filtered_results)} entity results")
            return filtered_results

        except Exception as e:
            logger.error(f"KG search failed: {e}")
            return []

    def _fuse_results(
        self,
        vector_results: list[RetrievalResult],
        kg_results: list[RetrievalResult],
        vector_weight: float,
        kg_weight: float,
        max_results: int,
    ) -> list[RetrievalResult]:
        """Fuse and rank results from vector and knowledge graph search.

        Args:
            vector_results: Results from vector search
            kg_results: Results from knowledge graph search
            vector_weight: Weight for vector results
            kg_weight: Weight for knowledge graph results
            max_results: Maximum number of results to return

        Returns:
            Fused and ranked results
        """
        try:
            # Apply weights to scores
            weighted_vector = []
            for result in vector_results:
                weighted_result = RetrievalResult(
                    content=result.content,
                    score=result.score * vector_weight,
                    source=result.source,
                    metadata={
                        **result.metadata,
                        "original_score": result.score,
                        "weight_applied": vector_weight,
                    },
                    provenance=result.provenance,
                )
                weighted_vector.append(weighted_result)

            weighted_kg = []
            for result in kg_results:
                weighted_result = RetrievalResult(
                    content=result.content,
                    score=result.score * kg_weight,
                    source=result.source,
                    metadata={
                        **result.metadata,
                        "original_score": result.score,
                        "weight_applied": kg_weight,
                    },
                    provenance=result.provenance,
                )
                weighted_kg.append(weighted_result)

            # Combine results
            all_results = weighted_vector + weighted_kg

            # Remove duplicates based on content similarity
            deduplicated = self._remove_duplicate_results(all_results)

            # Sort by weighted score
            deduplicated.sort(key=lambda x: x.score, reverse=True)

            # Apply diversity boost to ensure mix of sources
            final_results = self._apply_diversity_boost(deduplicated, max_results)

            return final_results[:max_results]

        except Exception as e:
            logger.error(f"Result fusion failed: {e}")
            # Fallback: just combine and sort
            all_results = vector_results + kg_results
            all_results.sort(key=lambda x: x.score, reverse=True)
            return all_results[:max_results]

    def _remove_duplicate_results(
        self, results: list[RetrievalResult]
    ) -> list[RetrievalResult]:
        """Remove duplicate results based on content similarity."""
        if not results:
            return results

        deduplicated = []
        seen_content = set()

        for result in results:
            # Create a normalized version of content for comparison
            normalized_content = self._normalize_content_for_comparison(result.content)

            # Check for exact duplicates first
            if normalized_content in seen_content:
                continue

            # Check for high similarity with existing results
            is_duplicate = False
            for existing in deduplicated:
                if (
                    self._calculate_content_similarity(result.content, existing.content)
                    > 0.9
                ):
                    # Keep the one with higher score
                    if result.score > existing.score:
                        deduplicated.remove(existing)
                        break
                    else:
                        is_duplicate = True
                        break

            if not is_duplicate:
                deduplicated.append(result)
                seen_content.add(normalized_content)

        return deduplicated

    def _normalize_content_for_comparison(self, content: str) -> str:
        """Normalize content for duplicate detection."""
        # Remove extra whitespace and convert to lowercase
        normalized = " ".join(content.lower().split())

        # Remove common prefixes that might vary
        prefixes_to_remove = [
            "product:",
            "entity:",
            "section:",
            "properties:",
            "applications:",
        ]

        for prefix in prefixes_to_remove:
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix) :].strip()
                break

        return normalized

    def _calculate_content_similarity(self, content1: str, content2: str) -> float:
        """Calculate similarity between two content strings."""
        # Simple word-based similarity
        words1 = set(content1.lower().split())
        words2 = set(content2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = words1.intersection(words2)
        union = words1.union(words2)

        return len(intersection) / len(union) if union else 0.0

    def _apply_diversity_boost(
        self, results: list[RetrievalResult], max_results: int
    ) -> list[RetrievalResult]:
        """Apply diversity boost to ensure mix of sources and content types."""
        if len(results) <= max_results:
            return results

        # Group results by source
        source_groups = {}
        for result in results:
            source = result.source
            if source not in source_groups:
                source_groups[source] = []
            source_groups[source].append(result)

        # If we have results from multiple sources, ensure representation
        if len(source_groups) > 1:
            diverse_results = []
            remaining_slots = max_results

            # First, take top result from each source
            for _source, source_results in source_groups.items():
                if remaining_slots > 0 and source_results:
                    diverse_results.append(source_results[0])
                    remaining_slots -= 1

            # Fill remaining slots with highest scoring results
            remaining_results = []
            for _source, source_results in source_groups.items():
                remaining_results.extend(
                    source_results[1:]
                )  # Skip first (already added)

            remaining_results.sort(key=lambda x: x.score, reverse=True)
            diverse_results.extend(remaining_results[:remaining_slots])

            # Sort final results by score
            diverse_results.sort(key=lambda x: x.score, reverse=True)
            return diverse_results

        # If all results from same source, just return top results
        return results[:max_results]

    async def get_related_content(
        self,
        entity_name: str,
        max_results: int = 10,
        relationship_types: list[str] | None = None,
    ) -> list[RetrievalResult]:
        """Get content related to a specific entity.

        Args:
            entity_name: Name of the entity to find related content for
            max_results: Maximum number of results
            relationship_types: Types of relationships to consider

        Returns:
            List of related content results
        """
        try:
            # Get entity neighbors from knowledge graph
            kg_response = await self.kg_service.get_entity_neighbors(
                entity_name=entity_name,
                relationship_types=relationship_types,
                max_depth=2,
                limit=max_results,
            )

            # Convert related entities to retrieval results
            results = []

            # Add the central entity
            if (
                kg_response.central_entity
                and kg_response.central_entity.id != "not_found"
            ):
                content = f"Entity: {kg_response.central_entity.canonical_name or kg_response.central_entity.text}\n"
                content += f"Type: {kg_response.central_entity.type}\n"

                if kg_response.central_entity.metadata:
                    content += "Properties:\n"
                    for key, value in kg_response.central_entity.metadata.items():
                        content += f"  {key}: {value}\n"

                result = RetrievalResult(
                    content=content,
                    score=1.0,
                    source="kg",
                    metadata={
                        "entity_id": kg_response.central_entity.id,
                        "entity_type": kg_response.central_entity.type,
                        "is_central_entity": True,
                    },
                    provenance={
                        "document_id": kg_response.central_entity.provenance.document_id,
                        "page": kg_response.central_entity.provenance.page,
                    },
                )
                results.append(result)

            # Add related entities
            for entity in kg_response.related_entities:
                content = f"Related Entity: {entity.canonical_name or entity.text}\n"
                content += f"Type: {entity.type}\n"

                # Find relationships to this entity
                relationships = [
                    r
                    for r in kg_response.relationships
                    if r.source_entity_id == entity.id
                    or r.target_entity_id == entity.id
                ]

                if relationships:
                    content += "Relationships:\n"
                    for rel in relationships[:3]:  # Limit to top 3 relationships
                        content += f"  {rel.relationship_type}\n"

                if entity.metadata:
                    content += "Properties:\n"
                    for key, value in list(entity.metadata.items())[
                        :3
                    ]:  # Limit properties
                        content += f"  {key}: {value}\n"

                result = RetrievalResult(
                    content=content,
                    score=0.8,
                    source="kg",
                    metadata={
                        "entity_id": entity.id,
                        "entity_type": entity.type,
                        "relationship_count": len(relationships),
                    },
                    provenance={
                        "document_id": entity.provenance.document_id,
                        "page": entity.provenance.page,
                        "relationships": [r.relationship_type for r in relationships],
                    },
                )
                results.append(result)

            # Sort by score and limit results
            results.sort(key=lambda x: x.score, reverse=True)
            return results[:max_results]

        except Exception as e:
            logger.error(f"Failed to get related content for {entity_name}: {e}")
            return []

    async def health_check(self) -> dict[str, Any]:
        """Check health of hybrid retrieval service.

        Returns:
            Health status information
        """
        try:
            # Check component health
            vector_health = await self.vector_service.health_check()
            kg_health = await self.kg_service.health_check()

            # Determine overall health
            vector_healthy = vector_health.get("status") == "healthy"
            kg_healthy = kg_health.get("status") == "healthy"

            if vector_healthy and kg_healthy:
                overall_status = "healthy"
            elif vector_healthy or kg_healthy:
                overall_status = "degraded"
            else:
                overall_status = "unhealthy"

            return {
                "status": overall_status,
                "components": {
                    "vector_service": vector_health,
                    "kg_service": kg_health,
                },
                "capabilities": {
                    "hybrid_search": vector_healthy and kg_healthy,
                    "vector_only": vector_healthy,
                    "kg_only": kg_healthy,
                },
                "timestamp": time.time(),
            }

        except Exception as e:
            logger.error(f"Hybrid retrieval health check failed: {e}")
            return {"status": "unhealthy", "error": str(e), "timestamp": time.time()}
