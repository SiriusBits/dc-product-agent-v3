"""Unit tests for the SearchService."""

import unittest
from unittest.mock import MagicMock, patch

from dc_agent.services.search import SearchService, get_search_service
from dc_agent.models.search import SearchRequest, SearchResult, SearchResponse


class TestSearchService(unittest.TestCase):
    """Tests for SearchService."""

    def test_semantic_search_with_results(self):
        """Test semantic search returns properly formatted results."""
        # Mock the ChromaVectorStore
        mock_store = MagicMock()
        mock_store.query.return_value = {
            "ids": [["chunk1", "chunk2"]],
            "documents": [["Document 1 content", "Document 2 content"]],
            "metadatas": [[
                {
                    "product_id": "TEST_PRODUCT",
                    "product_name": "Test Product",
                    "section": "Applications",
                    "chunk_type": "applications",
                    "doc_id": "doc-123",
                    "page": 1,
                },
                {
                    "product_id": "TEST_PRODUCT_2",
                    "product_name": "Test Product 2",
                    "section": "Properties",
                    "chunk_type": "properties",
                    "doc_id": "doc-456",
                },
            ]],
            "distances": [[0.5, 0.8]],
        }
        
        service = SearchService(vector_store=mock_store)
        result = service.semantic_search("test query", top_k=5)
        
        # Verify the mock was called correctly
        mock_store.query.assert_called_once_with(query_text="test query", n_results=5)
        
        # Verify response structure
        self.assertIsInstance(result, SearchResponse)
        self.assertEqual(result.query, "test query")
        self.assertEqual(result.total_results, 2)
        self.assertEqual(len(result.results), 2)
        
        # Verify first result
        first = result.results[0]
        self.assertEqual(first.product_id, "TEST_PRODUCT")
        self.assertEqual(first.product_name, "Test Product")
        self.assertEqual(first.section_name, "Applications")
        self.assertEqual(first.chunk_text, "Document 1 content")
        self.assertEqual(first.chunk_type, "applications")
        self.assertEqual(first.doc_id, "chunk1")  # uses Chroma record ID
        self.assertEqual(first.page, 1)
        
        # Verify relevance score conversion (1 / (1 + distance))
        expected_score = round(1.0 / (1.0 + 0.5), 4)
        self.assertEqual(first.relevance_score, expected_score)

    def test_semantic_search_empty_results(self):
        """Test semantic search handles empty results gracefully."""
        mock_store = MagicMock()
        mock_store.query.return_value = {
            "ids": [[]],
            "documents": [[]],
            "metadatas": [[]],
            "distances": [[]],
        }
        
        service = SearchService(vector_store=mock_store)
        result = service.semantic_search("no match query", top_k=10)
        
        self.assertEqual(result.query, "no match query")
        self.assertEqual(result.total_results, 0)
        self.assertEqual(len(result.results), 0)

    def test_semantic_search_missing_metadata(self):
        """Test semantic search handles missing metadata fields."""
        mock_store = MagicMock()
        mock_store.query.return_value = {
            "ids": [["chunk1"]],
            "documents": [["Document content"]],
            "metadatas": [[{}]],  # Empty metadata
            "distances": [[0.3]],
        }
        
        service = SearchService(vector_store=mock_store)
        result = service.semantic_search("test", top_k=5)
        
        self.assertEqual(result.total_results, 1)
        first = result.results[0]
        self.assertEqual(first.product_id, "unknown")
        self.assertEqual(first.product_name, "Unknown Product")
        self.assertEqual(first.section_name, "Unknown Section")
        self.assertIsNone(first.chunk_type)
        self.assertEqual(first.doc_id, "chunk1")  # uses Chroma record ID
        self.assertIsNone(first.page)


class TestSearchRequest(unittest.TestCase):
    """Tests for SearchRequest model."""

    def test_default_top_k(self):
        """Test default top_k value."""
        request = SearchRequest(query="test")
        self.assertEqual(request.top_k, 10)

    def test_custom_top_k(self):
        """Test custom top_k value."""
        request = SearchRequest(query="test", top_k=25)
        self.assertEqual(request.top_k, 25)

    def test_top_k_bounds(self):
        """Test top_k validation bounds."""
        # Valid bounds
        SearchRequest(query="test", top_k=1)
        SearchRequest(query="test", top_k=100)
        
        # Invalid bounds should raise validation error
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            SearchRequest(query="test", top_k=0)
        with self.assertRaises(ValidationError):
            SearchRequest(query="test", top_k=101)


class TestSearchResult(unittest.TestCase):
    """Tests for SearchResult model."""

    def test_full_result(self):
        """Test creating a full SearchResult."""
        result = SearchResult(
            product_id="TEST_1",
            product_name="Test Product",
            section_name="Applications",
            chunk_text="This is the content",
            relevance_score=0.85,
            chunk_type="applications",
            doc_id="doc-123",
            page=2,
        )
        
        self.assertEqual(result.product_id, "TEST_1")
        self.assertEqual(result.relevance_score, 0.85)
        self.assertEqual(result.page, 2)

    def test_minimal_result(self):
        """Test creating a minimal SearchResult with only required fields."""
        result = SearchResult(
            product_id="TEST_1",
            product_name="Test Product",
            section_name="Section",
            chunk_text="Content",
            relevance_score=0.5,
        )
        
        self.assertIsNone(result.chunk_type)
        self.assertIsNone(result.doc_id)
        self.assertIsNone(result.page)


if __name__ == "__main__":
    unittest.main()
