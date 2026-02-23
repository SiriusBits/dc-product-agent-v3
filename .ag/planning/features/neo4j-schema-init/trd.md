# Feature: neo4j-schema-init

## Milestone
M1 — Neo4j Foundation & Schema Design

## Requirements
Build a schema initialization module that applies constraints and indexes to Neo4j on startup, with support for development reset.

## Acceptance Criteria
- [ ] Uniqueness constraints created for entity `id` on all node labels
- [ ] Indexes created for `canonical_name` on all node labels
- [ ] Indexes created for `type` lookups where applicable
- [ ] Full-text index on `canonical_name` and `aliases` for search
- [ ] Schema init is idempotent (safe to run multiple times)
- [ ] `wipe_and_reinit()` function clears all data and re-applies schema
- [ ] Schema validation on startup logs current state
- [ ] Init can run as standalone script or as part of app startup

## Dependencies
- neo4j-schema-design (schema spec)
- neo4j-driver-refactor (async driver)

## Notes
- Neo4j Community Edition has limited constraint support — verify which constraint types are available
- Full-text indexes use `db.index.fulltext.createNodeIndex` in Neo4j 5.x
