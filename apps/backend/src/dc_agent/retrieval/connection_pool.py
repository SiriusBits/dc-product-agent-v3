"""Connection pool management for database operations."""

import asyncio
import logging
import time
from typing import Any

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class PoolConfig(BaseModel):
    """Configuration for connection pools."""

    min_connections: int = 2
    max_connections: int = 10
    connection_timeout: float = 30.0
    idle_timeout: float = 300.0  # 5 minutes
    max_lifetime: float = 3600.0  # 1 hour
    health_check_interval: float = 60.0  # 1 minute


class ConnectionPool:
    """Generic async connection pool."""

    def __init__(self, name: str, config: PoolConfig | None = None):
        """Initialize connection pool.
        
        Args:
            name: Pool name for logging
            config: Pool configuration
        """
        self.name = name
        self.config = config or PoolConfig()
        self._pool: list[Any] = []
        self._in_use: set[Any] = set()
        self._lock = asyncio.Lock()
        self._health_check_task: asyncio.Task | None = None
        self._stats = {
            "created": 0,
            "destroyed": 0,
            "borrowed": 0,
            "returned": 0,
            "health_checks": 0,
            "health_failures": 0,
        }

    async def initialize(self, connection_factory) -> bool:
        """Initialize the connection pool.
        
        Args:
            connection_factory: Async function that creates connections
            
        Returns:
            True if initialization successful
        """
        try:
            self.connection_factory = connection_factory

            # Create minimum connections
            for _ in range(self.config.min_connections):
                conn = await self._create_connection()
                if conn:
                    self._pool.append(conn)

            # Start health check task
            self._health_check_task = asyncio.create_task(self._health_check_loop())

            logger.info(f"Initialized {self.name} pool with {len(self._pool)} connections")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize {self.name} pool: {e}")
            return False

    async def get_connection(self):
        """Get a connection from the pool.
        
        Returns:
            Database connection
        """
        async with self._lock:
            try:
                # Try to get from pool
                if self._pool:
                    conn = self._pool.pop()
                    self._in_use.add(conn)
                    self._stats["borrowed"] += 1
                    return conn

                # Create new connection if under max limit
                if len(self._in_use) < self.config.max_connections:
                    conn = await self._create_connection()
                    if conn:
                        self._in_use.add(conn)
                        self._stats["borrowed"] += 1
                        return conn

                # Wait for connection to become available
                logger.warning(f"{self.name} pool exhausted, waiting for connection")

                # Simple wait and retry (could be improved with proper queuing)
                await asyncio.sleep(0.1)
                return await self.get_connection()

            except Exception as e:
                logger.error(f"Failed to get connection from {self.name} pool: {e}")
                raise

    async def return_connection(self, conn) -> None:
        """Return a connection to the pool.
        
        Args:
            conn: Database connection to return
        """
        async with self._lock:
            try:
                if conn in self._in_use:
                    self._in_use.remove(conn)
                    self._stats["returned"] += 1

                    # Check if connection is still healthy
                    if await self._is_connection_healthy(conn):
                        # Return to pool if under max size
                        if len(self._pool) < self.config.max_connections:
                            self._pool.append(conn)
                        else:
                            # Pool is full, close connection
                            await self._close_connection(conn)
                    else:
                        # Connection is unhealthy, close it
                        await self._close_connection(conn)

            except Exception as e:
                logger.error(f"Failed to return connection to {self.name} pool: {e}")
                # Try to close the connection anyway
                try:
                    await self._close_connection(conn)
                except:
                    pass

    async def close(self) -> None:
        """Close the connection pool."""
        try:
            # Cancel health check task
            if self._health_check_task:
                self._health_check_task.cancel()
                try:
                    await self._health_check_task
                except asyncio.CancelledError:
                    pass

            # Close all connections
            async with self._lock:
                # Close pooled connections
                for conn in self._pool:
                    await self._close_connection(conn)
                self._pool.clear()

                # Close in-use connections
                for conn in self._in_use:
                    await self._close_connection(conn)
                self._in_use.clear()

            logger.info(f"Closed {self.name} connection pool")

        except Exception as e:
            logger.error(f"Error closing {self.name} pool: {e}")

    async def _create_connection(self):
        """Create a new connection."""
        try:
            conn = await self.connection_factory()
            conn._pool_created_at = time.time()
            self._stats["created"] += 1
            logger.debug(f"Created new connection for {self.name} pool")
            return conn
        except Exception as e:
            logger.error(f"Failed to create connection for {self.name} pool: {e}")
            return None

    async def _close_connection(self, conn) -> None:
        """Close a connection."""
        try:
            if hasattr(conn, 'close'):
                await conn.close()
            elif hasattr(conn, 'disconnect'):
                await conn.disconnect()
            self._stats["destroyed"] += 1
            logger.debug(f"Closed connection for {self.name} pool")
        except Exception as e:
            logger.error(f"Error closing connection for {self.name} pool: {e}")

    async def _is_connection_healthy(self, conn) -> bool:
        """Check if a connection is healthy."""
        try:
            # Check connection age
            if hasattr(conn, '_pool_created_at'):
                age = time.time() - conn._pool_created_at
                if age > self.config.max_lifetime:
                    return False

            # Perform health check (implementation specific)
            if hasattr(conn, 'ping'):
                await conn.ping()
            elif hasattr(conn, 'health_check'):
                result = await conn.health_check()
                return result.get("status") == "healthy"

            return True

        except Exception as e:
            logger.debug(f"Connection health check failed for {self.name}: {e}")
            return False

    async def _health_check_loop(self) -> None:
        """Background task for periodic health checks."""
        while True:
            try:
                await asyncio.sleep(self.config.health_check_interval)
                await self._perform_health_check()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error for {self.name} pool: {e}")

    async def _perform_health_check(self) -> None:
        """Perform health check on pooled connections."""
        async with self._lock:
            try:
                self._stats["health_checks"] += 1
                unhealthy_connections = []

                # Check pooled connections
                for conn in self._pool:
                    if not await self._is_connection_healthy(conn):
                        unhealthy_connections.append(conn)

                # Remove unhealthy connections
                for conn in unhealthy_connections:
                    self._pool.remove(conn)
                    await self._close_connection(conn)
                    self._stats["health_failures"] += 1

                if unhealthy_connections:
                    logger.info(f"Removed {len(unhealthy_connections)} unhealthy connections from {self.name} pool")

                # Ensure minimum connections
                while len(self._pool) < self.config.min_connections:
                    conn = await self._create_connection()
                    if conn:
                        self._pool.append(conn)
                    else:
                        break

            except Exception as e:
                logger.error(f"Health check failed for {self.name} pool: {e}")

    def get_stats(self) -> dict[str, Any]:
        """Get pool statistics."""
        return {
            "name": self.name,
            "pool_size": len(self._pool),
            "in_use": len(self._in_use),
            "total_capacity": self.config.max_connections,
            "stats": self._stats.copy(),
            "config": self.config.dict(),
        }


class ConnectionPoolManager:
    """Manager for multiple connection pools."""

    def __init__(self):
        """Initialize connection pool manager."""
        self.pools: dict[str, ConnectionPool] = {}

    async def create_pool(
        self,
        name: str,
        connection_factory,
        config: PoolConfig | None = None
    ) -> bool:
        """Create a new connection pool.
        
        Args:
            name: Pool name
            connection_factory: Function to create connections
            config: Pool configuration
            
        Returns:
            True if pool created successfully
        """
        try:
            if name in self.pools:
                logger.warning(f"Pool {name} already exists")
                return False

            pool = ConnectionPool(name, config)
            success = await pool.initialize(connection_factory)

            if success:
                self.pools[name] = pool
                logger.info(f"Created connection pool: {name}")
                return True
            else:
                logger.error(f"Failed to create connection pool: {name}")
                return False

        except Exception as e:
            logger.error(f"Error creating pool {name}: {e}")
            return False

    async def get_connection(self, pool_name: str):
        """Get connection from named pool."""
        if pool_name not in self.pools:
            raise ValueError(f"Pool {pool_name} does not exist")

        return await self.pools[pool_name].get_connection()

    async def return_connection(self, pool_name: str, conn) -> None:
        """Return connection to named pool."""
        if pool_name not in self.pools:
            logger.error(f"Pool {pool_name} does not exist")
            return

        await self.pools[pool_name].return_connection(conn)

    async def close_pool(self, pool_name: str) -> bool:
        """Close a specific pool."""
        if pool_name not in self.pools:
            return False

        try:
            await self.pools[pool_name].close()
            del self.pools[pool_name]
            logger.info(f"Closed connection pool: {pool_name}")
            return True
        except Exception as e:
            logger.error(f"Error closing pool {pool_name}: {e}")
            return False

    async def close_all(self) -> None:
        """Close all connection pools."""
        for pool_name in list(self.pools.keys()):
            await self.close_pool(pool_name)

    def get_all_stats(self) -> dict[str, Any]:
        """Get statistics for all pools."""
        return {
            pool_name: pool.get_stats()
            for pool_name, pool in self.pools.items()
        }


# Global connection pool manager instance
pool_manager = ConnectionPoolManager()
