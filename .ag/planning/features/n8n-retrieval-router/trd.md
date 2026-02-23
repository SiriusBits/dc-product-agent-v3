# Feature: n8n-retrieval-router

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
n8n Switch/If nodes that route classified queries to the appropriate backend internal endpoints, including parallel execution for hybrid queries.

## Acceptance Criteria
- [ ] Vector path calls `POST /internal/vector-search` on backend
- [ ] KG path calls `POST /internal/kg-search` and/or `POST /internal/kg-product`
- [ ] Hybrid path calls both in parallel, waits for both responses
- [ ] Error handling: KG failure falls back to vector-only
- [ ] Timing captured at each HTTP Request node
- [ ] Backend internal endpoints exist and return expected response shapes

## Dependencies
- n8n-query-classifier (provides routing decision)
- M3 KG Query Service (backend KG endpoints)
- Existing vector search (SearchService)

## Notes
- n8n supports parallel execution via split/merge nodes
- Backend URL within Docker network: `http://host.docker.internal:8080` or service name
