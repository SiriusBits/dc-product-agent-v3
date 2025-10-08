"""Pytest configuration and shared fixtures."""

import pytest
import asyncio
import os
from typing import Generator, AsyncGenerator
from unittest.mock import Mock, AsyncMock

# Configure asyncio for testing
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_vector_store():
    """Create a mock vector store for testing."""
    mock_store = Mock()
    mock_store.add_documents = AsyncMock()
    mock_store.similarity_search = AsyncMock()
    mock_store.delete_collection = AsyncMock()
    mock_store.list_collections = AsyncMock()
    return mock_store


@pytest.fixture
def mock_kg_store():
    """Create a mock knowledge graph store for testing."""
    mock_store = Mock()
    mock_store.add_entity = AsyncMock()
    mock_store.add_relationship = AsyncMock()
    mock_store.find_entity = AsyncMock()
    mock_store.get_neighbors = AsyncMock()
    mock_store.query_by_relationship = AsyncMock()
    return mock_store


@pytest.fixture
def mock_redis():
    """Create a mock Redis client for testing."""
    mock_redis = Mock()
    mock_redis.get = AsyncMock()
    mock_redis.set = AsyncMock()
    mock_redis.delete = AsyncMock()
    mock_redis.exists = AsyncMock()
    return mock_redis


@pytest.fixture
def test_config():
    """Test configuration settings."""
    return {
        "TESTING": True,
        "VECTOR_DB_URL": "http://localhost:8001",
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "test_password",
        "REDIS_URL": "redis://localhost:6379",
        "DATABASE_URL": "postgresql://test:test@localhost:5432/test_db",
    }


@pytest.fixture(autouse=True)
def setup_test_environment(test_config):
    """Set up test environment variables."""
    original_env = {}
    
    # Store original values
    for key, value in test_config.items():
        original_env[key] = os.environ.get(key)
        os.environ[key] = str(value)
    
    yield
    
    # Restore original values
    for key, original_value in original_env.items():
        if original_value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = original_value


# Pytest markers
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "unit: marks tests as unit tests"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )
    config.addinivalue_line(
        "markers", "performance: marks tests as performance tests"
    )
    config.addinivalue_line(
        "markers", "slow: marks tests as slow running"
    )


# Skip integration tests if services are not available
def pytest_collection_modifyitems(config, items):
    """Modify test collection to handle service availability."""
    skip_integration = pytest.mark.skip(reason="Integration services not available")
    
    for item in items:
        if "integration" in item.keywords:
            # Check if required services are available
            if not _services_available():
                item.add_marker(skip_integration)


def _services_available() -> bool:
    """Check if required services are available for integration tests."""
    # This would check if ChromaDB, Neo4j, Redis, etc. are running
    # For now, return False to skip integration tests by default
    return os.environ.get("RUN_INTEGRATION_TESTS", "false").lower() == "true"


@pytest.fixture
def sample_product_data():
    """Sample product data for testing."""
    return {
        "id": "asa-150",
        "name": "ASA 150",
        "short_name": "ASA150",
        "family": "ASA",
        "cas_number": "12345-67-8",
        "chemical_name": "Alkenyl Succinic Anhydride 150",
        "synonyms": ["ASA-150", "Alkenyl Succinic Anhydride 150"],
        "properties": [
            {
                "category": "Physical",
                "name": "Viscosity",
                "value_string": "150 cP",
                "value_numeric": 150.0,
                "unit": "cP",
                "test_method": "ASTM D445"
            }
        ],
        "applications": ["Coatings", "Adhesives"],
        "key_benefits": ["High viscosity", "Good adhesion"]
    }


@pytest.fixture
def sample_kg_entities():
    """Sample KG entities for testing."""
    return [
        {
            "canonical_name": "ASA 150",
            "entity_type": "CHEMICAL",
            "aliases": ["ASA-150"],
            "properties": {"viscosity": "150 cP"},
            "confidence": 0.95
        },
        {
            "canonical_name": "Coatings",
            "entity_type": "APPLICATION",
            "aliases": ["Coating Applications"],
            "properties": {},
            "confidence": 0.90
        }
    ]


@pytest.fixture
def sample_search_results():
    """Sample search results for testing."""
    return [
        {
            "content": "ASA 150 has a viscosity of 150 cP",
            "score": 0.95,
            "source": "vector",
            "metadata": {"doc_id": "asa-150-spec"},
            "provenance": {"document": "ASA 150 Technical Bulletin"}
        },
        {
            "content": "ASA 150 is used in coatings",
            "score": 0.87,
            "source": "kg",
            "metadata": {"entity_type": "CHEMICAL"},
            "provenance": {"document": "Product Applications"}
        }
    ]