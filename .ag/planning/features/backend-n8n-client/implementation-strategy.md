# Implementation Strategy: backend-n8n-client

## Database Changes
None.

## API Modifications
- New config: `N8N_WEBHOOK_URL` in `dc_agent/config.py` Settings
- New service: `dc_agent/services/n8n_client.py`
  - `N8nRetrievalClient`:
    - `async def orchestrate(query, top_k, conversation_id) -> OrchestrationResult`
    - Uses `httpx.AsyncClient` with timeout
    - Fallback: catches `httpx.ConnectError`, `httpx.TimeoutException` → direct vector search
- New models in `dc_agent/models/orchestration.py`:
  - `ContextBlock(source, type, content, score, product_name)`
  - `TraceMetadata(execution_id, classification, timing_ms, result_counts)`
  - `OrchestrationResult(context_blocks, trace_metadata, fallback_used)`

## UI Components
None.

## Testing Approach
- Unit test with mocked httpx responses
- Test fallback: mock connection error → verify direct search used
- Test timeout handling
- Integration test with running n8n
