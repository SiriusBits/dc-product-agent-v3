"""Document ingestion service for processing and indexing documents."""

import logging
import time
from typing import Any, Optional

from ..models.api_models import RetrievalResult
from ..models.product_models import BaseExtractionDocument
from .document_processor import ChunkingStrategy, DocumentProcessor, EmbeddingConfig
from .kg_ingestion_service import KGIngestionService
from .metadata_enrichment import MetadataEnrichmentService
from .vector_service import VectorService

logger = logging.getLogger(__name__)


class IngestionService:
    """Service for document ingestion and processing."""

    def __init__(
        self, 
        vector_service: VectorService,
        kg_ingestion_service: Optional[KGIngestionService] = None,
        embedding_config: Optional[EmbeddingConfig] = None,
    ):
        """Initialize ingestion service.

        Args:
            vector_service: Vector service for document storage
            kg_ingestion_service: Knowledge graph ingestion service
            embedding_config: Configuration for embedding generation
        """
        self.vector_service = vector_service
        self.kg_ingestion_service = kg_ingestion_service
        self.document_processor = DocumentProcessor(embedding_config)
        self.metadata_enrichment = MetadataEnrichmentService()

    async def ingest_extraction_document(
        self,
        document: BaseExtractionDocument,
        collection_name: str = "technical_bulletins",
        overwrite: bool = False,
        chunking_strategy: ChunkingStrategy = ChunkingStrategy.SEMANTIC,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        generate_embeddings: bool = True,
        ingest_to_kg: bool = True,
    ) -> dict[str, Any]:
        """Ingest a pre-extracted document into the vector database.

        Args:
            document: Extracted document to ingest
            collection_name: Target collection
            overwrite: Whether to overwrite existing document
            chunking_strategy: Strategy for document chunking
            chunk_size: Maximum chunk size in characters
            chunk_overlap: Overlap between chunks in characters
            generate_embeddings: Whether to generate embeddings
            ingest_to_kg: Whether to ingest entities to knowledge graph

        Returns:
            Ingestion results
        """
        try:
            start_time = time.time()

            # Check if document already exists
            if document.doc_id and not overwrite:
                existing_chunks = await self.vector_service.get_document_chunks(
                    document.doc_id, collection_name
                )
                if existing_chunks:
                    logger.warning(
                        f"Document {document.doc_id} already exists in {collection_name}"
                    )
                    return {
                        "success": False,
                        "error": "Document already exists (use overwrite=True to replace)",
                        "document_id": document.doc_id,
                        "existing_chunks": len(existing_chunks),
                    }

            # Delete existing document if overwriting
            if document.doc_id and overwrite:
                await self.vector_service.delete_document(
                    document.doc_id, collection_name
                )
                logger.info(
                    f"Deleted existing document {document.doc_id} for overwrite"
                )

            # Process document with enhanced chunking and embedding generation
            async with self.document_processor as processor:
                processed_doc = await processor.process_document(
                    document=document,
                    chunking_strategy=chunking_strategy,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                    generate_embeddings=generate_embeddings,
                )
            
            # Enrich metadata
            enriched_metadata = self.metadata_enrichment.enrich_document_metadata(document)
            
            # Add enriched metadata to chunks
            for chunk in processed_doc.chunks:
                chunk.metadata.update({
                    "completeness_score": enriched_metadata.completeness_score,
                    "extraction_confidence": enriched_metadata.extraction_confidence,
                    "data_richness_score": enriched_metadata.data_richness_score,
                    "content_categories": enriched_metadata.content_categories,
                    "property_categories": enriched_metadata.property_categories,
                    "application_domains": enriched_metadata.application_domains,
                    "keywords": enriched_metadata.keywords[:10],  # Limit for storage
                })
            
            # Ingest processed chunks
            success = await self.vector_service.vector_store.add_documents(
                collection_name, processed_doc.chunks
            )
            
            # Ingest to knowledge graph if requested and service available
            kg_result = None
            if ingest_to_kg and self.kg_ingestion_service:
                try:
                    kg_result = await self.kg_ingestion_service.ingest_document_entities(
                        document=document,
                        validate_entities=True,
                        deduplicate=True,
                    )
                except Exception as e:
                    logger.error(f"Failed to ingest to knowledge graph: {e}")
                    kg_result = {"success": False, "error": str(e)}
            
            result = {
                "success": success,
                "document_id": document.doc_id,
                "filename": document.filename,
                "collection": collection_name,
                "chunks_created": len(processed_doc.chunks),
                "chunking_strategy": chunking_strategy.value,
                "embeddings_generated": generate_embeddings,
                "enrichment_summary": self.metadata_enrichment.get_enrichment_summary(enriched_metadata),
                "kg_ingestion": kg_result,
            }

            processing_time = time.time() - start_time
            result["total_processing_time_ms"] = int(processing_time * 1000)

            if result["success"]:
                logger.info(f"Successfully ingested document {document.filename}")
            else:
                logger.error(f"Failed to ingest document {document.filename}")

            return result

        except Exception as e:
            logger.error(
                f"Failed to ingest extraction document {document.filename}: {e}"
            )
            return {
                "success": False,
                "error": str(e),
                "document_id": document.doc_id,
                "filename": document.filename,
            }

    async def batch_ingest_documents(
        self,
        documents: list[BaseExtractionDocument],
        collection_name: str = "technical_bulletins",
        overwrite: bool = False,
        continue_on_error: bool = True,
    ) -> dict[str, Any]:
        """Ingest multiple documents in batch.

        Args:
            documents: List of documents to ingest
            collection_name: Target collection
            overwrite: Whether to overwrite existing documents
            continue_on_error: Whether to continue if individual documents fail

        Returns:
            Batch ingestion results
        """
        try:
            start_time = time.time()

            results = []
            successful = 0
            failed = 0

            for i, document in enumerate(documents):
                logger.info(
                    f"Processing document {i+1}/{len(documents)}: {document.filename}"
                )

                try:
                    result = await self.ingest_extraction_document(
                        document=document,
                        collection_name=collection_name,
                        overwrite=overwrite,
                    )

                    results.append(
                        {
                            "index": i,
                            "document_id": document.doc_id,
                            "filename": document.filename,
                            "result": result,
                        }
                    )

                    if result["success"]:
                        successful += 1
                    else:
                        failed += 1
                        if not continue_on_error:
                            logger.error(
                                f"Stopping batch ingestion due to error: {result.get('error')}"
                            )
                            break

                except Exception as e:
                    failed += 1
                    error_result = {
                        "index": i,
                        "document_id": document.doc_id,
                        "filename": document.filename,
                        "result": {"success": False, "error": str(e)},
                    }
                    results.append(error_result)

                    if not continue_on_error:
                        logger.error(f"Stopping batch ingestion due to exception: {e}")
                        break

            processing_time = time.time() - start_time

            batch_result = {
                "success": failed == 0,
                "total_documents": len(documents),
                "successful": successful,
                "failed": failed,
                "collection": collection_name,
                "processing_time_ms": int(processing_time * 1000),
                "results": results,
            }

            logger.info(
                f"Batch ingestion completed: {successful}/{len(documents)} successful"
            )
            return batch_result

        except Exception as e:
            logger.error(f"Batch ingestion failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "total_documents": len(documents),
                "successful": 0,
                "failed": len(documents),
            }

    async def search_documents(
        self,
        query: str,
        collection_names: list[str] | None = None,
        k: int = 10,
        filters: dict[str, Any] | None = None,
        min_score: float = 0.0,
    ) -> list[RetrievalResult]:
        """Search for documents across collections.

        Args:
            query: Search query
            collection_names: Collections to search (defaults to all)
            k: Number of results to return
            filters: Optional metadata filters
            min_score: Minimum similarity score

        Returns:
            List of retrieval results
        """
        try:
            if collection_names is None:
                # Get all available collections
                collections = await self.vector_service.list_collections()
                collection_names = [col["name"] for col in collections]

            if not collection_names:
                logger.warning("No collections available for search")
                return []

            # Search across multiple collections
            results = await self.vector_service.search_multiple_collections(
                query=query,
                collection_names=collection_names,
                k_per_collection=max(1, k // len(collection_names)),
                filters=filters,
                min_score=min_score,
            )

            # Limit to requested number of results
            return results[:k]

        except Exception as e:
            logger.error(f"Failed to search documents: {e}")
            return []

    async def get_document_info(
        self, document_id: str, collection_name: str = "technical_bulletins"
    ) -> dict[str, Any] | None:
        """Get information about a specific document.

        Args:
            document_id: Document ID
            collection_name: Collection to search

        Returns:
            Document information or None if not found
        """
        try:
            chunks = await self.vector_service.get_document_chunks(
                document_id, collection_name
            )

            if not chunks:
                return None

            # Extract document metadata from first chunk
            metadata = chunks[0].metadata

            # Count chunks by type
            chunk_types = {}
            for chunk in chunks:
                chunk_type = chunk.metadata.get("chunk_type", "unknown")
                chunk_types[chunk_type] = chunk_types.get(chunk_type, 0) + 1

            return {
                "document_id": document_id,
                "filename": metadata.get("filename"),
                "document_type": metadata.get("document_type"),
                "manufacturer": metadata.get("manufacturer"),
                "product_name": metadata.get("product_name"),
                "product_family": metadata.get("product_family"),
                "cas_number": metadata.get("cas_number"),
                "extraction_date": metadata.get("extraction_date"),
                "has_images": metadata.get("has_images", False),
                "total_chunks": len(chunks),
                "chunk_types": chunk_types,
                "collection": collection_name,
            }

        except Exception as e:
            logger.error(f"Failed to get document info for {document_id}: {e}")
            return None

    async def delete_document(
        self, document_id: str, collection_name: str = "technical_bulletins"
    ) -> dict[str, Any]:
        """Delete a document from the vector database.

        Args:
            document_id: Document ID to delete
            collection_name: Collection to delete from

        Returns:
            Deletion results
        """
        try:
            # Get document info before deletion
            doc_info = await self.get_document_info(document_id, collection_name)

            if not doc_info:
                return {
                    "success": False,
                    "error": "Document not found",
                    "document_id": document_id,
                }

            # Delete the document
            success = await self.vector_service.delete_document(
                document_id, collection_name
            )

            result = {
                "success": success,
                "document_id": document_id,
                "collection": collection_name,
                "chunks_deleted": doc_info["total_chunks"] if success else 0,
            }

            if success:
                logger.info(
                    f"Deleted document {document_id} with {doc_info['total_chunks']} chunks"
                )
            else:
                logger.error(f"Failed to delete document {document_id}")
                result["error"] = "Failed to delete document chunks"

            return result

        except Exception as e:
            logger.error(f"Failed to delete document {document_id}: {e}")
            return {"success": False, "error": str(e), "document_id": document_id}

    async def get_ingestion_stats(self) -> dict[str, Any]:
        """Get ingestion statistics across all collections.

        Returns:
            Ingestion statistics
        """
        try:
            collections = await self.vector_service.list_collections()


            total_chunks = 0
            collection_stats = []

            for collection in collections:
                stats = await self.vector_service.get_collection_stats(
                    collection["name"]
                )

                collection_stat = {
                    "name": collection["name"],
                    "document_count": stats.get("count", 0),
                    "description": collection.get("metadata", {}).get(
                        "description", ""
                    ),
                    "created_at": collection.get("metadata", {}).get("created_at"),
                }

                collection_stats.append(collection_stat)
                total_chunks += stats.get("count", 0)

            # Estimate document count (assuming average of 5 chunks per document)
            estimated_documents = total_chunks // 5 if total_chunks > 0 else 0

            return {
                "total_collections": len(collections),
                "total_chunks": total_chunks,
                "estimated_documents": estimated_documents,
                "collections": collection_stats,
                "timestamp": time.time(),
            }

        except Exception as e:
            logger.error(f"Failed to get ingestion stats: {e}")
            return {
                "error": str(e),
                "total_collections": 0,
                "total_chunks": 0,
                "estimated_documents": 0,
            }
