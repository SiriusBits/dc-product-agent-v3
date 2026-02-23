# Implementation Strategy: kg-unit-tests

## Database Changes
None.

## API Modifications
None.

## Testing Approach
- pytest with async support (pytest-asyncio)
- Mock Neo4j async sessions using unittest.mock / pytest-mock
- Mock httpx for n8n client tests
- Fixtures for sample entities, triples, YAML data
- Test directory: `apps/backend/tests/kg/`
