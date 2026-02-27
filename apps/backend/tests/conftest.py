"""Shared test configuration and fixtures.

Provides:
- ``integration`` marker — skipped unless ``--run-integration`` is passed
- ``benchmark`` marker  — skipped unless ``--run-benchmark``  is passed
- ``neo4j_store``  — session-scoped, real Neo4jKGStore with clean DB
- ``seeded_store`` — session-scoped, 2-product corpus ingested
"""

from __future__ import annotations

from pathlib import Path
from typing import AsyncGenerator

import pytest
import pytest_asyncio

from dc_agent.kg.neo4j import Neo4jKGStore
from dc_agent.kg.query_service import KGQueryService
from dc_agent.kg.schema import wipe_and_reinit
from dc_agent.kg.ingestion import ingest_corpus


# ---------------------------------------------------------------------------
# CLI options & marker collection
# ---------------------------------------------------------------------------

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--run-integration",
        action="store_true",
        default=False,
        help="Run integration tests that require a live Neo4j instance.",
    )
    parser.addoption(
        "--run-benchmark",
        action="store_true",
        default=False,
        help="Run performance benchmark tests (requires live Neo4j).",
    )


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    run_integration = config.getoption("--run-integration")
    run_benchmark = config.getoption("--run-benchmark")

    skip_integration = pytest.mark.skip(reason="need --run-integration to run")
    skip_benchmark = pytest.mark.skip(reason="need --run-benchmark to run")

    for item in items:
        if "integration" in item.keywords and not run_integration:
            item.add_marker(skip_integration)
        if "benchmark" in item.keywords and not run_benchmark:
            item.add_marker(skip_benchmark)


# ---------------------------------------------------------------------------
# Session-scoped Neo4j fixtures (only created when integration tests run)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(scope="session")
async def neo4j_store() -> AsyncGenerator[Neo4jKGStore, None]:
    """A real Neo4j store — wipes DB, applies schema, yields, then cleans up."""
    store = Neo4jKGStore()

    reachable = await store.verify_connectivity()
    if not reachable:
        pytest.skip("Neo4j is not reachable — skipping integration tests")

    await wipe_and_reinit(store)
    yield store
    await store.close()


@pytest_asyncio.fixture(scope="session")
async def seeded_store(
    neo4j_store: Neo4jKGStore,
) -> AsyncGenerator[tuple[Neo4jKGStore, KGQueryService], None]:
    """Neo4j store with 2-product test corpus ingested."""
    report = await ingest_corpus(neo4j_store, FIXTURES_DIR)
    assert report.total_entities_merged > 0, f"Ingestion failed: {report}"

    svc = KGQueryService(neo4j_store)
    yield neo4j_store, svc
