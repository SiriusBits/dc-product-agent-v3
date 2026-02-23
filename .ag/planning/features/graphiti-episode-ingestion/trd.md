# Feature: graphiti-episode-ingestion

## Milestone
M4 — Graphiti Episodic Memory Integration

## Requirements
Ingest product documents as Graphiti episodes with source attribution, using derived YAML summaries and section content.

## Acceptance Criteria
- [ ] Each product's derived summary ingested as a Graphiti episode
- [ ] Source attribution via `source_description` (document ID, filename)
- [ ] `reference_time` set from YAML `extraction_date` metadata
- [ ] Batch ingestion with rate limiting for Ollama
- [ ] Progress reporting per product
- [ ] Failed episodes skipped with error logged (doesn't halt batch)

## Dependencies
- graphiti-init-lifecycle
- Derived YAML files with `derived_info.summary` content
