"""Pre-ingestion validation of derived YAML knowledge-graph data.

Checks required fields, entity type validity, referential integrity
(triple endpoints reference known entities), and predicate coverage.
No Neo4j connection is needed — this is a pure-data check.

Usage::

    from dc_agent.kg.validation import validate_corpus

    report = validate_corpus(Path("data/extracts/derived_info_yaml"))
    if not report.is_valid:
        for err in report.errors:
            print(err)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

from dc_agent.kg.models import ValidationIssue, ValidationReport
from dc_agent.kg.predicates import ENTITY_TYPE_MAP, PREDICATE_MAP, normalize_predicate

logger = logging.getLogger(__name__)


def _extract_kg(data: dict[str, Any]) -> dict[str, Any] | None:
    """Return the knowledge_graph dict, checking both YAML layout variants."""
    kg = (data.get("derived_info") or {}).get("knowledge_graph")
    if kg:
        return kg
    return data.get("knowledge_graph")


def validate_file(path: Path) -> ValidationReport:
    """Validate a single derived YAML file."""
    report = ValidationReport(files_checked=1)
    fname = path.name

    # --- load ---
    try:
        with open(path) as f:
            data = yaml.safe_load(f)
    except Exception as exc:
        report.errors.append(
            ValidationIssue(file=fname, level="error", message=f"YAML parse error: {exc}")
        )
        return report

    if not isinstance(data, dict):
        report.errors.append(
            ValidationIssue(file=fname, level="error", message="Top-level value is not a dict")
        )
        return report

    kg = _extract_kg(data)
    if not kg:
        report.errors.append(
            ValidationIssue(file=fname, level="error", message="No knowledge_graph section found")
        )
        return report

    entities: list[dict[str, Any]] = kg.get("entities", [])
    triples: list[dict[str, Any]] = kg.get("kg_triples", [])
    report.total_entities = len(entities)
    report.total_triples = len(triples)

    # --- validate entities ---
    entity_ids: set[str] = set()
    for i, ent in enumerate(entities):
        eid = ent.get("id")
        etype = ent.get("type")
        cname = ent.get("canonical_name")

        if not eid:
            report.errors.append(
                ValidationIssue(file=fname, level="error", message=f"Entity [{i}]: missing 'id'")
            )
            continue
        if not cname:
            report.errors.append(
                ValidationIssue(file=fname, level="error", message=f"Entity {eid}: missing 'canonical_name'")
            )
        if not etype:
            report.errors.append(
                ValidationIssue(file=fname, level="error", message=f"Entity {eid}: missing 'type'")
            )
        elif etype not in ENTITY_TYPE_MAP:
            report.warnings.append(
                ValidationIssue(file=fname, level="warning", message=f"Entity {eid}: unknown type '{etype}'")
            )

        # Template variable check
        if cname and "${" in str(cname):
            report.warnings.append(
                ValidationIssue(file=fname, level="warning", message=f"Entity {eid}: template variable in canonical_name: {cname}")
            )

        # Optional field warnings
        if not ent.get("source_text"):
            report.warnings.append(
                ValidationIssue(file=fname, level="warning", message=f"Entity {eid}: missing 'source_text'")
            )
        if not ent.get("provenance"):
            report.warnings.append(
                ValidationIssue(file=fname, level="warning", message=f"Entity {eid}: missing 'provenance'")
            )

        entity_ids.add(eid)

    # --- validate triples ---
    for i, triple in enumerate(triples):
        subj = triple.get("subject")
        pred = triple.get("predicate")
        obj = triple.get("object")

        # Also check for subject_id variant
        if subj is None and "subject_id" in triple:
            subj = triple["subject_id"]

        # Subject may be a plain UUID string, {id, name}, or {text: ...}
        subj_id: str | None = None
        if isinstance(subj, str) and subj:
            subj_id = subj
        elif isinstance(subj, dict) and "id" in subj:
            subj_id = subj["id"]
        elif isinstance(subj, dict) and "text" in subj:
            # Anonymous subject — generate stable id from text
            subj_id = f"anon:{subj['text']}"
            report.warnings.append(
                ValidationIssue(file=fname, level="warning", message=f"Triple [{i}]: anonymous subject '{{text: {subj['text']}}}' — will auto-create node")
            )
        else:
            report.errors.append(
                ValidationIssue(file=fname, level="error", message=f"Triple [{i}]: missing or invalid 'subject'")
            )
            continue
        if not pred:
            report.errors.append(
                ValidationIssue(file=fname, level="error", message=f"Triple [{i}]: missing 'predicate'")
            )
            continue

        # Referential integrity — subject
        if subj_id not in entity_ids:
            report.warnings.append(
                ValidationIssue(file=fname, level="warning", message=f"Triple [{i}]: subject id '{subj_id}' not in file entities")
            )

        # Null object
        if obj is None:
            report.warnings.append(
                ValidationIssue(file=fname, level="warning", message=f"Triple [{i}]: null object for predicate '{pred}'")
            )
            continue

        # Referential integrity — entity-reference objects
        if isinstance(obj, dict) and "id" in obj and "name" in obj and len(obj) == 2:
            if obj["id"] not in entity_ids:
                report.warnings.append(
                    ValidationIssue(
                        file=fname,
                        level="warning",
                        message=f"Triple [{i}]: object id '{obj['id']}' not in file entities",
                    )
                )

        # Predicate coverage (warning only)
        rel_type = normalize_predicate(pred)
        if pred not in PREDICATE_MAP and rel_type == "HAS_PROPERTY":
            # Only warn for truly unmapped (not prefix-matched) predicates
            matched_prefix = any(pred.startswith(p) for p, _ in __import__("dc_agent.kg.predicates", fromlist=["PREDICATE_PREFIX_RULES"]).PREDICATE_PREFIX_RULES)
            if not matched_prefix:
                report.warnings.append(
                    ValidationIssue(file=fname, level="warning", message=f"Triple [{i}]: unmapped predicate '{pred}' → fallback HAS_PROPERTY")
                )

    return report


def validate_corpus(source_dir: Path) -> ValidationReport:
    """Validate all ``*_derived.yaml`` files in *source_dir*."""
    combined = ValidationReport()
    yaml_files = sorted(source_dir.glob("*_derived.yaml"))

    if not yaml_files:
        combined.errors.append(
            ValidationIssue(file=str(source_dir), level="error", message="No *_derived.yaml files found")
        )
        return combined

    for path in yaml_files:
        fr = validate_file(path)
        combined.files_checked += 1
        combined.total_entities += fr.total_entities
        combined.total_triples += fr.total_triples
        combined.errors.extend(fr.errors)
        combined.warnings.extend(fr.warnings)

    logger.info(
        "Validation complete: %d files, %d entities, %d triples, %d errors, %d warnings",
        combined.files_checked,
        combined.total_entities,
        combined.total_triples,
        len(combined.errors),
        len(combined.warnings),
    )
    return combined
