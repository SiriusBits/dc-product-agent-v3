# Implementation Strategy: neo4j-driver-refactor

## Database Changes
None — this refactors the Python driver code, not the schema.

## API Modifications
- Update `KGStore` ABC (`kg/store.py`) to use async methods:
  - `async def add_entity(...)`, `async def add_relationship(...)`, `async def query_graph(...)`, `async def close(...)`
- Rewrite `Neo4jKGStore` (`kg/neo4j.py`):
  - Constructor: `AsyncGraphDatabase.driver(uri, auth=(...))` with connection pool config
  - `add_entity`: `MERGE (n:{label} {id: $id}) SET n += $props`
  - `add_relationship`: `MATCH (a {id: $start_id}), (b {id: $end_id}) MERGE (a)-[r:{rel_type}]->(b) SET r += $rel_props`
  - `query_graph`: async session with parameterized Cypher
  - `close`: driver.close()
  - `__aenter__`/`__aexit__` for context manager
- Add retry decorator for transient errors
- Update `routes.py` and any other consumers of the old sync API

## UI Components
None.

## Testing Approach
- Unit tests with mocked `AsyncSession` and `AsyncTransaction`
- Test MERGE idempotency (same entity added twice → single node)
- Test relationship creation between existing nodes
- Test error handling (connection refused, timeout)
- Test retry logic triggers on ServiceUnavailable
