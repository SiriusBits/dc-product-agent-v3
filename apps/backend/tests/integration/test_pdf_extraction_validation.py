"""Integration tests for PDF extraction and validation pipeline."""

import pytest
import json
import tempfile
import os
from pathlib import Path
from typing import Dict, Any, List

from dc_agent.models.product_models import Product, PropertySpecification
from dc_agent.models.kg_models import KGEntity, KGTriple, KnowledgeGraph, EntityType


@pytest.mark.integration
class TestPDFExtractionValidation:
    """Test PDF extraction and validation pipeline."""
    
    @pytest.fixture
    def sample_extraction_data(self) -> Dict[str, Any]:
        """Sample extraction data that should be valid."""
        return {
            "document_metadata": {
                "doc_id": "asa-150-tech-bulletin",
                "filename": "ASA_150_Technical_Bulletin.pdf",
                "source_filepath": "/path/to/ASA_150_Technical_Bulletin.pdf",
                "processed_at": "2024-01-01T10:00:00Z",
                "file_hash": "abc123def456",
                "page_count": 8
            },
            "product_info": {
                "product_name": "ASA 150",
                "product_short_name": "ASA150",
                "product_family": "ASA",
                "cas_number": "12345-67-8",
                "chemical_name": "Alkenyl Succinic Anhydride 150",
                "synonyms": ["ASA-150", "Alkenyl Succinic Anhydride 150"]
            },
            "properties_and_specifications": [
                {
                    "category": "Physical Properties",
                    "name": "Viscosity",
                    "value_string": "150 cP at 25°C",
                    "value_numeric": 150.0,
                    "value_min": 145.0,
                    "value_max": 155.0,
                    "unit": "cP",
                    "test_method": "ASTM D445",
                    "page": 2
                },
                {
                    "category": "Physical Properties",
                    "name": "Specific Gravity",
                    "value_string": "1.05 at 25°C",
                    "value_numeric": 1.05,
                    "unit": "g/cm³",
                    "test_method": "ASTM D792",
                    "page": 2
                }
            ],
            "applications": [
                "Coatings",
                "Adhesives",
                "Sealants",
                "Composite Materials"
            ],
            "key_benefits": [
                "High viscosity for improved application properties",
                "Excellent adhesion to various substrates",
                "Chemical resistance",
                "Thermal stability"
            ],
            "sections": [
                {
                    "title": "Product Overview",
                    "content": "ASA 150 is a high-performance alkenyl succinic anhydride...",
                    "page": 1
                },
                {
                    "title": "Properties and Specifications",
                    "content": "The following table shows the typical properties...",
                    "page": 2
                }
            ]
        }
    
    @pytest.fixture
    def sample_derived_data(self) -> Dict[str, Any]:
        """Sample derived information data."""
        return {
            "knowledge_graph": {
                "entities": [
                    {
                        "canonical_name": "ASA 150",
                        "entity_type": "CHEMICAL",
                        "aliases": ["ASA-150", "Alkenyl Succinic Anhydride 150"],
                        "properties": {
                            "viscosity": "150 cP",
                            "specific_gravity": "1.05 g/cm³",
                            "family": "ASA"
                        },
                        "confidence": 0.95
                    },
                    {
                        "canonical_name": "Coatings",
                        "entity_type": "APPLICATION",
                        "aliases": ["Coating Applications", "Paint Applications"],
                        "properties": {},
                        "confidence": 0.90
                    },
                    {
                        "canonical_name": "Viscosity",
                        "entity_type": "PROPERTY",
                        "aliases": ["Dynamic Viscosity", "Fluid Viscosity"],
                        "properties": {
                            "unit": "cP",
                            "test_method": "ASTM D445"
                        },
                        "confidence": 0.98
                    }
                ],
                "kg_triples": [
                    {
                        "subject": {
                            "canonical_name": "ASA 150",
                            "entity_type": "CHEMICAL",
                            "aliases": ["ASA-150"],
                            "properties": {}
                        },
                        "predicate": "used_in",
                        "object": {
                            "canonical_name": "Coatings",
                            "entity_type": "APPLICATION",
                            "aliases": [],
                            "properties": {}
                        },
                        "source_text": "ASA 150 is used in coatings applications",
                        "confidence": 0.92
                    },
                    {
                        "subject": {
                            "canonical_name": "ASA 150",
                            "entity_type": "CHEMICAL",
                            "aliases": ["ASA-150"],
                            "properties": {}
                        },
                        "predicate": "has_property",
                        "object": {
                            "canonical_name": "Viscosity",
                            "entity_type": "PROPERTY",
                            "aliases": [],
                            "properties": {}
                        },
                        "source_text": "ASA 150 has a viscosity of 150 cP",
                        "confidence": 0.95
                    }
                ]
            },
            "enhanced_properties": [
                {
                    "category": "Physical Properties",
                    "name": "Viscosity",
                    "value_string": "150 cP at 25°C",
                    "value_numeric": 150.0,
                    "unit": "cP",
                    "test_method": "ASTM D445",
                    "derived_insights": [
                        "High viscosity suitable for thick film applications",
                        "Comparable to other ASA products in the 140-160 range"
                    ]
                }
            ]
        }
    
    def test_base_extraction_validation(self, sample_extraction_data):
        """Test validation of base extraction data."""
        # Test that the extraction data can be validated against our models
        
        # Validate product info
        product_info = sample_extraction_data["product_info"]
        
        # Create a Product model from the extracted data
        product = Product(
            id=product_info["product_name"].lower().replace(" ", "-"),
            name=product_info["product_name"],
            short_name=product_info["product_short_name"],
            family=product_info["product_family"],
            cas_number=product_info["cas_number"],
            chemical_name=product_info["chemical_name"],
            synonyms=product_info["synonyms"],
            properties=[
                PropertySpecification(**prop) 
                for prop in sample_extraction_data["properties_and_specifications"]
            ],
            applications=sample_extraction_data["applications"],
            key_benefits=sample_extraction_data["key_benefits"]
        )
        
        assert product.name == "ASA 150"
        assert product.family.value == "ASA"
        assert len(product.properties) == 2
        assert product.properties[0].value_numeric == 150.0
        assert "Coatings" in product.applications
    
    def test_derived_info_validation(self, sample_derived_data):
        """Test validation of derived information data."""
        kg_data = sample_derived_data["knowledge_graph"]
        
        # Validate entities
        entities = [KGEntity(**entity_data) for entity_data in kg_data["entities"]]
        
        assert len(entities) == 3
        assert entities[0].canonical_name == "ASA 150"
        assert entities[0].entity_type == EntityType.CHEMICAL
        assert entities[1].entity_type == EntityType.APPLICATION
        assert entities[2].entity_type == EntityType.PROPERTY
        
        # Validate triples
        triples = [KGTriple(**triple_data) for triple_data in kg_data["kg_triples"]]
        
        assert len(triples) == 2
        assert triples[0].predicate == "used_in"
        assert triples[1].predicate == "has_property"
        assert all(triple.confidence > 0.9 for triple in triples)
        
        # Validate complete knowledge graph
        knowledge_graph = KnowledgeGraph(
            entities=entities,
            kg_triples=triples,
            metadata={"source": "PDF extraction"}
        )
        
        assert len(knowledge_graph.entities) == 3
        assert len(knowledge_graph.kg_triples) == 2
    
    def test_extraction_data_completeness(self, sample_extraction_data):
        """Test that extraction data contains all required fields."""
        required_top_level_keys = [
            "document_metadata",
            "product_info",
            "properties_and_specifications",
            "applications",
            "key_benefits",
            "sections"
        ]
        
        for key in required_top_level_keys:
            assert key in sample_extraction_data, f"Missing required key: {key}"
        
        # Test document metadata completeness
        doc_metadata = sample_extraction_data["document_metadata"]
        required_metadata_keys = [
            "doc_id", "filename", "source_filepath", 
            "processed_at", "file_hash", "page_count"
        ]
        
        for key in required_metadata_keys:
            assert key in doc_metadata, f"Missing metadata key: {key}"
        
        # Test product info completeness
        product_info = sample_extraction_data["product_info"]
        required_product_keys = [
            "product_name", "product_short_name", "product_family",
            "cas_number", "chemical_name", "synonyms"
        ]
        
        for key in required_product_keys:
            assert key in product_info, f"Missing product info key: {key}"
    
    def test_property_specification_validation(self, sample_extraction_data):
        """Test validation of property specifications."""
        properties = sample_extraction_data["properties_and_specifications"]
        
        for prop_data in properties:
            prop = PropertySpecification(**prop_data)
            
            # Test required fields
            assert prop.category is not None
            assert prop.name is not None
            
            # Test numeric consistency
            if prop.value_numeric is not None:
                assert isinstance(prop.value_numeric, (int, float))
                
                # If min/max are provided, numeric value should be within range
                if prop.value_min is not None:
                    assert prop.value_numeric >= prop.value_min
                if prop.value_max is not None:
                    assert prop.value_numeric <= prop.value_max
            
            # Test that string value contains numeric value if both exist
            if prop.value_string and prop.value_numeric:
                assert str(prop.value_numeric) in prop.value_string or \
                       str(int(prop.value_numeric)) in prop.value_string
    
    def test_knowledge_graph_consistency(self, sample_derived_data):
        """Test knowledge graph internal consistency."""
        kg_data = sample_derived_data["knowledge_graph"]
        
        entities = [KGEntity(**entity_data) for entity_data in kg_data["entities"]]
        triples = [KGTriple(**triple_data) for triple_data in kg_data["kg_triples"]]
        
        # Create entity lookup
        entity_names = {entity.canonical_name for entity in entities}
        
        # Test that all triple subjects and objects reference existing entities
        for triple in triples:
            assert triple.subject.canonical_name in entity_names, \
                f"Triple subject '{triple.subject.canonical_name}' not found in entities"
            
            # For entity objects (not string/numeric objects)
            if hasattr(triple.object, 'canonical_name'):
                assert triple.object.canonical_name in entity_names, \
                    f"Triple object '{triple.object.canonical_name}' not found in entities"
        
        # Test confidence scores are reasonable
        for entity in entities:
            assert 0.0 <= entity.confidence <= 1.0
        
        for triple in triples:
            assert 0.0 <= triple.confidence <= 1.0
    
    def test_json_schema_compliance(self, sample_extraction_data, sample_derived_data):
        """Test that data complies with JSON schema format."""
        # Test that data can be serialized to JSON and back
        
        # Base extraction data
        json_str = json.dumps(sample_extraction_data, default=str)
        parsed_data = json.loads(json_str)
        
        assert parsed_data["product_info"]["product_name"] == "ASA 150"
        assert len(parsed_data["properties_and_specifications"]) == 2
        
        # Derived data
        json_str = json.dumps(sample_derived_data, default=str)
        parsed_data = json.loads(json_str)
        
        assert len(parsed_data["knowledge_graph"]["entities"]) == 3
        assert len(parsed_data["knowledge_graph"]["kg_triples"]) == 2
    
    def test_invalid_extraction_data_handling(self):
        """Test handling of invalid extraction data."""
        invalid_data_cases = [
            # Missing required fields
            {
                "product_info": {
                    "product_name": "Test Product"
                    # Missing other required fields
                }
            },
            # Invalid property specification
            {
                "product_info": {
                    "product_name": "Test Product",
                    "product_short_name": "TEST",
                    "product_family": "ASA",
                    "cas_number": "12345-67-8",
                    "chemical_name": "Test Chemical",
                    "synonyms": []
                },
                "properties_and_specifications": [
                    {
                        "category": "Physical",
                        "name": "Viscosity",
                        "value_numeric": "invalid_number",  # Should be numeric
                        "unit": "cP"
                    }
                ],
                "applications": [],
                "key_benefits": []
            },
            # Invalid entity type
            {
                "knowledge_graph": {
                    "entities": [
                        {
                            "canonical_name": "Test Entity",
                            "entity_type": "INVALID_TYPE",  # Invalid type
                            "aliases": [],
                            "properties": {}
                        }
                    ],
                    "kg_triples": []
                }
            }
        ]
        
        for invalid_data in invalid_data_cases:
            with pytest.raises((ValueError, TypeError, KeyError)):
                # This should fail validation
                if "product_info" in invalid_data:
                    Product(
                        id="test",
                        name=invalid_data["product_info"]["product_name"],
                        short_name=invalid_data["product_info"].get("product_short_name", ""),
                        family=invalid_data["product_info"].get("product_family", "ASA"),
                        cas_number=invalid_data["product_info"].get("cas_number", ""),
                        chemical_name=invalid_data["product_info"].get("chemical_name", ""),
                        synonyms=invalid_data["product_info"].get("synonyms", []),
                        properties=[
                            PropertySpecification(**prop) 
                            for prop in invalid_data.get("properties_and_specifications", [])
                        ],
                        applications=invalid_data.get("applications", []),
                        key_benefits=invalid_data.get("key_benefits", [])
                    )
                
                if "knowledge_graph" in invalid_data:
                    entities = [
                        KGEntity(**entity_data) 
                        for entity_data in invalid_data["knowledge_graph"]["entities"]
                    ]
    
    def test_data_type_consistency(self, sample_extraction_data):
        """Test data type consistency across extraction."""
        # Test that numeric values are consistently typed
        properties = sample_extraction_data["properties_and_specifications"]
        
        for prop in properties:
            if "value_numeric" in prop and prop["value_numeric"] is not None:
                assert isinstance(prop["value_numeric"], (int, float))
            
            if "value_min" in prop and prop["value_min"] is not None:
                assert isinstance(prop["value_min"], (int, float))
            
            if "value_max" in prop and prop["value_max"] is not None:
                assert isinstance(prop["value_max"], (int, float))
            
            if "page" in prop and prop["page"] is not None:
                assert isinstance(prop["page"], int)
        
        # Test that lists are consistently typed
        assert isinstance(sample_extraction_data["applications"], list)
        assert isinstance(sample_extraction_data["key_benefits"], list)
        assert isinstance(sample_extraction_data["product_info"]["synonyms"], list)
    
    def test_cross_reference_validation(self, sample_extraction_data, sample_derived_data):
        """Test cross-references between base and derived data."""
        product_name = sample_extraction_data["product_info"]["product_name"]
        
        # Check that product appears in knowledge graph entities
        kg_entities = sample_derived_data["knowledge_graph"]["entities"]
        product_entity = next(
            (entity for entity in kg_entities if entity["canonical_name"] == product_name),
            None
        )
        
        assert product_entity is not None, f"Product {product_name} not found in KG entities"
        assert product_entity["entity_type"] == "CHEMICAL"
        
        # Check that properties from base extraction appear in KG
        base_properties = {prop["name"] for prop in sample_extraction_data["properties_and_specifications"]}
        kg_property_entities = [
            entity["canonical_name"] for entity in kg_entities 
            if entity["entity_type"] == "PROPERTY"
        ]
        
        # At least some properties should appear in KG
        property_overlap = base_properties.intersection(set(kg_property_entities))
        assert len(property_overlap) > 0, "No properties from base extraction found in KG"
    
    def test_file_processing_metadata(self, sample_extraction_data):
        """Test file processing metadata validation."""
        metadata = sample_extraction_data["document_metadata"]
        
        # Test required metadata fields
        assert metadata["doc_id"] is not None
        assert metadata["filename"].endswith(".pdf")
        assert metadata["page_count"] > 0
        assert isinstance(metadata["page_count"], int)
        
        # Test file hash format (should be hex string)
        file_hash = metadata["file_hash"]
        assert isinstance(file_hash, str)
        assert len(file_hash) > 0
        
        # Test timestamp format
        processed_at = metadata["processed_at"]
        assert isinstance(processed_at, str)
        assert "T" in processed_at  # ISO format should contain T
    
    @pytest.mark.parametrize("confidence_threshold", [0.8, 0.9, 0.95])
    def test_confidence_threshold_filtering(self, sample_derived_data, confidence_threshold):
        """Test filtering by confidence thresholds."""
        kg_data = sample_derived_data["knowledge_graph"]
        
        # Filter entities by confidence
        high_confidence_entities = [
            entity for entity in kg_data["entities"]
            if entity.get("confidence", 0.0) >= confidence_threshold
        ]
        
        # Filter triples by confidence
        high_confidence_triples = [
            triple for triple in kg_data["kg_triples"]
            if triple.get("confidence", 0.0) >= confidence_threshold
        ]
        
        # Verify filtering works
        if confidence_threshold <= 0.9:
            assert len(high_confidence_entities) > 0
            assert len(high_confidence_triples) > 0
        
        # All filtered items should meet threshold
        for entity in high_confidence_entities:
            assert entity.get("confidence", 0.0) >= confidence_threshold
        
        for triple in high_confidence_triples:
            assert triple.get("confidence", 0.0) >= confidence_threshold


@pytest.mark.integration
class TestSchemaEvolution:
    """Test schema evolution and backward compatibility."""
    
    def test_schema_version_compatibility(self):
        """Test that schemas are backward compatible."""
        # Test with older version data format
        old_format_data = {
            "product_name": "ASA 150",
            "family": "ASA",
            "properties": [
                {
                    "name": "Viscosity",
                    "value": "150 cP",  # Old format: single value field
                    "unit": "cP"
                }
            ]
        }
        
        # Should be able to adapt old format to new format
        adapted_property = PropertySpecification(
            category="Physical",  # Default category
            name=old_format_data["properties"][0]["name"],
            value_string=old_format_data["properties"][0]["value"],
            unit=old_format_data["properties"][0]["unit"]
        )
        
        assert adapted_property.name == "Viscosity"
        assert adapted_property.value_string == "150 cP"
    
    def test_optional_field_addition(self):
        """Test that new optional fields don't break existing data."""
        # Simulate adding new optional fields to existing models
        minimal_product = Product(
            id="test",
            name="Test Product",
            short_name="TEST",
            family="ASA",
            cas_number="12345-67-8",
            chemical_name="Test Chemical",
            synonyms=[],
            properties=[],
            applications=[],
            key_benefits=[]
            # New optional fields would be added here in future versions
        )
        
        assert minimal_product.id == "test"
        assert minimal_product.name == "Test Product"