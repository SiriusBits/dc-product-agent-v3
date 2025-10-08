"""Unit tests for schema validation."""

import pytest
import json
from typing import Dict, Any
from pydantic import ValidationError

from dc_agent.models.product_models import (
    Product, ProductFamily, PropertySpecification, 
    ProductSearchRequest, ProductSearchResponse
)
from dc_agent.models.api_models import (
    ChatRequest, ChatResponse, SearchResult,
    ErrorResponse, HealthResponse
)
from dc_agent.models.kg_models import (
    KGEntity, KGTriple, EntityType, KnowledgeGraph
)


class TestProductModels:
    """Test product model validation."""
    
    def test_product_valid_data(self):
        """Test product creation with valid data."""
        product_data = {
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
        
        product = Product(**product_data)
        
        assert product.id == "asa-150"
        assert product.name == "ASA 150"
        assert product.family == ProductFamily.ASA
        assert len(product.properties) == 1
        assert product.properties[0].value_numeric == 150.0
    
    def test_product_missing_required_fields(self):
        """Test product validation with missing required fields."""
        incomplete_data = {
            "name": "ASA 150",
            # Missing required fields: id, short_name, family
        }
        
        with pytest.raises(ValidationError) as exc_info:
            Product(**incomplete_data)
        
        errors = exc_info.value.errors()
        error_fields = [error["loc"][0] for error in errors]
        
        assert "id" in error_fields
        assert "short_name" in error_fields
        assert "family" in error_fields
    
    def test_product_invalid_family(self):
        """Test product validation with invalid family."""
        invalid_data = {
            "id": "test-product",
            "name": "Test Product",
            "short_name": "TEST",
            "family": "INVALID_FAMILY",  # Invalid family
            "cas_number": "12345-67-8",
            "chemical_name": "Test Chemical",
            "synonyms": [],
            "properties": [],
            "applications": [],
            "key_benefits": []
        }
        
        with pytest.raises(ValidationError) as exc_info:
            Product(**invalid_data)
        
        assert "family" in str(exc_info.value)
    
    def test_property_specification_valid(self):
        """Test property specification with valid data."""
        prop_data = {
            "category": "Physical",
            "name": "Viscosity",
            "value_string": "150 cP",
            "value_numeric": 150.0,
            "value_min": 145.0,
            "value_max": 155.0,
            "unit": "cP",
            "test_method": "ASTM D445",
            "page": 2
        }
        
        prop = PropertySpecification(**prop_data)
        
        assert prop.category == "Physical"
        assert prop.value_numeric == 150.0
        assert prop.value_min == 145.0
        assert prop.value_max == 155.0
    
    def test_property_specification_numeric_validation(self):
        """Test property specification numeric value validation."""
        # Test invalid range (min > max)
        invalid_data = {
            "category": "Physical",
            "name": "Viscosity",
            "value_numeric": 150.0,
            "value_min": 200.0,  # Min greater than max
            "value_max": 100.0,
            "unit": "cP"
        }
        
        with pytest.raises(ValidationError):
            PropertySpecification(**invalid_data)
    
    def test_product_search_request_validation(self):
        """Test product search request validation."""
        valid_request = {
            "query": "ASA",
            "families": ["ASA", "DCA"],
            "applications": ["Coatings"],
            "limit": 50,
            "offset": 0
        }
        
        request = ProductSearchRequest(**valid_request)
        
        assert request.query == "ASA"
        assert ProductFamily.ASA in request.families
        assert ProductFamily.DCA in request.families
        assert "Coatings" in request.applications
    
    def test_product_search_request_limits(self):
        """Test product search request limit validation."""
        # Test limit too high
        with pytest.raises(ValidationError):
            ProductSearchRequest(limit=1000)  # Exceeds max limit
        
        # Test negative offset
        with pytest.raises(ValidationError):
            ProductSearchRequest(offset=-1)


class TestAPIModels:
    """Test API model validation."""
    
    def test_chat_request_valid(self):
        """Test chat request with valid data."""
        request_data = {
            "query": "What is the viscosity of ASA 150?",
            "conversation_id": "conv-123",
            "max_results": 10
        }
        
        request = ChatRequest(**request_data)
        
        assert request.query == "What is the viscosity of ASA 150?"
        assert request.conversation_id == "conv-123"
        assert request.max_results == 10
    
    def test_chat_request_empty_query(self):
        """Test chat request with empty query."""
        with pytest.raises(ValidationError):
            ChatRequest(query="")
    
    def test_chat_request_invalid_max_results(self):
        """Test chat request with invalid max_results."""
        with pytest.raises(ValidationError):
            ChatRequest(query="test", max_results=0)
        
        with pytest.raises(ValidationError):
            ChatRequest(query="test", max_results=101)  # Exceeds max
    
    def test_search_result_valid(self):
        """Test search result with valid data."""
        result_data = {
            "content": "ASA 150 has a viscosity of 150 cP",
            "score": 0.95,
            "source": "vector",
            "metadata": {"doc_id": "asa-150-spec"},
            "provenance": {"document": "ASA 150 Technical Bulletin"}
        }
        
        result = SearchResult(**result_data)
        
        assert result.content == "ASA 150 has a viscosity of 150 cP"
        assert result.score == 0.95
        assert result.source == "vector"
    
    def test_search_result_score_validation(self):
        """Test search result score validation."""
        # Score too high
        with pytest.raises(ValidationError):
            SearchResult(
                content="test",
                score=1.5,  # Score > 1.0
                source="vector",
                metadata={},
                provenance={}
            )
        
        # Score too low
        with pytest.raises(ValidationError):
            SearchResult(
                content="test",
                score=-0.1,  # Score < 0.0
                source="vector",
                metadata={},
                provenance={}
            )
    
    def test_chat_response_valid(self):
        """Test chat response with valid data."""
        response_data = {
            "answer": "ASA 150 has a viscosity of 150 cP at 25°C.",
            "sources": [
                {
                    "content": "ASA 150 viscosity: 150 cP",
                    "score": 0.95,
                    "source": "vector",
                    "metadata": {"doc_id": "asa-150-spec"},
                    "provenance": {"document": "ASA 150 Technical Bulletin"}
                }
            ],
            "conversation_id": "conv-123",
            "query_analysis": {
                "query_type": "specification",
                "entities": ["ASA 150"],
                "intent_confidence": 0.9
            },
            "response_time_ms": 250,
            "kg_enhanced": True
        }
        
        response = ChatResponse(**response_data)
        
        assert response.answer == "ASA 150 has a viscosity of 150 cP at 25°C."
        assert len(response.sources) == 1
        assert response.kg_enhanced is True
    
    def test_error_response_valid(self):
        """Test error response validation."""
        error_data = {
            "error_code": "VALIDATION_ERROR",
            "message": "Invalid input provided",
            "details": {"field": "query", "issue": "cannot be empty"},
            "timestamp": "2024-01-01T10:00:00Z",
            "request_id": "req-123"
        }
        
        error = ErrorResponse(**error_data)
        
        assert error.error_code == "VALIDATION_ERROR"
        assert error.message == "Invalid input provided"
        assert error.details["field"] == "query"
    
    def test_health_response_valid(self):
        """Test health response validation."""
        health_data = {
            "status": "healthy",
            "timestamp": "2024-01-01T10:00:00Z",
            "version": "3.0.0",
            "services": {
                "vector_db": "healthy",
                "knowledge_graph": "healthy",
                "cache": "healthy"
            }
        }
        
        health = HealthResponse(**health_data)
        
        assert health.status == "healthy"
        assert health.version == "3.0.0"
        assert health.services["vector_db"] == "healthy"


class TestKnowledgeGraphModels:
    """Test knowledge graph model validation."""
    
    def test_kg_entity_valid(self):
        """Test KG entity with valid data."""
        entity_data = {
            "canonical_name": "ASA 150",
            "entity_type": "CHEMICAL",
            "aliases": ["ASA-150", "Alkenyl Succinic Anhydride 150"],
            "properties": {
                "viscosity": "150 cP",
                "family": "ASA",
                "cas_number": "12345-67-8"
            },
            "source_text": "ASA 150 is a high viscosity chemical",
            "confidence": 0.95
        }
        
        entity = KGEntity(**entity_data)
        
        assert entity.canonical_name == "ASA 150"
        assert entity.entity_type == EntityType.CHEMICAL
        assert "ASA-150" in entity.aliases
        assert entity.properties["viscosity"] == "150 cP"
        assert entity.confidence == 0.95
    
    def test_kg_entity_invalid_type(self):
        """Test KG entity with invalid entity type."""
        with pytest.raises(ValidationError):
            KGEntity(
                canonical_name="Test",
                entity_type="INVALID_TYPE",
                aliases=[],
                properties={}
            )
    
    def test_kg_entity_confidence_validation(self):
        """Test KG entity confidence validation."""
        # Confidence too high
        with pytest.raises(ValidationError):
            KGEntity(
                canonical_name="Test",
                entity_type="CHEMICAL",
                aliases=[],
                properties={},
                confidence=1.5
            )
        
        # Confidence too low
        with pytest.raises(ValidationError):
            KGEntity(
                canonical_name="Test",
                entity_type="CHEMICAL",
                aliases=[],
                properties={},
                confidence=-0.1
            )
    
    def test_kg_triple_valid(self):
        """Test KG triple with valid data."""
        subject = KGEntity(
            canonical_name="ASA 150",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={}
        )
        
        object_entity = KGEntity(
            canonical_name="Coatings",
            entity_type=EntityType.APPLICATION,
            aliases=[],
            properties={}
        )
        
        triple_data = {
            "subject": subject,
            "predicate": "used_in",
            "object": object_entity,
            "source_text": "ASA 150 is used in coatings",
            "confidence": 0.9,
            "provenance": {"document": "ASA 150 Technical Bulletin"}
        }
        
        triple = KGTriple(**triple_data)
        
        assert triple.subject.canonical_name == "ASA 150"
        assert triple.predicate == "used_in"
        assert triple.object.canonical_name == "Coatings"
        assert triple.confidence == 0.9
    
    def test_knowledge_graph_valid(self):
        """Test knowledge graph with valid data."""
        entity1 = KGEntity(
            canonical_name="ASA 150",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={}
        )
        
        entity2 = KGEntity(
            canonical_name="Coatings",
            entity_type=EntityType.APPLICATION,
            aliases=[],
            properties={}
        )
        
        triple = KGTriple(
            subject=entity1,
            predicate="used_in",
            object=entity2,
            confidence=0.9
        )
        
        kg_data = {
            "entities": [entity1, entity2],
            "kg_triples": [triple],
            "metadata": {
                "source_document": "ASA 150 Technical Bulletin",
                "extraction_date": "2024-01-01"
            }
        }
        
        kg = KnowledgeGraph(**kg_data)
        
        assert len(kg.entities) == 2
        assert len(kg.kg_triples) == 1
        assert kg.metadata["source_document"] == "ASA 150 Technical Bulletin"


class TestJSONSchemaValidation:
    """Test JSON schema validation."""
    
    def test_product_json_serialization(self):
        """Test product JSON serialization and deserialization."""
        product = Product(
            id="asa-150",
            name="ASA 150",
            short_name="ASA150",
            family=ProductFamily.ASA,
            cas_number="12345-67-8",
            chemical_name="Alkenyl Succinic Anhydride 150",
            synonyms=["ASA-150"],
            properties=[
                PropertySpecification(
                    category="Physical",
                    name="Viscosity",
                    value_string="150 cP",
                    value_numeric=150.0,
                    unit="cP"
                )
            ],
            applications=["Coatings"],
            key_benefits=["High viscosity"]
        )
        
        # Serialize to JSON
        json_data = product.model_dump_json()
        parsed_data = json.loads(json_data)
        
        # Verify JSON structure
        assert parsed_data["id"] == "asa-150"
        assert parsed_data["family"] == "ASA"
        assert len(parsed_data["properties"]) == 1
        
        # Deserialize back to model
        restored_product = Product.model_validate(parsed_data)
        assert restored_product.id == product.id
        assert restored_product.family == product.family
    
    def test_chat_response_json_serialization(self):
        """Test chat response JSON serialization."""
        response = ChatResponse(
            answer="Test answer",
            sources=[
                SearchResult(
                    content="Test content",
                    score=0.95,
                    source="vector",
                    metadata={"doc_id": "test"},
                    provenance={"document": "Test Doc"}
                )
            ],
            conversation_id="conv-123",
            query_analysis={
                "query_type": "specification",
                "entities": ["ASA 150"],
                "intent_confidence": 0.9
            },
            response_time_ms=250,
            kg_enhanced=True
        )
        
        json_data = response.model_dump_json()
        parsed_data = json.loads(json_data)
        
        assert parsed_data["answer"] == "Test answer"
        assert len(parsed_data["sources"]) == 1
        assert parsed_data["kg_enhanced"] is True
    
    def test_nested_model_validation(self):
        """Test validation of nested models."""
        # Test with invalid nested property
        invalid_product_data = {
            "id": "test",
            "name": "Test",
            "short_name": "TEST",
            "family": "ASA",
            "cas_number": "12345-67-8",
            "chemical_name": "Test Chemical",
            "synonyms": [],
            "properties": [
                {
                    "category": "Physical",
                    "name": "Viscosity",
                    "value_numeric": "invalid_number",  # Should be float
                    "unit": "cP"
                }
            ],
            "applications": [],
            "key_benefits": []
        }
        
        with pytest.raises(ValidationError) as exc_info:
            Product(**invalid_product_data)
        
        # Should indicate the nested validation error
        assert "properties" in str(exc_info.value)


class TestDataIntegrity:
    """Test data integrity constraints."""
    
    def test_product_id_format(self):
        """Test product ID format validation."""
        # Valid ID formats
        valid_ids = ["asa-150", "dca-467", "eca-100ka", "product-123"]
        
        for product_id in valid_ids:
            product = Product(
                id=product_id,
                name="Test Product",
                short_name="TEST",
                family=ProductFamily.ASA,
                cas_number="12345-67-8",
                chemical_name="Test Chemical",
                synonyms=[],
                properties=[],
                applications=[],
                key_benefits=[]
            )
            assert product.id == product_id
    
    def test_cas_number_format(self):
        """Test CAS number format validation."""
        valid_cas_numbers = [
            "12345-67-8",
            "123456-78-9",
            "1234567-89-0"
        ]
        
        for cas_number in valid_cas_numbers:
            product = Product(
                id="test",
                name="Test Product",
                short_name="TEST",
                family=ProductFamily.ASA,
                cas_number=cas_number,
                chemical_name="Test Chemical",
                synonyms=[],
                properties=[],
                applications=[],
                key_benefits=[]
            )
            assert product.cas_number == cas_number
    
    def test_property_value_consistency(self):
        """Test property value consistency."""
        # Test that numeric and string values are consistent
        prop = PropertySpecification(
            category="Physical",
            name="Viscosity",
            value_string="150.5 cP",
            value_numeric=150.5,
            unit="cP"
        )
        
        assert prop.value_numeric == 150.5
        assert "150.5" in prop.value_string
    
    def test_entity_relationship_consistency(self):
        """Test entity relationship consistency in KG triples."""
        chemical = KGEntity(
            canonical_name="ASA 150",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={}
        )
        
        application = KGEntity(
            canonical_name="Coatings",
            entity_type=EntityType.APPLICATION,
            aliases=[],
            properties={}
        )
        
        # Valid relationship
        triple = KGTriple(
            subject=chemical,
            predicate="used_in",
            object=application,
            confidence=0.9
        )
        
        assert triple.subject.entity_type == EntityType.CHEMICAL
        assert triple.object.entity_type == EntityType.APPLICATION
        assert triple.predicate == "used_in"


class TestEdgeCases:
    """Test edge cases and boundary conditions."""
    
    def test_empty_collections(self):
        """Test handling of empty collections."""
        product = Product(
            id="test",
            name="Test Product",
            short_name="TEST",
            family=ProductFamily.ASA,
            cas_number="12345-67-8",
            chemical_name="Test Chemical",
            synonyms=[],  # Empty list
            properties=[],  # Empty list
            applications=[],  # Empty list
            key_benefits=[]  # Empty list
        )
        
        assert len(product.synonyms) == 0
        assert len(product.properties) == 0
        assert len(product.applications) == 0
        assert len(product.key_benefits) == 0
    
    def test_unicode_content(self):
        """Test handling of unicode content."""
        product = Product(
            id="test-unicode",
            name="Test Product with °C and µm",
            short_name="TEST",
            family=ProductFamily.ASA,
            cas_number="12345-67-8",
            chemical_name="Test Chemical with special chars: α, β, γ",
            synonyms=["Synonym with °C"],
            properties=[
                PropertySpecification(
                    category="Physical",
                    name="Temperature",
                    value_string="200°C",
                    value_numeric=200.0,
                    unit="°C"
                )
            ],
            applications=["High-temp applications"],
            key_benefits=["Works at 200°C"]
        )
        
        assert "°C" in product.name
        assert "α, β, γ" in product.chemical_name
        assert product.properties[0].unit == "°C"
    
    def test_very_long_strings(self):
        """Test handling of very long strings."""
        long_description = "A" * 10000  # Very long string
        
        # Should handle long strings without issues
        entity = KGEntity(
            canonical_name="Test Entity",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={"long_description": long_description}
        )
        
        assert len(entity.properties["long_description"]) == 10000
    
    def test_null_optional_fields(self):
        """Test handling of null optional fields."""
        prop = PropertySpecification(
            category="Physical",
            name="Viscosity",
            value_string=None,  # Optional field
            value_numeric=150.0,
            value_min=None,  # Optional field
            value_max=None,  # Optional field
            unit="cP",
            test_method=None,  # Optional field
            page=None  # Optional field
        )
        
        assert prop.value_string is None
        assert prop.value_min is None
        assert prop.value_max is None
        assert prop.test_method is None
        assert prop.page is None