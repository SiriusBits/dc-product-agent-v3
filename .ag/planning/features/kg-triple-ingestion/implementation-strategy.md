# Implementation Strategy: kg-triple-ingestion

## Database Changes
- Extend `apps/backend/src/dc_agent/kg/ingestion.py`:
- `TripleIngester` class:
  - `parse_triples(yaml_data: dict) -> List[KGTriple]`
  - `classify_object(obj) -> ObjectType` — Determine object type (entity_ref, string, property_dict, measurement_dict)
  - `ingest_triple(triple: KGTriple) -> None`
  - `ingest_batch(triples: List[KGTriple]) -> IngestionReport`
- Cypher patterns by object type:
  - Entity ref: `MATCH (a {id: $subj_id}), (b {id: $obj_id}) MERGE (a)-[r:REL_TYPE]->(b)`
  - String: `MATCH (a {id: $subj_id}) MERGE (b:Application {name: $obj_value}) MERGE (a)-[r:HAS_APPLICATION]->(b)`
  - Property dict: `MATCH (a {id: $subj_id}) MERGE (a)-[r:HAS_TYPICAL_PROPERTY {property: $prop_name}]->(a) SET r.value = $value`
  - Measurement: `MATCH (a {id: $subj_id}) CREATE (a)-[r:HAS_VISCOSITY_AT_TEMPERATURE {temperature: $temp, value: $val}]->(a)`

## API Modifications
None.

## UI Components
None.

## Testing Approach
- Unit test: classify each object type correctly
- Unit test: parse triples from sample YAML
- Integration test: ingest triples after entities, verify relationships in Neo4j
- Test: attempt triple with missing entity → logged warning, not crash
