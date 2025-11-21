from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class KGStore(ABC):
    """Abstract base class for Knowledge Graph Store operations."""

    @abstractmethod
    def add_entity(self, label: str, properties: Dict[str, Any]) -> None:
        """Add an entity to the knowledge graph."""
        pass

    @abstractmethod
    def add_relationship(self, start_label: str, start_props: Dict[str, Any], 
                         end_label: str, end_props: Dict[str, Any], 
                         rel_type: str, rel_props: Dict[str, Any] = None) -> None:
        """Add a relationship between two entities."""
        pass

    @abstractmethod
    def query_graph(self, query: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Execute a Cypher query on the knowledge graph."""
        pass

    @abstractmethod
    def close(self) -> None:
        """Close the connection to the knowledge graph."""
        pass
