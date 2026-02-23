# Feature: n8n-retrieval-webhook

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
Create the core n8n workflow triggered by webhook that receives queries from the backend and returns orchestrated retrieval context.

## Acceptance Criteria
- [ ] n8n workflow with Webhook trigger node accepting POST requests
- [ ] Receives `{query, top_k, conversation_id}` payload
- [ ] Returns `{context_blocks[], trace_metadata}` response
- [ ] Workflow exported as JSON in `n8n/workflows/retrieval-orchestrator.json`
- [ ] Webhook URL configurable and stable
- [ ] Workflow activatable/deactivatable via n8n UI

## Dependencies
- n8n container running (docker-compose)
- Backend internal endpoints (for downstream routing)

## Notes
- n8n webhooks use `/webhook/` or `/webhook-test/` URL paths
- Workflow JSON should be version-controlled for reproducibility
