"""Integration tests for database operations."""

import pytest
import asyncio
from typing import List, Dict, Any
from unittest.mock import Mock, patch
import os

from dc_agent.vector.chroma_store import ChromaVectorStore
from dc_agent.kg.neo4j_store import Neo4jKnowledgeGraphStore
from dc_agent.models.kg_models import KGEntity, KGTriple, EntityType
from dc_agent.models.api_models import SearchResult


@pytest.mark.integration
class TestChromaVectorStoreIntegration:
    """Integration tests for ChromaDB operations."""
    
    @pytest.fixture
    async def chroma_store(self):
        """Create ChromaDB store for testing."""
        # Skip if ChromaDB is not available
        try:
            import chromadb
            from chromadb.config import Settings
        except ImportError:
            pytest.skip("ChromaDB not available")
        
        # Use in-memory database for testing
        settings = Settings(
            chroma_db_impl="duckdb+parquet",
            persist_directory=None,  # In-memory
            anonymized_telemetry=False
        )
        
        store = ChromaVectorStore(client_settings=settings.__dict__)
        yield store
        
        # Cleanup
        try:
            await store.delete_collection("test_collection")
        except:
            pass
    
    @pytest.mark.asyncio
    async def test_add_and_search_documents(self, chroma_store):
        """Test adding documents and searching."""
        documents = [
            {
                "content": "ASA 150 is a high viscosity alkenyl succinic anhydride with excellent adhesion properties.",
                "metadata": {
                    "doc_id": "asa-150-spec",
                    "product": "ASA 150",
                    "section": "overview"
                }
            },
            {
                "content": "DCA 467 is a fast-curing dicyandiamide suitable for epoxy applications.",
                "metadata": {
                    "doc_id": "dca-467-spec",
                    "product": "DCA 467",
                    "section": "overview"
                }
            }
        ]
        
        # Add documents
        await chroma_store.add_documents(documents, "test_collection")
        
        # Search for ASA-related content
        results = await chroma_store.similarity_search(
            "high viscosity adhesion",
            k=5,
            collection_name="test_collection"
        )
        
        assert len(results) > 0
        assert any("ASA 150" in result.content for result in results)
        assert all(isinstance(result, SearchResult) for result in results)
        assert all(result.score >= 0 for result in results)
    
    @pytest.mark.asyncio
    async def test_search_with_filters(self, chroma_store):
        """Test searching with metadata filters."""
        documents = [
            {
                "content": "ASA 150 viscosity data",
                "metadata": {"product": "ASA 150", "section": "properties"}
            },
            {
                "content": "ASA 150 application data",
                "metadata": {"product": "ASA 150", "section": "applications"}
            },
            {
                "content": "DCA 467 properties",
                "metadata": {"product": "DCA 467", "section": "properties"}
            }
        ]
        
        await chroma_store.add_documents(documents, "test_collection")
        
        # Search with product filter
        results = await chroma_store.similarity_search(
            "properties",
            k=10,
            collection_name="test_collection",
            filter_dict={"product": "ASA 150"}
        )
        
        assert len(results) > 0
        assert all("ASA 150" in result.metadata.get("product", "") for result in results)
    
    @pytest.mark.asyncio
    async def test_collection_management(self, chroma_store):
        """Test collection creation and deletion."""
        # Create collection with documents
        documents = [{"content": "test content", "metadata": {"id": "1"}}]
        await chroma_store.add_documents(documents, "temp_collection")
        
        # List collections
        collections = await chroma_store.list_collections()
        assert "temp_collection" in collections
        
        # Delete collection
        await chroma_store.delete_collection("temp_collection")
        
        # Verify deletion
        collections_after = await chroma_store.list_collections()
        assert "temp_collection" not in collections_after
    
    @pytest.mark.asyncio
    async def test_empty_search(self, chroma_store):
        """Test search on empty collection."""
        results = await chroma_store.similarity_search(
            "test query",
            k=5,
            collection_name="empty_collection"
        )
        
        assert len(results) == 0
    
    @pytest.mark.asyncio
    async def test_large_document_batch(self, chroma_store):
        """Test adding large batch of documents."""
        # Create 100 test documents
        documents = [
            {
                "content": f"Test document {i} with content about chemical properties",
                "metadata": {"doc_id": f"doc_{i}", "batch": "large_test"}
            }
            for i in range(100)
        ]
        
        await chroma_store.add_documents(documents, "large_collection")
        
        # Search should work with large collection
        results = await chroma_store.similarity_search(
            "chemical properties",
            k=10,
            collection_name="large_collection"
        )
        
        assert len(results) == 10
        assert all(result.score > 0 for result in results)


@pytest.mark.integration
class TestNeo4jKnowledgeGraphIntegration:
    """Integration tests for Neo4j operations."""
    
    @pytest.fixture
    async def neo4j_store(self):
        """Create Neo4j store for testing."""
        # Skip if Neo4j is not available
        neo4j_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        neo4j_user = os.getenv("NEO4J_USER", "neo4j")
        neo4j_password = os.getenv("NEO4J_PASSWORD", "password")
        
        try:
            store = Neo4jKnowledgeGraphStore(neo4j_uri, neo4j_user, neo4j_password)
            # Test connection
            await store._test_connection()
            yield store
        except Exception as e:
            pytest.skip(f"Neo4j not available: {e}")
        finally:
            # Cleanup test data
            try:
                await store._cleanup_test_data()
            except:
                pass
    
    @pytest.mark.asyncio
    async def test_add_and_find_entity(self, neo4j_store):
        """Test adding and finding entities."""
        entity = KGEntity(
            canonical_name="ASA 150 Test",
            entity_type=EntityType.CHEMICAL,
            aliases=["ASA-150-Test", "Test ASA 150"],
            properties={
                "viscosity": "150 cP",
                "family": "ASA",
                "test_entity": True
            }
        )
        
        # Add entity
        entity_id = await neo4j_store.add_entity(entity)
        assert entity_id is not None
        
        # Find entity by name
        found_entity = await neo4j_store.find_entity("ASA 150 Test")
        assert found_entity is not None
        assert found_entity.canonical_name == "ASA 150 Test"
        assert found_entity.entity_type == EntityType.CHEMICAL
        assert "ASA-150-Test" in found_entity.aliases
    
    @pytest.mark.asyncio
    async def test_add_relationship(self, neo4j_store):
        """Test adding relationships between entities."""
        # Create subject entity
        subject = KGEntity(
            canonical_name="Test Chemical A",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={"test_entity": True}
        )
        
        # Create object entity
        obj = KGEntity(
            canonical_name="Test Application A",
            entity_type=EntityType.APPLICATION,
            aliases=[],
            properties={"test_entity": True}
        )
        
        # Add entities
        subject_id = await neo4j_store.add_entity(subject)
        obj_id = await neo4j_store.add_entity(obj)
        
        # Create relationship
        triple = KGTriple(
            subject=subject,
            predicate="used_in",
            object=obj,
            confidence=0.9,
            source_text="Test Chemical A is used in Test Application A"
        )
        
        # Add relationship
        rel_id = await neo4j_store.add_relationship(triple)
        assert rel_id is not None
        
        # Verify relationship exists
        neighbors = await neo4j_store.get_neighbors(subject_id, max_depth=1)
        assert len(neighbors) > 0
        assert any(
            neighbor["entity"].canonical_name == "Test Application A"
            for neighbor in neighbors
        )
    
    @pytest.mark.asyncio
    async def test_query_by_relationship_type(self, neo4j_store):
        """Test querying relationships by type."""
        # Create entities and relationships
        chemical = KGEntity(
            canonical_name="Test Chemical B",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={"test_entity": True}
        )
        
        application = KGEntity(
            canonical_name="Test Application B",
            entity_type=EntityType.APPLICATION,
            aliases=[],
            properties={"test_entity": True}
        )
        
        await neo4j_store.add_entity(chemical)
        await neo4j_store.add_entity(application)
        
        triple = KGTriple(
            subject=chemical,
            predicate="suitable_for",
            object=application,
            confidence=0.85
        )
        
        await neo4j_store.add_relationship(triple)
        
        # Query by relationship type
        relationships = await neo4j_store.query_by_relationship("suitable_for", limit=10)
        
        assert len(relationships) > 0
        assert any(
            rel.predicate == "suitable_for" and
            rel.subject.canonical_name == "Test Chemical B"
            for rel in relationships
        )
    
    @pytest.mark.asyncio
    async def test_multi_hop_neighbors(self, neo4j_store):
        """Test multi-hop neighbor traversal."""
        # Create chain: A -> B -> C
        entity_a = KGEntity(
            canonical_name="Test Entity A",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={"test_entity": True}
        )
        
        entity_b = KGEntity(
            canonical_name="Test Entity B",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={"test_entity": True}
        )
        
        entity_c = KGEntity(
            canonical_name="Test Entity C",
            entity_type=EntityType.APPLICATION,
            aliases=[],
            properties={"test_entity": True}
        )
        
        # Add entities
        id_a = await neo4j_store.add_entity(entity_a)
        id_b = await neo4j_store.add_entity(entity_b)
        id_c = await neo4j_store.add_entity(entity_c)
        
        # Add relationships A -> B -> C
        triple_ab = KGTriple(
            subject=entity_a,
            predicate="similar_to",
            object=entity_b,
            confidence=0.8
        )
        
        triple_bc = KGTriple(
            subject=entity_b,
            predicate="used_in",
            object=entity_c,
            confidence=0.9
        )
        
        await neo4j_store.add_relationship(triple_ab)
        await neo4j_store.add_relationship(triple_bc)
        
        # Test 1-hop neighbors
        neighbors_1 = await neo4j_store.get_neighbors(id_a, max_depth=1)
        neighbor_names_1 = [n["entity"].canonical_name for n in neighbors_1]
        assert "Test Entity B" in neighbor_names_1
        assert "Test Entity C" not in neighbor_names_1
        
        # Test 2-hop neighbors
        neighbors_2 = await neo4j_store.get_neighbors(id_a, max_depth=2)
        neighbor_names_2 = [n["entity"].canonical_name for n in neighbors_2]
        assert "Test Entity B" in neighbor_names_2
        assert "Test Entity C" in neighbor_names_2
    
    @pytest.mark.asyncio
    async def test_entity_type_filtering(self, neo4j_store):
        """Test finding entities with type filtering."""
        # Add entities with same name but different types
        chemical = KGEntity(
            canonical_name="Test Duplicate Name",
            entity_type=EntityType.CHEMICAL,
            aliases=[],
            properties={"test_entity": True, "type": "chemical"}
        )
        
        application = KGEntity(
            canonical_name="Test Duplicate Name",
            entity_type=EntityType.APPLICATION,
            aliases=[],
            properties={"test_entity": True, "type": "application"}
        )
        
        await neo4j_store.add_entity(chemical)
        await neo4j_store.add_entity(application)
        
        # Find with type filtering
        found_chemical = await neo4j_store.find_entity(
            "Test Duplicate Name",
            EntityType.CHEMICAL
        )
        found_application = await neo4j_store.find_entity(
            "Test Duplicate Name",
            EntityType.APPLICATION
        )
        
        assert found_chemical.entity_type == EntityType.CHEMICAL
        assert found_application.entity_type == EntityType.APPLICATION
        assert found_chemical.properties["type"] == "chemical"
        assert found_application.properties["type"] == "application"


@pytest.mark.integration
class TestDatabasePerformance:
    """Performance tests for database operations."""
    
    @pytest.mark.asyncio
    async def test_vector_search_performance(self):
        """Test vector search performance with large dataset."""
        pytest.skip("Performance test requires large dataset and timing")
    
    @pytest.mark.asyncio
    async def test_kg_traversal_performance(self):
        """Test knowledge graph traversal performance."""
        pytest.skip("Performance test requires large graph and timing")
    
    @pytest.mark.asyncio
    async def test_concurrent_operations(self):
        """Test concurrent database operations."""
        pytest.skip("Concurrency test requires careful setup")


@pytest.mark.integration
class TestDatabaseConsistency:
    """Test data consistency across operations."""
    
    @pytest.mark.asyncio
    async def test_transaction_rollback(self):
        """Test transaction rollback on errors."""
        pytest.skip("Transaction test requires specific error scenarios")
    
    @pytest.mark.asyncio
    async def test_data_integrity(self):
        """Test data integrity constraints."""
        pytest.skip("Integrity test requires constraint validation")