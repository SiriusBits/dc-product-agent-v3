# Implementation Strategy: kg-cypher-service

## Database Changes
None.

## API Modifications
- New module: `dc_agent/kg/cypher.py`
- `CypherService` class:
  - `execute(query_template, params, result_model) -> List[T]`
  - `execute_single(query_template, params, result_model) -> Optional[T]`
  - Query templates stored as named constants
  - Result mapping via Pydantic `model_validate`
- Used by `KGProductService`, `KGTraversalService`, `KGEntityService`

## UI Components
None.

## Testing Approach
- Unit test: parameterization prevents injection
- Unit test: result mapping to Pydantic models
- Unit test: timeout enforcement
- Test: timing logged correctly
