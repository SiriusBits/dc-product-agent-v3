# Implementation Strategy: graphiti-init-lifecycle

## Database Changes
None.

## API Modifications
- Refactor `GraphitiKGStore` in `kg/graphiti_store.py`:
  - Add `__aenter__`/`__aexit__`
  - Add `health_check() -> HealthStatus`
  - Validate Ollama model availability on init
  - Replace `close()` with proper async cleanup
- Wire health check into FastAPI health endpoint

## UI Components
None.

## Testing Approach
- Test context manager lifecycle (init, use, cleanup)
- Test health check with Neo4j up/down
- Test health check with Ollama up/down
- Test retry on transient failure
