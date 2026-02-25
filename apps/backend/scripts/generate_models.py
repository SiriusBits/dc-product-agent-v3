"""
generate_models.py — Generates Pydantic v2 models from JSON Schema files.

Handles two quirks of the project schemas:
  1. Snake_case JSON Schema keywords (additional_properties → additionalProperties)
  2. $ref URIs using https://example.com/schemas/… → local filenames

Usage:
  uv run python scripts/generate_models.py
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

# ── Paths ──────────────────────────────────────────────────────────────
# __file__ = apps/backend/scripts/generate_models.py
# parents: [0]=scripts, [1]=backend, [2]=apps, [3]=project root
PROJECT_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_DIR = PROJECT_ROOT / "reference" / "schema"
OUTPUT_DIR = (
    PROJECT_ROOT / "apps" / "backend" / "src" / "dc_agent" / "models" / "generated"
)

SCHEMA_FILES = [
    "common-defs.described.schema.json",
    "base-technical-bulletin-with-defs.described.schema.json",
    "base-technical-bulletin-llm.schema.json",
    "derived-info-with-knowledge-graph-with-defs.described.schema.json",
    "kg-entity.schema.json",
    "kg-triple.schema.json",
    "chunk.schema.json",
]

# ── Keyword normalisation ──────────────────────────────────────────────
KEY_MAP: dict[str, str] = {
    "additional_properties": "additionalProperties",
    "one_of": "oneOf",
    "all_of": "allOf",
    "any_of": "anyOf",
    "unique_items": "uniqueItems",
    "min_items": "minItems",
    "max_items": "maxItems",
    "min_length": "minLength",
    "max_length": "maxLength",
    "pattern_properties": "patternProperties",
}


def normalize_keys(obj: Any) -> Any:
    """Recursively map snake_case JSON Schema keywords to camelCase."""
    if obj is None or not isinstance(obj, (dict, list)):
        return obj
    if isinstance(obj, list):
        return [normalize_keys(item) for item in obj]
    return {KEY_MAP.get(k, k): normalize_keys(v) for k, v in obj.items()}


# ── $ref rewriting ─────────────────────────────────────────────────────
def build_id_to_file_map() -> dict[str, str]:
    """Build a map from schema $id → local filename."""
    mapping: dict[str, str] = {}
    for filename in SCHEMA_FILES:
        raw = json.loads((SCHEMA_DIR / filename).read_text())
        schema_id = raw.get("$id")
        if schema_id:
            mapping[schema_id] = filename
    return mapping


def rewrite_refs(obj: Any, id_map: dict[str, str]) -> Any:
    """Replace https://example.com/… $ref URIs with local filenames."""
    if obj is None or not isinstance(obj, (dict, list)):
        return obj
    if isinstance(obj, list):
        return [rewrite_refs(item, id_map) for item in obj]
    result: dict[str, Any] = {}
    for key, value in obj.items():
        if key == "$ref" and isinstance(value, str):
            for schema_id, filename in id_map.items():
                if value.startswith(schema_id):
                    value = value.replace(schema_id, filename)
                    break
            result[key] = value
        else:
            result[key] = rewrite_refs(value, id_map)
    return result


# ── Main ───────────────────────────────────────────────────────────────
def main() -> None:
    id_map = build_id_to_file_map()

    # Write normalised + ref-rewritten schemas to a temp dir
    with tempfile.TemporaryDirectory(prefix="schema-gen-") as tmp_dir:
        tmp_path = Path(tmp_dir)

        for filename in SCHEMA_FILES:
            raw = json.loads((SCHEMA_DIR / filename).read_text())
            normalized = rewrite_refs(normalize_keys(raw), id_map)
            (tmp_path / filename).write_text(json.dumps(normalized, indent=2))

        # Generate models for each schema using datamodel-codegen
        # Process the main schemas (not common-defs alone, since it's just $defs)
        # Use the base-technical-bulletin-with-defs as the main entry point
        # which $refs common-defs, giving us all shared types too.
        input_schemas = [
            f for f in SCHEMA_FILES if f != "common-defs.described.schema.json"
        ]

        # Generate from all schemas at once using the directory input
        # datamodel-codegen resolves $refs relative to input files
        # Ensure clean output directory
        if OUTPUT_DIR.exists():
            import shutil

            shutil.rmtree(OUTPUT_DIR)
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        cmd = [
            sys.executable,
            "-m",
            "datamodel_code_generator",
            "--input",
            str(tmp_path),
            "--input-file-type",
            "jsonschema",
            "--output",
            str(OUTPUT_DIR),
            "--output-model-type",
            "pydantic_v2.BaseModel",
            "--target-python-version",
            "3.11",
            "--use-annotated",
            "--field-constraints",
            "--collapse-root-models",
            "--use-double-quotes",
            "--use-union-operator",
            "--snake-case-field",
            "--strict-nullable",
            "--use-default",
            "--use-default-kwarg",
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print("datamodel-codegen failed:", file=sys.stderr)
            print(result.stderr, file=sys.stderr)
            sys.exit(1)

    # Add header comment to each generated .py file
    header = (
        '"""\n'
        "AUTO-GENERATED — DO NOT EDIT\n"
        "Source: reference/schema/*.schema.json\n"
        "Run `uv run python scripts/generate_models.py` to regenerate.\n"
        '"""\n\n'
    )
    for py_file in OUTPUT_DIR.glob("*.py"):
        if py_file.name == "__init__.py":
            continue
        content = py_file.read_text()
        py_file.write_text(header + content)

    rel_path = OUTPUT_DIR.relative_to(Path.cwd())
    print(f"✓ Generated Pydantic models → {rel_path}/")


if __name__ == "__main__":
    main()
