"""Utilities for loading JSON Schema documents for validation."""

from __future__ import annotations

import json
from importlib import resources
from pathlib import Path
from typing import Dict, Mapping, Optional

from jsonschema import RefResolver


def build_schema_store(schema_dir: Path) -> Dict[str, dict]:
    """Load every ``*.schema.json`` document and index by both $id and file URI."""
    store: Dict[str, dict] = {}
    for schema_path in schema_dir.glob("*.schema.json"):
        document = json.loads(schema_path.read_text(encoding="utf-8"))
        file_uri = schema_path.resolve().as_uri()
        store[file_uri] = document
        schema_id = document.get("$id")
        if isinstance(schema_id, str):
            store[schema_id] = document
    return store


def load_schema(schema_dir: Path, filename: str) -> dict:
    """Load a schema document by filename relative to ``schema_dir``."""
    path = schema_dir / filename
    return json.loads(path.read_text(encoding="utf-8"))


def resolver_for(schema: dict, store: Mapping[str, dict]) -> RefResolver:
    """Create a ``RefResolver`` that can resolve both remote IDs and local files."""
    base_uri = schema.get("$id") or ""
    return RefResolver(base_uri, schema, store)


__all__ = [
    "build_schema_store",
    "load_schema",
    "resolver_for",
]
