# Implementation Strategy: kg-api-admin

## Database Changes
None.

## API Modifications
- Add admin routes to `api/kg_routes.py`
- Health: ping Neo4j, check Graphiti, check n8n webhook
- Stats: `MATCH (n) RETURN labels(n), count(n)` + edge equivalent
- Reindex: trigger ingestion pipeline async
- Traces: query n8n API for recent executions (n8n has a REST API)

## UI Components
None.

## Testing Approach
- Test health with services up/down
- Test stats against known data
- Test reindex trigger
