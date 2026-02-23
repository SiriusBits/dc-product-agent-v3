# Implementation Strategy: kg-entity-ingestion

## Database Changes
- New module: `apps/backend/src/dc_agent/kg/ingestion.py`
- `EntityIngester` class:
  - `parse_entities(yaml_data: dict) -> List[KGEntity]` — Extract and validate entities
  - `ingest_entity(entity: KGEntity) -> None` — MERGE single entity into Neo4j
  - `ingest_batch(entities: List[KGEntity]) -> IngestionReport` — Batch with progress
- Cypher pattern per entity:
  ```
  MERGE (n:{label} {id: $id})
  SET n.canonical_name = $canonical_name,
      n.source_text = $source_text,
      n.document_id = $document_id,
      n.page = $page
  WITH n
  FOREACH (alias IN $aliases | SET n.aliases = coalesce(n.aliases, []) + alias)
  ```
- Pydantic model: `KGEntity(id, type, canonical_name, aliases, source_text, provenance)`

## API Modifications
None — this is a data pipeline module, not an API endpoint.

## UI Components
None.

## Testing Approach
- Unit test: parse entities from sample YAML
- Unit test: verify Cypher generation for each entity type
- Integration test: ingest sample entities, query Neo4j to verify
- Test cross-document merge (same entity ID from two YAMLs)
