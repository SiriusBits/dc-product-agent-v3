"""Pydantic models for product data structures."""

from typing import Any

from pydantic import BaseModel, Field


class ContactInfo(BaseModel):
    """Contact information for a manufacturer."""

    address: str | None = None
    phone: str | None = None
    fax: str | None = None
    email: str | None = None
    website: str | None = None


class FileHash(BaseModel):
    """File hash information."""

    sha256: str

    class Config:
        extra = "allow"  # Allow additional hash types


class AdvancedPdfMetadata(BaseModel):
    """Advanced PDF metadata."""

    pdf_producer: str | None = None
    pdf_version: str | None = None
    location: str | None = None
    file_size: str | None = None
    page_size: str | None = None
    number_of_pages: int = Field(ge=0)
    tagged_pdf: str | None = Field(default=None, pattern="^(Yes|No)$")
    fast_web_view: str | None = Field(default=None, pattern="^(Yes|No)$")


class DocumentFileMetadata(BaseModel):
    """PDF file metadata."""

    document_title: str
    author: list[str] | None = None
    author_title: list[str] | None = None
    description: str | None = None
    description_writer: list[str] | None = None
    keywords: list[str] | None = None
    copyright_status: str = Field(pattern="^(Unknown|Copyrighted|Public Domain)$")
    copyright_notice: str | None = None
    copyright_info: str | None = None
    created: str | None = None
    modified: str | None = None
    application: str | None = None
    advanced: AdvancedPdfMetadata


class ConfidenceScores(BaseModel):
    """Confidence scores for extraction quality."""

    product_info: float | None = Field(default=None, ge=0.0, le=1.0)
    key_benefits: float | None = Field(default=None, ge=0.0, le=1.0)
    applications_text: float | None = Field(default=None, ge=0.0, le=1.0)
    applications: float | None = Field(default=None, ge=0.0, le=1.0)
    properties_and_specifications: float | None = Field(default=None, ge=0.0, le=1.0)
    typical_properties: float | None = Field(default=None, ge=0.0, le=1.0)
    epoxy_resin_properties: float | None = Field(default=None, ge=0.0, le=1.0)
    other_tables: float | None = Field(default=None, ge=0.0, le=1.0)
    formulation_data: float | None = Field(default=None, ge=0.0, le=1.0)
    toxicity_data: float | None = Field(default=None, ge=0.0, le=1.0)
    sections: float | None = Field(default=None, ge=0.0, le=1.0)
    images: float | None = Field(default=None, ge=0.0, le=1.0)
    registrations: float | None = Field(default=None, ge=0.0, le=1.0)
    document_footnotes: float | None = Field(default=None, ge=0.0, le=1.0)
    overall: float | None = Field(default=None, ge=0.0, le=1.0)


class ExtractionMetadata(BaseModel):
    """Metadata about the extraction process."""

    confidence_scores: ConfidenceScores | None = None
    extractor_version: str
    extraction_date: str | None = None
    extraction_report: str | None = None


class DocumentMetadata(BaseModel):
    """Complete document metadata."""

    doc_id: str | None = None
    filename: str
    source_filepath: str | None = None
    filepath: str | None = None
    document_file_metadata: DocumentFileMetadata | None = None
    source_file_hash: FileHash | None = None
    document_type: str
    manufacturer: str
    contact_info: ContactInfo = Field(default_factory=ContactInfo)
    has_images: bool = Field(default=False)
    extraction_metadata: ExtractionMetadata


class ProductInfo(BaseModel):
    """Product identification information."""

    product_name: str
    product_short_name: str | None = None
    product_family: str | None = None
    cas_number: str | None = None
    chemical_name: str | None = None
    synonyms: list[str] = Field(default_factory=list)


class Registration(BaseModel):
    """Product registration information."""

    type: str
    number: str
    authority: str
    status: str | None = None
    notes: str | None = None


class PropertySpecification(BaseModel):
    """Property or specification value."""

    category: str
    name: str
    value_string: str | None = None
    value_numeric: float | None = None
    value_min: float | None = None
    value_max: float | None = None
    unit: str | None = None
    test_method: str | None = None
    page: int | None = Field(default=None, ge=1)


class TypicalProperty(BaseModel):
    """Typical property value."""

    name: str
    unit: str | None = None
    value_string: str | None = None
    value_min: float | None = None
    value_max: float | None = None
    value_numeric: float | None = None
    test_method: str | None = None


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
    data: list[TypicalProperty] = Field(default_factory=list)
    notes: str | dict[str, Any] | None = None
    table_notes: list[TableNote] = Field(default_factory=list)


class EpoxyResinRow(BaseModel):
    """Row in epoxy resin properties table."""

    resin_name: str
    property_name: str
    property_unit: str | None = None
    condition: str | None = None
    value_string: str | None = None
    value_numeric: float | None = None
    value_min: float | None = None
    value_max: float | None = None
    is_min: bool | None = None
    is_max: bool | None = None
    test_method: str | None = None


class EpoxyResinProperties(BaseModel):
    """Epoxy resin properties table."""

    table_name: str
    page: int = Field(ge=1)
    data_type: str
    description: str
    row_count: int = Field(ge=0)
    data: list[EpoxyResinRow] = Field(default_factory=list)
    notes: str | dict[str, Any] | None = None
    table_notes: list[TableNote] = Field(default_factory=list)


class GenericTable(BaseModel):
    """Generic table structure."""

    table_name: str
    page: int = Field(ge=1)
    data_type: str
    description: str
    row_count: int = Field(ge=0)
    data: list[dict[str, Any]] = Field(default_factory=list)
    table_notes: list[TableNote] = Field(default_factory=list)


class FormulationRow(BaseModel):
    """Row in formulation data table."""

    formulation_id: str
    component_name: str
    phr: float | None = None
    weight_percent: float | None = None
    notes: str | None = None


class ToxicityRecord(BaseModel):
    """Toxicity data record."""

    test_type: str
    species: str | None = None
    route: str | None = None
    value: float | None = None
    unit: str | None = None
    classification: str | None = None
    source: str | None = None


class DocumentSection(BaseModel):
    """Document section with content."""

    name: str
    page: int = Field(ge=1)
    content: str
    subsections: list["DocumentSection"] | None = None


class DataPoint(BaseModel):
    """Data point from extracted chart."""

    x: float
    y: float
    label: str | None = None


class ChemicalStructure(BaseModel):
    """Chemical structure information."""

    smiles: str | None = None
    molecular_formula: str | None = None
    molecular_weight: float | None = None


class ImageData(BaseModel):
    """Extracted data from images."""

    axis_labels: dict[str, str] | None = None
    data_points: list[DataPoint] | None = None
    chemical_structure: ChemicalStructure | None = None


class DocumentImage(BaseModel):
    """Document image information."""

    filename: str
    page: int = Field(ge=1)
    description: str | None = None
    image_type: str = Field(pattern="^(graph|structure|photo|diagram|other)$")
    extracted_data: ImageData | None = None


class BaseExtractionDocument(BaseModel):
    """Complete base extraction document."""

    doc_id: str | None = None
    filename: str
    source_filepath: str | None = None
    filepath: str | None = None
    document_file_metadata: DocumentFileMetadata | None = None
    source_file_hash: FileHash | None = None
    document_type: str
    manufacturer: str
    contact_info: ContactInfo = Field(default_factory=ContactInfo)
    has_images: bool = Field(default=False)
    product_info: ProductInfo
    registrations: list[Registration] = Field(default_factory=list)
    key_benefits: list[str] = Field(default_factory=list)
    applications_text: str | None = None
    applications: list[str] = Field(default_factory=list)
    properties_and_specifications: list[PropertySpecification] = Field(
        default_factory=list
    )
    epoxy_resin_properties: EpoxyResinProperties | None = None
    typical_properties: TypicalPropertiesTable
    other_tables: list[GenericTable] = Field(default_factory=list)
    formulation_data: list[FormulationRow] = Field(default_factory=list)
    toxicity_data: list[ToxicityRecord] = Field(default_factory=list)
    sections: list[DocumentSection] = Field(default_factory=list)
    images: list[DocumentImage] = Field(default_factory=list)
    document_footnotes: dict[str, str] = Field(default_factory=dict)
    extraction_metadata: ExtractionMetadata


# Forward reference resolution
DocumentSection.model_rebuild()
