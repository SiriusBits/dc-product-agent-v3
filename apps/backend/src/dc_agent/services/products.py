"""Product service for loading and managing product data."""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

from dc_agent.models.products import (
    ProductSummary,
    ProductDetail,
    ProductInfo,
    ContactInfo,
    PropertySpec,
    Section,
    ExtractionMetadata,
    DerivedInfo,
    Registration,
    ProductListResponse,
    ProductPdfResponse,
)

logger = logging.getLogger(__name__)


class ProductService:
    """Service for loading and managing product data from JSON files."""
    
    def __init__(
        self,
        base_extraction_dir: str = "../../data/extracts/base_extraction",
        derived_info_dir: str = "../../data/extracts/derived_info",
        pdf_dir: str = "../../data/extracts/pdfs",
    ):
        """Initialize the ProductService.
        
        Args:
            base_extraction_dir: Directory containing base extraction JSON files
            derived_info_dir: Directory containing derived info JSON files
            pdf_dir: Directory containing PDF files
        """
        self.base_extraction_dir = Path(base_extraction_dir)
        self.derived_info_dir = Path(derived_info_dir)
        self.pdf_dir = Path(pdf_dir)
        
        # Cache for loaded products
        self._products: Dict[str, Dict] = {}
        self._loaded = False
    
    def _load_products(self) -> None:
        """Load all product data from JSON files."""
        if self._loaded:
            return
        
        logger.info("Loading product data from JSON files...")
        
        # Load base extraction files
        base_files = list(self.base_extraction_dir.glob("*_base.json"))
        logger.info(f"Found {len(base_files)} base extraction files")
        
        for base_file in base_files:
            try:
                with open(base_file, "r", encoding="utf-8") as f:
                    base_data = json.load(f)
                
                doc_id = base_data.get("doc_id")
                if not doc_id:
                    logger.warning(f"No doc_id found in {base_file}")
                    continue
                
                # Initialize product entry
                self._products[doc_id] = {
                    "base": base_data,
                    "derived": None,
                }
                
                # Try to find corresponding derived info file
                # Extract the product name from the base filename
                # e.g., "AP-6G_Technical_Bulletin_base.json" -> "AP-6G_Technical_Bulletin"
                base_name = base_file.stem.replace("_base", "")
                derived_file = self.derived_info_dir / f"{base_name}_derived.json"
                
                if derived_file.exists():
                    with open(derived_file, "r", encoding="utf-8") as f:
                        derived_data = json.load(f)
                    self._products[doc_id]["derived"] = derived_data
                else:
                    logger.warning(f"No derived info file found for {base_name}")
                
            except Exception as e:
                logger.error(f"Error loading {base_file}: {e}")
        
        self._loaded = True
        logger.info(f"Loaded {len(self._products)} products")
    
    def _get_pdf_filename(self, base_data: Dict) -> Optional[str]:
        """Extract PDF filename from base data."""
        filename = base_data.get("filename")
        if filename:
            return filename
        
        # Fallback to filepath
        filepath = base_data.get("filepath") or base_data.get("source_filepath")
        if filepath:
            return Path(filepath).name
        
        return None
    
    def _check_pdf_exists(self, filename: str) -> bool:
        """Check if a PDF file exists."""
        if not filename:
            return False
        pdf_path = self.pdf_dir / filename
        return pdf_path.exists()
    
    def get_all_products(self) -> ProductListResponse:
        """Get a list of all products with summary info.
        
        Returns:
            ProductListResponse with list of ProductSummary objects
        """
        self._load_products()
        
        summaries: List[ProductSummary] = []
        
        for doc_id, product_data in self._products.items():
            base = product_data["base"]
            derived = product_data.get("derived")
            
            product_info = base.get("product_info", {})
            
            # Get summary and key_applications from derived info
            summary = None
            key_applications = []
            if derived and derived.get("derived_info"):
                derived_info = derived["derived_info"]
                summary = derived_info.get("summary")
                key_applications = derived_info.get("key_applications", [])
            
            pdf_filename = self._get_pdf_filename(base)
            
            summaries.append(ProductSummary(
                doc_id=doc_id,
                product_name=product_info.get("product_name", "Unknown"),
                product_short_name=product_info.get("product_short_name", "Unknown"),
                product_family=product_info.get("product_family"),
                cas_number=product_info.get("cas_number"),
                summary=summary,
                key_applications=key_applications,
                pdf_filename=pdf_filename,
            ))
        
        # Sort by product_short_name
        summaries.sort(key=lambda x: x.product_short_name)
        
        return ProductListResponse(
            products=summaries,
            count=len(summaries),
        )
    
    def get_product_by_id(self, product_id: str) -> Optional[ProductDetail]:
        """Get full product details by doc_id.
        
        Args:
            product_id: The document ID of the product
            
        Returns:
            ProductDetail or None if not found
        """
        self._load_products()
        
        product_data = self._products.get(product_id)
        if not product_data:
            return None
        
        base = product_data["base"]
        derived = product_data.get("derived")
        
        # Build ProductInfo
        pi = base.get("product_info", {})
        product_info = ProductInfo(
            product_name=pi.get("product_name", "Unknown"),
            product_short_name=pi.get("product_short_name", "Unknown"),
            product_family=pi.get("product_family"),
            cas_number=pi.get("cas_number"),
            chemical_name=pi.get("chemical_name"),
            synonyms=pi.get("synonyms", []),
        )
        
        # Build ContactInfo
        ci = base.get("contact_info")
        contact_info = None
        if ci:
            contact_info = ContactInfo(
                address=ci.get("address"),
                phone=ci.get("phone"),
                fax=ci.get("fax"),
                email=ci.get("email"),
            )
        
        # Build properties
        props = base.get("properties_and_specifications", [])
        properties = [
            PropertySpec(
                category=p.get("category"),
                name=p.get("name", ""),
                unit=p.get("unit"),
                value_string=p.get("value_string"),
                value_numeric=p.get("value_numeric"),
                value_min=p.get("value_min"),
                value_max=p.get("value_max"),
                test_method=p.get("test_method"),
                page=p.get("page"),
                notes=p.get("notes"),
            )
            for p in props
        ]
        
        # Build sections
        sects = base.get("sections", [])
        sections = [
            Section(
                name=s.get("name", ""),
                page=s.get("page"),
                text=s.get("text", ""),
            )
            for s in sects
        ]
        
        # Build extraction metadata
        em = base.get("extraction_metadata")
        extraction_metadata = None
        if em:
            extraction_metadata = ExtractionMetadata(
                confidence_scores=em.get("confidence_scores", {}),
                extractor_version=em.get("extractor_version"),
                extraction_date=em.get("extraction_date"),
            )
        
        # Build registrations
        regs = base.get("registrations", [])
        registrations = [
            Registration(
                authority=r.get("authority"),
                jurisdiction=r.get("jurisdiction"),
                registration_number=r.get("registration_number"),
                registration_name=r.get("registration_name"),
                cas_number=r.get("cas_number"),
                status=r.get("status"),
                effective_date=r.get("effective_date"),
                notes=r.get("notes"),
            )
            for r in regs
        ]
        
        # Build derived info
        derived_info = None
        if derived and derived.get("derived_info"):
            di = derived["derived_info"]
            derived_info = DerivedInfo(
                summary=di.get("summary"),
                personas=di.get("personas"),
                key_applications=di.get("key_applications", []),
            )
        
        return ProductDetail(
            doc_id=product_id,
            filename=base.get("filename", ""),
            filepath=base.get("filepath"),
            document_type=base.get("document_type"),
            manufacturer=base.get("manufacturer"),
            contact_info=contact_info,
            product_info=product_info,
            registrations=registrations,
            key_benefits=base.get("key_benefits", []),
            applications_text=base.get("applications_text"),
            applications=base.get("applications", []),
            properties_and_specifications=properties,
            sections=sections,
            derived_info=derived_info,
            extraction_metadata=extraction_metadata,
        )
    
    def get_product_pdf(self, product_id: str, base_url: str = "") -> Optional[ProductPdfResponse]:
        """Get PDF URL for a product.
        
        Args:
            product_id: The document ID of the product
            base_url: Base URL for the static files (e.g., "http://localhost:8000")
            
        Returns:
            ProductPdfResponse or None if not found
        """
        self._load_products()
        
        product_data = self._products.get(product_id)
        if not product_data:
            return None
        
        base = product_data["base"]
        product_info = base.get("product_info", {})
        product_name = product_info.get("product_name", "Unknown")
        
        pdf_filename = self._get_pdf_filename(base)
        if not pdf_filename:
            return None
        
        # Check if PDF exists
        if not self._check_pdf_exists(pdf_filename):
            return None
        
        # Build URL (static files are mounted at /static/pdfs/)
        pdf_url = f"{base_url}/static/pdfs/{pdf_filename}"
        
        return ProductPdfResponse(
            product_id=product_id,
            product_name=product_name,
            pdf_url=pdf_url,
            filename=pdf_filename,
        )
    
    def find_product_by_short_name(self, short_name: str) -> Optional[str]:
        """Find a product doc_id by its short name.
        
        Args:
            short_name: Product short name (e.g., "AP-6G", "DDSA")
            
        Returns:
            doc_id or None if not found
        """
        self._load_products()
        
        for doc_id, product_data in self._products.items():
            base = product_data["base"]
            product_info = base.get("product_info", {})
            if product_info.get("product_short_name", "").lower() == short_name.lower():
                return doc_id
        
        return None
    
    def reload(self) -> None:
        """Force reload of product data."""
        self._products = {}
        self._loaded = False
        self._load_products()


# Singleton instance
_product_service: Optional[ProductService] = None


def get_product_service() -> ProductService:
    """Get the singleton ProductService instance."""
    global _product_service
    if _product_service is None:
        _product_service = ProductService()
    return _product_service
