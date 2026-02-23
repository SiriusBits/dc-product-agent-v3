# Feature: n8n-trace-logging

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
Structured execution metadata returned with every n8n retrieval response, enabling visual debugging of retrieval paths.

## Acceptance Criteria
- [ ] Every response includes `trace_metadata` with:
  - `execution_id` (n8n execution ID, linkable to n8n UI)
  - `classification` (vector / kg / hybrid)
  - `classification_confidence` (0.0-1.0)
  - `retrieval_sources` (list of endpoints called)
  - `timing_ms` (total and per-source breakdown)
  - `result_counts` (per source: vector_count, kg_count, fused_count)
- [ ] Backend logs trace metadata at INFO level with each request
- [ ] Trace data optionally returned to frontend via response headers or body
- [ ] n8n execution ID links directly to execution detail in n8n UI (http://localhost:5678)

## Dependencies
- n8n-retrieval-webhook, n8n-query-classifier, n8n-retrieval-router, n8n-result-fusion

## Notes
- n8n provides `$execution.id` in workflow expressions
- Timing can be captured via `Date.now()` at start/end of each branch
