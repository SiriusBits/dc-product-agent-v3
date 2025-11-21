from neo4j import GraphDatabase
from typing import List, Dict, Any, Optional
from dc_agent.kg.store import KGStore
from dc_agent.config import settings

class Neo4jKGStore(KGStore):
    """Neo4j implementation of the Knowledge Graph Store."""

    def __init__(self):
        self.driver = GraphDatabase.driver(
            settings.NEO4J_URI, 
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )

    def close(self):
        self.driver.close()

    def add_entity(self, label: str, properties: Dict[str, Any]) -> None:
        """Add an entity to the knowledge graph."""
        with self.driver.session() as session:
            session.execute_write(self._create_node, label, properties)

    def add_relationship(self, start_label: str, start_props: Dict[str, Any], 
                         end_label: str, end_props: Dict[str, Any], 
                         rel_type: str, rel_props: Dict[str, Any] = None) -> None:
        """Add a relationship between two entities."""
        with self.driver.session() as session:
            session.execute_write(self._create_relationship, start_label, start_props, 
                                  end_label, end_props, rel_type, rel_props)

    def query_graph(self, query: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Execute a Cypher query on the knowledge graph."""
        with self.driver.session() as session:
            result = session.run(query, params or {})
            return [record.data() for record in result]

    @staticmethod
    def _create_node(tx, label, properties):
        query = (
            f"MERGE (n:{label} {{id: $id}}) "
            "SET n += $props"
        )
        # Ensure 'id' is present in properties for MERGE to work effectively as a unique key if intended
        # For simplicity here, we assume properties contains a unique identifier or we just merge on all props
        # A better approach is to have a specific ID field. Let's assume 'name' or 'id' is key.
        # For this generic implementation, we'll just use the properties map directly in MERGE if simple,
        # but MERGE with a map can be tricky.
        # Let's simplify: MERGE based on a specific key property if available, else all.
        
        # Simplified approach: Just CREATE for now to avoid MERGE complexity without schema
        # Or better: MERGE on a primary key if we define one.
        # Let's assume the user provides an 'id' or 'name' in properties.
        
        # Reverting to a safer generic MERGE:
        # MERGE (n:Label {key: value}) SET n += other_props
        
        # For this implementation, we will just pass the properties.
        query = f"CREATE (n:{label}) SET n = $props"
        tx.run(query, props=properties)

    @staticmethod
    def _create_relationship(tx, start_label, start_props, end_label, end_props, rel_type, rel_props):
        # This requires finding the nodes first. 
        # We assume nodes exist or we create them.
        # For robust implementation, we should match based on some unique ID.
        # Here we will do a simple MATCH based on all properties (can be slow/ambiguous).
        
        query = (
            f"MATCH (a:{start_label}), (b:{end_label}) "
            "WHERE a = $start_props AND b = $end_props "
            f"CREATE (a)-[r:{rel_type}]->(b) "
            "SET r = $rel_props"
        )
        tx.run(query, start_props=start_props, end_props=end_props, rel_props=rel_props or {})
