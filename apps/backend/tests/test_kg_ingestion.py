"""Tests for M2: KG data ingestion pipeline.

Covers model normalisation, predicate mapping, validation,
and file-level parsing.  No live Neo4j required.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
import yaml

from dc_agent.kg.models import KGEntity, KGTriple, EntityProvenance, ValidationReport
from dc_agent.kg.predicates import normalize_predicate, entity_type_to_label
from dc_agent.kg.validation import validate_file, validate_corpus


# ---------------------------------------------------------------------------
# Model normalisation
# ---------------------------------------------------------------------------


class TestKGTripleSubjectNormalisation:
    """The KGTriple model must accept multiple subject formats."""

    def test_plain_uuid_string(self) -> None:
        t = KGTriple(subject="abc-123", predicate="has_x", object="val")
        assert t.subject.id == "abc-123"
        assert t.subject.name == ""

    def test_dict_with_id_and_name(self) -> None:
        t = KGTriple(
            subject={"id": "abc", "name": "Foo"}, predicate="p", object="v"
        )
        assert t.subject.id == "abc"
        assert t.subject.name == "Foo"

    def test_dict_with_text_only(self) -> None:
        t = KGTriple(
            subject={"text": "Dried films"}, predicate="p", object="v"
        )
        assert t.subject.name == "Dried films"
        assert t.subject.id  # should be non-empty (deterministic)

    def test_text_subject_deterministic(self) -> None:
        a = KGTriple(subject={"text": "X"}, predicate="p", object="v")
        b = KGTriple(subject={"text": "X"}, predicate="p", object="v")
        assert a.subject.id == b.subject.id

    def test_subject_id_key_variant(self) -> None:
        raw: dict[str, Any] = {
            "subject_id": "uuid-1",
            "predicate": "has_x",
            "object": "val",
        }
        t = KGTriple.model_validate(raw)
        assert t.subject.id == "uuid-1"

    def test_object_id_key_variant(self) -> None:
        raw: dict[str, Any] = {
            "subject": "uuid-1",
            "predicate": "p",
            "object_id": "uuid-2",
        }
        t = KGTriple.model_validate(raw)
        assert t.object_raw == "uuid-2"


class TestEntityProvenanceNormalisation:
    """EntityProvenance should accept doc_id as alias for document_id."""

    def test_standard_document_id(self) -> None:
        p = EntityProvenance(document_id="doc-1", page=1)
        assert p.document_id == "doc-1"

    def test_doc_id_variant(self) -> None:
        p = EntityProvenance.model_validate({"doc_id": "doc-2", "page": 3})
        assert p.document_id == "doc-2"
        assert p.page == 3


# ---------------------------------------------------------------------------
# Predicate normalisation
# ---------------------------------------------------------------------------


class TestPredicateNormalisation:
    def test_explicit_mapping(self) -> None:
        assert normalize_predicate("contains") == "CONTAINS"

    def test_is_a_mapping(self) -> None:
        assert normalize_predicate("is_a") == "IS_A"

    def test_has_application(self) -> None:
        assert normalize_predicate("has_application") == "HAS_APPLICATION"

    def test_unknown_predicate_fallback(self) -> None:
        assert normalize_predicate("xyzzy_unknown_pred_123") == "HAS_PROPERTY"


# ---------------------------------------------------------------------------
# Entity type mapping
# ---------------------------------------------------------------------------


class TestEntityTypeToLabel:
    def test_product_name(self) -> None:
        assert entity_type_to_label("PRODUCT_NAME") == "Product"

    def test_chemical(self) -> None:
        assert entity_type_to_label("CHEMICAL") == "Chemical"

    def test_cas_number_to_identifier(self) -> None:
        assert entity_type_to_label("CAS_NUMBER") == "Identifier"

    def test_unknown_returns_none(self) -> None:
        assert entity_type_to_label("UNKNOWN_TYPE_XYZ") is None


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


@pytest.fixture()
def tmp_yaml(tmp_path: Path) -> Path:
    """Write a minimal derived YAML and return its path."""
    data = {
        "knowledge_graph": {
            "entities": [
                {
                    "id": "ent-1",
                    "type": "CHEMICAL",
                    "canonical_name": "Water",
                    "source_text": "H2O",
                    "provenance": {"document_id": "doc-1", "page": 1},
                },
                {
                    "id": "ent-2",
                    "type": "APPLICATION",
                    "canonical_name": "Solvent",
                    "source_text": "used as solvent",
                    "provenance": {"document_id": "doc-1", "page": 1},
                },
            ],
            "kg_triples": [
                {
                    "subject": "ent-1",
                    "predicate": "has_application",
                    "object": "ent-2",
                },
            ],
        }
    }
    fpath = tmp_path / "test_derived.yaml"
    fpath.write_text(yaml.dump(data, default_flow_style=False))
    return fpath


def test_validate_file_valid(tmp_yaml: Path) -> None:
    report = validate_file(tmp_yaml)
    assert report.is_valid
    assert report.total_entities == 2
    assert report.total_triples == 1


def test_validate_file_missing_kg(tmp_path: Path) -> None:
    fpath = tmp_path / "empty_derived.yaml"
    fpath.write_text(yaml.dump({"foo": "bar"}))
    report = validate_file(fpath)
    assert not report.is_valid
    assert any("No knowledge_graph" in e.message for e in report.errors)


def test_validate_corpus_no_files(tmp_path: Path) -> None:
    report = validate_corpus(tmp_path)
    assert not report.is_valid


# ---------------------------------------------------------------------------
# Parsing (ingestion.parse_file)
# ---------------------------------------------------------------------------


def test_parse_file(tmp_yaml: Path) -> None:
    from dc_agent.kg.ingestion import parse_file

    entities, triples = parse_file(tmp_yaml)
    assert len(entities) == 2
    assert len(triples) == 1
    assert triples[0].subject.id == "ent-1"
    assert triples[0].predicate == "has_application"


def test_parse_file_subject_id_variant(tmp_path: Path) -> None:
    """Files using subject_id / object_id keys should parse correctly."""
    from dc_agent.kg.ingestion import parse_file

    data = {
        "knowledge_graph": {
            "entities": [
                {
                    "id": "e1",
                    "type": "CHEMICAL",
                    "canonical_name": "X",
                },
            ],
            "kg_triples": [
                {
                    "subject_id": "e1",
                    "predicate": "has_property",
                    "object_id": "some-value",
                },
            ],
        }
    }
    fpath = tmp_path / "variant_derived.yaml"
    fpath.write_text(yaml.dump(data, default_flow_style=False))

    entities, triples = parse_file(fpath)
    assert len(triples) == 1
    assert triples[0].subject.id == "e1"
    assert triples[0].object_raw == "some-value"
