"""Routines for synchronising metadata into base extraction JSON/YAML files."""

from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path
from typing import List, Optional, Tuple

import yaml

from .metadata import extract_pdf_metadata


class _OrderedDumper(yaml.SafeDumper):
    pass


def _represent_ordered_dict(dumper: yaml.Dumper, data: OrderedDict) -> yaml.nodes.Node:
    return dumper.represent_dict(data.items())


_OrderedDumper.add_representer(OrderedDict, _represent_ordered_dict)
_OrderedDumper.add_representer(dict, _represent_ordered_dict)


def _load_json_ordered(path: Path) -> OrderedDict:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh, object_pairs_hook=OrderedDict)


def _write_json_ordered(path: Path, data: OrderedDict, *, dry_run: bool = False) -> None:
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=True)
        fh.write("\n")


def _write_yaml_ordered(path: Path, data: OrderedDict, *, dry_run: bool = False) -> None:
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        yaml.dump(data, fh, Dumper=_OrderedDumper, sort_keys=False)


def _attach_metadata(record: OrderedDict, metadata: OrderedDict) -> OrderedDict:
    updated = OrderedDict()
    inserted = False
    for key, value in record.items():
        if key == "document_file_metadata":
            continue
        updated[key] = value
        if key == "filepath" and not inserted:
            updated["document_file_metadata"] = metadata
            inserted = True
    if not inserted:
        updated["document_file_metadata"] = metadata
    return updated


def _resolve_pdf_path(source_path: str, pdf_root: Optional[Path]) -> Optional[Path]:
    path = Path(source_path)
    if path.is_absolute() and path.exists():
        return path
    if pdf_root:
        candidate = pdf_root / path.name
        if candidate.exists():
            return candidate
    if path.exists():
        return path
    return None


def sync_metadata(
    json_dir: Path,
    pdf_root: Optional[Path] = None,
    *,
    yaml_dir: Optional[Path] = None,
    dry_run: bool = False,
) -> List[Tuple[Path, Optional[Path]]]:
    """Update each base JSON (and optional YAML) with metadata extracted from source PDFs.

    Args:
        json_dir: Directory containing ``*_base.json`` documents.
        pdf_root: Optional directory used to resolve PDF filenames.
        yaml_dir: Directory containing YAML counterparts (``*_base.yaml``).
        dry_run: When ``True`` write operations are skipped.

    Returns:
        A list of tuples describing updated paths ``(json_path, yaml_path_or_None)``.
    """

    updated: List[Tuple[Path, Optional[Path]]] = []
    for json_path in sorted(json_dir.glob("*_base.json")):
        record = _load_json_ordered(json_path)
        source = record.get("source_filepath")
        if not isinstance(source, str):
            continue
        pdf_path = _resolve_pdf_path(source, pdf_root)
        if not pdf_path:
            continue
        metadata = extract_pdf_metadata(pdf_path)
        record_with_metadata = _attach_metadata(record, metadata)
        _write_json_ordered(json_path, record_with_metadata, dry_run=dry_run)

        yaml_path = None
        if yaml_dir:
            candidate = yaml_dir / (json_path.stem + ".yaml")
            if candidate.exists():
                with candidate.open("r", encoding="utf-8") as fh:
                    yaml_data = yaml.safe_load(fh)
                if not isinstance(yaml_data, dict):
                    yaml_data = {}
                yaml_ordered = OrderedDict()
                inserted = False
                for key, value in yaml_data.items():
                    if key == "document_file_metadata":
                        continue
                    yaml_ordered[key] = value
                    if key == "filepath" and not inserted:
                        yaml_ordered["document_file_metadata"] = metadata
                        inserted = True
                if not inserted:
                    yaml_ordered["document_file_metadata"] = metadata
                _write_yaml_ordered(candidate, yaml_ordered, dry_run=dry_run)
                yaml_path = candidate
        updated.append((json_path, yaml_path))
    return updated


__all__ = ["sync_metadata"]
