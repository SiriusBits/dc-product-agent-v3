# Feature: kg-triple-ingestion

## Milestone
M2 — KG Data Ingestion Pipeline

## Requirements
Parse `kg_triples` from derived YAML files and create Neo4j relationships, handling polymorphic object types (entity references, plain strings, property dicts, measurement dicts).

## Acceptance Criteria
- [ ] Predicate mapped to uppercase relationship type (is_a → IS_A)
- [ ] Entity-reference objects matched by subject/object `id`
- [ ] String objects (e.g., applications) create/merge Application nodes
- [ ] Property dict objects (`{property, value}`) create Property nodes or store on relationship
- [ ] Measurement dict objects (`{temperature, value}`) stored as relationship properties
- [ ] Relationship count after ingestion matches total kg_triples across all YAMLs
- [ ] No orphan relationships (both endpoints must exist)

## Dependencies
- kg-entity-ingestion (entities must exist before relationships)

## Notes
- Triple object types observed in YAML:
  - `{id, name}` — entity reference
  - `string` — plain value (applications, hazards, storage requirements)
  - `{property, value}` — physical property
  - `{temperature, value}` — temperature-dependent measurement
