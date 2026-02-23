# Implementation Strategy: kg-entity-search

## Database Changes
- Relies on full-text index created in neo4j-schema-init
- Query uses: `CALL db.index.fulltext.queryNodes('entity_search', $query) YIELD node, score`

## API Modifications
- New service: `dc_agent/kg/services/entity_service.py`
- Response models: `EntitySearchResult`, `EntityDetail`

## UI Components
None.

## Testing Approach
- Integration tests with known entities
- Test partial matching, alias matching
- Verify type filtering works
- Benchmark search performance
