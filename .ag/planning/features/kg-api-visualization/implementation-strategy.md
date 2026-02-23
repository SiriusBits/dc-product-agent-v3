# Implementation Strategy: kg-api-visualization

## Database Changes
None.

## API Modifications
- Add visualization routes to `api/kg_routes.py`
- Response models: `GraphNode`, `GraphEdge`, `SubgraphResponse`
- Cypher: extract subgraph with `MATCH path = (n)-[*0..depth]-(m) RETURN path`
- Transform Neo4j paths to node/edge lists

## UI Components
Frontend will consume these endpoints — data format must be compatible.

## Testing Approach
- Test subgraph extraction for known product
- Verify node/edge counts match expected topology
- Test depth parameter
