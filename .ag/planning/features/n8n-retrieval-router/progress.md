# Progress: n8n-retrieval-router

## Subtasks
- [x] Create backend internal router (`api/internal.py`)
- [x] Implement /internal/vector-search endpoint
- [x] Implement /internal/kg-search endpoint (includes profile enrichment — covers kg-product)
- [x] Build n8n vector routing branch
- [x] Build n8n KG routing branch (KG search + Graphiti)
- [x] Build n8n hybrid parallel branch (vector + KG in parallel)
- [x] Add error handling / fallback nodes (`onError: continueRegularOutput`)
- [ ] Test each path end-to-end (requires running containers)
