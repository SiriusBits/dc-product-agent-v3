"""Optimized hybrid retrieval service with caching and performance enhancements."""

import asyncio
import logging
import time
from typing import Any

from ..models.api_models import QueryAnalysis, RetrievalResult
from .adaptive_service import AdaptiveRetrievalService
from .cache import CacheConfig, RetrievalCache
from .connection_pool import ConnectionPoolManager, PoolConfig
from .hybrid_service import HybridRetrievalService

logger = logging.getLogger(__name__)


class OptimizedRetrievalService:
    """High-performance retrieval service with caching and connection pooling."""

    def __init__(
        self,
        vector_service=None,
        kg_service=None,
        cache_config: CacheConfig | None = None,
        pool_config: PoolConfig | None = None,
    ):
        """Initialize optimized retrieval service.
        
        Args:
            vector_service: Vector search service
            kg_service: Knowledge graph service
            cache_config: Cache configuration
            pool_config: Connection pool configuration
        """
        self.vector_service = vector_service
        self.kg_service = kg_service

        # Initialize caching
        self.cache = RetrievalCache(cache_config)
        self.cache_enabled = True

        # Initialize connection pooling
        self.pool_manager = ConnectionPoolManager()
        self.pool_config = pool_config or PoolConfig()

        # Initialize core services
        self.hybrid_service = HybridRetrievalService(vector_service, kg_service)
        self.adaptive_service = AdaptiveRetrievalService(vector_service, kg_service)

        # Performance tracking
        self.performance_stats = {
            "total_queries": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "avg_response_time": 0.0,
            "parallel_searches": 0,
            "errors": 0,
        }

        self._initialized = False

    async def initialize(self) -> bool:
        """Initialize the optimized retrieval service.
        
        Returns:
            True if initialization successful
        """
        try:
            # Initialize cache
            cache_success = await self.cache.connect()
            if not cache_success:
                logger.warning("Cache initialization failed, continuing without cache")
                self.cache_enabled = False

            # Initialize core services
            hybrid_success = await self.hybrid_service.initialize()

            if hybrid_success:
                self._initialized = True
                logger.info("Optimized retrieval service initialized successfully")
                return True
            else:
                logger.error("Failed to initialize core retrieval services")
                return False

        except Exception as e:
            logger.error(f"Failed to initialize optimized retrieval service: {e}")
            return False

    async def search(
        self,
        query: str,
        max_results: int = 20,
        use_cache: bool = True,
        use_adaptive: bool = True,
        timeout: float = 30.0,
        **kwargs
    ) -> tuple[list[RetrievalResult], dict[str, Any]]:
        """Perform optimized hybrid search with caching and performance enhancements.
        
        Args:
            query: Search query
            max_results: Maximum number of results
            use_cache: Whether to use caching
            use_adaptive: Whether to use adaptive strategies
            timeout: Query timeout in seconds
            **kwargs: Additional search parameters
            
        Returns:
            Tuple of (results, metadata)
        """
        start_time = time.time()
        self.performance_stats["total_queries"] += 1

        try:
            # Analyze query (with caching)
            analysis = await self._get_query_analysis(query, use_cache)

            # Check cache for results
            cached_results = None
            if use_cache and self.cache_enabled:
                cached_results = await self.cache.get_query_results(
                    query, analysis, max_results, **kwargs
                )

                if cached_results:
                    self.performance_stats["cache_hits"] += 1
                    execution_time = time.time() - start_time

                    metadata = {
                        "cached": True,
                        "execution_time_ms": int(execution_time * 1000),
                        "query_analysis": analysis.dict(),
                        "cache_hit": True,
                    }

                    self._update_performance_stats(execution_time)
                    return cached_results, metadata

            # Cache miss - perform search
            self.performance_stats["cache_misses"] += 1

            # Execute search with timeout
            search_task = self._execute_search(
                query, analysis, max_results, use_adaptive, **kwargs
            )

            try:
                results, search_metadata = await asyncio.wait_for(search_task, timeout=timeout)
            except TimeoutError:
                logger.error(f"Search timeout after {timeout}s for query: {query}")
                self.performance_stats["errors"] += 1
                return [], {
                    "error": "Search timeout",
                    "timeout_seconds": timeout,
                    "query_analysis": analysis.dict(),
                }

            # Cache results if enabled
            if use_cache and self.cache_enabled and results:
                await self.cache.cache_query_results(
                    query, analysis, results, max_results, **kwargs
                )

            # Update metadata
            execution_time = time.time() - start_time
            search_metadata.update({
                "cached": False,
                "execution_time_ms": int(execution_time * 1000),
                "cache_enabled": self.cache_enabled,
                "timeout_seconds": timeout,
            })

            self._update_performance_stats(execution_time)
            return results, search_metadata

        except Exception as e:
            logger.error(f"Optimized search failed: {e}")
            self.performance_stats["errors"] += 1

            execution_time = time.time() - start_time
            return [], {
                "error": str(e),
                "execution_time_ms": int(execution_time * 1000),
                "query_analysis": analysis.dict() if 'analysis' in locals() else {},
            }

    async def _get_query_analysis(self, query: str, use_cache: bool) -> QueryAnalysis:
        """Get query analysis with caching support."""
        try:
            # Try cache first
            if use_cache and self.cache_enabled:
                cached_analysis = await self.cache.get_query_analysis(query)
                if cached_analysis:
                    return cached_analysis

            # Perform analysis
            analysis = self.hybrid_service.query_router.analyze_query(query)

            # Cache analysis
            if use_cache and self.cache_enabled:
                await self.cache.cache_query_analysis(query, analysis)

            return analysis

        except Exception as e:
            logger.error(f"Query analysis failed: {e}")
            # Return default analysis
            from ..models.api_models import QueryType
            return QueryAnalysis(
                query_type=QueryType.GENERAL,
                entities=[],
                intent_confidence=0.5,
                suggested_strategy={}
            )

    async def _execute_search(
        self,
        query: str,
        analysis: QueryAnalysis,
        max_results: int,
        use_adaptive: bool,
        **kwargs
    ) -> tuple[list[RetrievalResult], dict[str, Any]]:
        """Execute the actual search operation."""
        try:
            if use_adaptive:
                # Use adaptive strategy-based search
                results, metadata = await self.adaptive_service.execute_strategy(
                    query=query,
                    analysis=analysis,
                    max_results=max_results,
                    **kwargs
                )
                metadata["search_type"] = "adaptive"
            else:
                # Use standard hybrid search
                results, _ = await self.hybrid_service.search(
                    query=query,
                    max_results=max_results,
                    **kwargs
                )
                metadata = {
                    "search_type": "hybrid",
                    "query_analysis": analysis.dict(),
                }

            return results, metadata

        except Exception as e:
            logger.error(f"Search execution failed: {e}")
            return [], {"error": str(e), "search_type": "failed"}

    async def parallel_search(
        self,
        queries: list[str],
        max_results_per_query: int = 10,
        use_cache: bool = True,
        **kwargs
    ) -> dict[str, tuple[list[RetrievalResult], dict[str, Any]]]:
        """Perform multiple searches in parallel.
        
        Args:
            queries: List of search queries
            max_results_per_query: Maximum results per query
            use_cache: Whether to use caching
            **kwargs: Additional search parameters
            
        Returns:
            Dictionary mapping queries to (results, metadata)
        """
        try:
            self.performance_stats["parallel_searches"] += 1

            # Create search tasks
            tasks = []
            for query in queries:
                task = self.search(
                    query=query,
                    max_results=max_results_per_query,
                    use_cache=use_cache,
                    **kwargs
                )
                tasks.append(task)

            # Execute in parallel
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            search_results = {}
            for i, query in enumerate(queries):
                if isinstance(results[i], Exception):
                    logger.error(f"Parallel search failed for query '{query}': {results[i]}")
                    search_results[query] = ([], {"error": str(results[i])})
                else:
                    search_results[query] = results[i]

            logger.info(f"Completed parallel search for {len(queries)} queries")
            return search_results

        except Exception as e:
            logger.error(f"Parallel search failed: {e}")
            return {query: ([], {"error": str(e)}) for query in queries}

    async def warm_cache(self, common_queries: list[str]) -> dict[str, bool]:
        """Warm up the cache with common queries.
        
        Args:
            common_queries: List of common queries to cache
            
        Returns:
            Dictionary mapping queries to success status
        """
        try:
            logger.info(f"Warming cache with {len(common_queries)} queries")

            results = {}
            for query in common_queries:
                try:
                    # Perform search to populate cache
                    await self.search(query, use_cache=True)
                    results[query] = True
                except Exception as e:
                    logger.error(f"Failed to warm cache for query '{query}': {e}")
                    results[query] = False

            successful = sum(1 for success in results.values() if success)
            logger.info(f"Cache warming completed: {successful}/{len(common_queries)} successful")

            return results

        except Exception as e:
            logger.error(f"Cache warming failed: {e}")
            return dict.fromkeys(common_queries, False)

    async def invalidate_cache(self, pattern: str | None = None) -> bool:
        """Invalidate cache entries.
        
        Args:
            pattern: Cache key pattern to invalidate (None for all)
            
        Returns:
            True if successful
        """
        try:
            if not self.cache_enabled:
                return False

            if pattern:
                deleted = await self.cache.invalidate_pattern(pattern)
                logger.info(f"Invalidated {deleted} cache entries matching pattern: {pattern}")
            else:
                success = await self.cache.clear_all()
                logger.info("Cleared all cache entries")
                return success

            return True

        except Exception as e:
            logger.error(f"Cache invalidation failed: {e}")
            return False

    def _update_performance_stats(self, execution_time: float) -> None:
        """Update performance statistics."""
        try:
            # Update average response time using exponential moving average
            alpha = 0.1  # Smoothing factor
            if self.performance_stats["avg_response_time"] == 0:
                self.performance_stats["avg_response_time"] = execution_time
            else:
                current_avg = self.performance_stats["avg_response_time"]
                self.performance_stats["avg_response_time"] = (
                    alpha * execution_time + (1 - alpha) * current_avg
                )

        except Exception as e:
            logger.error(f"Failed to update performance stats: {e}")

    async def get_performance_stats(self) -> dict[str, Any]:
        """Get performance statistics.
        
        Returns:
            Performance statistics
        """
        try:
            stats = self.performance_stats.copy()

            # Add cache statistics if available
            if self.cache_enabled:
                cache_stats = await self.cache.get_cache_stats()
                stats["cache"] = cache_stats

            # Calculate cache hit rate
            total_cache_requests = stats["cache_hits"] + stats["cache_misses"]
            if total_cache_requests > 0:
                stats["cache_hit_rate"] = stats["cache_hits"] / total_cache_requests
            else:
                stats["cache_hit_rate"] = 0.0

            # Add service health
            if self._initialized:
                health = await self.hybrid_service.health_check()
                stats["service_health"] = health

            stats["initialized"] = self._initialized
            stats["cache_enabled"] = self.cache_enabled

            return stats

        except Exception as e:
            logger.error(f"Failed to get performance stats: {e}")
            return {"error": str(e)}

    async def shutdown(self) -> None:
        """Shutdown the optimized retrieval service."""
        try:
            # Disconnect cache
            if self.cache_enabled:
                await self.cache.disconnect()

            # Close connection pools
            await self.pool_manager.close_all()

            # Shutdown core services
            if hasattr(self.kg_service, 'shutdown'):
                await self.kg_service.shutdown()

            self._initialized = False
            logger.info("Optimized retrieval service shut down")

        except Exception as e:
            logger.error(f"Error during shutdown: {e}")
