# Implementation Strategy: kg-product-queries

## Database Changes
None — read-only queries.

## API Modifications
- New service: `apps/backend/src/dc_agent/kg/services/product_service.py`
- Pydantic response models in `dc_agent/models/kg.py`:
  - `KGProduct`, `KGProperty`, `KGApplication`, `KGProductFamily`, `KGStorageInfo`
- Cypher queries use parameterized lookups:
  ```
  MATCH (p:Chemical {canonical_name: $name})-[r]->(related)
  RETURN p, type(r) as rel_type, related
  ```

## UI Components
None — service layer only.

## Testing Approach
- Unit tests with mocked Neo4j sessions returning sample records
- Integration tests against populated test database
- Benchmark response times
