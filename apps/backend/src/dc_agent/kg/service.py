"""Knowledge graph service for entity and relationship management."""

import logging
import time
from typing import List, Dict, Any, Optional, Tuple
from uuid import uuid4

from .base import KnowledgeGraphStore, GraphTraversalResult, GraphStatistics
from .neo4j_store import Neo4jKnowledgeGraphStore
from ..models.api_models import RetrievalResult, KGQueryResponse, GraphVisualizationData, GraphNode, GraphEdge, KGRelationship
from ..models.kg_models import KGEntity, KGTriple, KnowledgeGraph, DerivedInfo

logger = logging.getLogger(__name__)


class KnowledgeGraphService:
    """Service for knowledge graph operations."""
    
    def __init__(self, kg_store: Optional[KnowledgeGraphStore] = None):
        """Initialize knowledge graph service.
        
        Args:
            kg_store: Knowledge graph store instance (creates default if None)
        """
        if kg_store is None:
            # Create default Neo4j store from environment
            import os
            self.kg_store = Neo4jKnowledgeGraphStore(
                uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
                username=os.getenv("NEO4J_USERNAME", "neo4j"),
                password=os.getenv("NEO4J_PASSWORD", "password"),
                database=os.getenv("NEO4J_DATABASE", "neo4j")
            )
        else:
            self.kg_store = kg_store
        
        self._initialized = False
    
    async def initialize(self) -> bool:
        """Initialize the knowledge graph service.
        
        Returns:
            True if initialization successful
        """
        try:
            success = await self.kg_store.connect()
            if success:
                self._initialized = True
                logger.info("Knowledge graph service initialized successfully")
            else:
                logger.error("Failed to initialize knowledge graph service")
            return success
        except Exception as e:
            logger.error(f"Failed to initialize knowledge graph service: {e}")
            return False
    
    async def shutdown(self) -> None:
        """Shutdown the knowledge graph service."""
        try:
            await self.kg_store.disconnect()
            self._initialized = False
            logger.info("Knowledge graph service shut down")
        except Exception as e:
            logger.error(f"Error during knowledge graph service shutdown: {e}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check knowledge graph service health.
        
        Returns:
            Health status information
        """
        try:
            store_health = await self.kg_store.health_check()
            
            return {
                "status": store_health.get("status", "unknown"),
                "initialized": self._initialized,
                "store_health": store_health,
                "timestamp": time.time()
            }
        except Exception as e:
            logger.error(f"Knowledge graph health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "initialized": self._initialized,
                "timestamp": time.time()
            }
    
    async def ingest_derived_info(self, derived_info: DerivedInfo) -> Dict[str, Any]:
        """Ingest derived information containing knowledge graph data.
        
        Args:
            derived_info: Derived information with knowledge graph
            
        Returns:
            Ingestion results
        """
        try:
            start_time = time.time()
            
            # Ingest the knowledge graph
            result = await self.kg_store.ingest_knowledge_graph(derived_info.knowledge_graph)
            
            processing_time = time.time() - start_time
            result["processing_time_ms"] = int(processing_time * 1000)
            result["document_id"] = derived_info.doc_id
            
            if result["success"]:
                logger.info(f"Successfully ingested knowledge graph for document {derived_info.doc_id}")
            else:
                logger.error(f"Failed to ingest knowledge graph for document {derived_info.doc_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to ingest derived info for {derived_info.doc_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "document_id": derived_info.doc_id
            }
    
    async def search_entities(
        self,
        query: str,
        entity_types: Optional[List[str]] = None,
        limit: int = 20
    ) -> List[RetrievalResult]:
        """Search for entities in the knowledge graph.
        
        Args:
            query: Search query
            entity_types: Filter by entity types
            limit: Maximum number of results
            
        Returns:
            List of retrieval results
        """
        try:
            # Find entities matching the query
            entities = []
            
            # Search by text
            text_entities = await self.kg_store.find_entities(
                text=query,
                entity_type=entity_types[0] if entity_types and len(entity_types) == 1 else None,
                limit=limit
            )
            entities.extend(text_entities)
            
            # Search by canonical name if different from text
            if query not in [e.canonical_name for e in entities if e.canonical_name]:
                name_entities = await self.kg_store.find_entities(
                    canonical_name=query,
                    entity_type=entity_types[0] if entity_types and len(entity_types) == 1 else None,
                    limit=limit
                )
                entities.extend(name_entities)
            
            # Remove duplicates and filter by entity types
            unique_entities = {}
            for entity in entities:
                if entity.id not in unique_entities:
                    if not entity_types or entity.type in entity_types:
                        unique_entities[entity.id] = entity
            
            # Convert to RetrievalResult format
            results = []
            for entity in list(unique_entities.values())[:limit]:
                content = self._format_entity_content(entity)
                
                result = RetrievalResult(
                    content=content,
                    score=self._calculate_entity_relevance(entity, query),
                    source="kg",
                    metadata={
                        "entity_id": entity.id,
                        "entity_type": entity.type,
                        "canonical_name": entity.canonical_name,
                        "aliases": entity.aliases
                    },
                    provenance={
                        "document_id": entity.provenance.document_id,
                        "page": entity.provenance.page,
                        "source_text": entity.source_text
                    }
                )
                results.append(result)
            
            # Sort by relevance score
            results.sort(key=lambda x: x.score, reverse=True)
            
            logger.info(f"Found {len(results)} entities for query: {query}")
            return results
            
        except Exception as e:
            logger.error(f"Failed to search entities: {e}")
            return []
    
    async def get_entity_neighbors(
        self,
        entity_name: str,
        relationship_types: Optional[List[str]] = None,
        max_depth: int = 2,
        limit: int = 20
    ) -> KGQueryResponse:
        """Get knowledge graph neighbors for an entity.
        
        Args:
            entity_name: Entity name to search for
            relationship_types: Filter by relationship types
            max_depth: Maximum traversal depth
            limit: Maximum number of results
            
        Returns:
            Knowledge graph query response
        """
        try:
            # Find the entity by name
            entities = await self.kg_store.find_entities(text=entity_name, limit=5)
            
            if not entities:
                # Try canonical name search
                entities = await self.kg_store.find_entities(canonical_name=entity_name, limit=5)
            
            if not entities:
                logger.warning(f"Entity not found: {entity_name}")
                return KGQueryResponse(
                    central_entity=KGEntity(
                        id="not_found",
                        text=entity_name,
                        type="UNKNOWN",
                        canonical_name=entity_name,
                        aliases=[],
                        provenance={"document_id": "unknown", "page": None},
                        metadata={}
                    ),
                    related_entities=[],
                    relationships=[],
                    graph_data=GraphVisualizationData()
                )
            
            # Use the first matching entity
            central_entity = entities[0]
            
            # Traverse the graph from this entity
            traversal_result = await self.kg_store.traverse_graph(
                start_entity_id=central_entity.id,
                max_depth=max_depth,
                relationship_types=relationship_types,
                limit=limit
            )
            
            # Convert relationships to API format
            api_relationships = []
            for triple in traversal_result.relationships:
                subject_id = triple.subject if isinstance(triple.subject, str) else triple.subject.id
                object_id = triple.object if isinstance(triple.object, str) else getattr(triple.object, 'id', str(triple.object))
                
                relationship = KGRelationship(
                    id=f"{subject_id}_{triple.predicate}_{object_id}",
                    source_entity_id=subject_id,
                    target_entity_id=object_id,
                    relationship_type=triple.predicate,
                    confidence=triple.confidence or 1.0,
                    source_text=triple.source_text,
                    provenance=triple.provenance.dict()
                )
                api_relationships.append(relationship)
            
            # Create graph visualization data
            graph_data = self._create_graph_visualization(
                central_entity,
                traversal_result.related_entities,
                traversal_result.relationships
            )
            
            response = KGQueryResponse(
                central_entity=central_entity,
                related_entities=traversal_result.related_entities,
                relationships=api_relationships,
                graph_data=graph_data
            )
            
            logger.info(f"Found {len(traversal_result.related_entities)} related entities for {entity_name}")
            return response
            
        except Exception as e:
            logger.error(f"Failed to get entity neighbors for {entity_name}: {e}")
            return KGQueryResponse(
                central_entity=KGEntity(
                    id="error",
                    text=entity_name,
                    type="ERROR",
                    canonical_name=entity_name,
                    aliases=[],
                    provenance={"document_id": "error", "page": None},
                    metadata={"error": str(e)}
                ),
                related_entities=[],
                relationships=[],
                graph_data=GraphVisualizationData()
            )
    
    async def find_related_products(
        self,
        product_name: str,
        relationship_types: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[RetrievalResult]:
        """Find products related to the given product.
        
        Args:
            product_name: Product name to find relations for
            relationship_types: Types of relationships to consider
            limit: Maximum number of results
            
        Returns:
            List of related products as retrieval results
        """
        try:
            # Find the product entity
            entities = await self.kg_store.find_entities(
                text=product_name,
                entity_type="PRODUCT",
                limit=5
            )
            
            if not entities:
                logger.warning(f"Product not found: {product_name}")
                return []
            
            product_entity = entities[0]
            
            # Get related entities
            traversal_result = await self.kg_store.traverse_graph(
                start_entity_id=product_entity.id,
                max_depth=2,
                relationship_types=relationship_types,
                entity_types=["PRODUCT"],
                limit=limit
            )
            
            # Convert related products to retrieval results
            results = []
            for entity in traversal_result.related_entities:
                if entity.type == "PRODUCT" and entity.id != product_entity.id:
                    content = self._format_product_entity_content(entity)
                    
                    # Find relationships to this product
                    relationships = [
                        r for r in traversal_result.relationships
                        if (isinstance(r.subject, KGEntity) and r.subject.id == entity.id) or
                           (isinstance(r.object, KGEntity) and r.object.id == entity.id)
                    ]
                    
                    result = RetrievalResult(
                        content=content,
                        score=0.8,  # Default relevance score
                        source="kg",
                        metadata={
                            "entity_id": entity.id,
                            "entity_type": entity.type,
                            "product_name": entity.canonical_name or entity.text,
                            "relationship_count": len(relationships)
                        },
                        provenance={
                            "document_id": entity.provenance.document_id,
                            "page": entity.provenance.page,
                            "relationships": [r.predicate for r in relationships]
                        }
                    )
                    results.append(result)
            
            logger.info(f"Found {len(results)} related products for {product_name}")
            return results[:limit]
            
        except Exception as e:
            logger.error(f"Failed to find related products for {product_name}: {e}")
            return []
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get knowledge graph statistics.
        
        Returns:
            Knowledge graph statistics
        """
        try:
            stats = await self.kg_store.get_statistics()
            
            return {
                "total_entities": stats.total_entities,
                "total_relationships": stats.total_relationships,
                "entity_types": stats.entity_types,
                "relationship_types": stats.relationship_types,
                "avg_degree": stats.avg_degree,
                "connected_components": stats.connected_components,
                "density": stats.density,
                "timestamp": time.time()
            }
            
        except Exception as e:
            logger.error(f"Failed to get KG statistics: {e}")
            return {
                "error": str(e),
                "total_entities": 0,
                "total_relationships": 0
            }
    
    async def validate_graph_integrity(self) -> Dict[str, Any]:
        """Validate knowledge graph data integrity.
        
        Returns:
            Validation results
        """
        try:
            start_time = time.time()
            
            # Get basic statistics
            stats = await self.kg_store.get_statistics()
            
            # Check for common issues
            issues = []
            warnings = []
            
            # Check for orphaned entities (entities with no relationships)
            orphaned_query = """
            MATCH (e:Entity)
            WHERE NOT (e)-[:RELATIONSHIP]-()
            RETURN count(e) as orphaned_count
            """
            
            orphaned_result = await self.kg_store.execute_cypher_query(orphaned_query)
            orphaned_count = orphaned_result[0]["orphaned_count"] if orphaned_result else 0
            
            if orphaned_count > 0:
                warnings.append(f"Found {orphaned_count} orphaned entities with no relationships")
            
            # Check for entities without canonical names
            no_canonical_query = """
            MATCH (e:Entity)
            WHERE e.canonical_name IS NULL OR e.canonical_name = ""
            RETURN count(e) as no_canonical_count
            """
            
            no_canonical_result = await self.kg_store.execute_cypher_query(no_canonical_query)
            no_canonical_count = no_canonical_result[0]["no_canonical_count"] if no_canonical_result else 0
            
            if no_canonical_count > 0:
                warnings.append(f"Found {no_canonical_count} entities without canonical names")
            
            # Check for duplicate entities (same canonical name and type)
            duplicate_query = """
            MATCH (e:Entity)
            WHERE e.canonical_name IS NOT NULL
            WITH e.canonical_name as name, e.type as type, collect(e) as entities
            WHERE size(entities) > 1
            RETURN count(*) as duplicate_groups, sum(size(entities)) as duplicate_entities
            """
            
            duplicate_result = await self.kg_store.execute_cypher_query(duplicate_query)
            if duplicate_result:
                duplicate_groups = duplicate_result[0]["duplicate_groups"]
                duplicate_entities = duplicate_result[0]["duplicate_entities"]
                
                if duplicate_groups > 0:
                    warnings.append(f"Found {duplicate_groups} groups with {duplicate_entities} potentially duplicate entities")
            
            # Determine overall status
            if issues:
                status = "error"
            elif warnings:
                status = "warning"
            else:
                status = "healthy"
            
            processing_time = time.time() - start_time
            
            return {
                "status": status,
                "statistics": {
                    "total_entities": stats.total_entities,
                    "total_relationships": stats.total_relationships,
                    "entity_types": len(stats.entity_types),
                    "relationship_types": len(stats.relationship_types)
                },
                "issues": issues,
                "warnings": warnings,
                "checks_performed": [
                    "orphaned_entities",
                    "missing_canonical_names",
                    "duplicate_entities"
                ],
                "processing_time_ms": int(processing_time * 1000),
                "timestamp": time.time()
            }
            
        except Exception as e:
            logger.error(f"Failed to validate graph integrity: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": time.time()
            }
    
    def _format_entity_content(self, entity: KGEntity) -> str:
        """Format entity information as text content."""
        content = f"Entity: {entity.text}\n"
        
        if entity.canonical_name and entity.canonical_name != entity.text:
            content += f"Canonical Name: {entity.canonical_name}\n"
        
        content += f"Type: {entity.type}\n"
        
        if entity.aliases:
            content += f"Aliases: {', '.join(entity.aliases)}\n"
        
        if entity.source_text:
            content += f"Source: {entity.source_text}\n"
        
        if entity.metadata:
            content += "Properties:\n"
            for key, value in entity.metadata.items():
                content += f"  {key}: {value}\n"
        
        return content
    
    def _format_product_entity_content(self, entity: KGEntity) -> str:
        """Format product entity information as text content."""
        content = f"Product: {entity.canonical_name or entity.text}\n"
        content += f"Type: {entity.type}\n"
        
        if entity.aliases:
            content += f"Also known as: {', '.join(entity.aliases)}\n"
        
        # Extract product-specific metadata
        metadata = entity.metadata or {}
        
        if "family" in metadata:
            content += f"Product Family: {metadata['family']}\n"
        
        if "cas_number" in metadata:
            content += f"CAS Number: {metadata['cas_number']}\n"
        
        if "applications" in metadata:
            applications = metadata["applications"]
            if isinstance(applications, list):
                content += f"Applications: {', '.join(applications)}\n"
            else:
                content += f"Applications: {applications}\n"
        
        if "manufacturer" in metadata:
            content += f"Manufacturer: {metadata['manufacturer']}\n"
        
        return content
    
    def _calculate_entity_relevance(self, entity: KGEntity, query: str) -> float:
        """Calculate relevance score for an entity given a query."""
        score = 0.0
        query_lower = query.lower()
        
        # Exact match with text
        if entity.text.lower() == query_lower:
            score += 1.0
        elif query_lower in entity.text.lower():
            score += 0.8
        
        # Exact match with canonical name
        if entity.canonical_name and entity.canonical_name.lower() == query_lower:
            score += 0.9
        elif entity.canonical_name and query_lower in entity.canonical_name.lower():
            score += 0.7
        
        # Match with aliases
        for alias in entity.aliases:
            if alias.lower() == query_lower:
                score += 0.8
                break
            elif query_lower in alias.lower():
                score += 0.6
                break
        
        # Boost score for certain entity types
        if entity.type in ["PRODUCT", "CHEMICAL", "APPLICATION"]:
            score += 0.1
        
        return min(score, 1.0)
    
    def _create_graph_visualization(
        self,
        central_entity: KGEntity,
        related_entities: List[KGEntity],
        relationships: List[KGTriple]
    ) -> GraphVisualizationData:
        """Create graph visualization data."""
        nodes = []
        edges = []
        
        # Add central node
        central_node = GraphNode(
            id=central_entity.id,
            label=central_entity.canonical_name or central_entity.text,
            type=central_entity.type,
            properties=central_entity.metadata,
            size=20,  # Larger size for central node
            color=self._get_node_color(central_entity.type),
            position={"x": 0, "y": 0}  # Center position
        )
        nodes.append(central_node)
        
        # Add related nodes
        for i, entity in enumerate(related_entities):
            # Calculate position in circle around center
            import math
            angle = 2 * math.pi * i / len(related_entities)
            radius = 100
            x = radius * math.cos(angle)
            y = radius * math.sin(angle)
            
            node = GraphNode(
                id=entity.id,
                label=entity.canonical_name or entity.text,
                type=entity.type,
                properties=entity.metadata,
                size=10,
                color=self._get_node_color(entity.type),
                position={"x": x, "y": y}
            )
            nodes.append(node)
        
        # Add edges
        for triple in relationships:
            subject_id = triple.subject if isinstance(triple.subject, str) else triple.subject.id
            object_id = triple.object if isinstance(triple.object, str) else getattr(triple.object, 'id', str(triple.object))
            
            edge = GraphEdge(
                id=f"{subject_id}_{triple.predicate}_{object_id}",
                source=subject_id,
                target=object_id,
                label=triple.predicate,
                type=triple.predicate,
                weight=triple.confidence or 1.0,
                color=self._get_edge_color(triple.predicate)
            )
            edges.append(edge)
        
        return GraphVisualizationData(
            nodes=nodes,
            edges=edges,
            layout_hints={
                "algorithm": "force_directed",
                "center_node": central_entity.id,
                "radius": 100
            }
        )
    
    def _get_node_color(self, entity_type: str) -> str:
        """Get color for node based on entity type."""
        color_map = {
            "PRODUCT": "#FF6B6B",
            "CHEMICAL": "#4ECDC4",
            "APPLICATION": "#45B7D1",
            "PROPERTY": "#96CEB4",
            "MANUFACTURER": "#FFEAA7",
            "FAMILY": "#DDA0DD",
            "UNKNOWN": "#95A5A6"
        }
        return color_map.get(entity_type, "#95A5A6")
    
    def _get_edge_color(self, relationship_type: str) -> str:
        """Get color for edge based on relationship type."""
        color_map = {
            "used_in": "#3498DB",
            "has_property": "#2ECC71",
            "similar_to": "#E74C3C",
            "manufactured_by": "#F39C12",
            "belongs_to_family": "#9B59B6",
            "competes_with": "#E67E22"
        }
        return color_map.get(relationship_type, "#7F8C8D")