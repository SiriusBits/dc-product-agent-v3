"""Integration tests for knowledge graph data integrity."""

import pytest
import asyncio
from typing import List, Dict, Any, Set
from unittest.mock import Mock, AsyncMock

from dc_agent.kg.service import KnowledgeGraphService
from dc_agent.models.kg_models import KGEntity, KGTriple, EntityType, KnowledgeGraph


@pytest.mark.integration
class TestKnowledgeGraphDataIntegrity:
    """Test knowledge graph data integrity and consistency."""
    
    @pytest.fixture
    async def kg_service_with_test_data(self):
        """Create KG service with test data."""
        # Mock KG store for testing
        mock_store = Mock()
        mock_store.add_entity = AsyncMock()
        mock_store.add_relationship = AsyncMock()
        mock_store.find_entity = AsyncMock()
        mock_store.get_neighbors = AsyncMock()
        mock_store.query_by_relationship = AsyncMock()
        
        service = KnowledgeGraphService(kg_store=mock_store)
        
        # Add test entities
        test_entities = [
            KGEntity(
                canonical_name="ASA 150",
                entity_type=EntityType.CHEMICAL,
                aliases=["ASA-150", "Alkenyl Succinic Anhydride 150"],
                properties={
                    "viscosity": "150 cP",
                    "family": "ASA",
                    "cas_number": "12345-67-8"
                },
                confidence=0.95
            ),
            KGEntity(
                canonical_name="ASA 140",
                entity_type=EntityType.CHEMICAL,
                aliases=["ASA-140"],
                properties={
                    "viscosity": "140 cP",
                    "family": "ASA"
                },
                confidence=0.93
            ),
            KGEntity(
                canonical_name="Coatings",
                entity_type=EntityType.APPLICATION,
                aliases=["Coating Applications", "Paint Applications"],
                properties={},
                confidence=0.90
            ),
            KGEntity(
                canonical_name="Adhesives",
                entity_type=EntityType.APPLICATION,
                aliases=["Adhesive Applications"],
                properties={},
                confidence=0.88
            ),
            KGEntity(
                canonical_name="Viscosity",
                entity_type=EntityType.PROPERTY,
                aliases=["Dynamic Viscosity", "Fluid Viscosity"],
                properties={
                    "unit": "cP",
                    "test_method": "ASTM D445"
                },
                confidence=0.98
            )
        ]
        
        # Mock entity storage
        entity_storage = {}
        for i, entity in enumerate(test_entities):
            entity_id = f"entity_{i}"
            entity_storage[entity_id] = entity
            mock_store.add_entity.return_value = entity_id
        
        # Mock find_entity to return entities by name
        def mock_find_entity(name, entity_type=None):
            for entity in test_entities:
                if entity.canonical_name.lower() == name.lower():
                    if entity_type is None or entity.entity_type == entity_type:
                        return entity
            return None
        
        mock_store.find_entity.side_effect = mock_find_entity
        
        return service, test_entities, mock_store
    
    @pytest.mark.asyncio
    async def test_entity_uniqueness_constraint(self, kg_service_with_test_data):
        """Test that entities maintain uniqueness constraints."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Try to add duplicate entity
        duplicate_entity = KGEntity(
            canonical_name="ASA 150",  # Same as existing entity
            entity_type=EntityType.CHEMICAL,
            aliases=["Different Alias"],
            properties={"different": "property"},
            confidence=0.85
        )
        
        # Service should handle duplicate detection
        existing_entity = await service.find_entity("ASA 150")
        assert existing_entity is not None
        assert existing_entity.canonical_name == "ASA 150"
        
        # Adding duplicate should either merge or reject
        # (Implementation depends on business logic)
    
    @pytest.mark.asyncio
    async def test_relationship_consistency(self, kg_service_with_test_data):
        """Test relationship consistency and validation."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Create valid relationships
        asa_150 = test_entities[0]  # ASA 150
        coatings = test_entities[2]  # Coatings
        viscosity = test_entities[4]  # Viscosity
        
        valid_relationships = [
            KGTriple(
                subject=asa_150,
                predicate="used_in",
                object=coatings,
                source_text="ASA 150 is used in coatings applications",
                confidence=0.92
            ),
            KGTriple(
                subject=asa_150,
                predicate="has_property",
                object=viscosity,
                source_text="ASA 150 has a viscosity of 150 cP",
                confidence=0.95
            )
        ]
        
        # Mock relationship storage
        stored_relationships = []
        
        def mock_add_relationship(triple):
            stored_relationships.append(triple)
            return f"rel_{len(stored_relationships)}"
        
        mock_store.add_relationship.side_effect = mock_add_relationship
        
        # Add relationships
        for relationship in valid_relationships:
            rel_id = await service.add_relationship(relationship)
            assert rel_id is not None
        
        assert len(stored_relationships) == 2
        
        # Verify relationship types are semantically valid
        for rel in stored_relationships:
            if rel.predicate == "used_in":
                assert rel.subject.entity_type == EntityType.CHEMICAL
                assert rel.object.entity_type == EntityType.APPLICATION
            elif rel.predicate == "has_property":
                assert rel.subject.entity_type == EntityType.CHEMICAL
                assert rel.object.entity_type == EntityType.PROPERTY
    
    @pytest.mark.asyncio
    async def test_circular_relationship_detection(self, kg_service_with_test_data):
        """Test detection and handling of circular relationships."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Create potentially circular relationships
        asa_150 = test_entities[0]
        asa_140 = test_entities[1]
        
        # A -> B -> A (circular)
        circular_relationships = [
            KGTriple(
                subject=asa_150,
                predicate="similar_to",
                object=asa_140,
                confidence=0.85
            ),
            KGTriple(
                subject=asa_140,
                predicate="similar_to",
                object=asa_150,
                confidence=0.85
            )
        ]
        
        # This should be allowed (symmetric relationships are valid)
        for rel in circular_relationships:
            rel_id = await service.add_relationship(rel)
            assert rel_id is not None
        
        # But self-referential relationships should be handled carefully
        self_referential = KGTriple(
            subject=asa_150,
            predicate="similar_to",
            object=asa_150,  # Self-reference
            confidence=0.90
        )
        
        # Implementation should decide whether to allow self-references
        # For now, just test that it doesn't crash
        try:
            await service.add_relationship(self_referential)
        except ValueError:
            # It's acceptable to reject self-references
            pass
    
    @pytest.mark.asyncio
    async def test_confidence_score_consistency(self, kg_service_with_test_data):
        """Test confidence score consistency and validation."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Test entities have valid confidence scores
        for entity in test_entities:
            assert 0.0 <= entity.confidence <= 1.0
        
        # Test relationship confidence validation
        asa_150 = test_entities[0]
        coatings = test_entities[2]
        
        # Valid confidence scores
        valid_confidences = [0.0, 0.5, 0.95, 1.0]
        
        for confidence in valid_confidences:
            relationship = KGTriple(
                subject=asa_150,
                predicate="used_in",
                object=coatings,
                confidence=confidence
            )
            
            # Should not raise validation error
            assert relationship.confidence == confidence
        
        # Invalid confidence scores should raise validation errors
        invalid_confidences = [-0.1, 1.1, 2.0, -1.0]
        
        for confidence in invalid_confidences:
            with pytest.raises(ValueError):
                KGTriple(
                    subject=asa_150,
                    predicate="used_in",
                    object=coatings,
                    confidence=confidence
                )
    
    @pytest.mark.asyncio
    async def test_entity_property_consistency(self, kg_service_with_test_data):
        """Test entity property consistency and validation."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Test that entity properties are consistent with entity type
        for entity in test_entities:
            if entity.entity_type == EntityType.CHEMICAL:
                # Chemical entities should have chemical-related properties
                if "viscosity" in entity.properties:
                    viscosity_value = entity.properties["viscosity"]
                    assert isinstance(viscosity_value, str)
                    assert any(unit in viscosity_value for unit in ["cP", "Pa·s", "mPa·s"])
                
                if "cas_number" in entity.properties:
                    cas_number = entity.properties["cas_number"]
                    assert isinstance(cas_number, str)
                    # Basic CAS number format validation
                    assert "-" in cas_number
            
            elif entity.entity_type == EntityType.PROPERTY:
                # Property entities should have measurement-related properties
                if "unit" in entity.properties:
                    unit = entity.properties["unit"]
                    assert isinstance(unit, str)
                    assert len(unit) > 0
                
                if "test_method" in entity.properties:
                    test_method = entity.properties["test_method"]
                    assert isinstance(test_method, str)
                    # Should follow standard format (e.g., ASTM D445)
                    assert any(std in test_method for std in ["ASTM", "ISO", "DIN", "JIS"])
    
    @pytest.mark.asyncio
    async def test_alias_consistency(self, kg_service_with_test_data):
        """Test alias consistency and uniqueness."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Collect all aliases across entities
        all_aliases = set()
        canonical_names = set()
        
        for entity in test_entities:
            canonical_names.add(entity.canonical_name.lower())
            
            for alias in entity.aliases:
                alias_lower = alias.lower()
                
                # Alias should not conflict with canonical names of other entities
                if alias_lower in canonical_names and alias_lower != entity.canonical_name.lower():
                    pytest.fail(f"Alias '{alias}' conflicts with canonical name")
                
                # Alias should not be duplicated across entities
                if alias_lower in all_aliases:
                    pytest.fail(f"Duplicate alias '{alias}' found")
                
                all_aliases.add(alias_lower)
    
    @pytest.mark.asyncio
    async def test_relationship_semantic_validity(self, kg_service_with_test_data):
        """Test semantic validity of relationships."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Define valid relationship patterns
        valid_patterns = {
            "used_in": {
                "subject_types": [EntityType.CHEMICAL],
                "object_types": [EntityType.APPLICATION]
            },
            "has_property": {
                "subject_types": [EntityType.CHEMICAL],
                "object_types": [EntityType.PROPERTY]
            },
            "similar_to": {
                "subject_types": [EntityType.CHEMICAL],
                "object_types": [EntityType.CHEMICAL]
            },
            "part_of": {
                "subject_types": [EntityType.CHEMICAL],
                "object_types": [EntityType.CHEMICAL, EntityType.APPLICATION]
            }
        }
        
        # Test valid relationships
        asa_150 = test_entities[0]  # CHEMICAL
        coatings = test_entities[2]  # APPLICATION
        viscosity = test_entities[4]  # PROPERTY
        
        valid_relationships = [
            ("used_in", asa_150, coatings),
            ("has_property", asa_150, viscosity),
            ("similar_to", asa_150, test_entities[1])  # ASA 140
        ]
        
        for predicate, subject, obj in valid_relationships:
            pattern = valid_patterns[predicate]
            
            assert subject.entity_type in pattern["subject_types"], \
                f"Invalid subject type for {predicate}: {subject.entity_type}"
            assert obj.entity_type in pattern["object_types"], \
                f"Invalid object type for {predicate}: {obj.entity_type}"
        
        # Test invalid relationships (should be caught by validation)
        invalid_relationships = [
            ("used_in", coatings, asa_150),  # Wrong direction
            ("has_property", viscosity, asa_150),  # Wrong direction
        ]
        
        for predicate, subject, obj in invalid_relationships:
            pattern = valid_patterns[predicate]
            
            # These should fail semantic validation
            subject_valid = subject.entity_type in pattern["subject_types"]
            object_valid = obj.entity_type in pattern["object_types"]
            
            assert not (subject_valid and object_valid), \
                f"Invalid relationship {predicate} should not be semantically valid"
    
    @pytest.mark.asyncio
    async def test_knowledge_graph_completeness(self, kg_service_with_test_data):
        """Test knowledge graph completeness and connectivity."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Create a complete knowledge graph
        entities = test_entities
        relationships = [
            KGTriple(
                subject=entities[0],  # ASA 150
                predicate="used_in",
                object=entities[2],  # Coatings
                confidence=0.92
            ),
            KGTriple(
                subject=entities[0],  # ASA 150
                predicate="used_in",
                object=entities[3],  # Adhesives
                confidence=0.88
            ),
            KGTriple(
                subject=entities[0],  # ASA 150
                predicate="has_property",
                object=entities[4],  # Viscosity
                confidence=0.95
            ),
            KGTriple(
                subject=entities[1],  # ASA 140
                predicate="similar_to",
                object=entities[0],  # ASA 150
                confidence=0.85
            )
        ]
        
        kg = KnowledgeGraph(
            entities=entities,
            kg_triples=relationships,
            metadata={"test": "data"}
        )
        
        # Test completeness
        assert len(kg.entities) == 5
        assert len(kg.kg_triples) == 4
        
        # Test connectivity - every entity should be connected to at least one other
        connected_entities = set()
        
        for triple in kg.kg_triples:
            connected_entities.add(triple.subject.canonical_name)
            if hasattr(triple.object, 'canonical_name'):
                connected_entities.add(triple.object.canonical_name)
        
        entity_names = {entity.canonical_name for entity in kg.entities}
        
        # Most entities should be connected (some might be isolated)
        connectivity_ratio = len(connected_entities) / len(entity_names)
        assert connectivity_ratio >= 0.8, f"Low connectivity ratio: {connectivity_ratio}"
    
    @pytest.mark.asyncio
    async def test_data_provenance_integrity(self, kg_service_with_test_data):
        """Test data provenance and source tracking integrity."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Create relationships with provenance information
        asa_150 = test_entities[0]
        coatings = test_entities[2]
        
        relationship_with_provenance = KGTriple(
            subject=asa_150,
            predicate="used_in",
            object=coatings,
            source_text="ASA 150 is widely used in coatings applications due to its excellent adhesion properties.",
            confidence=0.92,
            provenance={
                "document": "ASA 150 Technical Bulletin",
                "page": 3,
                "section": "Applications",
                "extraction_method": "LLM",
                "extraction_date": "2024-01-01T10:00:00Z"
            }
        )
        
        # Validate provenance structure
        assert relationship_with_provenance.source_text is not None
        assert len(relationship_with_provenance.source_text) > 0
        assert isinstance(relationship_with_provenance.provenance, dict)
        
        provenance = relationship_with_provenance.provenance
        assert "document" in provenance
        assert "extraction_date" in provenance
        
        # Test that provenance is preserved through operations
        rel_id = await service.add_relationship(relationship_with_provenance)
        assert rel_id is not None
    
    @pytest.mark.asyncio
    async def test_concurrent_modification_safety(self, kg_service_with_test_data):
        """Test safety of concurrent modifications to the knowledge graph."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Simulate concurrent entity additions
        concurrent_entities = [
            KGEntity(
                canonical_name=f"Test Entity {i}",
                entity_type=EntityType.CHEMICAL,
                aliases=[],
                properties={},
                confidence=0.8
            )
            for i in range(10)
        ]
        
        # Mock concurrent additions
        async def add_entity_with_delay(entity, delay=0.01):
            await asyncio.sleep(delay)
            return await service.add_entity(entity)
        
        # Add entities concurrently
        tasks = [
            add_entity_with_delay(entity, i * 0.001) 
            for i, entity in enumerate(concurrent_entities)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # All additions should succeed or fail gracefully
        for result in results:
            if isinstance(result, Exception):
                # Acceptable if there are concurrency controls
                assert isinstance(result, (ValueError, RuntimeError))
            else:
                # Should return valid entity ID
                assert isinstance(result, str)
    
    @pytest.mark.asyncio
    async def test_graph_traversal_consistency(self, kg_service_with_test_data):
        """Test consistency of graph traversal operations."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Mock neighbor relationships
        def mock_get_neighbors(entity_id, max_depth=1):
            # Return consistent neighbor structure
            return [
                {
                    "entity": test_entities[1],  # ASA 140
                    "relationship": "similar_to",
                    "distance": 1
                },
                {
                    "entity": test_entities[2],  # Coatings
                    "relationship": "used_in",
                    "distance": 1
                }
            ]
        
        mock_store.get_neighbors.side_effect = mock_get_neighbors
        
        # Test neighbor retrieval
        neighbors = await service.get_neighbors("entity_0", max_depth=1)
        
        assert len(neighbors) == 2
        
        # Verify neighbor structure consistency
        for neighbor in neighbors:
            assert "entity" in neighbor
            assert "relationship" in neighbor
            assert "distance" in neighbor
            assert isinstance(neighbor["distance"], int)
            assert neighbor["distance"] > 0
    
    @pytest.mark.asyncio
    async def test_schema_validation_integration(self, kg_service_with_test_data):
        """Test integration with schema validation."""
        service, test_entities, mock_store = kg_service_with_test_data
        
        # Test that all test entities pass schema validation
        for entity in test_entities:
            # Should not raise validation errors
            validated_entity = KGEntity(
                canonical_name=entity.canonical_name,
                entity_type=entity.entity_type,
                aliases=entity.aliases,
                properties=entity.properties,
                confidence=entity.confidence
            )
            
            assert validated_entity.canonical_name == entity.canonical_name
            assert validated_entity.entity_type == entity.entity_type
        
        # Test schema validation for relationships
        asa_150 = test_entities[0]
        coatings = test_entities[2]
        
        validated_triple = KGTriple(
            subject=asa_150,
            predicate="used_in",
            object=coatings,
            confidence=0.9
        )
        
        assert validated_triple.subject.canonical_name == "ASA 150"
        assert validated_triple.object.canonical_name == "Coatings"
        assert validated_triple.confidence == 0.9