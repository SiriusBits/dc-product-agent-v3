import pytest
from unittest.mock import MagicMock, patch
from dc_agent.kg.neo4j import Neo4jKGStore

@pytest.fixture
def mock_driver():
    with patch("dc_agent.kg.neo4j.GraphDatabase.driver") as mock:
        yield mock

def test_add_entity(mock_driver):
    # Setup mock
    driver_instance = mock_driver.return_value
    session_mock = driver_instance.session.return_value
    session_mock.__enter__.return_value = session_mock
    
    # Initialize store
    store = Neo4jKGStore()
    
    # Call method
    store.add_entity("Product", {"name": "Test Product"})
    
    # Verify interaction
    session_mock.execute_write.assert_called_once()
    args = session_mock.execute_write.call_args[0]
    assert args[0] == store._create_node
    assert args[1] == "Product"
    assert args[2] == {"name": "Test Product"}

def test_query_graph(mock_driver):
    # Setup mock
    driver_instance = mock_driver.return_value
    session_mock = driver_instance.session.return_value
    session_mock.__enter__.return_value = session_mock
    
    # Mock result
    mock_result = MagicMock()
    mock_record = MagicMock()
    mock_record.data.return_value = {"n": {"name": "Test"}}
    mock_result.__iter__.return_value = [mock_record]
    session_mock.run.return_value = mock_result
    
    # Initialize store
    store = Neo4jKGStore()
    
    # Call method
    results = store.query_graph("MATCH (n) RETURN n")
    
    # Verify results
    assert len(results) == 1
    assert results[0] == {"n": {"name": "Test"}}
