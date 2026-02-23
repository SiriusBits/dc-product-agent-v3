# Milestone 5: n8n Retrieval Orchestration & Hybrid Retrieval

## Goal
Use n8n as the visual orchestration layer for hybrid retrieval, routing queries to vector search, KG, or both — with full execution traceability for debugging and iterative improvement.

## Context
The current RAG pipeline (`apps/backend/src/dc_agent/retrieval/rag.py`) only uses ChromaDB vector search via `SearchService`. The routing decision (vector vs. KG vs. hybrid) is currently non-existent. Rather than encoding this logic as opaque Python code, we use n8n workflows to orchestrate retrieval. This gives us:
- **Visual traceability**: Every query's classification, routing path, and result assembly is visible in n8n's execution log
- **Iterative improvement**: Adjust routing rules, thresholds, and fusion weights by editing n8n workflow nodes — no code deploy needed
- **Debugging**: When retrieval produces poor results, inspect the exact path taken, what each source returned, and where quality degraded

## Architecture

```
Backend (FastAPI)                    n8n (Orchestrator)
┌──────────────┐    webhook POST    ┌─────────────────────────────────┐
│ /chat or     │ ──────────────►    │ 1. Receive query                │
│ /search      │                    │ 2. Classify intent (switch)     │
│              │                    │ 3. Route to retrieval:          │
│              │                    │    ├─ Vector: POST /internal/   │
│              │    ◄──────────     │    │   vector-search (backend)  │
│              │    JSON response   │    ├─ KG: POST /internal/       │
│ Consume      │                    │    │   kg-search (backend)      │
│ orchestrated │                    │    └─ Both (parallel)           │
│ context      │                    │ 4. Fuse results                 │
│              │                    │ 5. Return context + trace meta  │
└──────────────┘                    └─────────────────────────────────┘
```

The backend exposes **internal endpoints** (not user-facing) for n8n to call:
- `POST /internal/vector-search` — ChromaDB semantic search
- `POST /internal/kg-search` — Neo4j knowledge graph queries
- `POST /internal/kg-product` — Structured product data from KG

## Features

### Feature 1: `n8n-retrieval-webhook`
Core n8n workflow triggered by webhook:
- Webhook node receives `{query, top_k, conversation_id}` from backend
- Passes structured payload through the pipeline
- Returns `{context_blocks[], trace_metadata}` to backend
- Workflow exported as JSON in `n8n/workflows/retrieval-orchestrator.json` for version control

### Feature 2: `n8n-query-classifier`
n8n classification node(s) that determine retrieval strategy:
- **Rule-based first pass** (n8n Code node): keyword/pattern detection
  - Relationship keywords → KG ("related to", "family", "compare", "CAS number")
  - Structured lookup patterns → KG ("what is the [property] of [product]")
  - General/open-ended → Vector ("tell me about", "explain", "describe")
  - Multi-product + property → Hybrid
- **Optional LLM fallback** (n8n HTTP node → Ollama): For ambiguous queries, ask the LLM to classify
- Switch node routes to the appropriate downstream path
- Classification result + confidence stored in trace metadata

### Feature 3: `n8n-retrieval-router`
n8n Switch/If nodes that route to backend internal endpoints:
- **Vector path**: Calls `POST /internal/vector-search` on backend
- **KG path**: Calls `POST /internal/kg-search` and/or `POST /internal/kg-product` on backend
- **Hybrid path**: Calls both in parallel (n8n parallel execution), merges responses
- Each path includes error handling nodes (fallback to vector-only on KG failure)
- Timing captured at each node for performance monitoring

### Feature 4: `n8n-result-fusion`
n8n Code node that merges results from multiple retrieval sources:
- Deduplicates overlapping information (same product mentioned in both)
- Applies configurable weights (vector_weight, kg_weight as workflow variables)
- KG results provide structured facts, vector results provide prose context
- Output: ordered list of `context_blocks` with source attribution
- Fusion parameters editable directly in n8n UI

### Feature 5: `backend-n8n-client`
Python HTTP client in the backend (`dc_agent/services/n8n_client.py`):
- Calls n8n webhook URL (configurable via `N8N_WEBHOOK_URL` setting)
- Sends query payload, receives orchestrated context
- Timeout and retry logic (n8n can be slow on first call)
- Fallback: if n8n is unreachable, degrade to direct vector search
- Parses trace metadata for logging/debugging

### Feature 6: `rag-pipeline-n8n`
Integrate n8n-orchestrated context into the existing `RAGPipeline`:
- `ChatService` calls n8n client instead of `SearchService` directly
- `RAGPipeline.format_context` extended to handle both vector and KG context blocks
- System prompt updated to instruct LLM on using structured KG data alongside prose
- `extract_sources` updated to include KG provenance from trace metadata
- Direct `SearchService` call retained as fallback when n8n is unavailable

### Feature 7: `n8n-trace-logging`
Structured execution metadata for debugging:
- Each n8n execution returns `trace_metadata`:
  - `execution_id` (n8n execution ID, linkable to n8n UI)
  - `classification` (vector / kg / hybrid)
  - `classification_confidence`
  - `retrieval_sources` (which endpoints were called)
  - `timing_ms` (total and per-source)
  - `result_counts` (per source)
- Backend logs trace metadata with each request
- Trace data optionally returned to frontend for developer tooling

## Backend Internal Endpoints
New internal routes (not in the public API router):
- `POST /internal/vector-search` — Thin wrapper around `SearchService.semantic_search`
- `POST /internal/kg-search` — Wraps `KGQueryService` product/entity queries
- `POST /internal/kg-product` — Structured product data from KG (properties, relationships)
- These are restricted to internal network access (n8n → backend within Docker network)

## Dependencies
- Milestone 3 (KG Query Service — backend endpoints for n8n to call)
- Milestone 4 (Graphiti Integration — optional, enhances KG search path)
- n8n container (already in docker-compose, port 5678)
- Existing ChromaDB vector search and RAG pipeline

## Acceptance Criteria
- [ ] n8n retrieval workflow receives queries and returns orchestrated context
- [ ] Query classifier correctly routes across vector / KG / hybrid strategies
- [ ] Parallel retrieval works for hybrid queries
- [ ] Result fusion produces deduplicated, ranked context blocks
- [ ] Backend n8n client handles timeouts and falls back to direct vector search
- [ ] Every query's routing path is inspectable in n8n execution log
- [ ] Trace metadata includes execution ID, classification, timing, and result counts
- [ ] RAG pipeline produces better answers for relationship/comparison queries
- [ ] Response time for hybrid queries < 2s (including n8n overhead)
- [ ] All existing vector-only queries continue to work (no regression)
- [ ] n8n workflow JSON is version-controlled in the repository
