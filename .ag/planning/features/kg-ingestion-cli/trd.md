# Feature: kg-ingestion-cli

## Milestone
M2 — KG Data Ingestion Pipeline

## Requirements
CLI tool for batch ingesting knowledge graph data from derived YAML/JSON files into Neo4j, with idempotency, dry-run mode, and progress reporting.

## Acceptance Criteria
- [ ] Script at `apps/backend/scripts/ingest_kg_data.py`
- [ ] `--source-dir` flag for derived YAML/JSON directory (default: `reference/derived_info_yaml/`)
- [ ] `--clear` flag wipes existing KG data before ingestion
- [ ] `--dry-run` flag validates and reports without writing to Neo4j
- [ ] Progress bar showing file-by-file and entity/triple progress
- [ ] Summary report: entities created/merged, triples created, warnings, errors
- [ ] Idempotent: re-running produces identical graph state
- [ ] Ingestion completes in < 30 seconds for all 17 products
- [ ] Runnable via `uv run python scripts/ingest_kg_data.py`

## Dependencies
- kg-entity-ingestion, kg-triple-ingestion, kg-data-validation

## Notes
- Follow the pattern of existing `ingest_reference_data.py` for ChromaDB
- Should be addable to Makefile as `make ingest-kg`
