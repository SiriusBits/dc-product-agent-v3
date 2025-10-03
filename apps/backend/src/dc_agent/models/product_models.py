"""Pydantic models for product data structures."""

from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field


class ContactInfo(BaseModel):
    """Contact information for a manufacturer."""
    
    address: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None


class FileHash(BaseModel):
    """File hash information."""
    
    sha256: str
    
    class Config:
        extra = "allow"  # Allow additional hash types


class AdvancedPdfMetadata(BaseModel):
    """Advanced PDF metadata."""
    
    pdf_producer: Optional[str] = None
    pdf_version: Optional[str] = None
    location: Optional[str] = None
    file_size: Optional[str] = None
    page_size: Optional[str] = None
    number_of_pages: int = Field(ge=0)
    tagged_pdf: Optional[str] = Field(default=None, regex="^(Yes|No)$")
    fast_web_view: Optional[str] = Field(default=None, regex="^(Yes|No)$")


class DocumentFileMetadata(BaseModel):
    """PDF file metadata."""
    
    document_title: str
    author: Optional[List[str]] = None
    author_title: Optional[List[str]] = None
    description: Optional[str] = None
    description_writer: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    copyright_status: str = Field(regex="^(Unknown|Copyrighted|Public Domain)$")
    copyright_notice: Optional[str] = None
    copyright_info: Optional[str] = None
    created: Optional[str] = None
    modified: Optional[str] = None
    application: Optional[str] = None
    advanced: AdvancedPdfMetadata


class ConfidenceScores(BaseModel):
    """Confidence scores for extraction quality."""
    
    product_info: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    key_benefits: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    applications_text: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    applications: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    properties_and_specifications: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    typical_properties: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    epoxy_resin_properties: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    other_tables: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    formulation_data: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    toxicity_data: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    sections: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    images: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    registrations: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    document_footnotes: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    overall: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class ExtractionMetadata(BaseModel):
    """Metadata about the extraction process."""
    
    confidence_scores: Optional[ConfidenceScores] = None
    extractor_version: str
    extraction_date: Optional[str] = None
    extraction_report: Optional[str] = None


class DocumentMetadata(BaseModel):
    """Complete document metadata."""
    
    doc_id: Optional[str] = None
    filename: str
    source_filepath: Optional[str] = None
    filepath: Optional[str] = None
    document_file_metadata: Optional[DocumentFileMetadata] = None
    source_file_hash: Optional[FileHash] = None
    document_type: str
    manufacturer: str
    contact_info: ContactInfo = Field(default_factory=ContactInfo)
    has_images: bool = Field(default=False)
    extraction_metadata: ExtractionMetadata


class ProductInfo(BaseModel):
    """Product identification information."""
    
    product_name: str
    product_short_name: Optional[str] = None
    product_family: Optional[str] = None
    cas_number: Optional[str] = None
    chemical_name: Optional[str] = None
    synonyms: List[str] = Field(default_factory=list)


class Registration(BaseModel):
    """Product registration information."""
    
    type: str
    number: str
    authority: str
    status: Optional[str] = None
    notes: Optional[str] = None


class PropertySpecification(BaseModel):
    """Property or specification value."""
    
    category: str
    name: str
    value_string: Optional[str] = None
    value_numeric: Optional[float] = None
    value_min: Optional[float] = None
    value_max: Optional[float] = None
    unit: Optional[str] = None
    test_method: Optional[str] = None
    page: Optional[int] = Field(default=None, ge=1)


class TypicalProperty(BaseModel):
    """Typical property value."""
    
    name: str
    unit: Optional[str] = None
    value_string: Optional[str] = None
    value_min: Optional[float] = None
    value_max: Optional[float] = None
    value_numeric: Optional[float] = None
    test_method: Optional[str] = None


class TableNote(BaseModel):
    """Table footnote or note."""
    
    key: str
    text: str


class TypicalPropertiesTable(BaseModel):
    """Table of typical properties."""
    
    table_name: str
    page: int = Field(ge=1)
    data_type: str
    description: str
    row_count: int = Field(ge=0)
    data: List[TypicalProperty] = Field(default_factory=list)
    notes: Optional[Union[str, Dict[str, Any]]] = None
    table_notes: List[TableNote] = Field(default_factory=list)


class EpoxyResinRow(BaseModel):
    """Row in epoxy resin properties table."""
    
    resin_name: str
    property_name: str
    property_unit: Optional[str] = None
    condition: Optional[str] = None
    value_string: Optional[str] = None
    value_numeric: Optional[float] = None
    value_min: Optional[float] = None
    value_max: Optional[float] = None
    is_min: Optional[bool] = None
    is_max: Optional[bool] = None
    test_method: Optional[str] = None


class EpoxyResinProperties(BaseModel):
    """Epoxy resin properties table."""
    
    table_name: str
    page: int = Field(ge=1)
    data_type: str
    description: str
    row_count: int = Field(ge=0)
    data: List[EpoxyResinRow] = Field(default_factory=list)
    notes: Optional[Union[str, Dict[str, Any]]] = None
    table_notes: List[TableNote] = Field(default_factory=list)


class GenericTable(BaseModel):
    """Generic table structure."""
    
    table_name: str
    page: int = Field(ge=1)
    data_type: str
    description: str
    row_count: int = Field(ge=0)
    data: List[Dict[str, Any]] = Field(default_factory=list)
    table_notes: List[TableNote] = Field(default_factory=list)


class FormulationRow(BaseModel):
    """Row in formulation data table."""
    
    formulation_id: str
    component_name: str
    phr: Optional[float] = None
    weight_percent: Optional[float] = None
    notes: Optional[str] = None


class ToxicityRecord(BaseModel):
    """Toxicity data record."""
    
    test_type: str
    species: Optional[str] = None
    route: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    classification: Optional[str] = None
    source: Optional[str] = None


class DocumentSection(BaseModel):
    """Document section with content."""
    
    name: str
    page: int = Field(ge=1)
    content: str
    subsections: Optional[List["DocumentSection"]] = None


class DataPoint(BaseModel):
    """Data point from extracted chart."""
    
    x: float
    y: float
    label: Optional[str] = None


class ChemicalStructure(BaseModel):
    """Chemical structure information."""
    
    smiles: Optional[str] = None
    molecular_formula: Optional[str] = None
    molecular_weight: Optional[float] = None


class ImageData(BaseModel):
    """Extracted data from images."""
    
    axis_labels: Optional[Dict[str, str]] = None
    data_points: Optional[List[DataPoint]] = None
    chemical_structure: Optional[ChemicalStructure] = None


class DocumentImage(BaseModel):
    """Document image information."""
    
    filename: str
    page: int = Field(ge=1)
    description: Optional[str] = None
    image_type: str = Field(regex="^(graph|structure|photo|diagram|other)$")
    extracted_data: Optional[ImageData] = None


class BaseExtractionDocument(BaseModel):
    """Complete base extraction document."""
    
    doc_id: Optional[str] = None
    filename: str
    source_filepath: Optional[str] = None
    filepath: Optional[str] = None
    document_file_metadata: Optional[DocumentFileMetadata] = None
    source_file_hash: Optional[FileHash] = None
    document_type: str
    manufacturer: str
    contact_info: ContactInfo = Field(default_factory=ContactInfo)
    has_images: bool = Field(default=False)
    product_info: ProductInfo
    registrations: List[Registration] = Field(default_factory=list)
    key_benefits: List[str] = Field(default_factory=list)
    applications_text: Optional[str] = None
    applications: List[str] = Field(default_factory=list)
    properties_and_specifications: List[PropertySpecification] = Field(default_factory=list)
    epoxy_resin_properties: Optional[EpoxyResinProperties] = None
    typical_properties: TypicalPropertiesTable
    other_tables: List[GenericTable] = Field(default_factory=list)
    formulation_data: List[FormulationRow] = Field(default_factory=list)
    toxicity_data: List[ToxicityRecord] = Field(default_factory=list)
    sections: List[DocumentSection] = Field(default_factory=list)
    images: List[DocumentImage] = Field(default_factory=list)
    document_footnotes: Dict[str, str] = Field(default_factory=dict)
    extraction_metadata: ExtractionMetadata


# Forward reference resolution
DocumentSection.model_rebuild()