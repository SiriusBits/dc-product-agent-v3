"""Knowledge graph data ingestion service with entity extraction and validation."""

import logging
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel

from ..models.kg_models import DerivedInfo, KGEntity, KGTriple, KnowledgeGraph
from ..models.product_models import BaseExtractionDocument, PropertySpecification
from .kg_service import KnowledgeGraphService

logger = logging.getLogger(__name__)


class EntityExtractionResult(BaseModel):
    """Result of entity extraction from document."""
    
    entities: List[KGEntity]
    relationships: List[KGTriple]
    extraction_metadata: Dict[str, Any]


class ProvenanceInfo(BaseModel):
    """Provenance information for extracted entities and relationships."""
    
    document_id: str
    filename: str
    page: Optional[int] = None
    section: Optional[str] = None
    source_text: Optional[str] = None
    extraction_method: str = "rule_based"
    confidence: float = 1.0


class KGIngestionService:
    """Service for knowledge graph data ingestion with entity extraction."""

    def __init__(self, kg_service: KnowledgeGraphService):
        """Initialize KG ingestion service.
        
        Args:
            kg_service: Knowledge graph service instance
        """
        self.kg_service = kg_service
        
        # Entity type mappings
        self.entity_types = {
            "product": "PRODUCT",
            "chemical": "CHEMICAL", 
            "application": "APPLICATION",
            "property": "PROPERTY",
            "manufacturer": "MANUFACTURER",
            "family": "FAMILY",
            "test_method": "TEST_METHOD",
            "unit": "UNIT",
            "value": "VALUE",
        }
        
        # Relationship type mappings
        self.relationship_types = {
            "used_in": "USED_IN",
            "has_property": "HAS_PROPERTY",
            "manufactured_by": "MANUFACTURED_BY",
            "belongs_to_family": "BELONGS_TO_FAMILY",
            "similar_to": "SIMILAR_TO",
            "competes_with": "COMPETES_WITH",
            "tested_by": "TESTED_BY",
            "measured_in": "MEASURED_IN",
            "has_value": "HAS_VALUE",
            "applies_to": "APPLIES_TO",
        }

    async def ingest_document_entities(
        self,
        document: BaseExtractionDocument,
        extract_from_derived: bool = True,
        validate_entities: bool = True,
        deduplicate: bool = True,
    ) -> Dict[str, Any]:
        """Extract and ingest entities from a document.
        
        Args:
            document: Document to extract entities from
            extract_from_derived: Whether to use derived info if available
            validate_entities: Whether to validate extracted entities
            deduplicate: Whether to deduplicate entities before ingestion
            
        Returns:
            Ingestion results
        """
        start_time = time.time()
        
        try:
            # Extract entities and relationships
            extraction_result = await self._extract_entities_from_document(document)
            
            # Validate entities if requested
            if validate_entities:
                extraction_result = await self._validate_entities(extraction_result)
            
            # Deduplicate if requested
            if deduplicate:
                extraction_result = await self._deduplicate_entities(extraction_result)
            
            # Create knowledge graph
            knowledge_graph = KnowledgeGraph(
                entities=extraction_result.entities,
                kg_triples=extraction_result.relationships,
                metadata={
                    "document_id": document.doc_id,
                    "filename": document.filename,
                    "extraction_method": "enhanced_rule_based",
                    "total_entities": len(extraction_result.entities),
                    "total_relationships": len(extraction_result.relationships),
                    **extraction_result.extraction_metadata,
                }
            )
            
            # Ingest into knowledge graph
            ingest_result = await self.kg_service.kg_store.ingest_knowledge_graph(knowledge_graph)
            
            processing_time = int((time.time() - start_time) * 1000)
            
            result = {
                "success": ingest_result.get("success", False),
                "document_id": document.doc_id,
                "filename": document.filename,
                "entities_extracted": len(extraction_result.entities),
                "relationships_extracted": len(extraction_result.relationships),
                "entities_ingested": ingest_result.get("entities_created", 0),
                "relationships_ingested": ingest_result.get("relationships_created", 0),
                "processing_time_ms": processing_time,
                "extraction_metadata": extraction_result.extraction_metadata,
            }
            
            if not ingest_result.get("success", False):
                result["error"] = ingest_result.get("error", "Unknown ingestion error")
            
            logger.info(
                f"Ingested {result['entities_ingested']} entities and "
                f"{result['relationships_ingested']} relationships for {document.filename}"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to ingest entities from document {document.filename}: {e}")
            return {
                "success": False,
                "error": str(e),
                "document_id": document.doc_id,
                "filename": document.filename,
                "entities_extracted": 0,
                "relationships_extracted": 0,
            }

    async def _extract_entities_from_document(self, document: BaseExtractionDocument) -> EntityExtractionResult:
        """Extract entities and relationships from document."""
        entities = []
        relationships = []
        extraction_stats = {
            "product_entities": 0,
            "property_entities": 0,
            "application_entities": 0,
            "manufacturer_entities": 0,
            "relationships_by_type": {},
        }
        
        # Create provenance info
        provenance = ProvenanceInfo(
            document_id=document.doc_id,
            filename=document.filename,
            extraction_method="enhanced_rule_based",
        )
        
        # Extract product entity
        product_entity = self._extract_product_entity(document, provenance)
        if product_entity:
            entities.append(product_entity)
            extraction_stats["product_entities"] += 1
        
        # Extract manufacturer entity
        manufacturer_entity = self._extract_manufacturer_entity(document, provenance)
        if manufacturer_entity:
            entities.append(manufacturer_entity)
            extraction_stats["manufacturer_entities"] += 1
            
            # Create relationship between product and manufacturer
            if product_entity:
                rel = self._create_relationship(
                    product_entity, "MANUFACTURED_BY", manufacturer_entity, provenance
                )
                relationships.append(rel)
                self._increment_relationship_stat(extraction_stats, "MANUFACTURED_BY")
        
        # Extract family entity if available
        if document.product_info.product_family:
            family_entity = self._extract_family_entity(document, provenance)
            if family_entity:
                entities.append(family_entity)
                
                # Create relationship between product and family
                if product_entity:
                    rel = self._create_relationship(
                        product_entity, "BELONGS_TO_FAMILY", family_entity, provenance
                    )
                    relationships.append(rel)
                    self._increment_relationship_stat(extraction_stats, "BELONGS_TO_FAMILY")
        
        # Extract property entities
        property_entities, property_relationships = self._extract_property_entities(
            document, product_entity, provenance
        )
        entities.extend(property_entities)
        relationships.extend(property_relationships)
        extraction_stats["property_entities"] += len(property_entities)
        
        for rel in property_relationships:
            self._increment_relationship_stat(extraction_stats, rel.predicate)
        
        # Extract application entities
        application_entities, application_relationships = self._extract_application_entities(
            document, product_entity, provenance
        )
        entities.extend(application_entities)
        relationships.extend(application_relationships)
        extraction_stats["application_entities"] += len(application_entities)
        
        for rel in application_relationships:
            self._increment_relationship_stat(extraction_stats, rel.predicate)
        
        # Extract test method entities
        test_method_entities, test_method_relationships = self._extract_test_method_entities(
            document, provenance
        )
        entities.extend(test_method_entities)
        relationships.extend(test_method_relationships)
        
        for rel in test_method_relationships:
            self._increment_relationship_stat(extraction_stats, rel.predicate)
        
        return EntityExtractionResult(
            entities=entities,
            relationships=relationships,
            extraction_metadata=extraction_stats,
        )

    def _extract_product_entity(self, document: BaseExtractionDocument, provenance: ProvenanceInfo) -> Optional[KGEntity]:
        """Extract product entity from document."""
        product_info = document.product_info
        
        if not product_info.product_name:
            return None
        
        # Create aliases list
        aliases = []
        if product_info.product_short_name and product_info.product_short_name != product_info.product_name:
            aliases.append(product_info.product_short_name)
        
        if product_info.synonyms:
            aliases.extend(product_info.synonyms)
        
        # Remove duplicates and empty strings
        aliases = list(set(alias.strip() for alias in aliases if alias and alias.strip()))
        
        # Create metadata
        metadata = {
            "manufacturer": document.manufacturer,
            "document_type": document.document_type,
        }
        
        if product_info.cas_number:
            metadata["cas_number"] = product_info.cas_number
        
        if product_info.chemical_name:
            metadata["chemical_name"] = product_info.chemical_name
        
        if product_info.product_family:
            metadata["family"] = product_info.product_family
        
        if document.applications:
            metadata["applications"] = document.applications[:5]  # Limit for storage
        
        return KGEntity(
            id=f"product_{self._normalize_id(product_info.product_name)}",
            text=product_info.product_name,
            type="PRODUCT",
            canonical_name=product_info.product_name,
            aliases=aliases,
            source_text=f"Product: {product_info.product_name}",
            confidence=1.0,
            provenance={
                "document_id": provenance.document_id,
                "page": None,
                "section": "Product Information",
            },
            metadata=metadata,
        )

    def _extract_manufacturer_entity(self, document: BaseExtractionDocument, provenance: ProvenanceInfo) -> Optional[KGEntity]:
        """Extract manufacturer entity from document."""
        if not document.manufacturer:
            return None
        
        return KGEntity(
            id=f"manufacturer_{self._normalize_id(document.manufacturer)}",
            text=document.manufacturer,
            type="MANUFACTURER",
            canonical_name=document.manufacturer,
            aliases=[],
            source_text=f"Manufacturer: {document.manufacturer}",
            confidence=1.0,
            provenance={
                "document_id": provenance.document_id,
                "page": None,
                "section": "Product Information",
            },
            metadata={
                "entity_type": "manufacturer",
            },
        )

    def _extract_family_entity(self, document: BaseExtractionDocument, provenance: ProvenanceInfo) -> Optional[KGEntity]:
        """Extract product family entity from document."""
        family = document.product_info.product_family
        if not family:
            return None
        
        return KGEntity(
            id=f"family_{self._normalize_id(family)}",
            text=family,
            type="FAMILY",
            canonical_name=family,
            aliases=[],
            source_text=f"Product Family: {family}",
            confidence=1.0,
            provenance={
                "document_id": provenance.document_id,
                "page": None,
                "section": "Product Information",
            },
            metadata={
                "entity_type": "product_family",
                "manufacturer": document.manufacturer,
            },
        )

    def _extract_property_entities(
        self, 
        document: BaseExtractionDocument, 
        product_entity: Optional[KGEntity], 
        provenance: ProvenanceInfo
    ) -> Tuple[List[KGEntity], List[KGTriple]]:
        """Extract property entities and relationships."""
        entities = []
        relationships = []
        
        if not document.properties_and_specifications:
            return entities, relationships
        
        # Group properties by category for better organization
        property_categories = {}
        for prop in document.properties_and_specifications:
            if prop.category not in property_categories:
                property_categories[prop.category] = []
            property_categories[prop.category].append(prop)
        
        # Create entities for each property
        for category, props in property_categories.items():
            for prop in props:
                property_entity = self._create_property_entity(prop, provenance)
                if property_entity:
                    entities.append(property_entity)
                    
                    # Create relationship to product
                    if product_entity:
                        rel = self._create_relationship(
                            product_entity, "HAS_PROPERTY", property_entity, provenance,
                            source_text=f"{product_entity.text} has property {prop.name}"
                        )
                        relationships.append(rel)
                    
                    # Create value entity if numeric value exists
                    if prop.value_numeric is not None:
                        value_entity = self._create_value_entity(prop, provenance)
                        if value_entity:
                            entities.append(value_entity)
                            
                            # Create relationship between property and value
                            rel = self._create_relationship(
                                property_entity, "HAS_VALUE", value_entity, provenance,
                                source_text=f"{prop.name}: {prop.value_numeric} {prop.unit or ''}"
                            )
                            relationships.append(rel)
                    
                    # Create test method entity if available
                    if prop.test_method:
                        test_method_entity = self._create_test_method_entity(prop.test_method, provenance)
                        if test_method_entity:
                            entities.append(test_method_entity)
                            
                            # Create relationship between property and test method
                            rel = self._create_relationship(
                                property_entity, "TESTED_BY", test_method_entity, provenance,
                                source_text=f"{prop.name} tested by {prop.test_method}"
                            )
                            relationships.append(rel)
        
        return entities, relationships

    def _create_property_entity(self, prop: PropertySpecification, provenance: ProvenanceInfo) -> Optional[KGEntity]:
        """Create property entity from property specification."""
        if not prop.name:
            return None
        
        # Create property ID
        prop_id = f"property_{self._normalize_id(prop.name)}"
        
        # Create metadata
        metadata = {
            "category": prop.category,
            "entity_type": "property",
        }
        
        if prop.unit:
            metadata["unit"] = prop.unit
        
        if prop.test_method:
            metadata["test_method"] = prop.test_method
        
        # Create source text
        source_text = f"Property: {prop.name}"
        if prop.value_string:
            source_text += f" = {prop.value_string}"
        elif prop.value_numeric is not None:
            source_text += f" = {prop.value_numeric}"
            if prop.unit:
                source_text += f" {prop.unit}"
        
        return KGEntity(
            id=prop_id,
            text=prop.name,
            type="PROPERTY",
            canonical_name=prop.name,
            aliases=[],
            source_text=source_text,
            confidence=0.9,
            provenance={
                "document_id": provenance.document_id,
                "page": prop.page,
                "section": "Properties and Specifications",
            },
            metadata=metadata,
        )

    def _create_value_entity(self, prop: PropertySpecification, provenance: ProvenanceInfo) -> Optional[KGEntity]:
        """Create value entity from property specification."""
        if prop.value_numeric is None:
            return None
        
        # Create value ID
        value_text = str(prop.value_numeric)
        if prop.unit:
            value_text += f" {prop.unit}"
        
        value_id = f"value_{self._normalize_id(value_text)}"
        
        metadata = {
            "numeric_value": prop.value_numeric,
            "entity_type": "value",
        }
        
        if prop.unit:
            metadata["unit"] = prop.unit
        
        return KGEntity(
            id=value_id,
            text=value_text,
            type="VALUE",
            canonical_name=value_text,
            aliases=[],
            source_text=f"Value: {value_text}",
            confidence=1.0,
            provenance={
                "document_id": provenance.document_id,
                "page": prop.page,
                "section": "Properties and Specifications",
            },
            metadata=metadata,
        )

    def _create_test_method_entity(self, test_method: str, provenance: ProvenanceInfo) -> Optional[KGEntity]:
        """Create test method entity."""
        if not test_method:
            return None
        
        # Normalize test method name
        normalized_method = self._normalize_test_method(test_method)
        if not normalized_method:
            return None
        
        method_id = f"test_method_{self._normalize_id(normalized_method)}"
        
        return KGEntity(
            id=method_id,
            text=normalized_method,
            type="TEST_METHOD",
            canonical_name=normalized_method,
            aliases=[test_method] if test_method != normalized_method else [],
            source_text=f"Test Method: {test_method}",
            confidence=0.8,
            provenance={
                "document_id": provenance.document_id,
                "page": None,
                "section": "Properties and Specifications",
            },
            metadata={
                "entity_type": "test_method",
                "original_text": test_method,
            },
        )

    def _extract_application_entities(
        self, 
        document: BaseExtractionDocument, 
        product_entity: Optional[KGEntity], 
        provenance: ProvenanceInfo
    ) -> Tuple[List[KGEntity], List[KGTriple]]:
        """Extract application entities and relationships."""
        entities = []
        relationships = []
        
        if not document.applications:
            return entities, relationships
        
        for application in document.applications:
            app_entity = self._create_application_entity(application, provenance)
            if app_entity:
                entities.append(app_entity)
                
                # Create relationship to product
                if product_entity:
                    rel = self._create_relationship(
                        product_entity, "USED_IN", app_entity, provenance,
                        source_text=f"{product_entity.text} used in {application}"
                    )
                    relationships.append(rel)
        
        return entities, relationships

    def _create_application_entity(self, application: str, provenance: ProvenanceInfo) -> Optional[KGEntity]:
        """Create application entity."""
        if not application:
            return None
        
        app_id = f"application_{self._normalize_id(application)}"
        
        return KGEntity(
            id=app_id,
            text=application,
            type="APPLICATION",
            canonical_name=application,
            aliases=[],
            source_text=f"Application: {application}",
            confidence=0.9,
            provenance={
                "document_id": provenance.document_id,
                "page": None,
                "section": "Applications",
            },
            metadata={
                "entity_type": "application",
            },
        )

    def _extract_test_method_entities(
        self, 
        document: BaseExtractionDocument, 
        provenance: ProvenanceInfo
    ) -> Tuple[List[KGEntity], List[KGTriple]]:
        """Extract test method entities from all properties."""
        entities = []
        relationships = []
        test_methods_seen = set()
        
        if not document.properties_and_specifications:
            return entities, relationships
        
        for prop in document.properties_and_specifications:
            if prop.test_method and prop.test_method not in test_methods_seen:
                test_method_entity = self._create_test_method_entity(prop.test_method, provenance)
                if test_method_entity:
                    entities.append(test_method_entity)
                    test_methods_seen.add(prop.test_method)
        
        return entities, relationships

    def _create_relationship(
        self,
        subject: KGEntity,
        predicate: str,
        obj: KGEntity,
        provenance: ProvenanceInfo,
        source_text: Optional[str] = None,
        confidence: float = 0.9,
    ) -> KGTriple:
        """Create a relationship triple."""
        return KGTriple(
            subject=subject,
            predicate=predicate,
            object=obj,
            source_text=source_text or f"{subject.text} {predicate.lower().replace('_', ' ')} {obj.text}",
            confidence=confidence,
            provenance={
                "document_id": provenance.document_id,
                "page": provenance.page,
                "section": provenance.section,
            },
        )

    async def _validate_entities(self, extraction_result: EntityExtractionResult) -> EntityExtractionResult:
        """Validate extracted entities and relationships."""
        valid_entities = []
        valid_relationships = []
        
        # Validate entities
        for entity in extraction_result.entities:
            if self._is_valid_entity(entity):
                valid_entities.append(entity)
            else:
                logger.warning(f"Invalid entity filtered out: {entity.id}")
        
        # Validate relationships
        valid_entity_ids = {entity.id for entity in valid_entities}
        
        for relationship in extraction_result.relationships:
            subject_id = relationship.subject.id if hasattr(relationship.subject, 'id') else str(relationship.subject)
            object_id = relationship.object.id if hasattr(relationship.object, 'id') else str(relationship.object)
            
            if subject_id in valid_entity_ids and object_id in valid_entity_ids:
                valid_relationships.append(relationship)
            else:
                logger.warning(f"Invalid relationship filtered out: {subject_id} -> {object_id}")
        
        return EntityExtractionResult(
            entities=valid_entities,
            relationships=valid_relationships,
            extraction_metadata={
                **extraction_result.extraction_metadata,
                "validation_applied": True,
                "entities_filtered": len(extraction_result.entities) - len(valid_entities),
                "relationships_filtered": len(extraction_result.relationships) - len(valid_relationships),
            }
        )

    def _is_valid_entity(self, entity: KGEntity) -> bool:
        """Check if an entity is valid."""
        # Basic validation rules
        if not entity.id or not entity.text or not entity.type:
            return False
        
        # Check text length
        if len(entity.text.strip()) < 2:
            return False
        
        # Check for valid entity type
        if entity.type not in ["PRODUCT", "CHEMICAL", "APPLICATION", "PROPERTY", "MANUFACTURER", "FAMILY", "TEST_METHOD", "UNIT", "VALUE"]:
            return False
        
        return True

    async def _deduplicate_entities(self, extraction_result: EntityExtractionResult) -> EntityExtractionResult:
        """Deduplicate entities based on canonical names and types."""
        unique_entities = {}
        entity_id_mapping = {}
        
        # Deduplicate entities
        for entity in extraction_result.entities:
            key = (entity.canonical_name or entity.text, entity.type)
            
            if key not in unique_entities:
                unique_entities[key] = entity
                entity_id_mapping[entity.id] = entity.id
            else:
                # Merge aliases
                existing_entity = unique_entities[key]
                existing_aliases = set(existing_entity.aliases)
                new_aliases = set(entity.aliases)
                existing_aliases.update(new_aliases)
                existing_entity.aliases = list(existing_aliases)
                
                # Map old ID to existing ID
                entity_id_mapping[entity.id] = existing_entity.id
        
        # Update relationships with new entity IDs
        updated_relationships = []
        for relationship in extraction_result.relationships:
            subject_id = relationship.subject.id if hasattr(relationship.subject, 'id') else str(relationship.subject)
            object_id = relationship.object.id if hasattr(relationship.object, 'id') else str(relationship.object)
            
            # Update subject and object references
            if subject_id in entity_id_mapping and object_id in entity_id_mapping:
                new_subject_id = entity_id_mapping[subject_id]
                new_object_id = entity_id_mapping[object_id]
                
                # Find the actual entity objects
                subject_entity = next((e for e in unique_entities.values() if e.id == new_subject_id), None)
                object_entity = next((e for e in unique_entities.values() if e.id == new_object_id), None)
                
                if subject_entity and object_entity:
                    updated_relationship = KGTriple(
                        subject=subject_entity,
                        predicate=relationship.predicate,
                        object=object_entity,
                        source_text=relationship.source_text,
                        confidence=relationship.confidence,
                        provenance=relationship.provenance,
                    )
                    updated_relationships.append(updated_relationship)
        
        # Remove duplicate relationships
        unique_relationships = []
        seen_relationships = set()
        
        for rel in updated_relationships:
            subject_id = rel.subject.id if hasattr(rel.subject, 'id') else str(rel.subject)
            object_id = rel.object.id if hasattr(rel.object, 'id') else str(rel.object)
            rel_key = (subject_id, rel.predicate, object_id)
            
            if rel_key not in seen_relationships:
                unique_relationships.append(rel)
                seen_relationships.add(rel_key)
        
        return EntityExtractionResult(
            entities=list(unique_entities.values()),
            relationships=unique_relationships,
            extraction_metadata={
                **extraction_result.extraction_metadata,
                "deduplication_applied": True,
                "entities_before_dedup": len(extraction_result.entities),
                "entities_after_dedup": len(unique_entities),
                "relationships_before_dedup": len(extraction_result.relationships),
                "relationships_after_dedup": len(unique_relationships),
            }
        )

    def _normalize_id(self, text: str) -> str:
        """Normalize text for use as entity ID."""
        # Convert to lowercase and replace spaces/special chars with underscores
        normalized = re.sub(r'[^\w\s-]', '', text.lower())
        normalized = re.sub(r'[-\s]+', '_', normalized)
        return normalized.strip('_')

    def _normalize_test_method(self, test_method: str) -> Optional[str]:
        """Normalize test method names."""
        if not test_method:
            return None
        
        # Remove common prefixes and clean up
        method = test_method.strip()
        method = re.sub(r'^(ASTM|ISO|DIN|JIS|BS)\s*[-:]?\s*', '', method, flags=re.IGNORECASE)
        method = re.sub(r'\s+', ' ', method)
        
        return method if len(method) > 2 else None

    def _increment_relationship_stat(self, stats: Dict[str, Any], relationship_type: str) -> None:
        """Increment relationship statistics."""
        if "relationships_by_type" not in stats:
            stats["relationships_by_type"] = {}
        
        stats["relationships_by_type"][relationship_type] = (
            stats["relationships_by_type"].get(relationship_type, 0) + 1
        )

    async def get_ingestion_statistics(self) -> Dict[str, Any]:
        """Get knowledge graph ingestion statistics."""
        try:
            kg_stats = await self.kg_service.get_statistics()
            
            return {
                "total_entities": kg_stats.get("total_entities", 0),
                "total_relationships": kg_stats.get("total_relationships", 0),
                "entity_types": kg_stats.get("entity_types", {}),
                "relationship_types": kg_stats.get("relationship_types", {}),
                "ingestion_service_status": "healthy",
                "timestamp": time.time(),
            }
            
        except Exception as e:
            logger.error(f"Failed to get ingestion statistics: {e}")
            return {
                "error": str(e),
                "ingestion_service_status": "unhealthy",
                "timestamp": time.time(),
            }