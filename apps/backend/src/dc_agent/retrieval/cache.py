"""Caching layer for hybrid retrieval system."""

import hashlib
import json
import logging
import time
from typing import Any

import redis.asyncio as redis
from pydantic import BaseModel

from ..models.api_models import QueryAnalysis, RetrievalResult

logger = logging.getLogger(__name__)


class CacheConfig(BaseModel):
    """Configuration for caching system."""

    redis_url: str = "redis://localhost:6379"
    default_ttl: int = 3600  # 1 hour
    query_ttl: int = 1800    # 30 minutes
    analysis_ttl: int = 7200  # 2 hours
    max_cache_size: int = 10000
    enable_compression: bool = True


class RetrievalCache:
    """Redis-based caching for retrieval results."""

    def __init__(self, config: CacheConfig | None = None):
        """Initialize retrieval cache.
        
        Args:
            config: Cache configuration
        """
        self.config = config or CacheConfig()
        self.redis_client: redis.Redis | None = None
        self._connected = False

    async def connect(self) -> bool:
        """Connect to Redis cache.
        
        Returns:
            True if connection successful
        """
        try:
            self.redis_client = redis.from_url(
                self.config.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )

            # Test connection
            await self.redis_client.ping()
            self._connected = True
            logger.info("Connected to Redis cache")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to Redis cache: {e}")
            self._connected = False
            return False

    async def disconnect(self) -> None:
        """Disconnect from Redis cache."""
        try:
            if self.redis_client:
                await self.redis_client.close()
            self._connected = False
            logger.info("Disconnected from Redis cache")
        except Exception as e:
            logger.error(f"Error disconnecting from Redis: {e}")

    def _generate_cache_key(self, prefix: str, data: dict[str, Any]) -> str:
        """Generate cache key from data.
        
        Args:
            prefix: Key prefix
            data: Data to hash
            
        Returns:
            Cache key
        """
        try:
            # Create deterministic hash from data
            data_str = json.dumps(data, sort_keys=True)
            hash_obj = hashlib.md5(data_str.encode())
            return f"{prefix}:{hash_obj.hexdigest()}"
        except Exception as e:
            logger.error(f"Failed to generate cache key: {e}")
            return f"{prefix}:error_{int(time.time())}"

    async def get_query_results(
        self,
        query: str,
        analysis: QueryAnalysis,
        max_results: int,
        **kwargs
    ) -> list[RetrievalResult] | None:
        """Get cached query results.
        
        Args:
            query: Search query
            analysis: Query analysis
            max_results: Maximum results
            **kwargs: Additional parameters
            
        Returns:
            Cached results or None
        """
        if not self._connected:
            return None

        try:
            # Generate cache key
            cache_data = {
                "query": query.lower().strip(),
                "query_type": analysis.query_type.value,
                "entities": sorted(analysis.entities),
                "max_results": max_results,
                "kwargs": {k: v for k, v in kwargs.items() if k in ["fusion_algorithm", "min_confidence"]},
            }

            cache_key = self._generate_cache_key("query_results", cache_data)

            # Get from cache
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                try:
                    # Deserialize results
                    results_data = json.loads(cached_data)
                    results = [RetrievalResult(**result) for result in results_data["results"]]

                    # Add cache metadata
                    for result in results:
                        result.metadata["cached"] = True
                        result.metadata["cache_timestamp"] = results_data["timestamp"]

                    logger.info(f"Cache hit for query: {len(results)} results")
                    return results

                except Exception as e:
                    logger.error(f"Failed to deserialize cached results: {e}")
                    # Remove corrupted cache entry
                    await self.redis_client.delete(cache_key)

            return None

        except Exception as e:
            logger.error(f"Failed to get cached query results: {e}")
            return None

    async def cache_query_results(
        self,
        query: str,
        analysis: QueryAnalysis,
        results: list[RetrievalResult],
        max_results: int,
        **kwargs
    ) -> bool:
        """Cache query results.
        
        Args:
            query: Search query
            analysis: Query analysis
            results: Results to cache
            max_results: Maximum results
            **kwargs: Additional parameters
            
        Returns:
            True if caching successful
        """
        if not self._connected or not results:
            return False

        try:
            # Generate cache key
            cache_data = {
                "query": query.lower().strip(),
                "query_type": analysis.query_type.value,
                "entities": sorted(analysis.entities),
                "max_results": max_results,
                "kwargs": {k: v for k, v in kwargs.items() if k in ["fusion_algorithm", "min_confidence"]},
            }

            cache_key = self._generate_cache_key("query_results", cache_data)

            # Prepare data for caching
            cache_value = {
                "results": [result.dict() for result in results],
                "timestamp": time.time(),
                "query_analysis": analysis.dict(),
            }

            # Serialize and cache
            serialized_data = json.dumps(cache_value)

            # Set with TTL
            await self.redis_client.setex(
                cache_key,
                self.config.query_ttl,
                serialized_data
            )

            logger.info(f"Cached {len(results)} query results")
            return True

        except Exception as e:
            logger.error(f"Failed to cache query results: {e}")
            return False

    async def get_query_analysis(self, query: str) -> QueryAnalysis | None:
        """Get cached query analysis.
        
        Args:
            query: Search query
            
        Returns:
            Cached analysis or None
        """
        if not self._connected:
            return None

        try:
            cache_key = self._generate_cache_key("query_analysis", {"query": query.lower().strip()})

            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                try:
                    analysis_data = json.loads(cached_data)
                    return QueryAnalysis(**analysis_data)
                except Exception as e:
                    logger.error(f"Failed to deserialize cached analysis: {e}")
                    await self.redis_client.delete(cache_key)

            return None

        except Exception as e:
            logger.error(f"Failed to get cached query analysis: {e}")
            return None

    async def cache_query_analysis(self, query: str, analysis: QueryAnalysis) -> bool:
        """Cache query analysis.
        
        Args:
            query: Search query
            analysis: Query analysis
            
        Returns:
            True if caching successful
        """
        if not self._connected:
            return False

        try:
            cache_key = self._generate_cache_key("query_analysis", {"query": query.lower().strip()})

            # Cache analysis with longer TTL
            await self.redis_client.setex(
                cache_key,
                self.config.analysis_ttl,
                json.dumps(analysis.dict())
            )

            logger.debug(f"Cached query analysis for: {query}")
            return True

        except Exception as e:
            logger.error(f"Failed to cache query analysis: {e}")
            return False

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern.
        
        Args:
            pattern: Redis key pattern
            
        Returns:
            Number of keys deleted
        """
        if not self._connected:
            return 0

        try:
            keys = await self.redis_client.keys(pattern)
            if keys:
                deleted = await self.redis_client.delete(*keys)
                logger.info(f"Invalidated {deleted} cache entries matching pattern: {pattern}")
                return deleted
            return 0

        except Exception as e:
            logger.error(f"Failed to invalidate cache pattern {pattern}: {e}")
            return 0

    async def clear_all(self) -> bool:
        """Clear all cache entries.
        
        Returns:
            True if successful
        """
        if not self._connected:
            return False

        try:
            await self.redis_client.flushdb()
            logger.info("Cleared all cache entries")
            return True

        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return False

    async def get_cache_stats(self) -> dict[str, Any]:
        """Get cache statistics.
        
        Returns:
            Cache statistics
        """
        if not self._connected:
            return {"connected": False}

        try:
            info = await self.redis_client.info()

            # Get key counts by prefix
            key_counts = {}
            for prefix in ["query_results", "query_analysis"]:
                keys = await self.redis_client.keys(f"{prefix}:*")
                key_counts[prefix] = len(keys)

            return {
                "connected": True,
                "redis_version": info.get("redis_version"),
                "used_memory": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "total_commands_processed": info.get("total_commands_processed"),
                "key_counts": key_counts,
                "config": {
                    "query_ttl": self.config.query_ttl,
                    "analysis_ttl": self.config.analysis_ttl,
                    "max_cache_size": self.config.max_cache_size,
                },
            }

        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {"connected": False, "error": str(e)}
