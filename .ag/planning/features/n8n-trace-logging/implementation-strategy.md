# Implementation Strategy: n8n-trace-logging

## Database Changes
None.

## API Modifications
- n8n workflow: accumulate trace data through pipeline
  - Set node at start: capture `start_time`, `execution_id = $execution.id`
  - After classification: store `classification`, `confidence`
  - After each retrieval: store `source_timing`, `result_count`
  - Final Code node: assemble `trace_metadata` object
- Backend: `N8nRetrievalClient` parses `trace_metadata` from response
- Backend: log trace at INFO level
- Optional: return trace in chat response for frontend dev tools

## UI Components
None directly — but trace_metadata enables frontend debugging tools.

## Testing Approach
- Verify all trace fields populated for each strategy (vector, kg, hybrid)
- Verify execution_id matches n8n UI
- Verify timing values are reasonable
- Test: missing trace fields handled gracefully
