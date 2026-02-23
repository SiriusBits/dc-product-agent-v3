# Feature: kg-integration-tests

## Milestone
M7 — Testing & Quality Assurance

## Requirements
Integration tests running against live Neo4j + n8n via Docker.

## Acceptance Criteria
- [ ] End-to-end ingestion pipeline (YAML → Neo4j)
- [ ] Query service against real graph data
- [ ] API endpoint responses with real KG backend
- [ ] Graphiti episode ingestion and search
- [ ] n8n orchestration end-to-end (webhook → classify → route → fuse → return)
- [ ] Hybrid retrieval through n8n
- [ ] Trace metadata correctness
- [ ] Tests skip gracefully when Docker services unavailable

## Dependencies
- Docker for Neo4j + n8n containers
- pytest
