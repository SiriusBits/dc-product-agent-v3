"""Pydantic models for KG data: entities, triples, and ingestion reports.

These models map directly to the YAML ``knowledge_graph`` sections in the
derived-info files and to the Neo4j schema defined in ``docs/kg-schema.md``.
"""

from __future__ import annotations

import hashlib
import uuid
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# YAML source models
# ---------------------------------------------------------------------------


class EntityProvenance(BaseModel):
    document_id: str
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def _normalise_doc_id(cls, data: Any) -> Any:
        """Accept ``doc_id`` as alias for ``document_id``."""
        if isinstance(data, dict) and "doc_id" in data and "document_id" not in data:
            data["document_id"] = data.pop("doc_id")
        return data


class KGEntity(BaseModel):
    """An entity extracted from a derived YAML file."""

    id: str
    type: str  # e.g. "CHEMICAL", "ORGANIZATION"
    canonical_name: str
    aliases: list[str] = Field(default_factory=list)
    source_text: str = ""
    provenance: EntityProvenance | None = None

    # Set during ingestion — the source filename
    source_file: str = ""


class TripleEndpoint(BaseModel):
    """Subject or object endpoint when it is an entity reference."""

    id: str
    name: str


class KGTriple(BaseModel):
    """A knowledge-graph triple from a derived YAML file.

    The ``object`` field is polymorphic — it may be a string, a dict with
    ``{id, name}``, a dict with ``{property, value}``, or another complex
    shape.  The raw value is stored as-is in ``object_raw``; the ingestion
    layer interprets it according to its shape.

    ``subject`` may arrive as a plain UUID string or as ``{id, name}``.
    A validator normalises both forms to :class:`TripleEndpoint`.
    """

    subject: TripleEndpoint
    predicate: str
    object_raw: Any = Field(alias="object")

    # Set during ingestion
    source_file: str = ""

    model_config = {"populate_by_name": True}

    @field_validator("subject", mode="before")
    @classmethod
    def _normalise_subject(cls, v: Any) -> Any:
        """Accept a plain UUID string, {id, name}, or {text: ...}."""
        if isinstance(v, str):
            return {"id": v, "name": ""}
        if isinstance(v, dict):
            if "id" in v:
                return v
            # {text: "..."} — generate deterministic id from text
            if "text" in v:
                digest = hashlib.sha256(f"anon:{v['text']}".encode()).hexdigest()[:32]
                return {"id": str(uuid.UUID(digest)), "name": v["text"]}
        return v

    @model_validator(mode="before")
    @classmethod
    def _normalise_variant_keys(cls, data: Any) -> Any:
        """Normalise schema variants (``subject_id`` → ``subject``, ``object_id`` → ``object``)."""
        if isinstance(data, dict):
            if "subject_id" in data and "subject" not in data:
                data["subject"] = data.pop("subject_id")
            if "object_id" in data and "object" not in data:
                data["object"] = data.pop("object_id")
        return data


# ---------------------------------------------------------------------------
# Ingestion report models
# ---------------------------------------------------------------------------


class FileReport(BaseModel):
    """Ingestion summary for a single YAML file."""

    filename: str
    entities_parsed: int = 0
    entities_merged: int = 0
    triples_parsed: int = 0
    triples_merged: int = 0
    triples_skipped: int = 0
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class IngestionReport(BaseModel):
    """Aggregate ingestion summary across all files."""

    files_processed: int = 0
    total_entities_parsed: int = 0
    total_entities_merged: int = 0
    total_triples_parsed: int = 0
    total_triples_merged: int = 0
    total_triples_skipped: int = 0
    total_warnings: int = 0
    total_errors: int = 0
    file_reports: list[FileReport] = Field(default_factory=list)

    def add(self, fr: FileReport) -> None:
        self.file_reports.append(fr)
        self.files_processed += 1
        self.total_entities_parsed += fr.entities_parsed
        self.total_entities_merged += fr.entities_merged
        self.total_triples_parsed += fr.triples_parsed
        self.total_triples_merged += fr.triples_merged
        self.total_triples_skipped += fr.triples_skipped
        self.total_warnings += len(fr.warnings)
        self.total_errors += len(fr.errors)


# ---------------------------------------------------------------------------
# Validation report
# ---------------------------------------------------------------------------


class ValidationIssue(BaseModel):
    file: str
    level: str  # "error" or "warning"
    message: str


class ValidationReport(BaseModel):
    files_checked: int = 0
    total_entities: int = 0
    total_triples: int = 0
    errors: list[ValidationIssue] = Field(default_factory=list)
    warnings: list[ValidationIssue] = Field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0
