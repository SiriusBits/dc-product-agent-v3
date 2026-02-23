# Implementation Strategy: kg-api-products

## Database Changes
None — read-only endpoints.

## API Modifications
- New router: `dc_agent/api/kg_routes.py`
- Mount under `/kg/products/` prefix
- Each endpoint delegates to KGProductService / KGTraversalService
- Response models in `dc_agent/models/kg.py`

## UI Components
None — API only (frontend will consume these).

## Testing Approach
- Unit test with mocked services
- Integration test with populated Neo4j
- Test 404 for missing products
- Verify OpenAPI schema
