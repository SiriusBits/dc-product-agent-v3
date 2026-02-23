# Milestone 2: KG Data Ingestion Pipeline

## Goal
Build an automated pipeline to ingest extracted knowledge graph data from derived YAML/JSON files into Neo4j.

## Context
The derived YAML files (e.g., `reference/derived_info_yaml/ASA_100_Technical_Bulletin_derived.yaml`) contain a `knowledge_graph` section with `entities` (typed nodes with IDs, names, aliases, provenance) and `kg_triples` (subject-predicate-object relationships). Currently, only the ChromaDB ingestion pipeline exists (`apps/backend/scripts/ingest_reference_data.py`). No KG ingestion has been built.

## Data Source Format
Each derived YAML contains:
```yaml
knowledge_graph:
  entities:
    - id: uuid
      type: CHEMICAL | CHEMICAL_CLASS | ORGANIZATION | IDENTIFIER | MATERIAL
      canonical_name: string
      aliases: [string]
      source_text: string
      provenance:
        document_id: uuid
        page: int
  kg_triples:
    - subject: {id, name}
      predicate: is_a | derived_from | has_cas_number | has_application | ...
      object: {id, name} | string | {property, value} | {temperature, value}
```

## Features

### Feature 1: `kg-entity-ingestion`
Parse entities from derived YAML and create Neo4j nodes:
- Map entity `type` to node label
- Use entity `id` as unique key for MERGE
- Store `canonical_name`, `aliases`, `source_text` as properties
- Attach `provenance` (document_id, page) as properties

### Feature 2: `kg-triple-ingestion`
Parse kg_triples and create Neo4j relationships:
- Map `predicate` to uppercase relationship type (e.g., `is_a` → `IS_A`)
- Handle polymorphic objects: entity refs (by ID), plain strings, property dicts
- For string objects (e.g., applications), create or merge target nodes
- For property objects, store property name + value on the relationship or create property nodes

### Feature 3: `kg-ingestion-cli`
CLI tool (`apps/backend/scripts/ingest_kg_data.py`):
- `--source-dir` for derived YAML/JSON directory
- `--clear` flag to wipe existing KG data
- `--dry-run` flag for validation without writes
- Progress bar and summary report
- Idempotent: re-running produces same graph state

### Feature 4: `kg-data-validation`
Pre-ingestion validation:
- Validate entity schema (required fields: id, type, canonical_name)
- Validate triple schema (required: subject, predicate, object)
- Check referential integrity (triple subjects/objects reference known entities)
- Report warnings for missing or malformed data

## Dependencies
- Milestone 1 (Neo4j Foundation & Schema)
- Derived YAML files in `reference/derived_info_yaml/`
- PyYAML for YAML parsing

## Acceptance Criteria
- [ ] All 17 product derived YAMLs are ingested successfully
- [ ] Entity count in Neo4j matches total unique entities across all YAMLs
- [ ] Relationship count matches total kg_triples
- [ ] Re-running ingestion produces no duplicate nodes/relationships
- [ ] `--dry-run` reports what would be created without side effects
- [ ] Validation catches malformed entities and triples
- [ ] Ingestion completes in < 30 seconds for full corpus
