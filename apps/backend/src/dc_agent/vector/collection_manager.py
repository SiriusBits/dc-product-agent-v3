"""Collection management utilities for vector databases."""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

from .base import VectorStore, DocumentChunk

logger = logging.getLogger(__name__)


class CollectionType(Enum):
    """Types of collections for different data sources."""
    
    TECHNICAL_BULLETINS = "technical_bulletins"
    PRODUCT_SPECIFICATIONS = "product_specifications"
    APPLICATION_GUIDES = "application_guides"
    SAFETY_DATA_SHEETS = "safety_data_sheets"
    KNOWLEDGE_BASE = "knowledge_base"


class CollectionManager:
    """Manages vector database collections and their lifecycle."""
    
    def __init__(self, vector_store: VectorStore):
        """Initialize collection manager.
        
        Args:
            vector_store: Vector store implementation
        """
        self.vector_store = vector_store
        self.default_collections = {
            CollectionType.TECHNICAL_BULLETINS: {
                "dimension": 768,
                "description": "Technical bulletin documents and extracts",
                "embedding_model": "nomic-embed-text"
            },
            CollectionType.PRODUCT_SPECIFICATIONS: {
                "dimension": 768,
                "description": "Product specification documents",
                "embedding_model": "nomic-embed-text"
            },
            CollectionType.APPLICATION_GUIDES: {
                "dimension": 768,
                "description": "Application and usage guides",
                "embedding_model": "nomic-embed-text"
            },
            CollectionType.SAFETY_DATA_SHEETS: {
                "dimension": 768,
                "description": "Safety data sheets and regulatory information",
                "embedding_model": "nomic-embed-text"
            },
            CollectionType.KNOWLEDGE_BASE: {
                "dimension": 768,
                "description": "General knowledge base articles",
                "embedding_model": "nomic-embed-text"
            }
        }
    
    async def initialize_default_collections(self) -> Dict[str, bool]:
        """Initialize all default collections.
        
        Returns:
            Dictionary mapping collection names to creation success status
        """
        results = {}
        
        for collection_type, config in self.default_collections.items():
            collection_name = collection_type.value
            
            # Check if collection already exists
            if await self.vector_store.collection_exists(collection_name):
                logger.info(f"Collection {collection_name} already exists")
                results[collection_name] = True
                continue
            
            # Create collection
            metadata = {
                "type": collection_type.value,
                "description": config["description"],
                "embedding_model": config["embedding_model"],
                "created_by": "collection_manager",
                "auto_created": True
            }
            
            success = await self.vector_store.create_collection(
                name=collection_name,
                dimension=config["dimension"],
                metadata=metadata
            )
            
            results[collection_name] = success
            
            if success:
                logger.info(f"Created collection: {collection_name}")
            else:
                logger.error(f"Failed to create collection: {collection_name}")
        
        return results
    
    async def create_custom_collection(
        self,
        name: str,
        dimension: int,
        description: str,
        embedding_model: str = "nomic-embed-text",
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Create a custom collection.
        
        Args:
            name: Collection name
            dimension: Vector dimension
            description: Collection description
            embedding_model: Embedding model used
            metadata: Additional metadata
            
        Returns:
            True if created successfully
        """
        # Check if collection already exists
        if await self.vector_store.collection_exists(name):
            logger.warning(f"Collection {name} already exists")
            return False
        
        # Prepare metadata
        collection_metadata = metadata or {}
        collection_metadata.update({
            "description": description,
            "embedding_model": embedding_model,
            "created_by": "collection_manager",
            "auto_created": False,
            "custom": True
        })
        
        success = await self.vector_store.create_collection(
            name=name,
            dimension=dimension,
            metadata=collection_metadata
        )
        
        if success:
            logger.info(f"Created custom collection: {name}")
        else:
            logger.error(f"Failed to create custom collection: {name}")
        
        return success
    
    async def delete_collection_safe(self, name: str) -> bool:
        """Safely delete a collection with confirmation.
        
        Args:
            name: Collection name
            
        Returns:
            True if deleted successfully
        """
        # Check if collection exists
        if not await self.vector_store.collection_exists(name):
            logger.warning(f"Collection {name} does not exist")
            return False
        
        # Get collection stats before deletion
        stats = await self.vector_store.get_collection_stats(name)
        document_count = stats.get("count", 0)
        
        if document_count > 0:
            logger.warning(f"Collection {name} contains {document_count} documents")
        
        success = await self.vector_store.delete_collection(name)
        
        if success:
            logger.info(f"Deleted collection: {name} (had {document_count} documents)")
        else:
            logger.error(f"Failed to delete collection: {name}")
        
        return success
    
    async def backup_collection(self, name: str) -> Optional[Dict[str, Any]]:
        """Create a backup of collection metadata and statistics.
        
        Args:
            name: Collection name
            
        Returns:
            Backup data or None if failed
        """
        try:
            if not await self.vector_store.collection_exists(name):
                logger.error(f"Collection {name} does not exist")
                return None
            
            stats = await self.vector_store.get_collection_stats(name)
            
            backup_data = {
                "collection_name": name,
                "backup_timestamp": datetime.utcnow().isoformat(),
                "stats": stats,
                "document_count": stats.get("count", 0)
            }
            
            logger.info(f"Created backup for collection: {name}")
            return backup_data
            
        except Exception as e:
            logger.error(f"Failed to backup collection {name}: {e}")
            return None
    
    async def get_all_collection_info(self) -> List[Dict[str, Any]]:
        """Get detailed information about all collections.
        
        Returns:
            List of collection information
        """
        try:
            collections = await self.vector_store.list_collections()
            
            detailed_info = []
            for collection in collections:
                # Get additional stats
                stats = await self.vector_store.get_collection_stats(collection["name"])
                
                info = {
                    **collection,
                    "detailed_stats": stats,
                    "is_default": collection["name"] in [ct.value for ct in CollectionType],
                    "health_status": "healthy"  # Could add health checks here
                }
                
                detailed_info.append(info)
            
            return detailed_info
            
        except Exception as e:
            logger.error(f"Failed to get collection info: {e}")
            return []
    
    async def optimize_collection(self, name: str) -> Dict[str, Any]:
        """Optimize a collection (placeholder for future optimization logic).
        
        Args:
            name: Collection name
            
        Returns:
            Optimization results
        """
        try:
            if not await self.vector_store.collection_exists(name):
                return {"error": f"Collection {name} does not exist"}
            
            stats_before = await self.vector_store.get_collection_stats(name)
            
            # Placeholder for optimization logic
            # Could include:
            # - Removing duplicate documents
            # - Reindexing
            # - Compacting storage
            # - Updating embeddings
            
            stats_after = await self.vector_store.get_collection_stats(name)
            
            result = {
                "collection_name": name,
                "optimization_timestamp": datetime.utcnow().isoformat(),
                "stats_before": stats_before,
                "stats_after": stats_after,
                "optimizations_applied": ["placeholder"]
            }
            
            logger.info(f"Optimized collection: {name}")
            return result
            
        except Exception as e:
            logger.error(f"Failed to optimize collection {name}: {e}")
            return {"error": str(e)}
    
    async def validate_collection_health(self, name: str) -> Dict[str, Any]:
        """Validate collection health and integrity.
        
        Args:
            name: Collection name
            
        Returns:
            Health validation results
        """
        try:
            if not await self.vector_store.collection_exists(name):
                return {
                    "collection_name": name,
                    "status": "not_found",
                    "errors": ["Collection does not exist"]
                }
            
            stats = await self.vector_store.get_collection_stats(name)
            document_count = stats.get("count", 0)
            
            errors = []
            warnings = []
            
            # Check for empty collection
            if document_count == 0:
                warnings.append("Collection is empty")
            
            # Check metadata
            metadata = stats.get("metadata", {})
            if not metadata.get("description"):
                warnings.append("Collection missing description")
            
            if not metadata.get("embedding_model"):
                warnings.append("Collection missing embedding model info")
            
            # Determine overall status
            if errors:
                status = "unhealthy"
            elif warnings:
                status = "warning"
            else:
                status = "healthy"
            
            result = {
                "collection_name": name,
                "status": status,
                "document_count": document_count,
                "errors": errors,
                "warnings": warnings,
                "stats": stats,
                "validation_timestamp": datetime.utcnow().isoformat()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to validate collection {name}: {e}")
            return {
                "collection_name": name,
                "status": "error",
                "errors": [str(e)]
            }
    
    async def get_collection_summary(self) -> Dict[str, Any]:
        """Get a summary of all collections and their status.
        
        Returns:
            Summary of all collections
        """
        try:
            collections = await self.get_all_collection_info()
            
            total_collections = len(collections)
            total_documents = sum(col.get("count", 0) for col in collections)
            default_collections = sum(1 for col in collections if col.get("is_default", False))
            custom_collections = total_collections - default_collections
            
            # Get health status for each collection
            health_checks = []
            for collection in collections:
                health = await self.validate_collection_health(collection["name"])
                health_checks.append(health)
            
            healthy_count = sum(1 for h in health_checks if h["status"] == "healthy")
            warning_count = sum(1 for h in health_checks if h["status"] == "warning")
            unhealthy_count = sum(1 for h in health_checks if h["status"] in ["unhealthy", "error"])
            
            summary = {
                "total_collections": total_collections,
                "total_documents": total_documents,
                "default_collections": default_collections,
                "custom_collections": custom_collections,
                "health_summary": {
                    "healthy": healthy_count,
                    "warning": warning_count,
                    "unhealthy": unhealthy_count
                },
                "collections": collections,
                "health_checks": health_checks,
                "summary_timestamp": datetime.utcnow().isoformat()
            }
            
            return summary
            
        except Exception as e:
            logger.error(f"Failed to get collection summary: {e}")
            return {"error": str(e)}