"""Performance benchmark tests for the Knowledge Graph.

Requires a live Neo4j instance with seeded test data.  Run with::

    uv run pytest tests/test_kg_performance.py --run-benchmark -v -s

Thresholds (from ROADMAP success criteria):
- Entity lookup:   < 300 ms
- Product profile:  < 300 ms
- Entity search:   < 300 ms
- Graph traversal: <   1 s
- Property comparison: < 1 s
"""

from __future__ import annotations

import logging
import time
from typing import Callable, Coroutine

import pytest

from dc_agent.kg.neo4j import Neo4jKGStore
from dc_agent.kg.query_service import KGQueryService

pytestmark = pytest.mark.benchmark

logger = logging.getLogger(__name__)

# Number of iterations per benchmark (averaged)
_ITERATIONS = 10


async def _bench(
    fn: Callable[..., Coroutine],
    *args,
    iterations: int = _ITERATIONS,
    **kwargs,
) -> float:
    """Run *fn* multiple times and return the **average** elapsed time in ms."""
    total = 0.0
    for _ in range(iterations):
        start = time.perf_counter()
        await fn(*args, **kwargs)
        total += (time.perf_counter() - start) * 1000.0
    avg = total / iterations
    logger.info(
        "%s: avg=%.1f ms over %d runs (total=%.1f ms)",
        fn.__qualname__,
        avg,
        iterations,
        total,
    )
    return avg


# ---------------------------------------------------------------------------
# Benchmarks
# ---------------------------------------------------------------------------


class TestEntityLookup:
    async def test_get_entity_by_id_under_300ms(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        avg_ms = await _bench(svc.get_entity_by_id, "test-dca221-chemical")
        assert avg_ms < 300, f"Entity lookup avg {avg_ms:.1f} ms exceeds 300 ms"


class TestProductProfile:
    async def test_get_product_profile_under_300ms(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        avg_ms = await _bench(svc.get_product_profile, "DCA 221")
        assert avg_ms < 300, f"Product profile avg {avg_ms:.1f} ms exceeds 300 ms"


class TestEntitySearch:
    async def test_search_entities_under_300ms(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        avg_ms = await _bench(svc.search_entities, "DCA")
        assert avg_ms < 300, f"Entity search avg {avg_ms:.1f} ms exceeds 300 ms"


class TestTraversal:
    async def test_traverse_under_1s(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        avg_ms = await _bench(svc.traverse, "DCA 221", max_hops=2)
        assert avg_ms < 1000, f"Traversal avg {avg_ms:.1f} ms exceeds 1000 ms"

    async def test_traverse_3_hops_under_1s(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        avg_ms = await _bench(svc.traverse, "DCA 221", max_hops=3)
        assert avg_ms < 1000, f"Traversal (3-hop) avg {avg_ms:.1f} ms exceeds 1000 ms"


class TestPropertyComparison:
    async def test_compare_property_under_1s(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        avg_ms = await _bench(svc.compare_property, "Viscosity")
        assert avg_ms < 1000, f"Property comparison avg {avg_ms:.1f} ms exceeds 1000 ms"


class TestNeighbors:
    async def test_get_neighbors_under_300ms(
        self, seeded_store: tuple[Neo4jKGStore, KGQueryService]
    ) -> None:
        _, svc = seeded_store
        avg_ms = await _bench(svc.get_entity_neighbors, "test-dca221-chemical")
        assert avg_ms < 300, f"Neighbors avg {avg_ms:.1f} ms exceeds 300 ms"
