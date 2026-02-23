"""Abstract base class for Knowledge Graph Store operations.

All methods are async.  Implementations must support the async context
manager protocol (``async with``).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class KGStore(ABC):
    """Async interface for Knowledge Graph Store operations."""

    # -- write operations ---------------------------------------------------

    @abstractmethod
    async def add_entity(
        self,
        label: str,
        properties: dict[str, Any],
    ) -> None:
        """Merge an entity into the graph.

        Uses MERGE semantics keyed on ``properties["id"]`` so that
        repeated calls update rather than duplicate.
        """
        ...

    @abstractmethod
    async def add_relationship(
        self,
        start_id: str,
        end_id: str,
        rel_type: str,
        rel_props: dict[str, Any] | None = None,
    ) -> None:
        """Merge a directed relationship between two nodes by ``id``."""
        ...

    @abstractmethod
    async def execute(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Run an arbitrary *write* Cypher statement and return results."""
        ...

    # -- read operations ----------------------------------------------------

    @abstractmethod
    async def query(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Run a *read-only* Cypher query and return rows as dicts."""
        ...

    # -- lifecycle ----------------------------------------------------------

    @abstractmethod
    async def close(self) -> None:
        """Release the underlying connection / driver."""
        ...

    async def __aenter__(self) -> KGStore:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> None:
        await self.close()
