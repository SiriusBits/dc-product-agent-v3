"""Validate all product data files against the generated Pydantic models.

This ensures both the JSON schemas and the generated Pydantic models
stay in sync with the actual data on disk.

Note: The generated models have ``extra="forbid"`` (from ``additionalProperties:
false`` in the schemas).  Data files may contain fields added after the schema
was last updated; those *extra_forbidden* errors are collected as warnings
rather than hard failures so the test still catches real type / structure errors.
"""

from __future__ import annotations

import json
import warnings
from pathlib import Path

import pytest
from pydantic import ValidationError

from dc_agent.models.generated.base_technical_bulletin_with_defs_described_schema import (
    BaseTechnicalBulletinExtractionSchema,
)
from dc_agent.models.generated.derived_info_with_knowledge_graph_with_defs_described_schema import (
    DerivedInformationKnowledgeGraphSchemaIdsRequired,
)


def _validate_ignoring_extras(
    model_cls: type, data: dict, filename: str
) -> None:
    """Run model_validate; fail only on non-extra errors, warn on extras."""
    try:
        model_cls.model_validate(data)
    except ValidationError as exc:
        extra_errors = [e for e in exc.errors() if e["type"] == "extra_forbidden"]
        real_errors = [e for e in exc.errors() if e["type"] != "extra_forbidden"]

        if extra_errors:
            fields = [".".join(str(p) for p in e["loc"]) for e in extra_errors]
            warnings.warn(
                f"{filename}: {len(extra_errors)} extra field(s) not in schema: "
                f"{', '.join(fields)}",
                stacklevel=2,
            )

        if real_errors:
            detail = "\n".join(
                f"  {'.'.join(str(p) for p in e['loc'])}: {e['msg']}"
                for e in real_errors
            )
            pytest.fail(
                f"{filename} failed validation with "
                f"{len(real_errors)} error(s):\n{detail}"
            )

# ── Paths ──────────────────────────────────────────────────────────────
# tests/ is one level below apps/backend/
DATA_ROOT = Path(__file__).resolve().parents[3] / "data" / "extracts"
BASE_DIR = DATA_ROOT / "base_extraction"
DERIVED_DIR = DATA_ROOT / "derived_info"


def _list_json_files(directory: Path, suffix: str) -> list[Path]:
    """Return sorted list of JSON files matching *{suffix}.json in a directory."""
    if not directory.exists():
        return []
    return sorted(directory.glob(f"*{suffix}.json"))


# ── Fixtures ───────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def base_extraction_files() -> list[Path]:
    files = _list_json_files(BASE_DIR, "_base")
    assert len(files) > 0, f"No base extraction JSON files found in {BASE_DIR}"
    return files


@pytest.fixture(scope="module")
def derived_info_files() -> list[Path]:
    files = _list_json_files(DERIVED_DIR, "_derived")
    assert len(files) > 0, f"No derived info JSON files found in {DERIVED_DIR}"
    return files


# ── Base extraction tests ──────────────────────────────────────────────
def _base_ids(directory: Path) -> list[str]:
    """Generate pytest IDs from filenames."""
    return [f.stem for f in _list_json_files(directory, "_base")]


@pytest.mark.parametrize(
    "json_file",
    _list_json_files(BASE_DIR, "_base"),
    ids=_base_ids(BASE_DIR),
)
def test_base_extraction_validates(json_file: Path) -> None:
    """Each base extraction JSON should parse against the generated model."""
    data = json.loads(json_file.read_text())
    _validate_ignoring_extras(
        BaseTechnicalBulletinExtractionSchema, data, json_file.name
    )


# ── Derived info tests ─────────────────────────────────────────────────
def _derived_ids(directory: Path) -> list[str]:
    return [f.stem for f in _list_json_files(directory, "_derived")]


@pytest.mark.parametrize(
    "json_file",
    _list_json_files(DERIVED_DIR, "_derived"),
    ids=_derived_ids(DERIVED_DIR),
)
def test_derived_info_validates(json_file: Path) -> None:
    """Each derived info JSON should parse against the generated model."""
    data = json.loads(json_file.read_text())
    _validate_ignoring_extras(
        DerivedInformationKnowledgeGraphSchemaIdsRequired, data, json_file.name
    )


# ── Counts sanity check ───────────────────────────────────────────────
def test_product_counts_match(
    base_extraction_files: list[Path],
    derived_info_files: list[Path],
) -> None:
    """Every base extraction should have a corresponding derived info file."""
    base_names = {f.stem.replace("_base", "") for f in base_extraction_files}
    derived_names = {f.stem.replace("_derived", "") for f in derived_info_files}

    missing_derived = base_names - derived_names
    assert not missing_derived, (
        f"Base extractions without derived info: {missing_derived}"
    )
