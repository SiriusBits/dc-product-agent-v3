# Implementation Strategy: kg-integration-tests

## Database Changes
- Test database uses isolated Neo4j instance or separate database within same instance

## API Modifications
None.

## Testing Approach
- pytest markers: `@pytest.mark.integration` for Docker-dependent tests
- conftest.py: check Docker service availability, skip if unavailable
- Fixture: populate test Neo4j with known data before each test
- Fixture: activate n8n test workflow
- Test directory: `apps/backend/tests/integration/kg/`
