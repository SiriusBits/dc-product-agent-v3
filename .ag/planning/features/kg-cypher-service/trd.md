# Feature: kg-cypher-service

## Milestone
M3 — KG Query Service

## Requirements
Safe, parameterized Cypher execution layer with query templates and result mapping to Pydantic models.

## Acceptance Criteria
- [ ] All Cypher queries use parameterized inputs (no string interpolation)
- [ ] Query template registry for common patterns
- [ ] Result records mapped to Pydantic models automatically
- [ ] Query timeout enforcement (configurable, default 5s)
- [ ] Query execution logged with timing for performance monitoring
- [ ] No Cypher injection possible through user-provided inputs

## Dependencies
- neo4j-driver-refactor (async driver)
