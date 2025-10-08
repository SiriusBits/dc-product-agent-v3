"""Integration tests for API endpoints."""

import pytest
import asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from unittest.mock import Mock, AsyncMock, patch

from dc_agent.main import app
from dc_agent.models.api_models import ChatRequest, ChatResponse, SearchResult
from dc_agent.models.product_models import Product, ProductFamily


@pytest.fixture
def test_client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
async def async_client():
    """Create async test client."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


class TestHealthEndpoint:
    """Test health check endpoint."""
    
    def test_health_check(self, test_client):
        """Test health check endpoint."""
        response = test_client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data


class TestChatEndpoints:
    """Test chat API endpoints."""
    
    @pytest.mark.asyncio
    async def test_chat_endpoint_success(self, async_client):
        """Test successful chat request."""
        with patch('dc_agent.api.chat.chat_service') as mock_chat_service:
            # Mock the chat service response
            mock_response = ChatResponse(
                answer="ASA 150 has a viscosity of 150 cP at 25°C.",
                sources=[
                    SearchResult(
                        content="ASA 150 viscosity: 150 cP",
                        score=0.95,
                        source="vector",
                        metadata={"doc_id": "asa-150-spec"},
                        provenance={"document": "ASA 150 Technical Bulletin"}
                    )
                ],
                conversation_id="test-conv-123",
                query_analysis={
                    "query_type": "specification",
                    "entities": ["ASA 150"],
                    "intent_confidence": 0.9
                },
                response_time_ms=250,
                kg_enhanced=True
            )
            mock_chat_service.process_query.return_value = mock_response
            
            request_data = {
                "query": "What is the viscosity of ASA 150?",
                "conversation_id": "test-conv-123",
                "max_results": 10
            }
            
            response = await async_client.post("/api/chat", json=request_data)
            
            assert response.status_code == 200
            data = response.json()
            assert data["answer"] == "ASA 150 has a viscosity of 150 cP at 25°C."
            assert len(data["sources"]) == 1
            assert data["conversation_id"] == "test-conv-123"
            assert data["kg_enhanced"] is True
    
    @pytest.mark.asyncio
    async def test_chat_endpoint_empty_query(self, async_client):
        """Test chat endpoint with empty query."""
        request_data = {
            "query": "",
            "max_results": 10
        }
        
        response = await async_client.post("/api/chat", json=request_data)
        
        assert response.status_code == 422  # Validation error
    
    @pytest.mark.asyncio
    async def test_chat_endpoint_invalid_max_results(self, async_client):
        """Test chat endpoint with invalid max_results."""
        request_data = {
            "query": "Test query",
            "max_results": -1
        }
        
        response = await async_client.post("/api/chat", json=request_data)
        
        assert response.status_code == 422  # Validation error
    
    @pytest.mark.asyncio
    async def test_chat_endpoint_service_error(self, async_client):
        """Test chat endpoint when service raises error."""
        with patch('dc_agent.api.chat.chat_service') as mock_chat_service:
            mock_chat_service.process_query.side_effect = Exception("Service error")
            
            request_data = {
                "query": "Test query",
                "max_results": 10
            }
            
            response = await async_client.post("/api/chat", json=request_data)
            
            assert response.status_code == 500


class TestProductEndpoints:
    """Test product API endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_products_success(self, async_client):
        """Test successful product listing."""
        with patch('dc_agent.api.products.product_service') as mock_product_service:
            mock_products = [
                Product(
                    id="asa-150",
                    name="ASA 150",
                    short_name="ASA150",
                    family=ProductFamily.ASA,
                    cas_number="12345-67-8",
                    chemical_name="Alkenyl Succinic Anhydride 150",
                    synonyms=["ASA-150"],
                    properties=[],
                    applications=["Coatings"],
                    key_benefits=["High viscosity"]
                )
            ]
            mock_product_service.list_products.return_value = mock_products
            
            response = await async_client.get("/api/products")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["name"] == "ASA 150"
            assert data[0]["family"] == "ASA"
    
    @pytest.mark.asyncio
    async def test_list_products_with_family_filter(self, async_client):
        """Test product listing with family filter."""
        with patch('dc_agent.api.products.product_service') as mock_product_service:
            mock_product_service.list_products.return_value = []
            
            response = await async_client.get("/api/products?family=ASA")
            
            assert response.status_code == 200
            mock_product_service.list_products.assert_called_once_with(
                family=ProductFamily.ASA,
                limit=100,
                offset=0
            )
    
    @pytest.mark.asyncio
    async def test_get_product_by_id_success(self, async_client):
        """Test successful product retrieval by ID."""
        with patch('dc_agent.api.products.product_service') as mock_product_service:
            mock_product = Product(
                id="asa-150",
                name="ASA 150",
                short_name="ASA150",
                family=ProductFamily.ASA,
                cas_number="12345-67-8",
                chemical_name="Alkenyl Succinic Anhydride 150",
                synonyms=["ASA-150"],
                properties=[],
                applications=["Coatings"],
                key_benefits=["High viscosity"]
            )
            mock_product_service.get_product_by_id.return_value = mock_product
            
            response = await async_client.get("/api/products/asa-150")
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == "asa-150"
            assert data["name"] == "ASA 150"
    
    @pytest.mark.asyncio
    async def test_get_product_by_id_not_found(self, async_client):
        """Test product retrieval with non-existent ID."""
        with patch('dc_agent.api.products.product_service') as mock_product_service:
            mock_product_service.get_product_by_id.return_value = None
            
            response = await async_client.get("/api/products/non-existent")
            
            assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_search_products_success(self, async_client):
        """Test successful product search."""
        with patch('dc_agent.api.products.product_service') as mock_product_service:
            mock_products = [
                Product(
                    id="asa-150",
                    name="ASA 150",
                    short_name="ASA150",
                    family=ProductFamily.ASA,
                    cas_number="12345-67-8",
                    chemical_name="Alkenyl Succinic Anhydride 150",
                    synonyms=["ASA-150"],
                    properties=[],
                    applications=["Coatings"],
                    key_benefits=["High viscosity"]
                )
            ]
            mock_product_service.search_products.return_value = mock_products
            
            response = await async_client.get("/api/products/search?q=ASA")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["name"] == "ASA 150"
    
    @pytest.mark.asyncio
    async def test_search_products_with_filters(self, async_client):
        """Test product search with filters."""
        with patch('dc_agent.api.products.product_service') as mock_product_service:
            mock_product_service.search_products.return_value = []
            
            response = await async_client.get(
                "/api/products/search?q=ASA&families=ASA&applications=Coatings"
            )
            
            assert response.status_code == 200
            mock_product_service.search_products.assert_called_once_with(
                query="ASA",
                families=[ProductFamily.ASA],
                applications=["Coatings"],
                limit=100
            )
    
    @pytest.mark.asyncio
    async def test_compare_products_success(self, async_client):
        """Test successful product comparison."""
        with patch('dc_agent.api.products.product_service') as mock_product_service:
            mock_products = [
                Product(
                    id="asa-150",
                    name="ASA 150",
                    short_name="ASA150",
                    family=ProductFamily.ASA,
                    cas_number="12345-67-8",
                    chemical_name="Alkenyl Succinic Anhydride 150",
                    synonyms=["ASA-150"],
                    properties=[],
                    applications=["Coatings"],
                    key_benefits=["High viscosity"]
                ),
                Product(
                    id="asa-140",
                    name="ASA 140",
                    short_name="ASA140",
                    family=ProductFamily.ASA,
                    cas_number="12345-67-9",
                    chemical_name="Alkenyl Succinic Anhydride 140",
                    synonyms=["ASA-140"],
                    properties=[],
                    applications=["Coatings"],
                    key_benefits=["Medium viscosity"]
                )
            ]
            mock_product_service.compare_products.return_value = mock_products
            
            response = await async_client.post(
                "/api/products/compare",
                json={"product_ids": ["asa-150", "asa-140"]}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["name"] == "ASA 150"
            assert data[1]["name"] == "ASA 140"


class TestKnowledgeGraphEndpoints:
    """Test knowledge graph API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_entity_neighbors_success(self, async_client):
        """Test successful entity neighbors retrieval."""
        with patch('dc_agent.api.kg.kg_service') as mock_kg_service:
            mock_neighbors = [
                {
                    "entity": {
                        "canonical_name": "ASA 140",
                        "entity_type": "CHEMICAL",
                        "properties": {}
                    },
                    "relationship": "similar_to",
                    "distance": 1
                }
            ]
            mock_kg_service.get_neighbors.return_value = mock_neighbors
            
            response = await async_client.get("/api/kg/neighbors/ASA%20150")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["entity"]["canonical_name"] == "ASA 140"
            assert data[0]["relationship"] == "similar_to"
    
    @pytest.mark.asyncio
    async def test_get_entity_neighbors_not_found(self, async_client):
        """Test entity neighbors retrieval for non-existent entity."""
        with patch('dc_agent.api.kg.kg_service') as mock_kg_service:
            mock_kg_service.get_neighbors.return_value = []
            
            response = await async_client.get("/api/kg/neighbors/NonExistent")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 0
    
    @pytest.mark.asyncio
    async def test_query_relationships_success(self, async_client):
        """Test successful relationship query."""
        with patch('dc_agent.api.kg.kg_service') as mock_kg_service:
            mock_relationships = [
                {
                    "subject": {"canonical_name": "ASA 150", "entity_type": "CHEMICAL"},
                    "predicate": "used_in",
                    "object": {"canonical_name": "Coatings", "entity_type": "APPLICATION"},
                    "confidence": 0.9
                }
            ]
            mock_kg_service.query_by_relationship.return_value = mock_relationships
            
            response = await async_client.get("/api/kg/relationships/used_in")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["predicate"] == "used_in"
            assert data[0]["confidence"] == 0.9


class TestErrorHandling:
    """Test error handling across endpoints."""
    
    @pytest.mark.asyncio
    async def test_404_endpoint(self, async_client):
        """Test non-existent endpoint."""
        response = await async_client.get("/api/nonexistent")
        
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_method_not_allowed(self, async_client):
        """Test method not allowed."""
        response = await async_client.delete("/api/products")
        
        assert response.status_code == 405
    
    @pytest.mark.asyncio
    async def test_validation_error_response_format(self, async_client):
        """Test validation error response format."""
        response = await async_client.post("/api/chat", json={"invalid": "data"})
        
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data


class TestCORS:
    """Test CORS configuration."""
    
    @pytest.mark.asyncio
    async def test_cors_headers(self, async_client):
        """Test CORS headers are present."""
        response = await async_client.options("/api/products")
        
        # Should have CORS headers
        assert "access-control-allow-origin" in response.headers
    
    @pytest.mark.asyncio
    async def test_preflight_request(self, async_client):
        """Test preflight request handling."""
        headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        }
        
        response = await async_client.options("/api/chat", headers=headers)
        
        assert response.status_code == 200


@pytest.mark.integration
class TestFullWorkflow:
    """Test full workflow integration."""
    
    @pytest.mark.asyncio
    async def test_chat_to_product_workflow(self, async_client):
        """Test workflow from chat query to product details."""
        # This would test a full user workflow
        pytest.skip("Full workflow test requires complete system setup")
    
    @pytest.mark.asyncio
    async def test_search_to_comparison_workflow(self, async_client):
        """Test workflow from search to product comparison."""
        pytest.skip("Full workflow test requires complete system setup")