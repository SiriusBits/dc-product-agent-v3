"""KG ingestion pipeline: YAML → Neo4j.

Reads derived YAML files from ``data/extracts/derived_info_yaml/``,
parses entities and triples, and MERGEs them into Neo4j using the
async :class:`~dc_agent.kg.neo4j.Neo4jKGStore`.

Usage::

    from dc_agent.kg.ingestion import ingest_corpus
    from dc_agent.kg.neo4j import Neo4jKGStore

    async with Neo4jKGStore() as store:
        report = await ingest_corpus(store, Path("data/extracts/derived_info_yaml"))
        print(report.model_dump_json(indent=2))
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from pathlib import Path
from typing import Any

import yaml

from dc_agent.kg.models import (
    FileReport,
    IngestionReport,
    KGEntity,
    KGTriple,
)
from dc_agent.kg.predicates import (
    SELF_REF_RELATIONSHIPS,
    STRING_CREATES_NODE,
    entity_type_to_label,
    normalize_predicate,
)
from dc_agent.kg.store import KGStore

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# YAML parsing
# ---------------------------------------------------------------------------


def _extract_kg(data: dict[str, Any]) -> dict[str, Any]:
    """Return the knowledge_graph section, checking both YAML layout variants."""
    kg = (data.get("derived_info") or {}).get("knowledge_graph")
    if kg:
        return kg
    return data.get("knowledge_graph") or {}


def parse_file(path: Path) -> tuple[list[KGEntity], list[KGTriple]]:
    """Parse entities and triples from a single derived YAML file."""
    with open(path) as f:
        data = yaml.safe_load(f)

    kg = _extract_kg(data)
    fname = path.name

    entities: list[KGEntity] = []
    for raw in kg.get("entities", []):
        try:
            ent = KGEntity.model_validate(raw)
            ent.source_file = fname
            entities.append(ent)
        except Exception as exc:
            logger.warning("Skipping invalid entity in %s: %s", fname, exc)

    triples: list[KGTriple] = []
    for raw in kg.get("kg_triples", []):
        try:
            triple = KGTriple.model_validate(raw)
            triple.source_file = fname
            triples.append(triple)
        except Exception as exc:
            logger.warning("Skipping invalid triple in %s: %s", fname, exc)

    return entities, triples


# ---------------------------------------------------------------------------
# Entity ingestion
# ---------------------------------------------------------------------------


def _stable_id(label: str, name: str) -> str:
    """Generate a deterministic UUID-like id from label + canonical_name.

    Used for auto-created nodes (from string triple objects) so that
    repeated ingestion produces the same id.
    """
    digest = hashlib.sha256(f"{label}:{name}".encode()).hexdigest()[:32]
    return str(uuid.UUID(digest[:32]))


async def _merge_entity(store: KGStore, entity: KGEntity) -> str | None:
    """MERGE a single entity into Neo4j.  Returns the Neo4j label or None."""
    label = entity_type_to_label(entity.type)
    if label is None:
        logger.warning(
            "Unknown entity type '%s' for '%s' — skipping",
            entity.type,
            entity.canonical_name,
        )
        return None

    # Skip template variables
    if "${" in entity.canonical_name:
        logger.warning("Skipping template entity: %s", entity.canonical_name)
        return None

    props: dict[str, Any] = {
        "id": entity.id,
        "canonical_name": entity.canonical_name,
        "aliases": entity.aliases,
        "source_text": entity.source_text,
        "entity_type": entity.type,
        "source_file": entity.source_file,
    }
    if entity.provenance:
        props["document_id"] = entity.provenance.document_id
        props["page"] = entity.provenance.page

    # For Identifier nodes, infer the identifier_type
    if label == "Identifier":
        if entity.type == "CAS_NUMBER":
            props["identifier_type"] = "CAS"
        elif entity.type == "REGISTRATION":
            props["identifier_type"] = "REACH"
        else:
            props["identifier_type"] = "OTHER"
        props["value"] = entity.canonical_name

    await store.add_entity(label, props)
    return label


async def ingest_entities(
    store: KGStore,
    entities: list[KGEntity],
    report: FileReport,
) -> dict[str, str]:
    """MERGE all entities and return a map of entity_id → Neo4j label."""
    id_to_label: dict[str, str] = {}
    report.entities_parsed = len(entities)

    for ent in entities:
        label = await _merge_entity(store, ent)
        if label:
            id_to_label[ent.id] = label
            report.entities_merged += 1
        else:
            report.warnings.append(f"Skipped entity: {ent.canonical_name} (type={ent.type})")

    return id_to_label


# ---------------------------------------------------------------------------
# Triple ingestion
# ---------------------------------------------------------------------------


async def _ensure_node(
    store: KGStore,
    label: str,
    canonical_name: str,
    *,
    auto_created: dict[str, str],
) -> str:
    """Ensure a node exists, auto-creating if needed.  Returns the node id."""
    key = f"{label}:{canonical_name}"
    if key in auto_created:
        return auto_created[key]

    node_id = _stable_id(label, canonical_name)
    await store.add_entity(label, {
        "id": node_id,
        "canonical_name": canonical_name,
        "entity_type": f"AUTO_{label.upper()}",
        "aliases": [],
        "source_text": "",
    })
    auto_created[key] = node_id
    return node_id


async def _ingest_triple(
    store: KGStore,
    triple: KGTriple,
    id_to_label: dict[str, str],
    auto_created: dict[str, str],
    report: FileReport,
) -> bool:
    """Ingest a single triple.  Returns True if merged, False if skipped."""
    subj_id = triple.subject.id
    obj_raw = triple.object_raw
    raw_pred = triple.predicate
    rel_type = normalize_predicate(raw_pred)

    # --- null object → skip ---
    if obj_raw is None:
        report.warnings.append(f"Null object for '{raw_pred}' on '{triple.subject.name}'")
        return False

    # Base relationship properties (always include source_predicate)
    rel_props: dict[str, Any] = {"source_predicate": raw_pred}

    # --- determine target node and extra rel props ---

    target_id: str | None = None

    if isinstance(obj_raw, str):
        # Check if the string is a known entity id (plain UUID reference)
        if obj_raw in id_to_label:
            target_id = obj_raw
        elif rel_type in STRING_CREATES_NODE:
            target_label = STRING_CREATES_NODE[rel_type]
            target_id = await _ensure_node(
                store, target_label, obj_raw, auto_created=auto_created
            )
        elif rel_type in SELF_REF_RELATIONSHIPS:
            # Self-referencing: store string as relationship property
            target_id = subj_id
            rel_props["value"] = obj_raw
        else:
            # Fallback: store as self-ref with value
            target_id = subj_id
            rel_props["value"] = obj_raw

    elif isinstance(obj_raw, dict):
        obj_keys = set(obj_raw.keys())

        if obj_keys == {"id", "name"}:
            # Entity reference
            target_id = obj_raw["id"]

        elif "property" in obj_keys and "value" in obj_keys and len(obj_keys) == 2:
            # {property, value} → Property node + value on relationship
            prop_name = obj_raw["property"]
            target_id = await _ensure_node(
                store, "Property", str(prop_name), auto_created=auto_created
            )
            rel_props["value"] = str(obj_raw["value"]) if obj_raw["value"] is not None else ""
            rel_props["property_name"] = str(prop_name)

        elif "temperature" in obj_keys and "value" in obj_keys and len(obj_keys) == 2:
            # {temperature, value} → Property node with temperature metadata
            prop_name = raw_pred.replace("has_", "").replace("_at_temperature", "").replace("_", " ").title()
            target_id = await _ensure_node(
                store, "Property", prop_name, auto_created=auto_created
            )
            rel_props["value"] = str(obj_raw["value"])
            rel_props["temperature"] = str(obj_raw["temperature"])
            rel_props["property_name"] = prop_name

        else:
            # Complex measurement / formulation object → flatten onto relationship
            # Try to identify if it references an entity by name
            if rel_type == "FORMULATED_WITH" and any(
                k in obj_raw for k in ("epoxy_type", "resin")
            ):
                ref_name = obj_raw.get("epoxy_type") or obj_raw.get("resin") or "Unknown"
                target_id = await _ensure_node(
                    store, "Chemical", str(ref_name), auto_created=auto_created
                )
            else:
                # Self-ref with flattened properties
                target_id = subj_id

            # Flatten all dict values as rel props (stringify non-primitives)
            for k, v in obj_raw.items():
                if isinstance(v, (str, int, float, bool)):
                    rel_props[k] = v
                elif v is not None:
                    rel_props[k] = str(v)

    else:
        report.warnings.append(
            f"Unexpected object type {type(obj_raw).__name__} for '{raw_pred}'"
        )
        return False

    if target_id is None:
        report.warnings.append(f"Could not resolve target for '{raw_pred}' on '{triple.subject.name}'")
        return False

    await store.add_relationship(subj_id, target_id, rel_type, rel_props)
    return True


async def ingest_triples(
    store: KGStore,
    triples: list[KGTriple],
    id_to_label: dict[str, str],
    report: FileReport,
    auto_created: dict[str, str],
) -> None:
    """MERGE all triples as Neo4j relationships."""
    report.triples_parsed = len(triples)

    for triple in triples:
        ok = await _ingest_triple(store, triple, id_to_label, auto_created, report)
        if ok:
            report.triples_merged += 1
        else:
            report.triples_skipped += 1


# ---------------------------------------------------------------------------
# File + corpus ingestion
# ---------------------------------------------------------------------------


async def ingest_file(
    store: KGStore,
    path: Path,
    auto_created: dict[str, str],
    *,
    dry_run: bool = False,
) -> FileReport:
    """Ingest a single YAML file into Neo4j."""
    report = FileReport(filename=path.name)

    try:
        entities, triples = parse_file(path)
    except Exception as exc:
        report.errors.append(f"Failed to parse {path.name}: {exc}")
        return report

    if dry_run:
        report.entities_parsed = len(entities)
        report.triples_parsed = len(triples)
        return report

    id_to_label = await ingest_entities(store, entities, report)
    await ingest_triples(store, triples, id_to_label, report, auto_created)

    logger.info(
        "%s: %d entities merged, %d triples merged, %d skipped, %d warnings",
        path.name,
        report.entities_merged,
        report.triples_merged,
        report.triples_skipped,
        len(report.warnings),
    )
    return report


async def ingest_corpus(
    store: KGStore,
    source_dir: Path,
    *,
    dry_run: bool = False,
) -> IngestionReport:
    """Ingest all ``*_derived.yaml`` files from *source_dir*."""
    report = IngestionReport()
    auto_created: dict[str, str] = {}  # shared across files for dedup
    yaml_files = sorted(source_dir.glob("*_derived.yaml"))

    if not yaml_files:
        logger.error("No *_derived.yaml files found in %s", source_dir)
        return report

    logger.info("Ingesting %d YAML files from %s", len(yaml_files), source_dir)

    for path in yaml_files:
        fr = await ingest_file(store, path, auto_created, dry_run=dry_run)
        report.add(fr)

    logger.info(
        "Ingestion complete: %d files, %d entities, %d triples (%d skipped), %d warnings, %d errors",
        report.files_processed,
        report.total_entities_merged,
        report.total_triples_merged,
        report.total_triples_skipped,
        report.total_warnings,
        report.total_errors,
    )
    return report
