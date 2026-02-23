# Implementation Strategy: n8n-retrieval-router

## Database Changes
None.

## API Modifications
- New internal FastAPI router: `dc_agent/api/internal.py`
  - `POST /internal/vector-search` — wraps SearchService.semantic_search
  - `POST /internal/kg-search` — wraps KGEntityService/KGProductService
  - `POST /internal/kg-product` — structured product data from KG
- Mount internal router in main.py (restricted access)

## n8n Workflow Design
- **Switch node**: 3 outputs (vector, kg, hybrid)
- **Vector branch**: HTTP Request → backend /internal/vector-search
- **KG branch**: HTTP Request → backend /internal/kg-search
- **Hybrid branch**: Split → parallel HTTP Requests → Merge
- **Error handling**: Each HTTP Request has error output → fallback path

## UI Components
None.

## Testing Approach
- Test each routing path independently
- Test hybrid parallel execution
- Test KG failure fallback to vector
- Verify timing data captured
