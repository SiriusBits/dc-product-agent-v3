"""Ingest utilities for converting YAML extracts into validated JSON."""

from __future__ import annotations

import datetime as _dt
import hashlib
import json
import re
import uuid
from collections import OrderedDict
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence, Tuple

import yaml

from .metadata import extract_pdf_metadata

_PLACEHOLDER_PATTERN = re.compile(r"\$\{([^}]+)\}")

# Field ordering to keep generated JSON predictable
_FIELD_ORDER = [
    "doc_id",
    "filename",
    "source_filepath",
    "filepath",
    "document_file_metadata",
    "source_file_hash",
    "document_type",
    "manufacturer",
    "contact_info",
    "product_info",
    "registrations",
    "key_benefits",
    "applications_text",
    "applications",
    "properties_and_specifications",
    "typical_properties",
    "epoxy_resin_properties",
    "other_tables",
    "formulation_data",
    "toxicity_data",
    "sections",
    "has_images",
    "images",
    "document_footnotes",
    "extraction_metadata",
]


def _flatten_mapping(data: Mapping[str, Any], prefix: str = "") -> Dict[str, Any]:
    mapping: Dict[str, Any] = {}
    for key, value in data.items():
        new_key = f"{prefix}.{key}" if prefix else key
        mapping[new_key] = value
        if isinstance(value, Mapping):
            mapping.update(_flatten_mapping(value, new_key))
    return mapping


def _expand_placeholders(obj: Any, mapping: Mapping[str, Any]) -> Any:
    if isinstance(obj, str):
        whole_match = _PLACEHOLDER_PATTERN.fullmatch(obj)
        if whole_match:
            placeholder = whole_match.group(1)
            if placeholder in mapping:
                value = mapping[placeholder]
                # Recursively expand in case nested placeholders exist inside dict/list values
                return _expand_placeholders(value, mapping)

        def replace(match: re.Match[str]) -> str:
            placeholder = match.group(1)
            if placeholder in mapping:
                return str(mapping[placeholder])
            return match.group(0)

        return _PLACEHOLDER_PATTERN.sub(replace, obj)
    if isinstance(obj, Mapping):
        return {key: _expand_placeholders(value, mapping) for key, value in obj.items()}
    if isinstance(obj, list):
        return [_expand_placeholders(item, mapping) for item in obj]
    return obj


def _resolve_pdf_path(source: Optional[str], pdf_root: Optional[Path]) -> Optional[Path]:
    if not source:
        return None
    path = Path(source)
    if path.is_absolute() and path.exists():
        return path
    if path.exists():
        return path.resolve()
    if pdf_root:
        candidate = (pdf_root / path.name).resolve()
        if candidate.exists():
            return candidate
    return None


def _ensure_uuid(value: Optional[str]) -> str:
    if value:
        try:
            return str(uuid.UUID(str(value)))
        except ValueError:
            pass
    return str(uuid.uuid4())


def _compute_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _ensure_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _ensure_dict(value: Any) -> dict:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    return {}


def _load_yaml(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return data or {}


def load_constants(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Constants file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    return data or {}


def _build_extraction_metadata(
    *,
    extractor_version: Optional[str],
    default_scores: Optional[Mapping[str, Any]] = None,
    provided_scores: Optional[Mapping[str, Any]] = None,
    extraction_date: Optional[str] = None,
) -> Dict[str, Any]:
    metadata: Dict[str, Any] = {}
    version = extractor_version or ""
    metadata["extractor_version"] = version
    if extraction_date:
        metadata["extraction_date"] = extraction_date
    else:
        metadata["extraction_date"] = _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")
    scores: "OrderedDict[str, Any]" = OrderedDict()
    if default_scores:
        for key, value in default_scores.items():
            scores[key] = value
    if provided_scores:
        for key, value in provided_scores.items():
            scores[key] = value
    if scores:
        metadata["confidence_scores"] = scores
    return metadata


def convert_base_yaml(
    yaml_path: Path,
    *,
    pdf_root: Optional[Path] = None,
    constants: Optional[Mapping[str, Any]] = None,
    extractor_version: Optional[str] = None,
    extraction_date: Optional[str] = None,
) -> OrderedDict:
    """Convert a base extraction YAML document into a JSON-ready record."""

    raw = _load_yaml(yaml_path)
    constants = constants or {}
    mapping = _flatten_mapping(constants) if constants else {}
    expanded = _expand_placeholders(raw, mapping)

    filename = expanded.get("filename")
    source_filepath = expanded.get("source_filepath")
    pdf_path = _resolve_pdf_path(source_filepath, pdf_root)
    if not pdf_path and filename and pdf_root:
        pdf_path = _resolve_pdf_path(str((pdf_root / filename).resolve()), pdf_root)
    if not pdf_path and filename:
        candidate = Path(filename)
        if candidate.exists():
            pdf_path = candidate.resolve()
    if not pdf_path:
        raise FileNotFoundError(
            f"Unable to resolve PDF for {yaml_path.name}. Provide --pdf-root or include source_filepath."
        )

    doc_id = _ensure_uuid(expanded.get("doc_id"))
    filename = filename or pdf_path.name
    source_filepath = source_filepath or str(pdf_path)
    filepath = expanded.get("filepath")

    processed_pdfs_root = mapping.get("paths.processed_pdfs_root")
    processed_images_root = mapping.get("paths.processed_images_root")

    pdf_metadata = extract_pdf_metadata(pdf_path)
    sha256 = _compute_sha256(pdf_path)

    defaults = constants.get("defaults", {}) if constants else {}
    extraction_defaults = (constants or {}).get("extraction", {})

    document_type = expanded.get("document_type") or defaults.get("document_type") or "Technical Bulletin"

    extraction_metadata_input = _ensure_dict(expanded.get("extraction_metadata"))
    provided_scores = _ensure_dict(extraction_metadata_input.get("confidence_scores"))
    extraction_metadata = _build_extraction_metadata(
        extractor_version=
        extraction_metadata_input.get("extractor_version")
        or extractor_version
        or extraction_defaults.get("extractor_version"),
        default_scores=extraction_defaults.get("default_confidence_scores"),
        provided_scores=provided_scores,
        extraction_date=extraction_metadata_input.get("extraction_date") or extraction_date,
    )

    output = OrderedDict()
    output["doc_id"] = doc_id
    output["filename"] = filename
    output["source_filepath"] = source_filepath
    if filepath:
        output["filepath"] = filepath
    else:
        if processed_pdfs_root:
            output["filepath"] = f"{processed_pdfs_root.rstrip('/')}/{filename}"
        else:
            output["filepath"] = str(Path("data/pdf_extracts/v1/pdfs") / filename)
    output["document_file_metadata"] = pdf_metadata
    output["source_file_hash"] = {"sha256": sha256}
    output["document_type"] = document_type
    output["manufacturer"] = expanded.get("manufacturer")
    output["contact_info"] = expanded.get("contact_info")
    output["product_info"] = expanded.get("product_info") or {}
    output["registrations"] = _ensure_list(expanded.get("registrations"))
    output["key_benefits"] = _ensure_list(expanded.get("key_benefits"))
    output["applications_text"] = expanded.get("applications_text")
    output["applications"] = _ensure_list(expanded.get("applications"))
    output["properties_and_specifications"] = _ensure_list(expanded.get("properties_and_specifications"))

    typical_properties = expanded.get("typical_properties")
    if isinstance(typical_properties, Mapping):
        typical_copy = OrderedDict(typical_properties)
        typical_copy.setdefault("table_notes", [])
        output["typical_properties"] = typical_copy
    else:
        output["typical_properties"] = typical_properties

    epoxy_props = expanded.get("epoxy_resin_properties")
    if isinstance(epoxy_props, Mapping):
        epoxy_copy = OrderedDict(epoxy_props)
        epoxy_copy.setdefault("table_notes", [])
        output["epoxy_resin_properties"] = epoxy_copy
    else:
        output["epoxy_resin_properties"] = epoxy_props

    other_tables_list = []
    for table in _ensure_list(expanded.get("other_tables")):
        if isinstance(table, Mapping):
            table_copy = OrderedDict(table)
            table_copy.setdefault("table_notes", [])
            other_tables_list.append(table_copy)
        else:
            other_tables_list.append(table)
    output["other_tables"] = other_tables_list
    output["formulation_data"] = _ensure_list(expanded.get("formulation_data"))
    output["toxicity_data"] = _ensure_list(expanded.get("toxicity_data"))
    output["sections"] = _ensure_list(expanded.get("sections"))
    images_input = _ensure_list(expanded.get("images"))
    images_output = []
    pdf_stem = Path(filename).stem
    for item in images_input:
        if isinstance(item, dict):
            image_record = dict(item)
            if "image_path" not in image_record and processed_images_root and image_record.get("filename"):
                image_record["image_path"] = f"{processed_images_root.rstrip('/')}/{pdf_stem}/{image_record['filename']}"
            images_output.append(image_record)
        else:
            images_output.append(item)
    output["images"] = images_output
    output["has_images"] = bool(images_output)
    output["document_footnotes"] = _ensure_dict(expanded.get("document_footnotes"))
    output["extraction_metadata"] = extraction_metadata

    # Ensure ordering and append any extra fields that may exist in YAML
    ordered = OrderedDict()
    for key in _FIELD_ORDER:
        if key in output:
            ordered[key] = output[key]
    for key, value in output.items():
        if key not in ordered:
            ordered[key] = value
    # Attach any additional YAML fields not explicitly mapped (e.g., custom metadata)
    for key, value in expanded.items():
        if key not in ordered:
            ordered[key] = value

    return ordered


def process_base_directory(
    base_yaml_dir: Path,
    output_dir: Path,
    *,
    pdf_root: Optional[Path] = None,
    constants: Optional[Mapping[str, Any]] = None,
    extractor_version: Optional[str] = None,
    extraction_date: Optional[str] = None,
) -> Sequence[Tuple[Path, Path]]:
    """Convert all YAML files in ``base_yaml_dir`` to JSON files in ``output_dir``."""

    output_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for yaml_path in sorted(base_yaml_dir.glob("*_base.yaml")):
        record = convert_base_yaml(
            yaml_path,
            pdf_root=pdf_root,
            constants=constants,
            extractor_version=extractor_version,
            extraction_date=extraction_date,
        )
        out_path = output_dir / (yaml_path.stem + ".json")
        with out_path.open("w", encoding="utf-8") as handle:
            json.dump(record, handle, indent=2, ensure_ascii=True)
            handle.write("\n")
        results.append((yaml_path, out_path))
    return results


__all__ = [
    "convert_base_yaml",
    "load_constants",
    "process_base_directory",
]
