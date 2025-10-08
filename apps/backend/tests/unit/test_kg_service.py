"""Unit tests for knowledge graph service."""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from typing import List, Dict, Any

from dc_agent.kg.service import KnowledgeGraphService
from dc_agent.kg.base import KnowledgeGraphStore
from dc_agent.models.kg_models import KGEntity, KGTriple, EntityType


class MockKGStore(KnowledgeGraphStore):
    """Mock knowledge graph store for testing."""
    
    def __init__(self):
        self.entities = {}
        self.relationships = []
    
    async def add_entity(self, entity: KGEntity) -> str:
        """Mock add entity."""
        entity_id = f"entity_{len(self.entities)}"
        self.entities[entity_id] = entity
        return entity_id
    
    async def add_relationship(self, triple: KGTriple) -> str:
        """Mock add relationship."""
        rel_id = f"rel_{len(self.relationships)}"
        self.relationships.append(triple)
        return rel_id
    
    async def find_entity(self, name: str, entity_type: EntityType = None) -> KGEntity:
        """Mock find entity."""
        for entity in self.entities.values():
            if entity.canonical_name.lower() == name.lower():
                if entity_type is None or entity.entity_type == entity_type:
                    return entity
        return None
    
    async def get_neighbors(self, entity_id: str, max_depth: int = 1) -> List[Dict[str, Any]]:
        """Mock get neighbors."""
        return [
            {
                "entity": KGEntity(
                    canonical_name=f"Neighbor {i}",
                    entity_type=EntityType.CHEMICAL,
                    aliases=[],
                    properties={}
                ),
                "relationship": "related_to",
                "distance": 1
            }
            for i in range(min(3, max_depth * 2))
        ]
    
    async def query_by_relationship(self, relationship_type: str, limit: int = 10) -> List[KGTriple]:
        """Mock query by relationship."""
        return [
            triple for triple in self.relationships 
            if triple.predicate == relationship_type
        ][:limit]


@pytest.fixture
def mock_kg_store():
    """Create mock KG store."""
    return MockKGStore()


@pytest.fixture
def kg_service(mock_kg_store):
    """Create KG service with mock store."""
    return KnowledgeGraphService(kg_store=mock_kg_store)


class TestKnowledgeGraphService:
    """Test cases for KnowledgeGraphService."""
    
    @pytest.mark.asyncio
    async def test_add_entity_success(self, kg_service, mock_kg_store):
        """Test successful entity addition."""
        entity = KGEntity(
            canonical_name="ASA 150",
            entity_type=EntityType.CHEMICAL,
            aliases=["Alkenyl Succinic Anhydride 150"],
            properties={"viscosity": "150 cP", "family": "ASA"}
        )
        
        entity_id = await kg_service.add_entity(entity)
        
        assert entity_id.startswith("entity_")
        assert entity_id in mock_kg_store.entities
        assert mock_kg_store.entities[entity_id].canonical_name == "ASA 150"
    
    @pytest.mark.asyncio
    async def test_add_relationship_success(self, kg_service, mock_kg_store):
        """Test successful relationship addition."""
        # Add entities first
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
        
        subject_id = await kg_service.add_entity(subject)
        object_id = await kg_service.add_entity(object_entity)
        
        triple = KGTriple(
            subject=subject,
            predicate="used_in",
            object=object_entity,
            confidence=0.9
        )
        
        rel_id = await kg_service.add_relationship(triple)
        
        assert rel_id.startswith("rel_")
        assert len(mock_kg_store.relationships) == 1
        assert mock_kg_store.relationships[0].predicate == "used_in"
    
    @pytest.mark.asyncio
    async def test_find_entity_by_name(self, kg_service, mock_kg_store):
        """Test finding entity by name."""
        entity = KGEntity(
            canonical_name="DCA 467",
            entity_type=EntityType.CHEMICAL,
            aliases=["Dicyandiamide 467"],
            properties={}
        )
        
        await kg_service.add_entity(entity)
        
        found_entity = await kg_service.find_entity("DCA 467")
        
        assert found_entity is not None
        assert found_entity.canonical_name == "DCA 467"
        assert found_entity.entity_type == EntityType.CHEMICAL
    
    @pytest.mark.asyncio
    async def test_find_entity_case_insensitive(self, kg_service, mock_kg_store):
        """Test finding entity with case insensitive search."""
        entity = KGEntity(
            canonical_name="ASA 140",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={}
        )
        
        await kg_service.add_entity(entity)
        
        found_entity = await kg_service.find_entity("asa 140")
        
        assert found_entity is not None
        assert found_entity.canonical_name == "ASA 140"
    
    @pytest.mark.asyncio
    async def test_find_entity_not_found(self, kg_service):
        """Test finding non-existent entity."""
        found_entity = await kg_service.find_entity("NonExistent Product")
        
        assert found_entity is None
    
    @pytest.mark.asyncio
    async def test_get_neighbors_success(self, kg_service, mock_kg_store):
        """Test getting entity neighbors."""
        entity = KGEntity(
            canonical_name="ASA 150",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={}
        )
        
        entity_id = await kg_service.add_entity(entity)
        neighbors = await kg_service.get_neighbors(entity_id, max_depth=2)
        
        assert len(neighbors) == 4  # max_depth * 2 from mock
        assert all("entity" in neighbor for neighbor in neighbors)
        assert all("relationship" in neighbor for neighbor in neighbors)
        assert all("distance" in neighbor for neighbor in neighbors)
    
    @pytest.mark.asyncio
    async def test_query_by_relationship_type(self, kg_service, mock_kg_store):
        """Test querying by relationship type."""
        # Add some relationships
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
        
        triple1 = KGTriple(
            subject=subject,
            predicate="used_in",
            object=object_entity,
            confidence=0.9
        )
        triple2 = KGTriple(
            subject=subject,
            predicate="similar_to",
            object=object_entity,
            confidence=0.8
        )
        
        await kg_service.add_relationship(triple1)
        await kg_service.add_relationship(triple2)
        
        used_in_relations = await kg_service.query_by_relationship("used_in")
        
        assert len(used_in_relations) == 1
        assert used_in_relations[0].predicate == "used_in"
    
    @pytest.mark.asyncio
    async def test_find_related_entities(self, kg_service, mock_kg_store):
        """Test finding related entities."""
        entity = KGEntity(
            canonical_name="ASA 150",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={}
        )
        
        entity_id = await kg_service.add_entity(entity)
        related = await kg_service.find_related_entities("ASA 150", max_depth=2)
        
        assert len(related) > 0
        assert all("entity" in item for item in related)
    
    @pytest.mark.asyncio
    async def test_entity_type_filtering(self, kg_service, mock_kg_store):
        """Test finding entity with type filtering."""
        chemical_entity = KGEntity(
            canonical_name="Test Chemical",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={}
        )
        application_entity = KGEntity(
            canonical_name="Test Chemical",  # Same name, different type
            entity_type=EntityType.APPLICATION,
            aliases=[],
            properties={}
        )
        
        await kg_service.add_entity(chemical_entity)
        await kg_service.add_entity(application_entity)
        
        found_chemical = await kg_service.find_entity("Test Chemical", EntityType.CHEMICAL)
        found_application = await kg_service.find_entity("Test Chemical", EntityType.APPLICATION)
        
        assert found_chemical.entity_type == EntityType.CHEMICAL
        assert found_application.entity_type == EntityType.APPLICATION


@pytest.mark.integration
class TestKnowledgeGraphServiceIntegration:
    """Integration tests for KnowledgeGraphService with real Neo4j."""
    
    @pytest.mark.asyncio
    async def test_neo4j_integration(self):
        """Test integration with Neo4j (requires running Neo4j)."""
        pytest.skip("Integration test requires running Neo4j instance")
    
    @pytest.mark.asyncio
    async def test_graphiti_integration(self):
        """Test integration with Graphiti."""
        pytest.skip("Integration test requires Graphiti setup")