# Feature: kg-entity-ingestion

## Milestone
M2 — KG Data Ingestion Pipeline

## Requirements
Parse entities from derived YAML `knowledge_graph.entities` sections and create Neo4j nodes with proper label mapping, unique ID-based MERGE, and provenance tracking.

## Acceptance Criteria
- [ ] Entity `type` mapped to Neo4j node label (CHEMICAL → :Chemical, etc.)
- [ ] Entity `id` used as unique key for MERGE (no duplicates)
- [ ] Properties stored: `canonical_name`, `aliases`, `source_text`
- [ ] Provenance attached: `document_id`, `page` from YAML
- [ ] Cross-document entities merged correctly (same entity in multiple YAMLs)
- [ ] Unknown entity types logged as warnings, not errors
- [ ] Entity count after ingestion matches unique entities across all YAMLs

## Dependencies
- M1: neo4j-schema-design, neo4j-driver-refactor, neo4j-schema-init
- PyYAML for YAML parsing

## Notes
- Some entities appear in multiple product YAMLs (e.g., "Dixie Chemical" organization)
- Aliases should accumulate across documents (union, not replace)
