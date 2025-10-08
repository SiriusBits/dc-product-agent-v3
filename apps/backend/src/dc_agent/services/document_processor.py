"""Document processing service for chunking and embedding generation."""

import asyncio
import logging
import time
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import httpx
from pydantic import BaseModel, Field

from ..models.product_models import BaseExtractionDocument
from ..vector import DocumentChunk

logger = logging.getLogger(__name__)


class ChunkingStrategy(str, Enum):
    """Available chunking strategies."""
    
    SEMANTIC = "semantic"
    FIXED_SIZE = "fixed_size"
    SECTION_BASED = "section_based"
    HYBRID = "hybrid"


class ChunkMetadata(BaseModel):
    """Metadata for document chunks."""
    
    document_id: str
    filename: str
    document_type: str
    manufacturer: str
    product_name: str
    product_family: Optional[str] = None
    cas_number: Optional[str] = None
    extraction_date: str
    has_images: bool = False
    chunk_type: str
    section: str
    page: Optional[int] = None
    chunk_index: int
    total_chunks: int
    chunk_size: int
    overlap_size: int = 0


class ProcessedDocument(BaseModel):
    """Result of document processing."""
    
    document_id: str
    filename: str
    chunks: List[DocumentChunk]
    processing_time_ms: int
    chunking_strategy: ChunkingStrategy
    metadata: Dict[str, Any]


class EmbeddingConfig(BaseModel):
    """Configuration for embedding generation."""
    
    model_name: str = "nomic-embed-text"
    ollama_base_url: str = "http://localhost:11434"
    batch_size: int = 10
    max_retries: int = 3
    timeout_seconds: int = 30
    normalize_embeddings: bool = True


class DocumentProcessor:
    """Service for processing documents into chunks with embeddings."""

    def __init__(self, embedding_config: Optional[EmbeddingConfig] = None):
        """Initialize document processor.
        
        Args:
            embedding_config: Configuration for embedding generation
        """
        self.embedding_config = embedding_config or EmbeddingConfig()
        self._client = httpx.AsyncClient(timeout=self.embedding_config.timeout_seconds)
        
    async def __aenter__(self):
        """Async context manager entry."""
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self._client.aclose()

    async def process_document(
        self,
        document: BaseExtractionDocument,
        chunking_strategy: ChunkingStrategy = ChunkingStrategy.SEMANTIC,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        generate_embeddings: bool = True,
    ) -> ProcessedDocument:
        """Process a document into chunks with optional embeddings.
        
        Args:
            document: Document to process
            chunking_strategy: Strategy for chunking
            chunk_size: Maximum chunk size in characters
            chunk_overlap: Overlap between chunks in characters
            generate_embeddings: Whether to generate embeddings
            
        Returns:
            Processed document with chunks
        """
        start_time = time.time()
        
        try:
            # Create chunks based on strategy
            chunks = await self._create_chunks(
                document=document,
                strategy=chunking_strategy,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
            )
            
            # Generate embeddings if requested
            if generate_embeddings and chunks:
                await self._generate_embeddings(chunks)
            
            processing_time = int((time.time() - start_time) * 1000)
            
            return ProcessedDocument(
                document_id=document.doc_id,
                filename=document.filename,
                chunks=chunks,
                processing_time_ms=processing_time,
                chunking_strategy=chunking_strategy,
                metadata={
                    "chunk_count": len(chunks),
                    "total_characters": sum(len(chunk.content) for chunk in chunks),
                    "average_chunk_size": sum(len(chunk.content) for chunk in chunks) / len(chunks) if chunks else 0,
                    "embeddings_generated": generate_embeddings,
                },
            )
            
        except Exception as e:
            logger.error(f"Failed to process document {document.filename}: {e}")
            raise

    async def _create_chunks(
        self,
        document: BaseExtractionDocument,
        strategy: ChunkingStrategy,
        chunk_size: int,
        chunk_overlap: int,
    ) -> List[DocumentChunk]:
        """Create chunks from document based on strategy."""
        
        if strategy == ChunkingStrategy.SEMANTIC:
            return await self._create_semantic_chunks(document)
        elif strategy == ChunkingStrategy.SECTION_BASED:
            return await self._create_section_based_chunks(document, chunk_size, chunk_overlap)
        elif strategy == ChunkingStrategy.FIXED_SIZE:
            return await self._create_fixed_size_chunks(document, chunk_size, chunk_overlap)
        elif strategy == ChunkingStrategy.HYBRID:
            return await self._create_hybrid_chunks(document, chunk_size, chunk_overlap)
        else:
            raise ValueError(f"Unknown chunking strategy: {strategy}")

    async def _create_semantic_chunks(self, document: BaseExtractionDocument) -> List[DocumentChunk]:
        """Create semantically meaningful chunks based on document structure."""
        chunks = []
        chunk_index = 0
        
        # Base metadata for all chunks
        base_metadata = self._create_base_metadata(document)
        
        # Chunk 1: Product overview and key information
        product_content = self._format_product_overview(document)
        if product_content:
            chunks.append(
                DocumentChunk(
                    id=f"{document.doc_id}_product_overview",
                    content=product_content,
                    metadata={
                        **base_metadata,
                        "chunk_type": "product_overview",
                        "section": "Product Overview",
                        "chunk_index": chunk_index,
                        "chunk_size": len(product_content),
                    },
                )
            )
            chunk_index += 1

        # Chunk 2: Applications and benefits
        applications_content = self._format_applications(document)
        if applications_content:
            chunks.append(
                DocumentChunk(
                    id=f"{document.doc_id}_applications",
                    content=applications_content,
                    metadata={
                        **base_metadata,
                        "chunk_type": "applications",
                        "section": "Applications and Benefits",
                        "chunk_index": chunk_index,
                        "chunk_size": len(applications_content),
                    },
                )
            )
            chunk_index += 1

        # Chunk 3: Properties and specifications
        properties_content = self._format_properties(document)
        if properties_content:
            chunks.append(
                DocumentChunk(
                    id=f"{document.doc_id}_properties",
                    content=properties_content,
                    metadata={
                        **base_metadata,
                        "chunk_type": "properties",
                        "section": "Properties and Specifications",
                        "chunk_index": chunk_index,
                        "chunk_size": len(properties_content),
                    },
                )
            )
            chunk_index += 1

        # Chunk 4: Typical properties table
        if document.typical_properties and document.typical_properties.data:
            typical_props_content = self._format_typical_properties(document.typical_properties)
            if typical_props_content:
                chunks.append(
                    DocumentChunk(
                        id=f"{document.doc_id}_typical_properties",
                        content=typical_props_content,
                        metadata={
                            **base_metadata,
                            "chunk_type": "typical_properties",
                            "section": "Typical Properties",
                            "page": document.typical_properties.page,
                            "chunk_index": chunk_index,
                            "chunk_size": len(typical_props_content),
                        },
                    )
                )
                chunk_index += 1

        # Chunks for document sections
        for i, section in enumerate(document.sections):
            if section.content and section.content.strip():
                section_content = f"Section: {section.name}\n\n{section.content}"
                chunks.append(
                    DocumentChunk(
                        id=f"{document.doc_id}_section_{i}",
                        content=section_content,
                        metadata={
                            **base_metadata,
                            "chunk_type": "section",
                            "section": section.name,
                            "page": section.page,
                            "chunk_index": chunk_index,
                            "chunk_size": len(section_content),
                        },
                    )
                )
                chunk_index += 1

        # Chunk for safety and regulatory information
        safety_content = self._format_safety_info(document)
        if safety_content:
            chunks.append(
                DocumentChunk(
                    id=f"{document.doc_id}_safety",
                    content=safety_content,
                    metadata={
                        **base_metadata,
                        "chunk_type": "safety",
                        "section": "Safety and Regulatory",
                        "chunk_index": chunk_index,
                        "chunk_size": len(safety_content),
                    },
                )
            )
            chunk_index += 1

        # Update total chunks in metadata
        for chunk in chunks:
            chunk.metadata["total_chunks"] = len(chunks)

        logger.info(f"Created {len(chunks)} semantic chunks for document {document.filename}")
        return chunks

    async def _create_section_based_chunks(
        self, document: BaseExtractionDocument, chunk_size: int, chunk_overlap: int
    ) -> List[DocumentChunk]:
        """Create chunks based on document sections with size limits."""
        chunks = []
        chunk_index = 0
        
        base_metadata = self._create_base_metadata(document)
        
        # Process each section separately
        sections_to_process = [
            ("Product Overview", self._format_product_overview(document)),
            ("Applications", self._format_applications(document)),
            ("Properties", self._format_properties(document)),
        ]
        
        # Add document sections
        for section in document.sections:
            if section.content and section.content.strip():
                sections_to_process.append((section.name, section.content))
        
        # Add safety info
        safety_content = self._format_safety_info(document)
        if safety_content:
            sections_to_process.append(("Safety and Regulatory", safety_content))
        
        for section_name, content in sections_to_process:
            if not content:
                continue
                
            # Split large sections into smaller chunks
            section_chunks = self._split_text_with_overlap(content, chunk_size, chunk_overlap)
            
            for i, chunk_content in enumerate(section_chunks):
                chunk_id = f"{document.doc_id}_{section_name.lower().replace(' ', '_')}_{i}"
                chunks.append(
                    DocumentChunk(
                        id=chunk_id,
                        content=chunk_content,
                        metadata={
                            **base_metadata,
                            "chunk_type": "section_based",
                            "section": section_name,
                            "chunk_index": chunk_index,
                            "section_chunk_index": i,
                            "chunk_size": len(chunk_content),
                            "overlap_size": chunk_overlap if i > 0 else 0,
                        },
                    )
                )
                chunk_index += 1
        
        # Update total chunks in metadata
        for chunk in chunks:
            chunk.metadata["total_chunks"] = len(chunks)
        
        logger.info(f"Created {len(chunks)} section-based chunks for document {document.filename}")
        return chunks

    async def _create_fixed_size_chunks(
        self, document: BaseExtractionDocument, chunk_size: int, chunk_overlap: int
    ) -> List[DocumentChunk]:
        """Create fixed-size chunks from document content."""
        chunks = []
        chunk_index = 0
        
        base_metadata = self._create_base_metadata(document)
        
        # Combine all document content
        full_content = self._get_full_document_content(document)
        
        # Split into fixed-size chunks
        text_chunks = self._split_text_with_overlap(full_content, chunk_size, chunk_overlap)
        
        for i, chunk_content in enumerate(text_chunks):
            chunks.append(
                DocumentChunk(
                    id=f"{document.doc_id}_chunk_{i}",
                    content=chunk_content,
                    metadata={
                        **base_metadata,
                        "chunk_type": "fixed_size",
                        "section": "Document Content",
                        "chunk_index": chunk_index,
                        "chunk_size": len(chunk_content),
                        "overlap_size": chunk_overlap if i > 0 else 0,
                    },
                )
            )
            chunk_index += 1
        
        # Update total chunks in metadata
        for chunk in chunks:
            chunk.metadata["total_chunks"] = len(chunks)
        
        logger.info(f"Created {len(chunks)} fixed-size chunks for document {document.filename}")
        return chunks

    async def _create_hybrid_chunks(
        self, document: BaseExtractionDocument, chunk_size: int, chunk_overlap: int
    ) -> List[DocumentChunk]:
        """Create hybrid chunks combining semantic and size-based approaches."""
        chunks = []
        chunk_index = 0
        
        base_metadata = self._create_base_metadata(document)
        
        # Start with semantic chunks
        semantic_sections = [
            ("Product Overview", self._format_product_overview(document)),
            ("Applications", self._format_applications(document)),
            ("Properties", self._format_properties(document)),
        ]
        
        for section_name, content in semantic_sections:
            if not content:
                continue
                
            # If content is small enough, keep as single chunk
            if len(content) <= chunk_size:
                chunks.append(
                    DocumentChunk(
                        id=f"{document.doc_id}_{section_name.lower().replace(' ', '_')}",
                        content=content,
                        metadata={
                            **base_metadata,
                            "chunk_type": "hybrid_semantic",
                            "section": section_name,
                            "chunk_index": chunk_index,
                            "chunk_size": len(content),
                        },
                    )
                )
                chunk_index += 1
            else:
                # Split large sections
                section_chunks = self._split_text_with_overlap(content, chunk_size, chunk_overlap)
                for i, chunk_content in enumerate(section_chunks):
                    chunk_id = f"{document.doc_id}_{section_name.lower().replace(' ', '_')}_{i}"
                    chunks.append(
                        DocumentChunk(
                            id=chunk_id,
                            content=chunk_content,
                            metadata={
                                **base_metadata,
                                "chunk_type": "hybrid_split",
                                "section": section_name,
                                "chunk_index": chunk_index,
                                "section_chunk_index": i,
                                "chunk_size": len(chunk_content),
                                "overlap_size": chunk_overlap if i > 0 else 0,
                            },
                        )
                    )
                    chunk_index += 1
        
        # Process remaining sections with size-based chunking
        for section in document.sections:
            if section.content and section.content.strip():
                if len(section.content) <= chunk_size:
                    chunks.append(
                        DocumentChunk(
                            id=f"{document.doc_id}_section_{section.name.lower().replace(' ', '_')}",
                            content=f"Section: {section.name}\n\n{section.content}",
                            metadata={
                                **base_metadata,
                                "chunk_type": "hybrid_section",
                                "section": section.name,
                                "page": section.page,
                                "chunk_index": chunk_index,
                                "chunk_size": len(section.content),
                            },
                        )
                    )
                    chunk_index += 1
                else:
                    section_chunks = self._split_text_with_overlap(section.content, chunk_size, chunk_overlap)
                    for i, chunk_content in enumerate(section_chunks):
                        chunk_id = f"{document.doc_id}_section_{section.name.lower().replace(' ', '_')}_{i}"
                        chunks.append(
                            DocumentChunk(
                                id=chunk_id,
                                content=f"Section: {section.name}\n\n{chunk_content}",
                                metadata={
                                    **base_metadata,
                                    "chunk_type": "hybrid_section_split",
                                    "section": section.name,
                                    "page": section.page,
                                    "chunk_index": chunk_index,
                                    "section_chunk_index": i,
                                    "chunk_size": len(chunk_content),
                                    "overlap_size": chunk_overlap if i > 0 else 0,
                                },
                            )
                        )
                        chunk_index += 1
        
        # Update total chunks in metadata
        for chunk in chunks:
            chunk.metadata["total_chunks"] = len(chunks)
        
        logger.info(f"Created {len(chunks)} hybrid chunks for document {document.filename}")
        return chunks

    def _split_text_with_overlap(self, text: str, chunk_size: int, overlap: int) -> List[str]:
        """Split text into chunks with overlap."""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            
            # If this is not the last chunk, try to break at a sentence or word boundary
            if end < len(text):
                # Look for sentence boundary within the last 100 characters
                sentence_break = text.rfind('.', end - 100, end)
                if sentence_break > start:
                    end = sentence_break + 1
                else:
                    # Look for word boundary
                    word_break = text.rfind(' ', end - 50, end)
                    if word_break > start:
                        end = word_break
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # Move start position with overlap
            start = end - overlap
            if start >= len(text):
                break
        
        return chunks

    async def _generate_embeddings(self, chunks: List[DocumentChunk]) -> None:
        """Generate embeddings for chunks using Ollama."""
        if not chunks:
            return
        
        try:
            # Process chunks in batches
            for i in range(0, len(chunks), self.embedding_config.batch_size):
                batch = chunks[i:i + self.embedding_config.batch_size]
                await self._generate_batch_embeddings(batch)
                
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {e}")
            raise

    async def _generate_batch_embeddings(self, chunks: List[DocumentChunk]) -> None:
        """Generate embeddings for a batch of chunks."""
        texts = [chunk.content for chunk in chunks]
        
        for attempt in range(self.embedding_config.max_retries):
            try:
                # Call Ollama embeddings API
                response = await self._client.post(
                    f"{self.embedding_config.ollama_base_url}/api/embeddings",
                    json={
                        "model": self.embedding_config.model_name,
                        "prompt": texts[0] if len(texts) == 1 else texts,
                    }
                )
                response.raise_for_status()
                
                result = response.json()
                
                # Handle single vs batch response
                if isinstance(result.get("embedding"), list):
                    # Single embedding
                    if len(chunks) == 1:
                        chunks[0].embedding = result["embedding"]
                    else:
                        logger.warning("Expected batch embeddings but got single embedding")
                        chunks[0].embedding = result["embedding"]
                else:
                    # Batch embeddings
                    embeddings = result.get("embeddings", [])
                    for chunk, embedding in zip(chunks, embeddings):
                        chunk.embedding = embedding
                
                logger.debug(f"Generated embeddings for {len(chunks)} chunks")
                return
                
            except Exception as e:
                logger.warning(f"Embedding generation attempt {attempt + 1} failed: {e}")
                if attempt == self.embedding_config.max_retries - 1:
                    raise
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

    def _create_base_metadata(self, document: BaseExtractionDocument) -> Dict[str, Any]:
        """Create base metadata for all chunks."""
        return {
            "document_id": document.doc_id,
            "filename": document.filename,
            "document_type": document.document_type,
            "manufacturer": document.manufacturer,
            "product_name": document.product_info.product_name,
            "product_family": document.product_info.product_family,
            "cas_number": document.product_info.cas_number,
            "extraction_date": document.extraction_metadata.extraction_date,
            "has_images": document.has_images,
        }

    def _format_product_overview(self, document: BaseExtractionDocument) -> str:
        """Format product overview information."""
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

    def _format_applications(self, document: BaseExtractionDocument) -> str:
        """Format applications information."""
        if not document.applications and not document.applications_text:
            return ""
        
        content = f"Applications for {document.product_info.product_name}:\n"
        
        if document.applications:
            content += "\n".join(f"• {app}" for app in document.applications)
        
        if document.applications_text:
            if document.applications:
                content += "\n\nDetailed Applications:\n"
            content += document.applications_text
        
        return content

    def _format_properties(self, document: BaseExtractionDocument) -> str:
        """Format properties and specifications."""
        if not document.properties_and_specifications:
            return ""
        
        content = "Properties and Specifications:\n\n"
        
        # Group by category
        categories = {}
        for prop in document.properties_and_specifications:
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
        """Format typical properties table."""
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
        """Format safety and regulatory information."""
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

    def _get_full_document_content(self, document: BaseExtractionDocument) -> str:
        """Get full document content as a single string."""
        content_parts = []
        
        # Add product overview
        product_overview = self._format_product_overview(document)
        if product_overview:
            content_parts.append(product_overview)
        
        # Add applications
        applications = self._format_applications(document)
        if applications:
            content_parts.append(applications)
        
        # Add properties
        properties = self._format_properties(document)
        if properties:
            content_parts.append(properties)
        
        # Add typical properties
        if document.typical_properties and document.typical_properties.data:
            typical_props = self._format_typical_properties(document.typical_properties)
            if typical_props:
                content_parts.append(typical_props)
        
        # Add sections
        for section in document.sections:
            if section.content and section.content.strip():
                content_parts.append(f"Section: {section.name}\n\n{section.content}")
        
        # Add safety info
        safety_info = self._format_safety_info(document)
        if safety_info:
            content_parts.append(safety_info)
        
        return "\n\n---\n\n".join(content_parts)

    async def health_check(self) -> Dict[str, Any]:
        """Check if the document processor is healthy."""
        try:
            # Test Ollama connection
            response = await self._client.get(f"{self.embedding_config.ollama_base_url}/api/tags")
            response.raise_for_status()
            
            models = response.json().get("models", [])
            model_available = any(
                model.get("name", "").startswith(self.embedding_config.model_name)
                for model in models
            )
            
            return {
                "status": "healthy" if model_available else "degraded",
                "ollama_available": True,
                "embedding_model_available": model_available,
                "embedding_model": self.embedding_config.model_name,
                "ollama_url": self.embedding_config.ollama_base_url,
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "ollama_available": False,
                "embedding_model_available": False,
            }