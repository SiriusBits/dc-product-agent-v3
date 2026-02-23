# Feature: kg-entity-search

## Milestone
M3 — KG Query Service

## Requirements
General-purpose entity search over the knowledge graph using full-text indexing.

## Acceptance Criteria
- [ ] `search_entities(query, entity_type=None, limit=20)` returns matching entities
- [ ] `get_entity_by_id(id)` returns single entity with relationships
- [ ] `get_entities_by_type(type, limit=50)` lists entities of a given type
- [ ] Search uses Neo4j full-text index for performance
- [ ] Partial name matching works (e.g., "ASA" matches "ASA 100", "ASA 150", "ASA 155")
- [ ] Alias matching works (e.g., "HDSA" matches "ASA 100")

## Dependencies
- neo4j-schema-init (full-text index must exist)
- kg-entity-ingestion (data must be loaded)
