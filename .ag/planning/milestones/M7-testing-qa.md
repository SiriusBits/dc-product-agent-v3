# Milestone 7: Testing & Quality Assurance

## Goal
Comprehensive test coverage for all KG components, ensuring reliability and performance requirements are met.

## Context
The project requires ≥80% test coverage. Backend tests use pytest. No KG-specific tests exist yet. Testing against Neo4j requires either mocking the driver or running integration tests against a test container.

## Features

### Feature 1: `kg-unit-tests`
Unit tests (mocked Neo4j driver):
- `Neo4jKGStore` CRUD operations
- Schema initialization logic
- Entity/triple parsing and mapping
- Query builder parameterization
- KG service methods (product queries, traversal, entity search)
- Query router classification logic
- KG context builder formatting
- Result fusion ranking

### Feature 2: `kg-integration-tests`
Integration tests (live Neo4j + n8n via Docker):
- End-to-end ingestion pipeline (YAML → Neo4j)
- Query service against real graph data
- API endpoint responses with real KG backend
- Graphiti episode ingestion and search
- n8n retrieval orchestration end-to-end (webhook → classify → route → fuse → return)
- Hybrid retrieval with both ChromaDB and Neo4j through n8n
- Trace metadata correctness (execution_id, classification, timing)

### Feature 3: `kg-performance-tests`
Performance benchmarks:
- Entity lookup: target < 300ms
- Product queries (all properties): target < 300ms
- Multi-hop traversal (2 hops): target < 1s
- Full hybrid query (vector + KG): target < 2s
- Bulk ingestion (17 products): target < 30s

## Dependencies
- All previous milestones (M1-M6)
- pytest (already in dev dependencies)
- Docker for integration test containers

## Acceptance Criteria
- [ ] Unit test suite covers all KG modules with ≥80% coverage
- [ ] Integration tests pass against dockerized Neo4j
- [ ] Performance benchmarks meet specified targets
- [ ] Tests are included in the project's `make test` target
- [ ] CI-compatible test configuration (skip integration tests without Docker)
