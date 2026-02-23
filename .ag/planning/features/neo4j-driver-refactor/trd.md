# Feature: neo4j-driver-refactor

## Milestone
M1 — Neo4j Foundation & Schema Design

## Requirements
Rewrite `Neo4jKGStore` (apps/backend/src/dc_agent/kg/neo4j.py) to use the async Neo4j Python driver with proper MERGE operations, connection management, and error handling.

## Acceptance Criteria
- [ ] `Neo4jKGStore` uses `neo4j.AsyncGraphDatabase` driver
- [ ] `add_entity` uses MERGE on entity `id` (not CREATE)
- [ ] `add_relationship` matches nodes by ID before creating relationships
- [ ] Connection pooling configured with sensible defaults
- [ ] Retry logic for transient Neo4j errors (ServiceUnavailable, SessionExpired)
- [ ] Structured logging for all operations (not print statements)
- [ ] `KGStore` ABC updated to async methods
- [ ] Async context manager support (`async with Neo4jKGStore() as store:`)
- [ ] All existing code that imports `Neo4jKGStore` updated

## Dependencies
- neo4j-schema-design (need to know the schema to write proper MERGE queries)
- `neo4j>=5.14.0` (already in pyproject.toml — confirm async driver support)

## Notes
- Current implementation uses synchronous `GraphDatabase.driver` — must switch to `AsyncGraphDatabase`
- Current `_create_node` uses CREATE instead of MERGE (causes duplicates)
- Current `_create_relationship` matches nodes by full property set (fragile and slow)
