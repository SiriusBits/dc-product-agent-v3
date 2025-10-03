"""Abstract base classes for knowledge graph operations."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from ..models.kg_models import KGEntity, KGTriple, KnowledgeGraph


@dataclass
class GraphTraversalResult:
    """Result from graph traversal operations."""
    
    central_entity: KGEntity
    related_entities: List[KGEntity]
    relationships: List[KGTriple]
    traversal_depth: int
    total_paths: int


@dataclass
class GraphStatistics:
    """Knowledge graph statistics."""
    
    total_entities: int
    total_relationships: int
    entity_types: Dict[str, int]
    relationship_types: Dict[str, int]
    avg_degree: float
    connected_components: int
    density: float


class KnowledgeGraphStore(ABC):
    """Abstract base class for knowledge graph database implementations."""
    
    @abstractmethod
    async def connect(self) -> bool:
        """Connect to the knowledge graph database.
        
        Returns:
            True if connection successful
        """
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Disconnect from the knowledge graph database."""
        pass
    
    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Check knowledge graph database health.
        
        Returns:
            Health status information
        """
        pass
    
    @abstractmethod
    async def create_entity(self, entity: KGEntity) -> bool:
        """Create a new entity in the knowledge graph.
        
        Args:
            entity: Entity to create
            
        Returns:
            True if created successfully
        """
        pass
    
    @abstractmethod
    async def update_entity(self, entity: KGEntity) -> bool:
        """Update an existing entity in the knowledge graph.
        
        Args:
            entity: Entity to update
            
        Returns:
            True if updated successfully
        """
        pass
    
    @abstractmethod
    async def delete_entity(self, entity_id: str) -> bool:
        """Delete an entity from the knowledge graph.
        
        Args:
            entity_id: ID of entity to delete
            
        Returns:
            True if deleted successfully
        """
        pass
    
    @abstractmethod
    async def get_entity(self, entity_id: str) -> Optional[KGEntity]:
        """Get an entity by ID.
        
        Args:
            entity_id: Entity ID
            
        Returns:
            Entity if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def find_entities(
        self,
        text: Optional[str] = None,
        entity_type: Optional[str] = None,
        canonical_name: Optional[str] = None,
        limit: int = 100
    ) -> List[KGEntity]:
        """Find entities by various criteria.
        
        Args:
            text: Entity text to search for
            entity_type: Entity type filter
            canonical_name: Canonical name filter
            limit: Maximum number of results
            
        Returns:
            List of matching entities
        """
        pass
    
    @abstractmethod
    async def create_relationship(self, triple: KGTriple) -> bool:
        """Create a relationship between entities.
        
        Args:
            triple: Triple representing the relationship
            
        Returns:
            True if created successfully
        """
        pass
    
    @abstractmethod
    async def delete_relationship(
        self,
        subject_id: str,
        predicate: str,
        object_id: str
    ) -> bool:
        """Delete a relationship between entities.
        
        Args:
            subject_id: Subject entity ID
            predicate: Relationship type
            object_id: Object entity ID
            
        Returns:
            True if deleted successfully
        """
        pass
    
    @abstractmethod
    async def get_entity_relationships(
        self,
        entity_id: str,
        relationship_types: Optional[List[str]] = None,
        direction: str = "both"  # "in", "out", "both"
    ) -> List[KGTriple]:
        """Get all relationships for an entity.
        
        Args:
            entity_id: Entity ID
            relationship_types: Filter by relationship types
            direction: Direction of relationships to include
            
        Returns:
            List of relationships
        """
        pass
    
    @abstractmethod
    async def traverse_graph(
        self,
        start_entity_id: str,
        max_depth: int = 2,
        relationship_types: Optional[List[str]] = None,
        entity_types: Optional[List[str]] = None,
        limit: int = 100
    ) -> GraphTraversalResult:
        """Traverse the graph from a starting entity.
        
        Args:
            start_entity_id: Starting entity ID
            max_depth: Maximum traversal depth
            relationship_types: Filter by relationship types
            entity_types: Filter by entity types
            limit: Maximum number of entities to return
            
        Returns:
            Graph traversal results
        """
        pass
    
    @abstractmethod
    async def find_shortest_path(
        self,
        start_entity_id: str,
        end_entity_id: str,
        max_depth: int = 5,
        relationship_types: Optional[List[str]] = None
    ) -> Optional[List[KGTriple]]:
        """Find shortest path between two entities.
        
        Args:
            start_entity_id: Starting entity ID
            end_entity_id: Target entity ID
            max_depth: Maximum path length
            relationship_types: Allowed relationship types
            
        Returns:
            List of relationships forming the path, or None if no path found
        """
        pass
    
    @abstractmethod
    async def get_similar_entities(
        self,
        entity_id: str,
        similarity_threshold: float = 0.7,
        limit: int = 10
    ) -> List[Tuple[KGEntity, float]]:
        """Find entities similar to the given entity.
        
        Args:
            entity_id: Reference entity ID
            similarity_threshold: Minimum similarity score
            limit: Maximum number of results
            
        Returns:
            List of (entity, similarity_score) tuples
        """
        pass
    
    @abstractmethod
    async def batch_create_entities(self, entities: List[KGEntity]) -> Dict[str, bool]:
        """Create multiple entities in batch.
        
        Args:
            entities: List of entities to create
            
        Returns:
            Dictionary mapping entity IDs to success status
        """
        pass
    
    @abstractmethod
    async def batch_create_relationships(self, triples: List[KGTriple]) -> Dict[str, bool]:
        """Create multiple relationships in batch.
        
        Args:
            triples: List of triples to create
            
        Returns:
            Dictionary mapping relationship identifiers to success status
        """
        pass
    
    @abstractmethod
    async def ingest_knowledge_graph(self, kg: KnowledgeGraph) -> Dict[str, Any]:
        """Ingest a complete knowledge graph.
        
        Args:
            kg: Knowledge graph to ingest
            
        Returns:
            Ingestion results
        """
        pass
    
    @abstractmethod
    async def export_subgraph(
        self,
        entity_ids: List[str],
        include_relationships: bool = True
    ) -> KnowledgeGraph:
        """Export a subgraph containing specified entities.
        
        Args:
            entity_ids: List of entity IDs to include
            include_relationships: Whether to include relationships
            
        Returns:
            Knowledge graph containing the subgraph
        """
        pass
    
    @abstractmethod
    async def get_statistics(self) -> GraphStatistics:
        """Get knowledge graph statistics.
        
        Returns:
            Graph statistics
        """
        pass
    
    @abstractmethod
    async def clear_graph(self) -> bool:
        """Clear all data from the knowledge graph.
        
        Returns:
            True if cleared successfully
        """
        pass
    
    @abstractmethod
    async def execute_cypher_query(
        self,
        query: str,
        parameters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Execute a raw Cypher query (Neo4j specific).
        
        Args:
            query: Cypher query string
            parameters: Query parameters
            
        Returns:
            Query results
        """
        pass