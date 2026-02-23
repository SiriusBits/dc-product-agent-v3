"""Tests for the async Neo4jKGStore.

All tests mock the async Neo4j driver so no live database is needed.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from dc_agent.kg.neo4j import Neo4jKGStore, _sanitize_label


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_mock_driver() -> MagicMock:
    """Build a mock that mimics ``AsyncGraphDatabase.driver(...)``."""
    driver = MagicMock()

    # session() must be an async context manager
    session = AsyncMock()
    driver.session.return_value.__aenter__ = AsyncMock(return_value=session)
    driver.session.return_value.__aexit__ = AsyncMock(return_value=None)

    # execute_write / execute_read call the passed function with a tx mock
    async def _exec_write(fn, *args, **kwargs):
        tx = AsyncMock()
        return await fn(tx, *args, **kwargs)

    async def _exec_read(fn, *args, **kwargs):
        tx = AsyncMock()
        # Make tx.run return an async iterator with sample data
        mock_result = AsyncMock()
        mock_result.__aiter__ = MagicMock(
            return_value=iter([MagicMock(data=MagicMock(return_value={"n": {"name": "Test"}}))])
        )
        tx.run.return_value = mock_result
        return await fn(tx, *args, **kwargs)

    session.execute_write = AsyncMock(side_effect=_exec_write)
    session.execute_read = AsyncMock(side_effect=_exec_read)

    driver.close = AsyncMock()
    return driver


@pytest.fixture
def mock_driver():
    with patch("dc_agent.kg.neo4j.AsyncGraphDatabase.driver") as factory:
        driver = _make_mock_driver()
        factory.return_value = driver
        yield driver


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_add_entity_requires_id(mock_driver):
    store = Neo4jKGStore()
    with pytest.raises(ValueError, match="id"):
        await store.add_entity("Product", {"name": "Test"})
    await store.close()


@pytest.mark.asyncio
async def test_add_entity_calls_execute_write(mock_driver):
    async with Neo4jKGStore() as store:
        await store.add_entity("Product", {"id": "p1", "name": "Test Product"})

    # execute_write should have been called once
    session = mock_driver.session.return_value.__aenter__.return_value
    session.execute_write.assert_called_once()


@pytest.mark.asyncio
async def test_add_relationship_calls_execute_write(mock_driver):
    async with Neo4jKGStore() as store:
        await store.add_relationship("id1", "id2", "IS_A", {"weight": 1.0})

    session = mock_driver.session.return_value.__aenter__.return_value
    assert session.execute_write.call_count == 1


@pytest.mark.asyncio
async def test_context_manager_closes_driver(mock_driver):
    async with Neo4jKGStore():
        pass
    mock_driver.close.assert_awaited_once()


def test_sanitize_label_strips_special_chars():
    assert _sanitize_label("HAS_PROPERTY") == "HAS_PROPERTY"
    assert _sanitize_label("has-dashes") == "has_dashes"
    assert _sanitize_label("123numeric") == "_123numeric"
