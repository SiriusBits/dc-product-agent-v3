# Feature: backend-n8n-client

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
Python HTTP client in the backend that calls the n8n retrieval webhook and handles the orchestrated response, with fallback to direct vector search.

## Acceptance Criteria
- [ ] `N8nRetrievalClient` class in `dc_agent/services/n8n_client.py`
- [ ] Calls n8n webhook URL (configurable via `N8N_WEBHOOK_URL` setting)
- [ ] Sends `{query, top_k, conversation_id}` payload
- [ ] Receives and parses `{context_blocks[], trace_metadata}` response
- [ ] Timeout configurable (default 10s)
- [ ] Retry on transient failures (1 retry with backoff)
- [ ] Fallback to direct `SearchService.semantic_search` if n8n unreachable
- [ ] Trace metadata logged at INFO level
- [ ] Returns typed `OrchestrationResult` Pydantic model

## Dependencies
- n8n-retrieval-webhook (webhook must be running)
- httpx for async HTTP calls (already a dependency)

## Notes
- N8N_WEBHOOK_URL added to Settings in config.py
- First n8n call after restart can be slow (workflow loading)
