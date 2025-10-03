"""Vector database service for document ingestion and similarity search."""

import logging
import time
from typing import List, Dict, Any, Optional, Union
from uuid import uuid4

from ..models.api_models import RetrievalResult
from ..models.product_models import BaseExtractionDocument, DocumentSection, PropertySpecification
from ..vector import VectorStore, DocumentChunk, VectorSearchResult, CollectionManager
from ..vector.config import VectorStoreFactory, VectorStoreType

logger = logging.getLogger(__name__)


class VectorService:
    """Service for vector database operations."""
    
    def __init__(self, vector_store: Optional[VectorStore] = None):
        """Initialize vector service.
        
        Args:
            vector_store: Vector store instance (creates default if None)
        """
        if vector_store is None:
            self.vector_store = VectorStoreFactory.create_from_env(VectorStoreType.CHROMA)
        else:
            self.vector_store = vector_store
        
        self.collection_manager = CollectionManager(self.vector_store)
        self._initialized = False
    
    async def initialize(self) -> bool:
        """Initialize the vector service and default collections.
        
        Returns:
            True if initialization successful
        """
        try:
            # Initialize default collections
            results = await self.collection_manager.initialize_default_collections()
            
            # Check if all collections were created successfully
            success_count = sum(1 for success in results.values() if success)
            total_count = len(results)
            
            if success_count == total_count:
                logger.info(f"Successfully initialized {success_count}/{total_count} collections")
                self._initialized = True
                return True
            else:
                logger.warning(f"Initialized {success_count}/{total_count} collections")
                self._initialized = True  # Partial success is still usable
                return True
                
        except Exception as e:
            logger.error(f"Failed to initialize vector service: {e}")
            return False
    
    async def health_check(self) -> Dict[str, Any]:
        """Check vector service health.
        
        Returns:
            Health status information
        """
        try:
            # Check vector store health
            store_health = await self.vector_store.health_check()
            
            # Get collection summary
            collection_summary = await self.collection_manager.get_collection_summary()
            
            # Determine overall health
            store_healthy = store_health.get("status") == "healthy"
            collections_healthy = collection_summary.get("health_summary", {}).get("unhealthy", 0) == 0
            
            overall_status = "healthy" if store_healthy and collections_healthy else "degraded"
            
            return {
                "status": overall_status,
                "initialized": self._initialized,
                "vector_store": store_health,
                "collections": collection_summary,
                "timestamp": time.time()
            }
            
        except Exception as e:
            logger.error(f"Vector service health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "initialized": self._initialized,
                "timestamp": time.time()
            }
    
    async def ingest_document(
        self,
        document: BaseExtractionDocument,
        collection_name: str = "technical_bulletins",
        chunk_strategy: str = "semantic"
    ) -> Dict[str, Any]:
        """Ingest a document into the vector database.
        
        Args:
            document: Document to ingest
            collection_name: Target collection
            chunk_strategy: Chunking strategy to use
            
        Returns:
            Ingestion results
        """
        try:
            start_time = time.time()
            
            # Check if collection exists
            if not await self.vector_store.collection_exists(collection_name):
                logger.error(f"Collection {collection_name} does not exist")
                return {
                    "success": False,
                    "error": f"Collection {collection_name} does not exist",
                    "chunks_created": 0
                }
            
            # Create document chunks
            chunks = await self._create_document_chunks(document, chunk_strategy)
            
            if not chunks:
                logger.warning(f"No chunks created for document {document.filename}")
                return {
                    "success": False,
                    "error": "No chunks created from document",
                    "chunks_created": 0
                }
            
            # Add chunks to vector store
            success = await self.vector_store.add_documents(collection_name, chunks)
            
            processing_time = time.time() - start_time
            
            result = {
                "success": success,
                "document_id": document.doc_id,
                "filename": document.filename,
                "collection": collection_name,
                "chunks_created": len(chunks),
                "processing_time_ms": int(processing_time * 1000),
                "chunk_strategy": chunk_strategy
            }
            
            if success:
                logger.info(f"Successfully ingested document {document.filename} with {len(chunks)} chunks")
            else:
                logger.error(f"Failed to ingest document {document.filename}")
                result["error"] = "Failed to add chunks to vector store"
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to ingest document {document.filename}: {e}")
            return {
                "success": False,
                "error": str(e),
                "document_id": document.doc_id,
                "filename": document.filename,
                "chunks_created": 0
            }
    
    async def search(
        self,
        query: str,
        collection_name: str = "technical_bulletins",
        k: int = 10,
        filters: Optional[Dict[str, Any]] = None,
        min_score: float = 0.0
    ) -> List[RetrievalResult]:
        """Perform similarity search in vector database.
        
        Args:
            query: Search query
            collection_name: Collection to search
            k: Number of results to return
            filters: Optional metadata filters
            min_score: Minimum similarity score
            
        Returns:
            List of retrieval results
        """
        try:
            # Check if collection exists
            if not await self.vector_store.collection_exists(collection_name):
                logger.error(f"Collection {collection_name} does not exist")
                return []
            
            # Perform vector search
            search_results = await self.vector_store.similarity_search(
                collection_name=collection_name,
                query=query,
                k=k,
                filter_metadata=filters,
                include_distances=True
            )
            
            # Convert to RetrievalResult format and filter by score
            retrieval_results = []
            for result in search_results:
                if result.score >= min_score:
                    retrieval_result = RetrievalResult(
                        content=result.content,
                        score=result.score,
                        source="vector",
                        metadata=result.metadata,
                        provenance={
                            "collection": collection_name,
                            "document_id": result.metadata.get("document_id"),
                            "chunk_id": result.id,
                            "distance": result.distance
                        }
                    )
                    retrieval_results.append(retrieval_result)
            
            logger.info(f"Found {len(retrieval_results)} results for query in {collection_name}")
            return retrieval_results
            
        except Exception as e:
            logger.error(f"Failed to search in collection {collection_name}: {e}")
            return []
    
    async def search_multiple_collections(
        self,
        query: str,
        collection_names: List[str],
        k_per_collection: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        min_score: float = 0.0
    ) -> List[RetrievalResult]:
        """Search across multiple collections and merge results.
        
        Args:
            query: Search query
            collection_names: Collections to search
            k_per_collection: Results per collection
            filters: Optional metadata filters
            min_score: Minimum similarity score
            
        Returns:
            Merged and sorted retrieval results
        """
        try:
            all_results = []
            
            # Search each collection
            for collection_name in collection_names:
                results = await self.search(
                    query=query,
                    collection_name=collection_name,
                    k=k_per_collection,
                    filters=filters,
                    min_score=min_score
                )
                all_results.extend(results)
            
            # Sort by score (descending)
            all_results.sort(key=lambda x: x.score, reverse=True)
            
            logger.info(f"Found {len(all_results)} total results across {len(collection_names)} collections")
            return all_results
            
        except Exception as e:
            logger.error(f"Failed to search multiple collections: {e}")
            return []
    
    async def get_document_chunks(
        self,
        document_id: str,
        collection_name: str = "technical_bulletins"
    ) -> List[DocumentChunk]:
        """Get all chunks for a specific document.
        
        Args:
            document_id: Document ID
            collection_name: Collection to search
            
        Returns:
            List of document chunks
        """
        try:
            # Search for chunks with matching document_id
            search_results = await self.vector_store.similarity_search(
                collection_name=collection_name,
                query="",  # Empty query to get all results
                k=1000,  # Large number to get all chunks
                filter_metadata={"document_id": document_id}
            )
            
            # Convert to DocumentChunk format
            chunks = []
            for result in search_results:
                chunk = DocumentChunk(
                    id=result.id,
                    content=result.content,
                    metadata=result.metadata
                )
                chunks.append(chunk)
            
            logger.info(f"Found {len(chunks)} chunks for document {document_id}")
            return chunks
            
        except Exception as e:
            logger.error(f"Failed to get chunks for document {document_id}: {e}")
            return []
    
    async def delete_document(
        self,
        document_id: str,
        collection_name: str = "technical_bulletins"
    ) -> bool:
        """Delete all chunks for a specific document.
        
        Args:
            document_id: Document ID
            collection_name: Collection to delete from
            
        Returns:
            True if deletion successful
        """
        try:
            # Get all chunk IDs for the document
            chunks = await self.get_document_chunks(document_id, collection_name)
            
            if not chunks:
                logger.warning(f"No chunks found for document {document_id}")
                return True  # Nothing to delete
            
            chunk_ids = [chunk.id for chunk in chunks]
            
            # Delete chunks
            success = await self.vector_store.delete_documents(collection_name, chunk_ids)
            
            if success:
                logger.info(f"Deleted {len(chunk_ids)} chunks for document {document_id}")
            else:
                logger.error(f"Failed to delete chunks for document {document_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to delete document {document_id}: {e}")
            return False
    
    async def get_collection_stats(self, collection_name: str) -> Dict[str, Any]:
        """Get statistics for a collection.
        
        Args:
            collection_name: Collection name
            
        Returns:
            Collection statistics
        """
        try:
            return await self.vector_store.get_collection_stats(collection_name)
        except Exception as e:
            logger.error(f"Failed to get stats for collection {collection_name}: {e}")
            return {}
    
    async def list_collections(self) -> List[Dict[str, Any]]:
        """List all collections with detailed information.
        
        Returns:
            List of collection information
        """
        try:
            return await self.collection_manager.get_all_collection_info()
        except Exception as e:
            logger.error(f"Failed to list collections: {e}")
            return []
    
    async def _create_document_chunks(
        self,
        document: BaseExtractionDocument,
        chunk_strategy: str = "semantic"
    ) -> List[DocumentChunk]:
        """Create chunks from a document.
        
        Args:
            document: Document to chunk
            chunk_strategy: Chunking strategy
            
        Returns:
            List of document chunks
        """
        chunks = []
        
        try:
            # Base metadata for all chunks
            base_metadata = {
                "document_id": document.doc_id,
                "filename": document.filename,
                "document_type": document.document_type,
                "manufacturer": document.manufacturer,
                "product_name": document.product_info.product_name,
                "product_family": document.product_info.product_family,
                "cas_number": document.product_info.cas_number,
                "extraction_date": document.extraction_metadata.extraction_date,
                "has_images": document.has_images
            }
            
            # Chunk 1: Product information and key benefits
            product_content = self._format_product_info(document)
            if product_content:
                chunks.append(DocumentChunk(
                    id=f"{document.doc_id}_product_info",
                    content=product_content,
                    metadata={
                        **base_metadata,
                        "chunk_type": "product_info",
                        "section": "Product Information"
                    }
                ))
            
            # Chunk 2: Applications
            if document.applications:
                applications_content = f"Applications for {document.product_info.product_name}:\n"
                applications_content += "\n".join(f"• {app}" for app in document.applications)
                
                if document.applications_text:
                    applications_content += f"\n\nDetailed Applications:\n{document.applications_text}"
                
                chunks.append(DocumentChunk(
                    id=f"{document.doc_id}_applications",
                    content=applications_content,
                    metadata={
                        **base_metadata,
                        "chunk_type": "applications",
                        "section": "Applications"
                    }
                ))
            
            # Chunk 3: Properties and specifications
            if document.properties_and_specifications:
                properties_content = self._format_properties(document.properties_and_specifications)
                if properties_content:
                    chunks.append(DocumentChunk(
                        id=f"{document.doc_id}_properties",
                        content=properties_content,
                        metadata={
                            **base_metadata,
                            "chunk_type": "properties",
                            "section": "Properties and Specifications"
                        }
                    ))
            
            # Chunk 4: Typical properties table
            if document.typical_properties and document.typical_properties.data:
                typical_props_content = self._format_typical_properties(document.typical_properties)
                if typical_props_content:
                    chunks.append(DocumentChunk(
                        id=f"{document.doc_id}_typical_properties",
                        content=typical_props_content,
                        metadata={
                            **base_metadata,
                            "chunk_type": "typical_properties",
                            "section": "Typical Properties",
                            "page": document.typical_properties.page
                        }
                    ))
            
            # Chunks for document sections
            for i, section in enumerate(document.sections):
                if section.content.strip():
                    chunks.append(DocumentChunk(
                        id=f"{document.doc_id}_section_{i}",
                        content=f"Section: {section.name}\n\n{section.content}",
                        metadata={
                            **base_metadata,
                            "chunk_type": "section",
                            "section": section.name,
                            "page": section.page
                        }
                    ))
            
            # Chunk for safety and regulatory information
            if document.toxicity_data or document.registrations:
                safety_content = self._format_safety_info(document)
                if safety_content:
                    chunks.append(DocumentChunk(
                        id=f"{document.doc_id}_safety",
                        content=safety_content,
                        metadata={
                            **base_metadata,
                            "chunk_type": "safety",
                            "section": "Safety and Regulatory"
                        }
                    ))
            
            logger.info(f"Created {len(chunks)} chunks for document {document.filename}")
            return chunks
            
        except Exception as e:
            logger.error(f"Failed to create chunks for document {document.filename}: {e}")
            return []
    
    def _format_product_info(self, document: BaseExtractionDocument) -> str:
        """Format product information into text."""
        content = f"Product: {document.product_info.product_name}\n"
        
        if document.product_info.product_short_name:
            content += f"Short Name: {document.product_info.product_short_name}\n"
        
        if document.product_info.product_family:
            content += f"Family: {document.product_info.product_family}\n"
        
        if document.product_info.cas_number:
            content += f"CAS Number: {document.product_info.cas_number}\n"
        
        if document.product_info.chemical_name:
            content += f"Chemical Name: {document.product_info.chemical_name}\n"
        
        if document.product_info.synonyms:
            content += f"Synonyms: {', '.join(document.product_info.synonyms)}\n"
        
        content += f"Manufacturer: {document.manufacturer}\n"
        
        if document.key_benefits:
            content += "\nKey Benefits:\n"
            content += "\n".join(f"• {benefit}" for benefit in document.key_benefits)
        
        return content
    
    def _format_properties(self, properties: List[PropertySpecification]) -> str:
        """Format properties and specifications into text."""
        if not properties:
            return ""
        
        content = "Properties and Specifications:\n\n"
        
        # Group by category
        categories = {}
        for prop in properties:
            if prop.category not in categories:
                categories[prop.category] = []
            categories[prop.category].append(prop)
        
        for category, props in categories.items():
            content += f"{category}:\n"
            for prop in props:
                prop_line = f"• {prop.name}: "
                
                if prop.value_string:
                    prop_line += prop.value_string
                elif prop.value_numeric is not None:
                    prop_line += str(prop.value_numeric)
                    if prop.unit:
                        prop_line += f" {prop.unit}"
                elif prop.value_min is not None and prop.value_max is not None:
                    prop_line += f"{prop.value_min} - {prop.value_max}"
                    if prop.unit:
                        prop_line += f" {prop.unit}"
                elif prop.value_min is not None:
                    prop_line += f"≥ {prop.value_min}"
                    if prop.unit:
                        prop_line += f" {prop.unit}"
                elif prop.value_max is not None:
                    prop_line += f"≤ {prop.value_max}"
                    if prop.unit:
                        prop_line += f" {prop.unit}"
                
                if prop.test_method:
                    prop_line += f" (Test Method: {prop.test_method})"
                
                content += prop_line + "\n"
            
            content += "\n"
        
        return content
    
    def _format_typical_properties(self, typical_props) -> str:
        """Format typical properties table into text."""
        content = f"Typical Properties - {typical_props.table_name}:\n"
        content += f"{typical_props.description}\n\n"
        
        for prop in typical_props.data:
            prop_line = f"• {prop.name}: "
            
            if prop.value_string:
                prop_line += prop.value_string
            elif prop.value_numeric is not None:
                prop_line += str(prop.value_numeric)
                if prop.unit:
                    prop_line += f" {prop.unit}"
            elif prop.value_min is not None and prop.value_max is not None:
                prop_line += f"{prop.value_min} - {prop.value_max}"
                if prop.unit:
                    prop_line += f" {prop.unit}"
            
            if prop.test_method:
                prop_line += f" (Test Method: {prop.test_method})"
            
            content += prop_line + "\n"
        
        if typical_props.table_notes:
            content += "\nNotes:\n"
            for note in typical_props.table_notes:
                content += f"{note.key}: {note.text}\n"
        
        return content
    
    def _format_safety_info(self, document: BaseExtractionDocument) -> str:
        """Format safety and regulatory information into text."""
        content = ""
        
        if document.registrations:
            content += "Registrations:\n"
            for reg in document.registrations:
                content += f"• {reg.type}: {reg.number} ({reg.authority})"
                if reg.status:
                    content += f" - Status: {reg.status}"
                if reg.notes:
                    content += f" - {reg.notes}"
                content += "\n"
            content += "\n"
        
        if document.toxicity_data:
            content += "Toxicity Data:\n"
            for tox in document.toxicity_data:
                tox_line = f"• {tox.test_type}"
                if tox.species:
                    tox_line += f" ({tox.species})"
                if tox.route:
                    tox_line += f" - Route: {tox.route}"
                if tox.value and tox.unit:
                    tox_line += f" - {tox.value} {tox.unit}"
                if tox.classification:
                    tox_line += f" - Classification: {tox.classification}"
                content += tox_line + "\n"
        
        return content