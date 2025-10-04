"""Core hybrid retrieval service combining vector and knowledge graph search."""

import asyncio
import logging
import time
from typing import Any

from ..kg.service import KnowledgeGraphService
from ..models.api_models import QueryAnalysis, RetrievalResult
from ..services.vector_service import VectorService
from .fusion import ResultFusion
from .query_router import QueryRouter

logger = logging.getLogger(__name__)


class HybridRetrievalService:
    """Core service for hybrid retrieval combining vector and knowledge graph search."""

    def __init__(
        self,
        vector_service: VectorService | None = None,
        kg_service: KnowledgeGraphService | None = None,
        query_router: QueryRouter | None = None,
    ):
        """Initialize hybrid retrieval service.
        
        Args:
            vector_service: Vector search service
            kg_service: Knowledge graph service
            query_router: Query analysis and routing service
        """
        self.vector_service = vector_service or VectorService()
        self.kg_service = kg_service or KnowledgeGraphService()
        self.query_router = query_router or QueryRouter()
        self.fusion = ResultFusion()
        self._initialized = False

    async def initialize(self) -> bool:
        """Initialize the hybrid retrieval service.
        
        Returns:
            True if initialization successful
        """
        try:
            # Initialize vector service
            vector_success = await self.vector_service.initialize()

            # Initialize knowledge graph service
            kg_success = await self.kg_service.initialize()

            # Service is usable if at least one component is working
            if vector_success or kg_success:
                self._initialized = True
                logger.info(f"Hybrid retrieval service initialized (vector: {vector_success}, kg: {kg_success})")
                return True
            else:
                logger.error("Failed to initialize hybrid retrieval service - no components available")
                return False

        except Exception as e:
            logger.error(f"Failed to initialize hybrid retrieval service: {e}")
            return False

    async def search(
        self,
        query: str,
        max_results: int = 20,
        vector_weight: float | None = None,
        kg_weight: float | None = None,
        fusion_algorithm: str = "weighted_score",
        min_confidence: float = 0.1,
        **kwargs
    ) -> tuple[list[RetrievalResult], QueryAnalysis]:
        """Perform hybrid search combining vector and knowledge graph retrieval.
        
        Args:
            query: Search query
            max_results: Maximum number of results to return
            vector_weight: Weight for vector search results (auto-calculated if None)
            kg_weight: Weight for knowledge graph results (auto-calculated if None)
            fusion_algorithm: Algorithm for fusing results ("weighted_score", "rrf", "interleaved", "confidence")
            min_confidence: Minimum confidence threshold for results
            **kwargs: Additional parameters for specific search strategies
            
        Returns:
            Tuple of (fused results, query analysis)
        """
        try:
            start_time = time.time()

            # Analyze query to determine optimal strategy
            analysis = self.query_router.analyze_query(query)

            # Get retrieval weights if not provided
            if vector_weight is None or kg_weight is None:
                weights = self.query_router.get_retrieval_weights(analysis)
                vector_weight = vector_weight or weights["vector_weight"]
                kg_weight = kg_weight or weights["kg_weight"]

            # Perform parallel retrieval
            vector_results, kg_results = await self._parallel_retrieval(
                query, analysis, max_results, **kwargs
            )

            # Filter by minimum confidence
            vector_results = [r for r in vector_results if r.score >= min_confidence]
            kg_results = [r for r in kg_results if r.score >= min_confidence]

            # Fuse results using specified algorithm
            fused_results = await self._fuse_results(
                vector_results,
                kg_results,
                fusion_algorithm,
                vector_weight,
                kg_weight,
                max_results
            )

            # Add timing information
            processing_time = time.time() - start_time
            for result in fused_results:
                result.metadata["processing_time_ms"] = int(processing_time * 1000)
                result.metadata["query_analysis"] = analysis.dict()

            logger.info(
                f"Hybrid search completed: {len(vector_results)} vector + {len(kg_results)} KG → {len(fused_results)} fused results"
            )

            return fused_results, analysis

        except Exception as e:
            logger.error(f"Failed to perform hybrid search: {e}")
            # Return empty results with error analysis
            error_analysis = QueryAnalysis(
                query_type=analysis.query_type if 'analysis' in locals() else "general",
                entities=[],
                intent_confidence=0.0,
                suggested_strategy={"error": str(e)}
            )
            return [], error_analysis

    async def _parallel_retrieval(
        self,
        query: str,
        analysis: QueryAnalysis,
        max_results: int,
        **kwargs
    ) -> tuple[list[RetrievalResult], list[RetrievalResult]]:
        """Perform parallel vector and knowledge graph retrieval.
        
        Args:
            query: Search query
            analysis: Query analysis
            max_results: Maximum results per source
            **kwargs: Additional search parameters
            
        Returns:
            Tuple of (vector results, kg results)
        """
        try:
            # Prepare search tasks
            tasks = []

            # Vector search task
            vector_task = self._vector_search(query, analysis, max_results, **kwargs)
            tasks.append(vector_task)

            # Knowledge graph search task
            kg_task = self._kg_search(query, analysis, max_results, **kwargs)
            tasks.append(kg_task)

            # Execute searches in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Handle results and exceptions
            vector_results = []
            kg_results = []

            if len(results) >= 1 and not isinstance(results[0], Exception):
                vector_results = results[0]
            elif len(results) >= 1:
                logger.error(f"Vector search failed: {results[0]}")

            if len(results) >= 2 and not isinstance(results[1], Exception):
                kg_results = results[1]
            elif len(results) >= 2:
                logger.error(f"KG search failed: {results[1]}")

            return vector_results, kg_results

        except Exception as e:
            logger.error(f"Failed to perform parallel retrieval: {e}")
            return [], []

    async def _vector_search(
        self,
        query: str,
        analysis: QueryAnalysis,
        max_results: int,
        **kwargs
    ) -> list[RetrievalResult]:
        """Perform vector database search.
        
        Args:
            query: Search query
            analysis: Query analysis
            max_results: Maximum number of results
            **kwargs: Additional search parameters
            
        Returns:
            Vector search results
        """
        try:
            # Get strategy parameters
            strategy = analysis.suggested_strategy
            collections = strategy.get("vector_collections", ["technical_bulletins"])

            # Prepare search filters
            filters = kwargs.get("filters", {})

            # Add entity-based filters if entities were detected
            if analysis.entities and strategy.get("entity_boost", False):
                # Create filter to boost results containing detected entities
                entity_filter = {
                    "product_names": analysis.entities
                }
                filters.update(entity_filter)

            # Perform search across specified collections
            if len(collections) == 1:
                results = await self.vector_service.search(
                    query=query,
                    collection_name=collections[0],
                    k=max_results,
                    filters=filters,
                    min_score=kwargs.get("min_score", 0.0)
                )
            else:
                results = await self.vector_service.search_multiple_collections(
                    query=query,
                    collection_names=collections,
                    k_per_collection=max_results // len(collections),
                    filters=filters,
                    min_score=kwargs.get("min_score", 0.0)
                )

            # Add vector-specific metadata
            for result in results:
                result.metadata["search_type"] = "vector"
                result.metadata["collections_searched"] = collections
                result.metadata["entities_detected"] = analysis.entities

            logger.info(f"Vector search returned {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return []

    async def _kg_search(
        self,
        query: str,
        analysis: QueryAnalysis,
        max_results: int,
        **kwargs
    ) -> list[RetrievalResult]:
        """Perform knowledge graph search.
        
        Args:
            query: Search query
            analysis: Query analysis
            max_results: Maximum number of results
            **kwargs: Additional search parameters
            
        Returns:
            Knowledge graph search results
        """
        try:
            # Get strategy parameters
            strategy = analysis.suggested_strategy
            entity_types = strategy.get("kg_entity_types")
            relationship_types = strategy.get("kg_relationship_types")
            max_depth = strategy.get("kg_max_depth", 2)

            results = []

            # If specific entities were detected, search for related entities
            if analysis.entities:
                for entity in analysis.entities[:3]:  # Limit to first 3 entities
                    try:
                        # Get entity neighbors
                        kg_response = await self.kg_service.get_entity_neighbors(
                            entity_name=entity,
                            relationship_types=relationship_types,
                            max_depth=max_depth,
                            limit=max_results // len(analysis.entities)
                        )

                        # Convert related entities to retrieval results
                        for related_entity in kg_response.related_entities:
                            content = self._format_kg_entity_result(related_entity, kg_response.relationships)

                            result = RetrievalResult(
                                content=content,
                                score=0.8,  # Default KG relevance score
                                source="kg",
                                metadata={
                                    "entity_id": related_entity.id,
                                    "entity_type": related_entity.type,
                                    "canonical_name": related_entity.canonical_name,
                                    "search_type": "kg_neighbors",
                                    "source_entity": entity,
                                },
                                provenance={
                                    "document_id": related_entity.provenance.get("document_id"),
                                    "page": related_entity.provenance.get("page"),
                                    "relationship_count": len([
                                        r for r in kg_response.relationships
                                        if r.source_entity_id == related_entity.id or r.target_entity_id == related_entity.id
                                    ])
                                }
                            )
                            results.append(result)

                    except Exception as e:
                        logger.warning(f"Failed to search KG for entity '{entity}': {e}")
                        continue

            # Also perform general entity search
            try:
                entity_results = await self.kg_service.search_entities(
                    query=query,
                    entity_types=entity_types,
                    limit=max_results // 2
                )
                results.extend(entity_results)

            except Exception as e:
                logger.warning(f"Failed to perform general KG entity search: {e}")

            # Remove duplicates and sort by score
            unique_results = {}
            for result in results:
                entity_id = result.metadata.get("entity_id")
                if entity_id and entity_id not in unique_results:
                    unique_results[entity_id] = result
                elif not entity_id:
                    # For results without entity_id, use content as key
                    content_key = result.content[:100]
                    if content_key not in unique_results:
                        unique_results[content_key] = result

            final_results = list(unique_results.values())
            final_results.sort(key=lambda x: x.score, reverse=True)

            logger.info(f"KG search returned {len(final_results)} results")
            return final_results[:max_results]

        except Exception as e:
            logger.error(f"KG search failed: {e}")
            return []

    async def _fuse_results(
        self,
        vector_results: list[RetrievalResult],
        kg_results: list[RetrievalResult],
        algorithm: str,
        vector_weight: float,
        kg_weight: float,
        max_results: int
    ) -> list[RetrievalResult]:
        """Fuse results from different sources using specified algorithm.
        
        Args:
            vector_results: Results from vector search
            kg_results: Results from knowledge graph search
            algorithm: Fusion algorithm to use
            vector_weight: Weight for vector results
            kg_weight: Weight for KG results
            max_results: Maximum number of results
            
        Returns:
            Fused results
        """
        try:
            if algorithm == "weighted_score":
                return self.fusion.weighted_score_fusion(
                    vector_results, kg_results, vector_weight, kg_weight, max_results
                )
            elif algorithm == "rrf":
                return self.fusion.reciprocal_rank_fusion(
                    vector_results, kg_results, max_results=max_results
                )
            elif algorithm == "interleaved":
                return self.fusion.interleaved_fusion(
                    vector_results, kg_results, vector_weight, max_results
                )
            elif algorithm == "confidence":
                return self.fusion.confidence_based_fusion(
                    vector_results, kg_results, max_results=max_results
                )
            else:
                logger.warning(f"Unknown fusion algorithm '{algorithm}', using weighted_score")
                return self.fusion.weighted_score_fusion(
                    vector_results, kg_results, vector_weight, kg_weight, max_results
                )

        except Exception as e:
            logger.error(f"Failed to fuse results with algorithm '{algorithm}': {e}")
            # Fallback: simple concatenation
            all_results = vector_results + kg_results
            all_results.sort(key=lambda x: x.score, reverse=True)
            return all_results[:max_results]

    def _format_kg_entity_result(self, entity, relationships: list) -> str:
        """Format knowledge graph entity as retrieval result content."""
        try:
            content = f"Entity: {entity.canonical_name or entity.text}\n"
            content += f"Type: {entity.type}\n"

            if entity.aliases:
                content += f"Also known as: {', '.join(entity.aliases)}\n"

            # Add relevant relationships
            entity_relationships = [
                r for r in relationships
                if r.source_entity_id == entity.id or r.target_entity_id == entity.id
            ]

            if entity_relationships:
                content += "\nRelationships:\n"
                for rel in entity_relationships[:5]:  # Limit to 5 relationships
                    if rel.source_entity_id == entity.id:
                        content += f"• {rel.relationship_type} → {rel.target_entity_id}\n"
                    else:
                        content += f"• {rel.source_entity_id} → {rel.relationship_type} → {entity.canonical_name or entity.text}\n"

            if entity.metadata:
                content += "\nProperties:\n"
                for key, value in list(entity.metadata.items())[:5]:  # Limit to 5 properties
                    content += f"• {key}: {value}\n"

            return content

        except Exception as e:
            logger.error(f"Failed to format KG entity result: {e}")
            return f"Entity: {entity.canonical_name or entity.text} (Type: {entity.type})"

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
                status = "healthy"
            elif vector_healthy or kg_healthy:
                status = "degraded"
            else:
                status = "unhealthy"

            return {
                "status": status,
                "initialized": self._initialized,
                "components": {
                    "vector_service": vector_health,
                    "kg_service": kg_health,
                },
                "capabilities": {
                    "vector_search": vector_healthy,
                    "kg_search": kg_healthy,
                    "hybrid_fusion": vector_healthy or kg_healthy,
                },
                "timestamp": time.time(),
            }

        except Exception as e:
            logger.error(f"Hybrid retrieval health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "initialized": self._initialized,
                "timestamp": time.time(),
            }
