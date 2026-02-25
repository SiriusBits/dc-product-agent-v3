"""Pydantic models for product API responses.

Schema-level models live in dc_agent.models.generated (auto-generated from
reference/schema/*.schema.json).  This module defines the API response shapes
that wrap or simplify the generated models for FastAPI serialisation.
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

# Re-export schema-backed models from the generated package.
# Consumers (services, routes) can import them from here unchanged.
from dc_agent.models.generated.common_defs_described_schema import (
    ContactInfo,
    Registration,
    PropertySpecRow as PropertySpec,
)


# ── Simplified API models (not in the JSON schemas) ────────────────────

class ProductInfo(BaseModel):
    """Product identification info for API responses."""
    product_name: str
    product_short_name: str
    product_family: str | None = None
    cas_number: str | None = None
    chemical_name: str | None = None
    synonyms: list[str] = Field(default_factory=list)


class Section(BaseModel):
    """Document section (simplified for API responses)."""
    name: str
    page: int | None = None
    text: str


class ExtractionMetadata(BaseModel):
    """Extraction metadata (simplified for API responses)."""
    confidence_scores: Dict[str, Any] = Field(default_factory=dict)
    extractor_version: str | None = None
    extraction_date: str | None = None


class DerivedInfo(BaseModel):
    """Derived AI analysis (simplified for API responses)."""
    summary: str | None = None
    personas: Dict[str, str] | None = None
    key_applications: list[str] = Field(default_factory=list)


class ProductSummary(BaseModel):
    """Summary product info for list endpoint."""
    doc_id: str
    product_name: str
    product_short_name: str
    product_family: str | None = None
    cas_number: str | None = None
    summary: str | None = None
    key_applications: list[str] = Field(default_factory=list)
    pdf_filename: str | None = None


class ProductDetail(BaseModel):
    """Full product details."""
    # Identification
    doc_id: str
    filename: str
    filepath: str | None = None

    # Document metadata
    document_type: str | None = None
    manufacturer: str | None = None
    contact_info: ContactInfo | None = None

    # Product info
    product_info: ProductInfo

    # Registrations and benefits
    registrations: list[Registration] = Field(default_factory=list)
    key_benefits: list[str] = Field(default_factory=list)

    # Applications
    applications_text: str | None = None
    applications: list[str] = Field(default_factory=list)

    # Properties and specifications
    properties_and_specifications: list[PropertySpec] = Field(default_factory=list)

    # Sections
    sections: list[Section] = Field(default_factory=list)

    # Derived info (from AI analysis)
    derived_info: DerivedInfo | None = None

    # Metadata
    extraction_metadata: ExtractionMetadata | None = None


class ProductListResponse(BaseModel):
    """Response for product list endpoint."""
    products: list[ProductSummary]
    count: int


class ProductPdfResponse(BaseModel):
    """Response for product PDF endpoint."""
    product_id: str
    product_name: str
    pdf_url: str
    filename: str
