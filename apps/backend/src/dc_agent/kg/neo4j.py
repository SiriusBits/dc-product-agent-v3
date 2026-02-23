"""Async Neo4j Knowledge Graph Store implementation.

Provides MERGE-based upsert operations, ID-keyed node matching,
connection pooling, retry logic for transient errors, and structured
logging.  Designed to be used as an async context manager::

    async with Neo4jKGStore() as store:
        await store.add_entity("Chemical", {"id": "abc", ...})
"""

from __future__ import annotations

import asyncio
import logging
import re
from functools import wraps
from typing import Any, Callable, TypeVar

from neo4j import AsyncGraphDatabase
from neo4j.exceptions import ServiceUnavailable, SessionExpired

from dc_agent.config import settings
from dc_agent.kg.store import KGStore

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_DELAY_S = 0.5  # initial backoff between retries

F = TypeVar("F", bound=Callable[..., Any])


def _retry_transient(func: F) -> F:
    """Retry on transient Neo4j errors with exponential backoff."""

    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        last_exc: Exception | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                return await func(*args, **kwargs)
            except (ServiceUnavailable, SessionExpired) as exc:
                last_exc = exc
                logger.warning(
                    "Transient Neo4j error (attempt %d/%d): %s",
                    attempt,
                    _MAX_RETRIES,
                    exc,
                )
                if attempt < _MAX_RETRIES:
                    await asyncio.sleep(_RETRY_DELAY_S * attempt)
        raise last_exc  # type: ignore[misc]

    return wrapper  # type: ignore[return-value]


def _sanitize_label(name: str) -> str:
    """Ensure a Neo4j label / relationship type is safe for Cypher.

    Only ``[a-zA-Z0-9_]`` are allowed.  The result must start with a
    letter or underscore.
    """
    sanitized = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    if not sanitized or sanitized[0].isdigit():
        sanitized = f"_{sanitized}"
    return sanitized


class Neo4jKGStore(KGStore):
    """Async Neo4j implementation of :class:`KGStore`.

    Parameters
    ----------
    uri:
        Bolt URI for Neo4j.  Falls back to ``settings.NEO4J_URI``.
    user / password:
        Auth credentials.  Fall back to ``settings.NEO4J_*``.
    max_connection_pool_size:
        Upper bound on the driver connection pool.
    connection_acquisition_timeout:
        Seconds to wait for a connection from the pool.
    """

    def __init__(
        self,
        uri: str | None = None,
        user: str | None = None,
        password: str | None = None,
        *,
        max_connection_pool_size: int = 50,
        connection_acquisition_timeout: float = 60.0,
    ) -> None:
        self._uri = uri or settings.NEO4J_URI
        self._driver = AsyncGraphDatabase.driver(
            self._uri,
            auth=(user or settings.NEO4J_USER, password or settings.NEO4J_PASSWORD),
            max_connection_pool_size=max_connection_pool_size,
            connection_acquisition_timeout=connection_acquisition_timeout,
        )
        logger.info("Neo4jKGStore initialised (uri=%s)", self._uri)

    # -- write operations ---------------------------------------------------

    @_retry_transient
    async def add_entity(
        self,
        label: str,
        properties: dict[str, Any],
    ) -> None:
        """MERGE a node by ``id`` under *label*."""
        if "id" not in properties:
            raise ValueError("Entity properties must include an 'id' field")

        safe_label = _sanitize_label(label)
        cypher = (
            f"MERGE (n:{safe_label} {{id: $id}}) "
            "SET n += $props, n.updated_at = datetime()"
        )
        props = {k: v for k, v in properties.items() if v is not None}

        async def _tx(tx: Any) -> None:
            await tx.run(cypher, id=properties["id"], props=props)

        async with self._driver.session() as session:
            await session.execute_write(_tx)

        logger.debug("Merged entity %s (id=%s)", safe_label, properties["id"])

    @_retry_transient
    async def add_relationship(
        self,
        start_id: str,
        end_id: str,
        rel_type: str,
        rel_props: dict[str, Any] | None = None,
    ) -> None:
        """MERGE a relationship between two nodes identified by ``id``."""
        safe_rel = _sanitize_label(rel_type)
        cypher = (
            "MATCH (a {id: $start_id}), (b {id: $end_id}) "
            f"MERGE (a)-[r:{safe_rel}]->(b) "
            "SET r += $props"
        )
        clean_props = {
            k: v for k, v in (rel_props or {}).items() if v is not None
        }

        async def _tx(tx: Any) -> None:
            await tx.run(
                cypher,
                start_id=start_id,
                end_id=end_id,
                props=clean_props,
            )

        async with self._driver.session() as session:
            await session.execute_write(_tx)

        logger.debug(
            "Merged relationship %s (%s)->(%s)", safe_rel, start_id, end_id
        )

    @_retry_transient
    async def execute(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Run an arbitrary write Cypher statement."""

        async def _tx(tx: Any) -> list[dict[str, Any]]:
            result = await tx.run(cypher, **(params or {}))
            return [record.data() async for record in result]

        async with self._driver.session() as session:
            rows = await session.execute_write(_tx)

        logger.debug("Execute returned %d records", len(rows))
        return rows

    # -- read operations ----------------------------------------------------

    @_retry_transient
    async def query(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Run a read-only Cypher query."""

        async def _tx(tx: Any) -> list[dict[str, Any]]:
            result = await tx.run(cypher, **(params or {}))
            return [record.data() async for record in result]

        async with self._driver.session() as session:
            rows = await session.execute_read(_tx)

        logger.debug("Query returned %d records", len(rows))
        return rows

    # -- lifecycle ----------------------------------------------------------

    async def close(self) -> None:
        """Close the async Neo4j driver."""
        await self._driver.close()
        logger.info("Neo4jKGStore connection closed")

    async def verify_connectivity(self) -> bool:
        """Return ``True`` if the Neo4j server is reachable."""
        try:
            await self._driver.verify_connectivity()
            return True
        except Exception as exc:
            logger.error("Neo4j connectivity check failed: %s", exc)
            return False
