"""Neo4j implementation of knowledge graph store."""

import json
import logging
from datetime import datetime
from typing import Any

from neo4j import Driver, GraphDatabase
from neo4j.exceptions import AuthError, ServiceUnavailable

from ..models.kg_models import KGEntity, KGProvenance, KGTriple, KnowledgeGraph
from .base import GraphStatistics, GraphTraversalResult, KnowledgeGraphStore

logger = logging.getLogger(__name__)


class Neo4jKnowledgeGraphStore(KnowledgeGraphStore):
    """Neo4j implementation of knowledge graph store."""

    def __init__(
        self,
        uri: str = "bolt://localhost:7687",
        username: str = "neo4j",
        password: str = "password",
        database: str = "neo4j",
    ):
        """Initialize Neo4j knowledge graph store.

        Args:
            uri: Neo4j connection URI
            username: Database username
            password: Database password
            database: Database name
        """
        self.uri = uri
        self.username = username
        self.password = password
        self.database = database
        self.driver: Driver | None = None
        self._connected = False

    async def connect(self) -> bool:
        """Connect to Neo4j database."""
        try:
            self.driver = GraphDatabase.driver(
                self.uri, auth=(self.username, self.password)
            )

            # Test connection
            with self.driver.session(database=self.database) as session:
                result = session.run("RETURN 1 as test")
                result.single()

            self._connected = True
            logger.info(f"Connected to Neo4j at {self.uri}")
            return True

        except (ServiceUnavailable, AuthError) as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            self._connected = False
            return False

    async def disconnect(self) -> None:
        """Disconnect from Neo4j database."""
        if self.driver:
            self.driver.close()
            self.driver = None
            self._connected = False
            logger.info("Disconnected from Neo4j")

    async def health_check(self) -> dict[str, Any]:
        """Check Neo4j database health."""
        try:
            if not self._connected or not self.driver:
                return {
                    "status": "unhealthy",
                    "error": "Not connected to database",
                    "timestamp": datetime.utcnow().isoformat(),
                }

            with self.driver.session(database=self.database) as session:
                # Test basic connectivity
                result = session.run("RETURN 1 as test")
                result.single()

                # Get basic stats
                stats_result = session.run(
                    """
                    MATCH (n) 
                    RETURN count(n) as node_count
                """
                )
                node_count = stats_result.single()["node_count"]

                rel_result = session.run(
                    """
                    MATCH ()-[r]->() 
                    RETURN count(r) as rel_count
                """
                )
                rel_count = rel_result.single()["rel_count"]

                return {
                    "status": "healthy",
                    "database": self.database,
                    "uri": self.uri,
                    "node_count": node_count,
                    "relationship_count": rel_count,
                    "timestamp": datetime.utcnow().isoformat(),
                }

        except Exception as e:
            logger.error(f"Neo4j health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def create_entity(self, entity: KGEntity) -> bool:
        """Create a new entity in Neo4j."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return False

            with self.driver.session(database=self.database) as session:
                query = """
                CREATE (e:Entity {
                    id: $id,
                    text: $text,
                    type: $type,
                    canonical_name: $canonical_name,
                    aliases: $aliases,
                    source_text: $source_text,
                    provenance: $provenance,
                    metadata: $metadata,
                    created_at: datetime()
                })
                """

                session.run(
                    query,
                    {
                        "id": entity.id,
                        "text": entity.text,
                        "type": entity.type,
                        "canonical_name": entity.canonical_name,
                        "aliases": entity.aliases,
                        "source_text": entity.source_text,
                        "provenance": entity.provenance.dict(),
                        "metadata": entity.metadata,
                    },
                )

                logger.debug(f"Created entity: {entity.id}")
                return True

        except Exception as e:
            logger.error(f"Failed to create entity {entity.id}: {e}")
            return False

    async def update_entity(self, entity: KGEntity) -> bool:
        """Update an existing entity in Neo4j."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return False

            with self.driver.session(database=self.database) as session:
                query = """
                MATCH (e:Entity {id: $id})
                SET e.text = $text,
                    e.type = $type,
                    e.canonical_name = $canonical_name,
                    e.aliases = $aliases,
                    e.source_text = $source_text,
                    e.provenance = $provenance,
                    e.metadata = $metadata,
                    e.updated_at = datetime()
                RETURN e
                """

                result = session.run(
                    query,
                    {
                        "id": entity.id,
                        "text": entity.text,
                        "type": entity.type,
                        "canonical_name": entity.canonical_name,
                        "aliases": entity.aliases,
                        "source_text": entity.source_text,
                        "provenance": entity.provenance.dict(),
                        "metadata": entity.metadata,
                    },
                )

                if result.single():
                    logger.debug(f"Updated entity: {entity.id}")
                    return True
                else:
                    logger.warning(f"Entity not found for update: {entity.id}")
                    return False

        except Exception as e:
            logger.error(f"Failed to update entity {entity.id}: {e}")
            return False

    async def delete_entity(self, entity_id: str) -> bool:
        """Delete an entity from Neo4j."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return False

            with self.driver.session(database=self.database) as session:
                query = """
                MATCH (e:Entity {id: $entity_id})
                DETACH DELETE e
                RETURN count(e) as deleted_count
                """

                result = session.run(query, {"entity_id": entity_id})
                deleted_count = result.single()["deleted_count"]

                if deleted_count > 0:
                    logger.debug(f"Deleted entity: {entity_id}")
                    return True
                else:
                    logger.warning(f"Entity not found for deletion: {entity_id}")
                    return False

        except Exception as e:
            logger.error(f"Failed to delete entity {entity_id}: {e}")
            return False

    async def get_entity(self, entity_id: str) -> KGEntity | None:
        """Get an entity by ID from Neo4j."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return None

            with self.driver.session(database=self.database) as session:
                query = """
                MATCH (e:Entity {id: $entity_id})
                RETURN e
                """

                result = session.run(query, {"entity_id": entity_id})
                record = result.single()

                if record:
                    node = record["e"]
                    return self._node_to_entity(node)
                else:
                    return None

        except Exception as e:
            logger.error(f"Failed to get entity {entity_id}: {e}")
            return None

    async def find_entities(
        self,
        text: str | None = None,
        entity_type: str | None = None,
        canonical_name: str | None = None,
        limit: int = 100,
    ) -> list[KGEntity]:
        """Find entities by various criteria."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return []

            conditions = []
            params = {"limit": limit}

            if text:
                conditions.append(
                    "(e.text CONTAINS $text OR any(alias IN e.aliases WHERE alias CONTAINS $text))"
                )
                params["text"] = text

            if entity_type:
                conditions.append("e.type = $entity_type")
                params["entity_type"] = entity_type

            if canonical_name:
                conditions.append("e.canonical_name = $canonical_name")
                params["canonical_name"] = canonical_name

            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

            query = f"""
            MATCH (e:Entity)
            {where_clause}
            RETURN e
            LIMIT $limit
            """

            with self.driver.session(database=self.database) as session:
                result = session.run(query, params)
                entities = []

                for record in result:
                    entity = self._node_to_entity(record["e"])
                    if entity:
                        entities.append(entity)

                return entities

        except Exception as e:
            logger.error(f"Failed to find entities: {e}")
            return []

    async def create_relationship(self, triple: KGTriple) -> bool:
        """Create a relationship between entities."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return False

            # Extract subject and object IDs
            subject_id = (
                triple.subject if isinstance(triple.subject, str) else triple.subject.id
            )
            object_id = (
                triple.object
                if isinstance(triple.object, str)
                else getattr(triple.object, "id", str(triple.object))
            )

            with self.driver.session(database=self.database) as session:
                query = """
                MATCH (s:Entity {id: $subject_id})
                MATCH (o:Entity {id: $object_id})
                CREATE (s)-[r:RELATIONSHIP {
                    predicate: $predicate,
                    source_text: $source_text,
                    provenance: $provenance,
                    confidence: $confidence,
                    created_at: datetime()
                }]->(o)
                RETURN r
                """

                result = session.run(
                    query,
                    {
                        "subject_id": subject_id,
                        "object_id": object_id,
                        "predicate": triple.predicate,
                        "source_text": triple.source_text,
                        "provenance": triple.provenance.dict(),
                        "confidence": triple.confidence,
                    },
                )

                if result.single():
                    logger.debug(
                        f"Created relationship: {subject_id} -[{triple.predicate}]-> {object_id}"
                    )
                    return True
                else:
                    logger.warning("Failed to create relationship: entities not found")
                    return False

        except Exception as e:
            logger.error(f"Failed to create relationship: {e}")
            return False

    async def delete_relationship(
        self, subject_id: str, predicate: str, object_id: str
    ) -> bool:
        """Delete a relationship between entities."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return False

            with self.driver.session(database=self.database) as session:
                query = """
                MATCH (s:Entity {id: $subject_id})-[r:RELATIONSHIP {predicate: $predicate}]->(o:Entity {id: $object_id})
                DELETE r
                RETURN count(r) as deleted_count
                """

                result = session.run(
                    query,
                    {
                        "subject_id": subject_id,
                        "predicate": predicate,
                        "object_id": object_id,
                    },
                )

                deleted_count = result.single()["deleted_count"]

                if deleted_count > 0:
                    logger.debug(
                        f"Deleted relationship: {subject_id} -[{predicate}]-> {object_id}"
                    )
                    return True
                else:
                    logger.warning("Relationship not found for deletion")
                    return False

        except Exception as e:
            logger.error(f"Failed to delete relationship: {e}")
            return False

    async def get_entity_relationships(
        self,
        entity_id: str,
        relationship_types: list[str] | None = None,
        direction: str = "both",
    ) -> list[KGTriple]:
        """Get all relationships for an entity."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return []

            # Build query based on direction
            if direction == "out":
                pattern = "(e:Entity {id: $entity_id})-[r:RELATIONSHIP]->(other:Entity)"
            elif direction == "in":
                pattern = "(other:Entity)-[r:RELATIONSHIP]->(e:Entity {id: $entity_id})"
            else:  # both
                pattern = "(e:Entity {id: $entity_id})-[r:RELATIONSHIP]-(other:Entity)"

            where_clause = ""
            params = {"entity_id": entity_id}

            if relationship_types:
                where_clause = "WHERE r.predicate IN $relationship_types"
                params["relationship_types"] = relationship_types

            query = f"""
            MATCH {pattern}
            {where_clause}
            RETURN e, r, other, startNode(r) as start, endNode(r) as end
            """

            with self.driver.session(database=self.database) as session:
                result = session.run(query, params)
                triples = []

                for record in result:
                    triple = self._record_to_triple(record)
                    if triple:
                        triples.append(triple)

                return triples

        except Exception as e:
            logger.error(f"Failed to get relationships for entity {entity_id}: {e}")
            return []

    async def traverse_graph(
        self,
        start_entity_id: str,
        max_depth: int = 2,
        relationship_types: list[str] | None = None,
        entity_types: list[str] | None = None,
        limit: int = 100,
    ) -> GraphTraversalResult:
        """Traverse the graph from a starting entity."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return GraphTraversalResult(
                    central_entity=None,
                    related_entities=[],
                    relationships=[],
                    traversal_depth=0,
                    total_paths=0,
                )

            # Build relationship filter
            rel_filter = ""
            if relationship_types:
                rel_filter = f"WHERE ALL(r IN relationships(p) WHERE r.predicate IN {relationship_types})"

            # Build entity type filter
            entity_filter = ""
            if entity_types:
                entity_filter = f"AND end.type IN {entity_types}"

            query = f"""
            MATCH (start:Entity {{id: $start_entity_id}})
            MATCH p = (start)-[*1..{max_depth}]-(end:Entity)
            {rel_filter}
            WHERE end.id <> start.id {entity_filter}
            WITH start, end, p, length(p) as depth
            ORDER BY depth, end.id
            LIMIT $limit
            RETURN start, collect(DISTINCT end) as related_entities, 
                   collect(p) as paths, count(DISTINCT p) as total_paths
            """

            with self.driver.session(database=self.database) as session:
                result = session.run(
                    query, {"start_entity_id": start_entity_id, "limit": limit}
                )

                record = result.single()
                if not record:
                    # Return empty result if start entity not found
                    return GraphTraversalResult(
                        central_entity=None,
                        related_entities=[],
                        relationships=[],
                        traversal_depth=0,
                        total_paths=0,
                    )

                central_entity = self._node_to_entity(record["start"])
                related_entities = [
                    self._node_to_entity(node) for node in record["related_entities"]
                ]

                # Extract relationships from paths
                relationships = []
                for path in record["paths"]:
                    for rel in path.relationships:
                        # Convert relationship to triple
                        triple = self._relationship_to_triple(
                            rel, path.start_node, path.end_node
                        )
                        if triple:
                            relationships.append(triple)

                return GraphTraversalResult(
                    central_entity=central_entity,
                    related_entities=related_entities,
                    relationships=relationships,
                    traversal_depth=max_depth,
                    total_paths=record["total_paths"],
                )

        except Exception as e:
            logger.error(f"Failed to traverse graph from {start_entity_id}: {e}")
            return GraphTraversalResult(
                central_entity=None,
                related_entities=[],
                relationships=[],
                traversal_depth=0,
                total_paths=0,
            )

    async def find_shortest_path(
        self,
        start_entity_id: str,
        end_entity_id: str,
        max_depth: int = 5,
        relationship_types: list[str] | None = None,
    ) -> list[KGTriple] | None:
        """Find shortest path between two entities."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return None

            rel_filter = ""
            if relationship_types:
                rel_filter = f"WHERE ALL(r IN relationships(p) WHERE r.predicate IN {relationship_types})"

            query = f"""
            MATCH (start:Entity {{id: $start_entity_id}})
            MATCH (end:Entity {{id: $end_entity_id}})
            MATCH p = shortestPath((start)-[*1..{max_depth}]-(end))
            {rel_filter}
            RETURN p
            """

            with self.driver.session(database=self.database) as session:
                result = session.run(
                    query,
                    {
                        "start_entity_id": start_entity_id,
                        "end_entity_id": end_entity_id,
                    },
                )

                record = result.single()
                if not record:
                    return None

                path = record["p"]
                triples = []

                for rel in path.relationships:
                    triple = self._relationship_to_triple(
                        rel, path.start_node, path.end_node
                    )
                    if triple:
                        triples.append(triple)

                return triples

        except Exception as e:
            logger.error(f"Failed to find shortest path: {e}")
            return None

    async def get_similar_entities(
        self, entity_id: str, similarity_threshold: float = 0.7, limit: int = 10
    ) -> list[tuple[KGEntity, float]]:
        """Find entities similar to the given entity."""
        # This is a simplified implementation
        # In practice, you might use more sophisticated similarity measures
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return []

            query = """
            MATCH (e:Entity {id: $entity_id})
            MATCH (similar:Entity)
            WHERE similar.id <> e.id 
              AND similar.type = e.type
              AND (similar.text CONTAINS e.text OR e.text CONTAINS similar.text)
            RETURN similar, 
                   CASE 
                     WHEN similar.text = e.text THEN 1.0
                     WHEN similar.canonical_name = e.canonical_name THEN 0.9
                     ELSE 0.8
                   END as similarity
            ORDER BY similarity DESC
            LIMIT $limit
            """

            with self.driver.session(database=self.database) as session:
                result = session.run(query, {"entity_id": entity_id, "limit": limit})

                similar_entities = []
                for record in result:
                    entity = self._node_to_entity(record["similar"])
                    similarity = record["similarity"]

                    if entity and similarity >= similarity_threshold:
                        similar_entities.append((entity, similarity))

                return similar_entities

        except Exception as e:
            logger.error(f"Failed to find similar entities: {e}")
            return []

    async def batch_create_entities(self, entities: list[KGEntity]) -> dict[str, bool]:
        """Create multiple entities in batch."""
        results = {}

        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return {entity.id: False for entity in entities}

            with self.driver.session(database=self.database) as session:
                for entity in entities:
                    try:
                        query = """
                        CREATE (e:Entity {
                            id: $id,
                            text: $text,
                            type: $type,
                            canonical_name: $canonical_name,
                            aliases: $aliases,
                            source_text: $source_text,
                            provenance: $provenance,
                            metadata: $metadata,
                            created_at: datetime()
                        })
                        """

                        session.run(
                            query,
                            {
                                "id": entity.id,
                                "text": entity.text,
                                "type": entity.type,
                                "canonical_name": entity.canonical_name,
                                "aliases": entity.aliases,
                                "source_text": entity.source_text,
                                "provenance": entity.provenance.dict(),
                                "metadata": entity.metadata,
                            },
                        )

                        results[entity.id] = True

                    except Exception as e:
                        logger.error(
                            f"Failed to create entity {entity.id} in batch: {e}"
                        )
                        results[entity.id] = False

                logger.info(
                    f"Batch created {sum(results.values())}/{len(entities)} entities"
                )
                return results

        except Exception as e:
            logger.error(f"Batch entity creation failed: {e}")
            return {entity.id: False for entity in entities}

    async def batch_create_relationships(
        self, triples: list[KGTriple]
    ) -> dict[str, bool]:
        """Create multiple relationships in batch."""
        results = {}

        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return {f"{i}": False for i in range(len(triples))}

            with self.driver.session(database=self.database) as session:
                for i, triple in enumerate(triples):
                    try:
                        subject_id = (
                            triple.subject
                            if isinstance(triple.subject, str)
                            else triple.subject.id
                        )
                        object_id = (
                            triple.object
                            if isinstance(triple.object, str)
                            else getattr(triple.object, "id", str(triple.object))
                        )

                        query = """
                        MATCH (s:Entity {id: $subject_id})
                        MATCH (o:Entity {id: $object_id})
                        CREATE (s)-[r:RELATIONSHIP {
                            predicate: $predicate,
                            source_text: $source_text,
                            provenance: $provenance,
                            confidence: $confidence,
                            created_at: datetime()
                        }]->(o)
                        RETURN r
                        """

                        result = session.run(
                            query,
                            {
                                "subject_id": subject_id,
                                "object_id": object_id,
                                "predicate": triple.predicate,
                                "source_text": triple.source_text,
                                "provenance": triple.provenance.dict(),
                                "confidence": triple.confidence,
                            },
                        )

                        if result.single():
                            results[str(i)] = True
                        else:
                            results[str(i)] = False

                    except Exception as e:
                        logger.error(f"Failed to create relationship {i} in batch: {e}")
                        results[str(i)] = False

                logger.info(
                    f"Batch created {sum(results.values())}/{len(triples)} relationships"
                )
                return results

        except Exception as e:
            logger.error(f"Batch relationship creation failed: {e}")
            return {f"{i}": False for i in range(len(triples))}

    async def ingest_knowledge_graph(self, kg: KnowledgeGraph) -> dict[str, Any]:
        """Ingest a complete knowledge graph."""
        try:
            start_time = datetime.utcnow()

            # Create entities first
            entity_results = await self.batch_create_entities(kg.entities)
            successful_entities = sum(entity_results.values())

            # Create relationships
            relationship_results = await self.batch_create_relationships(kg.kg_triples)
            successful_relationships = sum(relationship_results.values())

            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds()

            result = {
                "success": True,
                "entities": {
                    "total": len(kg.entities),
                    "successful": successful_entities,
                    "failed": len(kg.entities) - successful_entities,
                },
                "relationships": {
                    "total": len(kg.kg_triples),
                    "successful": successful_relationships,
                    "failed": len(kg.kg_triples) - successful_relationships,
                },
                "processing_time_seconds": processing_time,
                "metadata": kg.metadata,
            }

            logger.info(
                f"Ingested knowledge graph: {successful_entities} entities, {successful_relationships} relationships"
            )
            return result

        except Exception as e:
            logger.error(f"Failed to ingest knowledge graph: {e}")
            return {
                "success": False,
                "error": str(e),
                "entities": {
                    "total": len(kg.entities),
                    "successful": 0,
                    "failed": len(kg.entities),
                },
                "relationships": {
                    "total": len(kg.kg_triples),
                    "successful": 0,
                    "failed": len(kg.kg_triples),
                },
            }

    async def export_subgraph(
        self, entity_ids: list[str], include_relationships: bool = True
    ) -> KnowledgeGraph:
        """Export a subgraph containing specified entities."""
        try:
            entities = []
            relationships = []

            # Get entities
            for entity_id in entity_ids:
                entity = await self.get_entity(entity_id)
                if entity:
                    entities.append(entity)

            # Get relationships if requested
            if include_relationships:
                for entity_id in entity_ids:
                    entity_rels = await self.get_entity_relationships(entity_id)
                    relationships.extend(entity_rels)

            return KnowledgeGraph(
                entities=entities,
                kg_triples=relationships,
                metadata={
                    "export_timestamp": datetime.utcnow().isoformat(),
                    "entity_count": len(entities),
                    "relationship_count": len(relationships),
                    "source_entity_ids": entity_ids,
                },
            )

        except Exception as e:
            logger.error(f"Failed to export subgraph: {e}")
            return KnowledgeGraph(
                entities=[], kg_triples=[], metadata={"error": str(e)}
            )

    async def get_statistics(self) -> GraphStatistics:
        """Get knowledge graph statistics."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return GraphStatistics(
                    total_entities=0,
                    total_relationships=0,
                    entity_types={},
                    relationship_types={},
                    avg_degree=0.0,
                    connected_components=0,
                    density=0.0,
                )

            with self.driver.session(database=self.database) as session:
                # Get basic counts
                entity_count_result = session.run(
                    "MATCH (n:Entity) RETURN count(n) as count"
                )
                total_entities = entity_count_result.single()["count"]

                rel_count_result = session.run(
                    "MATCH ()-[r:RELATIONSHIP]->() RETURN count(r) as count"
                )
                total_relationships = rel_count_result.single()["count"]

                # Get entity types
                entity_types_result = session.run(
                    """
                    MATCH (n:Entity) 
                    RETURN n.type as type, count(n) as count
                """
                )
                entity_types = {
                    record["type"]: record["count"] for record in entity_types_result
                }

                # Get relationship types
                rel_types_result = session.run(
                    """
                    MATCH ()-[r:RELATIONSHIP]->() 
                    RETURN r.predicate as predicate, count(r) as count
                """
                )
                relationship_types = {
                    record["predicate"]: record["count"] for record in rel_types_result
                }

                # Calculate average degree
                avg_degree = (
                    (2 * total_relationships) / total_entities
                    if total_entities > 0
                    else 0.0
                )

                # Calculate density
                max_edges = (
                    total_entities * (total_entities - 1) if total_entities > 1 else 1
                )
                density = total_relationships / max_edges if max_edges > 0 else 0.0

                # TODO: Calculate connected components (requires more complex query)
                connected_components = 1  # Placeholder

                return GraphStatistics(
                    total_entities=total_entities,
                    total_relationships=total_relationships,
                    entity_types=entity_types,
                    relationship_types=relationship_types,
                    avg_degree=avg_degree,
                    connected_components=connected_components,
                    density=density,
                )

        except Exception as e:
            logger.error(f"Failed to get graph statistics: {e}")
            return GraphStatistics(
                total_entities=0,
                total_relationships=0,
                entity_types={},
                relationship_types={},
                avg_degree=0.0,
                connected_components=0,
                density=0.0,
            )

    async def clear_graph(self) -> bool:
        """Clear all data from the knowledge graph."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return False

            with self.driver.session(database=self.database) as session:
                session.run("MATCH (n:Entity) DETACH DELETE n")
                logger.warning("Cleared all data from knowledge graph")
                return True

        except Exception as e:
            logger.error(f"Failed to clear graph: {e}")
            return False

    async def execute_cypher_query(
        self, query: str, parameters: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """Execute a raw Cypher query."""
        try:
            if not self._connected or not self.driver:
                logger.error("Not connected to Neo4j")
                return []

            with self.driver.session(database=self.database) as session:
                result = session.run(query, parameters or {})

                records = []
                for record in result:
                    records.append(dict(record))

                return records

        except Exception as e:
            logger.error(f"Failed to execute Cypher query: {e}")
            return []

    def _node_to_entity(self, node) -> KGEntity | None:
        """Convert Neo4j node to KGEntity."""
        try:
            provenance_data = node.get("provenance", {})
            if isinstance(provenance_data, str):
                provenance_data = json.loads(provenance_data)

            provenance = KGProvenance(**provenance_data)

            return KGEntity(
                id=node["id"],
                text=node["text"],
                type=node["type"],
                canonical_name=node.get("canonical_name"),
                aliases=node.get("aliases", []),
                source_text=node.get("source_text"),
                provenance=provenance,
                metadata=node.get("metadata", {}),
            )
        except Exception as e:
            logger.error(f"Failed to convert node to entity: {e}")
            return None

    def _record_to_triple(self, record) -> KGTriple | None:
        """Convert Neo4j record to KGTriple."""
        try:
            rel = record["r"]
            start_node = record["start"]
            end_node = record["end"]

            subject_entity = self._node_to_entity(start_node)
            object_entity = self._node_to_entity(end_node)

            if not subject_entity or not object_entity:
                return None

            provenance_data = rel.get("provenance", {})
            if isinstance(provenance_data, str):
                provenance_data = json.loads(provenance_data)

            provenance = KGProvenance(**provenance_data)

            return KGTriple(
                subject=subject_entity,
                predicate=rel["predicate"],
                object=object_entity,
                source_text=rel.get("source_text"),
                provenance=provenance,
                confidence=rel.get("confidence"),
            )
        except Exception as e:
            logger.error(f"Failed to convert record to triple: {e}")
            return None

    def _relationship_to_triple(self, rel, start_node, end_node) -> KGTriple | None:
        """Convert Neo4j relationship to KGTriple."""
        try:
            subject_entity = self._node_to_entity(start_node)
            object_entity = self._node_to_entity(end_node)

            if not subject_entity or not object_entity:
                return None

            provenance_data = rel.get("provenance", {})
            if isinstance(provenance_data, str):
                provenance_data = json.loads(provenance_data)

            provenance = KGProvenance(**provenance_data)

            return KGTriple(
                subject=subject_entity,
                predicate=rel["predicate"],
                object=object_entity,
                source_text=rel.get("source_text"),
                provenance=provenance,
                confidence=rel.get("confidence"),
            )
        except Exception as e:
            logger.error(f"Failed to convert relationship to triple: {e}")
            return None
