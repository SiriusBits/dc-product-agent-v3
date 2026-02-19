"""Pydantic models for product data."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class ProductInfo(BaseModel):
    """Basic product identification info."""
    product_name: str
    product_short_name: str
    product_family: Optional[str] = None
    cas_number: Optional[str] = None
    chemical_name: Optional[str] = None
    synonyms: List[str] = Field(default_factory=list)


class ContactInfo(BaseModel):
    """Manufacturer contact information."""
    address: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None


class PropertySpec(BaseModel):
    """Product property or specification."""
    category: Optional[str] = None
    name: str
    unit: Optional[str] = None
    value_string: Optional[str] = None
    value_numeric: Optional[float] = None
    value_min: Optional[float] = None
    value_max: Optional[float] = None
    test_method: Optional[str] = None
    page: Optional[int] = None
    notes: Optional[str] = None


class Section(BaseModel):
    """Document section."""
    name: str
    page: Optional[int] = None
    text: str


class ExtractionMetadata(BaseModel):
    """Metadata about the extraction process."""
    confidence_scores: Dict[str, Any] = Field(default_factory=dict)
    extractor_version: Optional[str] = None
    extraction_date: Optional[str] = None


class Registration(BaseModel):
    """Product registration information."""
    authority: Optional[str] = None
    jurisdiction: Optional[str] = None
    registration_number: Optional[str] = None
    registration_name: Optional[str] = None
    cas_number: Optional[str] = None
    status: Optional[str] = None
    effective_date: Optional[str] = None
    notes: Optional[str] = None


class DerivedInfo(BaseModel):
    """Derived information from AI analysis."""
    summary: Optional[str] = None
    personas: Optional[Dict[str, str]] = None
    key_applications: List[str] = Field(default_factory=list)


class ProductSummary(BaseModel):
    """Summary product info for list endpoint."""
    doc_id: str
    product_name: str
    product_short_name: str
    product_family: Optional[str] = None
    cas_number: Optional[str] = None
    summary: Optional[str] = None
    key_applications: List[str] = Field(default_factory=list)
    pdf_filename: Optional[str] = None


class ProductDetail(BaseModel):
    """Full product details."""
    # Identification
    doc_id: str
    filename: str
    filepath: Optional[str] = None
    
    # Document metadata
    document_type: Optional[str] = None
    manufacturer: Optional[str] = None
    contact_info: Optional[ContactInfo] = None
    
    # Product info
    product_info: ProductInfo
    
    # Registrations and benefits
    registrations: List[Registration] = Field(default_factory=list)
    key_benefits: List[str] = Field(default_factory=list)
    
    # Applications
    applications_text: Optional[str] = None
    applications: List[str] = Field(default_factory=list)
    
    # Properties and specifications
    properties_and_specifications: List[PropertySpec] = Field(default_factory=list)
    
    # Sections
    sections: List[Section] = Field(default_factory=list)
    
    # Derived info (from AI analysis)
    derived_info: Optional[DerivedInfo] = None
    
    # Metadata
    extraction_metadata: Optional[ExtractionMetadata] = None


class ProductListResponse(BaseModel):
    """Response for product list endpoint."""
    products: List[ProductSummary]
    count: int


class ProductPdfResponse(BaseModel):
    """Response for product PDF endpoint."""
    product_id: str
    product_name: str
    pdf_url: str
    filename: str
