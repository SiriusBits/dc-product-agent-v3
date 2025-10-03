"""Database connection management with connection pooling."""

import logging
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import asyncpg
from asyncpg import Pool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database connections and connection pooling."""

    def __init__(
        self,
        database_url: str | None = None,
        min_connections: int = 5,
        max_connections: int = 20,
        echo: bool = False,
    ):
        """Initialize database manager.

        Args:
            database_url: Database connection URL
            min_connections: Minimum connections in pool
            max_connections: Maximum connections in pool
            echo: Whether to echo SQL statements
        """
        self.database_url = database_url or self._get_database_url()
        self.min_connections = min_connections
        self.max_connections = max_connections
        self.echo = echo

        # SQLAlchemy engine and session factory
        self.engine = None
        self.session_factory = None

        # AsyncPG connection pool for raw queries
        self.pool: Pool | None = None

        self._initialized = False

    def _get_database_url(self) -> str:
        """Get database URL from environment variables."""
        # Check for full database URL first
        database_url = os.getenv("DATABASE_URL")
        if database_url:
            return database_url

        # Build URL from components
        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5432")
        database = os.getenv("POSTGRES_DB", "dc_agent")
        username = os.getenv("POSTGRES_USER", "dc_agent")
        password = os.getenv("POSTGRES_PASSWORD", "postgres123")

        return f"postgresql+asyncpg://{username}:{password}@{host}:{port}/{database}"

    async def initialize(self) -> None:
        """Initialize database connections and pools."""
        if self._initialized:
            return

        try:
            # Initialize SQLAlchemy engine
            self.engine = create_async_engine(
                self.database_url,
                echo=self.echo,
                poolclass=NullPool,  # Use asyncpg pool instead
                pool_pre_ping=True,
            )

            # Create session factory
            self.session_factory = async_sessionmaker(
                bind=self.engine, class_=AsyncSession, expire_on_commit=False
            )

            # Initialize AsyncPG connection pool
            # Convert SQLAlchemy URL to asyncpg format
            asyncpg_url = self.database_url.replace(
                "postgresql+asyncpg://", "postgresql://"
            )

            self.pool = await asyncpg.create_pool(
                asyncpg_url,
                min_size=self.min_connections,
                max_size=self.max_connections,
                command_timeout=60,
            )

            self._initialized = True
            logger.info("Database manager initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize database manager: {e}")
            raise

    async def close(self) -> None:
        """Close all database connections."""
        if not self._initialized:
            return

        try:
            # Close AsyncPG pool
            if self.pool:
                await self.pool.close()
                self.pool = None

            # Close SQLAlchemy engine
            if self.engine:
                await self.engine.dispose()
                self.engine = None

            self.session_factory = None
            self._initialized = False

            logger.info("Database manager closed successfully")

        except Exception as e:
            logger.error(f"Error closing database manager: {e}")

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a database session with automatic cleanup.

        Yields:
            SQLAlchemy async session
        """
        if not self._initialized:
            await self.initialize()

        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    @asynccontextmanager
    async def get_connection(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """Get a raw database connection with automatic cleanup.

        Yields:
            AsyncPG connection
        """
        if not self._initialized:
            await self.initialize()

        async with self.pool.acquire() as connection:
            yield connection

    async def execute_query(self, query: str, *args) -> list:
        """Execute a raw SQL query and return results.

        Args:
            query: SQL query string
            *args: Query parameters

        Returns:
            Query results
        """
        async with self.get_connection() as conn:
            return await conn.fetch(query, *args)

    async def execute_command(self, command: str, *args) -> str:
        """Execute a SQL command (INSERT, UPDATE, DELETE).

        Args:
            command: SQL command string
            *args: Command parameters

        Returns:
            Command status
        """
        async with self.get_connection() as conn:
            return await conn.execute(command, *args)

    async def health_check(self) -> dict:
        """Check database health and connection status.

        Returns:
            Health status information
        """
        try:
            if not self._initialized:
                return {
                    "status": "not_initialized",
                    "error": "Database manager not initialized",
                }

            # Test SQLAlchemy connection
            async with self.get_session() as session:
                result = await session.execute("SELECT 1")
                sqlalchemy_ok = result.scalar() == 1

            # Test AsyncPG connection
            async with self.get_connection() as conn:
                result = await conn.fetchval("SELECT 1")
                asyncpg_ok = result == 1

            # Get pool stats
            pool_stats = (
                {
                    "size": self.pool.get_size(),
                    "min_size": self.pool.get_min_size(),
                    "max_size": self.pool.get_max_size(),
                    "idle_size": self.pool.get_idle_size(),
                }
                if self.pool
                else {}
            )

            return {
                "status": "healthy" if (sqlalchemy_ok and asyncpg_ok) else "unhealthy",
                "sqlalchemy_connection": "ok" if sqlalchemy_ok else "failed",
                "asyncpg_connection": "ok" if asyncpg_ok else "failed",
                "pool_stats": pool_stats,
                "database_url": (
                    self.database_url.split("@")[1]
                    if "@" in self.database_url
                    else "unknown"
                ),
            }

        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}

    async def get_database_info(self) -> dict:
        """Get database information and statistics.

        Returns:
            Database information
        """
        try:
            async with self.get_connection() as conn:
                # Get database version
                version = await conn.fetchval("SELECT version()")

                # Get database size
                db_name = os.getenv("POSTGRES_DB", "dc_agent")
                size_query = """
                    SELECT pg_size_pretty(pg_database_size($1)) as size
                """
                size = await conn.fetchval(size_query, db_name)

                # Get table count
                table_count_query = """
                    SELECT COUNT(*) 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """
                table_count = await conn.fetchval(table_count_query)

                # Get connection count
                connection_query = """
                    SELECT COUNT(*) 
                    FROM pg_stat_activity 
                    WHERE datname = $1
                """
                connection_count = await conn.fetchval(connection_query, db_name)

                return {
                    "version": version,
                    "database_name": db_name,
                    "size": size,
                    "table_count": table_count,
                    "active_connections": connection_count,
                    "pool_stats": (
                        {
                            "size": self.pool.get_size(),
                            "min_size": self.pool.get_min_size(),
                            "max_size": self.pool.get_max_size(),
                            "idle_size": self.pool.get_idle_size(),
                        }
                        if self.pool
                        else {}
                    ),
                }

        except Exception as e:
            logger.error(f"Failed to get database info: {e}")
            return {"error": str(e)}


# Global database manager instance
_database_manager: DatabaseManager | None = None


async def get_database_manager() -> DatabaseManager:
    """Get the global database manager instance.

    Returns:
        Database manager instance
    """
    global _database_manager

    if _database_manager is None:
        _database_manager = DatabaseManager()
        await _database_manager.initialize()

    return _database_manager


async def close_database_manager() -> None:
    """Close the global database manager."""
    global _database_manager

    if _database_manager:
        await _database_manager.close()
        _database_manager = None
