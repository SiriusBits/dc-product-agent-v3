"""Metadata enrichment service for document processing."""

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from pydantic import BaseModel

from ..models.product_models import BaseExtractionDocument, PropertySpecification

logger = logging.getLogger(__name__)


class EnrichedMetadata(BaseModel):
    """Enriched metadata for documents."""
    
    # Basic document metadata
    document_id: str
    filename: str
    document_type: str
    manufacturer: str
    
    # Product metadata
    product_name: str
    product_family: Optional[str] = None
    cas_number: Optional[str] = None
    chemical_name: Optional[str] = None
    synonyms: List[str] = []
    
    # Content analysis
    content_categories: List[str] = []
    property_categories: List[str] = []
    application_domains: List[str] = []
    test_methods: List[str] = []
    
    # Quantitative metadata
    total_properties: int = 0
    total_applications: int = 0
    total_sections: int = 0
    has_typical_properties: bool = False
    has_safety_data: bool = False
    has_images: bool = False
    
    # Quality indicators
    completeness_score: float = 0.0
    extraction_confidence: float = 0.0
    data_richness_score: float = 0.0
    
    # Searchability metadata
    keywords: List[str] = []
    search_terms: List[str] = []
    related_products: List[str] = []
    
    # Processing metadata
    enrichment_timestamp: str
    enrichment_version: str = "1.0"


class MetadataEnrichmentService:
    """Service for enriching document metadata."""
    
    # Known application domains
    APPLICATION_DOMAINS = {
        "adhesives": ["adhesive", "bonding", "glue", "cement"],
        "coatings": ["coating", "paint", "finish", "surface treatment"],
        "composites": ["composite", "fiber", "reinforcement", "laminate"],
        "electronics": ["electronic", "circuit", "semiconductor", "pcb"],
        "automotive": ["automotive", "vehicle", "car", "transportation"],
        "aerospace": ["aerospace", "aircraft", "aviation", "space"],
        "marine": ["marine", "boat", "ship", "underwater"],
        "construction": ["construction", "building", "structural", "concrete"],
        "textiles": ["textile", "fabric", "fiber", "clothing"],
        "packaging": ["packaging", "container", "film", "barrier"],
    }
    
    # Property categories
    PROPERTY_CATEGORIES = {
        "mechanical": ["tensile", "modulus", "strength", "elongation", "hardness", "impact"],
        "thermal": ["temperature", "thermal", "heat", "tg", "glass transition", "melting"],
        "chemical": ["chemical", "resistance", "compatibility", "stability", "ph"],
        "physical": ["density", "viscosity", "specific gravity", "appearance", "color"],
        "electrical": ["electrical", "dielectric", "conductivity", "resistivity", "voltage"],
        "processing": ["processing", "cure", "pot life", "gel time", "working time"],
        "environmental": ["environmental", "weathering", "uv", "moisture", "humidity"],
    }
    
    def __init__(self):
        """Initialize metadata enrichment service."""
        pass
    
    def enrich_document_metadata(self, document: BaseExtractionDocument) -> EnrichedMetadata:
        """Enrich metadata for a document.
        
        Args:
            document: Document to enrich metadata for
            
        Returns:
            Enriched metadata
        """
        try:
            # Extract basic metadata
            enriched = EnrichedMetadata(
                document_id=document.doc_id,
                filename=document.filename,
                document_type=document.document_type,
                manufacturer=document.manufacturer,
                product_name=document.product_info.product_name,
                product_family=document.product_info.product_family,
                cas_number=document.product_info.cas_number,
                chemical_name=document.product_info.chemical_name,
                synonyms=document.product_info.synonyms or [],
                enrichment_timestamp=datetime.utcnow().isoformat(),
            )
            
            # Analyze content
            self._analyze_content_categories(document, enriched)
            self._analyze_properties(document, enriched)
            self._analyze_applications(document, enriched)
            self._extract_test_methods(document, enriched)
            
            # Calculate quantitative metrics
            self._calculate_quantitative_metrics(document, enriched)
            
            # Calculate quality scores
            self._calculate_quality_scores(document, enriched)
            
            # Generate searchability metadata
            self._generate_search_metadata(document, enriched)
            
            logger.info(f"Enriched metadata for document {document.filename}")
            return enriched
            
        except Exception as e:
            logger.error(f"Failed to enrich metadata for document {document.filename}: {e}")
            raise
    
    def _analyze_content_categories(self, document: BaseExtractionDocument, enriched: EnrichedMetadata) -> None:
        """Analyze and categorize document content."""
        categories = set()
        
        # Check for different types of content
        if document.properties_and_specifications:
            categories.add("properties")
        
        if document.applications or document.applications_text:
            categories.add("applications")
        
        if document.typical_properties:
            categories.add("typical_properties")
        
        if document.toxicity_data:
            categories.add("safety_data")
        
        if document.registrations:
            categories.add("regulatory")
        
        if document.formulation_data:
            categories.add("formulation")
        
        if document.sections:
            categories.add("technical_sections")
        
        if document.images:
            categories.add("visual_data")
        
        enriched.content_categories = sorted(list(categories))
    
    def _analyze_properties(self, document: BaseExtractionDocument, enriched: EnrichedMetadata) -> None:
        """Analyze property categories in the document."""
        property_categories = set()
        
        if document.properties_and_specifications:
            for prop in document.properties_and_specifications:
                # Categorize based on property name and category
                prop_text = f"{prop.category} {prop.name}".lower()
                
                for category, keywords in self.PROPERTY_CATEGORIES.items():
                    if any(keyword in prop_text for keyword in keywords):
                        property_categories.add(category)
        
        # Also check typical properties
        if document.typical_properties and document.typical_properties.data:
            for prop in document.typical_properties.data:
                prop_text = prop.name.lower()
                
                for category, keywords in self.PROPERTY_CATEGORIES.items():
                    if any(keyword in prop_text for keyword in keywords):
                        property_categories.add(category)
        
        enriched.property_categories = sorted(list(property_categories))
    
    def _analyze_applications(self, document: BaseExtractionDocument, enriched: EnrichedMetadata) -> None:
        """Analyze application domains in the document."""
        application_domains = set()
        
        # Analyze applications list
        if document.applications:
            for app in document.applications:
                app_text = app.lower()
                
                for domain, keywords in self.APPLICATION_DOMAINS.items():
                    if any(keyword in app_text for keyword in keywords):
                        application_domains.add(domain)
        
        # Analyze applications text
        if document.applications_text:
            app_text = document.applications_text.lower()
            
            for domain, keywords in self.APPLICATION_DOMAINS.items():
                if any(keyword in app_text for keyword in keywords):
                    application_domains.add(domain)
        
        enriched.application_domains = sorted(list(application_domains))
    
    def _extract_test_methods(self, document: BaseExtractionDocument, enriched: EnrichedMetadata) -> None:
        """Extract test methods mentioned in the document."""
        test_methods = set()
        
        if document.properties_and_specifications:
            for prop in document.properties_and_specifications:
                if prop.test_method:
                    # Clean and normalize test method names
                    method = self._normalize_test_method(prop.test_method)
                    if method:
                        test_methods.add(method)
        
        if document.typical_properties and document.typical_properties.data:
            for prop in document.typical_properties.data:
                if prop.test_method:
                    method = self._normalize_test_method(prop.test_method)
                    if method:
                        test_methods.add(method)
        
        enriched.test_methods = sorted(list(test_methods))
    
    def _normalize_test_method(self, test_method: str) -> Optional[str]:
        """Normalize test method names."""
        if not test_method:
            return None
        
        # Remove common prefixes and clean up
        method = test_method.strip()
        method = re.sub(r'^(ASTM|ISO|DIN|JIS|BS)\s*[-:]?\s*', '', method, flags=re.IGNORECASE)
        method = re.sub(r'\s+', ' ', method)
        
        return method if len(method) > 2 else None
    
    def _calculate_quantitative_metrics(self, document: BaseExtractionDocument, enriched: EnrichedMetadata) -> None:
        """Calculate quantitative metrics about the document."""
        enriched.total_properties = len(document.properties_and_specifications or [])
        enriched.total_applications = len(document.applications or [])
        enriched.total_sections = len(document.sections or [])
        enriched.has_typical_properties = bool(document.typical_properties and document.typical_properties.data)
        enriched.has_safety_data = bool(document.toxicity_data or document.registrations)
        enriched.has_images = document.has_images
    
    def _calculate_quality_scores(self, document: BaseExtractionDocument, enriched: EnrichedMetadata) -> None:
        """Calculate quality and completeness scores."""
        # Completeness score based on available data fields
        completeness_factors = []
        
        # Basic product info (weight: 0.2)
        product_completeness = 0.0
        if document.product_info.product_name:
            product_completeness += 0.4
        if document.product_info.cas_number:
            product_completeness += 0.3
        if document.product_info.chemical_name:
            product_completeness += 0.2
        if document.product_info.synonyms:
            product_completeness += 0.1
        completeness_factors.append((product_completeness, 0.2))
        
        # Properties data (weight: 0.3)
        properties_completeness = min(1.0, len(document.properties_and_specifications or []) / 10)
        completeness_factors.append((properties_completeness, 0.3))
        
        # Applications data (weight: 0.2)
        applications_completeness = 0.0
        if document.applications:
            applications_completeness += 0.7
        if document.applications_text:
            applications_completeness += 0.3
        applications_completeness = min(1.0, applications_completeness)
        completeness_factors.append((applications_completeness, 0.2))
        
        # Additional data (weight: 0.3)
        additional_completeness = 0.0
        if document.typical_properties:
            additional_completeness += 0.3
        if document.key_benefits:
            additional_completeness += 0.2
        if document.sections:
            additional_completeness += 0.2
        if document.toxicity_data or document.registrations:
            additional_completeness += 0.2
        if document.images:
            additional_completeness += 0.1
        completeness_factors.append((additional_completeness, 0.3))
        
        # Calculate weighted completeness score
        enriched.completeness_score = sum(score * weight for score, weight in completeness_factors)
        
        # Extraction confidence from metadata
        if document.extraction_metadata and document.extraction_metadata.confidence_scores:
            confidence_scores = document.extraction_metadata.confidence_scores
            if isinstance(confidence_scores, dict):
                # Average confidence scores
                scores = [float(score) for score in confidence_scores.values() if isinstance(score, (int, float))]
                enriched.extraction_confidence = sum(scores) / len(scores) if scores else 0.0
            else:
                enriched.extraction_confidence = 0.0
        else:
            enriched.extraction_confidence = 0.0
        
        # Data richness score based on variety and depth
        richness_factors = []
        
        # Property diversity
        property_diversity = len(enriched.property_categories) / len(self.PROPERTY_CATEGORIES)
        richness_factors.append(property_diversity * 0.3)
        
        # Application diversity
        application_diversity = len(enriched.application_domains) / len(self.APPLICATION_DOMAINS)
        richness_factors.append(application_diversity * 0.2)
        
        # Content variety
        content_variety = len(enriched.content_categories) / 8  # Max expected categories
        richness_factors.append(content_variety * 0.3)
        
        # Test method coverage
        test_method_coverage = min(1.0, len(enriched.test_methods) / 5)
        richness_factors.append(test_method_coverage * 0.2)
        
        enriched.data_richness_score = sum(richness_factors)
    
    def _generate_search_metadata(self, document: BaseExtractionDocument, enriched: EnrichedMetadata) -> None:
        """Generate keywords and search terms for better searchability."""
        keywords = set()
        search_terms = set()
        
        # Add product names and synonyms
        keywords.add(document.product_info.product_name.lower())
        if document.product_info.product_short_name:
            keywords.add(document.product_info.product_short_name.lower())
        if document.product_info.chemical_name:
            keywords.add(document.product_info.chemical_name.lower())
        
        for synonym in document.product_info.synonyms or []:
            keywords.add(synonym.lower())
        
        # Add CAS number
        if document.product_info.cas_number:
            keywords.add(document.product_info.cas_number)
        
        # Add manufacturer
        keywords.add(document.manufacturer.lower())
        
        # Add product family
        if document.product_info.product_family:
            keywords.add(document.product_info.product_family.lower())
        
        # Extract keywords from applications
        if document.applications:
            for app in document.applications:
                # Extract meaningful terms from applications
                app_terms = self._extract_meaningful_terms(app)
                keywords.update(app_terms)
        
        # Extract keywords from key benefits
        if document.key_benefits:
            for benefit in document.key_benefits:
                benefit_terms = self._extract_meaningful_terms(benefit)
                keywords.update(benefit_terms)
        
        # Add property categories and domains
        keywords.update(enriched.property_categories)
        keywords.update(enriched.application_domains)
        
        # Generate search terms (combinations and variations)
        search_terms.update(keywords)
        
        # Add product + application combinations
        product_name = document.product_info.product_name.lower()
        for domain in enriched.application_domains:
            search_terms.add(f"{product_name} {domain}")
            search_terms.add(f"{domain} {product_name}")
        
        # Add property + product combinations
        for category in enriched.property_categories:
            search_terms.add(f"{product_name} {category}")
            search_terms.add(f"{category} {product_name}")
        
        # Clean and filter
        enriched.keywords = sorted([kw for kw in keywords if len(kw) > 2])
        enriched.search_terms = sorted([term for term in search_terms if len(term) > 2])
        
        # Find related products (products with similar applications or properties)
        enriched.related_products = self._find_related_products(document, enriched)
    
    def _extract_meaningful_terms(self, text: str) -> Set[str]:
        """Extract meaningful terms from text."""
        # Simple term extraction - could be enhanced with NLP
        terms = set()
        
        # Split on common delimiters and clean
        words = re.split(r'[,;.\-\s]+', text.lower())
        
        # Filter meaningful terms
        for word in words:
            word = word.strip()
            if (len(word) > 3 and 
                word.isalpha() and 
                word not in {'with', 'from', 'that', 'this', 'they', 'have', 'been', 'will', 'such'}):
                terms.add(word)
        
        return terms
    
    def _find_related_products(self, document: BaseExtractionDocument, enriched: EnrichedMetadata) -> List[str]:
        """Find potentially related products based on metadata."""
        # This is a placeholder - in a real implementation, this would query
        # the knowledge graph or vector database for similar products
        related = []
        
        # For now, just return products from the same family
        if document.product_info.product_family:
            # This would be replaced with actual database queries
            related.append(f"Other {document.product_info.product_family} products")
        
        return related
    
    def get_enrichment_summary(self, enriched: EnrichedMetadata) -> Dict[str, Any]:
        """Get a summary of the enrichment results."""
        return {
            "document_id": enriched.document_id,
            "filename": enriched.filename,
            "completeness_score": round(enriched.completeness_score, 3),
            "extraction_confidence": round(enriched.extraction_confidence, 3),
            "data_richness_score": round(enriched.data_richness_score, 3),
            "content_categories": enriched.content_categories,
            "property_categories": enriched.property_categories,
            "application_domains": enriched.application_domains,
            "total_properties": enriched.total_properties,
            "total_applications": enriched.total_applications,
            "keyword_count": len(enriched.keywords),
            "search_term_count": len(enriched.search_terms),
            "enrichment_timestamp": enriched.enrichment_timestamp,
        }