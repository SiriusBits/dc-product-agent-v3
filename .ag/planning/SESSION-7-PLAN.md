# Session 7 — M5: n8n Retrieval Orchestration Completion
**Date**: 2026-02-25/26
**Branch**: `warp-cloud`

---

## Milestone Completed This Session

### Milestone 5: n8n Retrieval Orchestration & Hybrid Retrieval
**Status**: ✅ COMPLETE (code + workflow built; end-to-end testing deferred to container setup)

Closed out all remaining gaps in M5 across 7 features. The backend Python side (M5 features `backend-n8n-client` and `rag-pipeline-n8n`) was already partially built from prior sessions; this session completed the n8n workflow features and the backend integration gaps.

---

## What Was Built

### 1. Internal Endpoints for n8n (`n8n-retrieval-router`)

Created dedicated `/internal/*` endpoints decoupled from the public API, optimised for n8n fusion node consumption.

**New files:**
- `apps/backend/src/dc_agent/api/internal_models.py` — Pydantic request/response models (`InternalVectorSearchRequest`, `InternalKGSearchRequest`, `VectorResultItem`, `KGEntityItem`, `KGProfileItem`)
- `apps/backend/src/dc_agent/api/internal.py` — FastAPI router with:
  - `POST /internal/vector-search` — wraps `SearchService.semantic_search`
  - `POST /internal/kg-search` — wraps `KGQueryService.search_entities` + optional product profile enrichment (when top hit is Chemical/Product, fetches full profile with classification, apps, properties, identifiers, manufacturer, benefits)

**Modified:**
- `apps/backend/src/dc_agent/main.py` — mounted `internal_router` at `/internal`

### 2. n8n Workflow Updates (`n8n-retrieval-webhook`, `n8n-query-classifier`, `n8n-retrieval-router`, `n8n-result-fusion`, `n8n-trace-logging`)

Rewrote `n8n/workflows/retrieval-orchestration.json` with these improvements over the prior version:

**Internal URLs**: All HTTP Request nodes now call `/internal/vector-search` and `/internal/kg-search` instead of public `/api/v1/*` endpoints. Graphiti search still uses `/api/v1/query-kg` (no internal equivalent needed).

**Classification confidence**: Query Classifier Code node now computes a `confidence` score (0.0–1.0) based on pattern match counts, passed through to trace metadata.

**Per-source timing**: Pipeline start timestamp (`pipeline_start`) and classifier latency (`classify_ms`) captured in the classifier, then used in all fusion nodes to compute per-source timing breakdowns.

**Result counts**: Every fusion node emits `result_counts` with per-source counts (`vector_count`, `kg_count`, `graphiti_count`) and `fused_count`.

**Configurable weights**: Hybrid fusion uses `$getWorkflowStaticData('global')` to read `vector_weight` (default 0.6) and `kg_weight` (default 0.4). Weights are editable in n8n UI without touching code.

**Error handling**: All HTTP Request nodes have `onError: continueRegularOutput` so a single source failure doesn't crash the entire pipeline.

**KG profile enrichment**: KG and hybrid fusion nodes now render product profiles (classification, applications, properties, manufacturer) as rich context blocks when the internal KG search returns a profile.

### 3. N8nTraceMetadata Model Update

**Modified:** `apps/backend/src/dc_agent/models/n8n.py`
- Added `classification_confidence: float` (0.0–1.0)
- Added `result_counts: dict[str, int]` (per-source counts)

### 4. RAG Pipeline KG Enhancements (`rag-pipeline-n8n`)

**Modified:** `apps/backend/src/dc_agent/retrieval/rag.py`

- `format_context()` now dispatches by `chunk_type`: KG/graphiti results get formatted as structured facts (`[KG Fact N]`), vector results as document excerpts (`[Source N]`). KG context appears first.
- New `_format_kg_context()` and `_format_vector_context()` static methods.
- `SYSTEM_PROMPT` updated with instructions for handling two context types: document excerpts (prose) and knowledge graph facts (structured). Tells the LLM to treat KG property values as authoritative and synthesize facts into natural language.
- `extract_sources()` handles KG provenance — uses `product_name + source_type` as dedup key for KG results, labels sections as "Knowledge Graph (kg)" or "Knowledge Graph (graphiti)".

### 5. Tests

**New files:**
- `apps/backend/tests/test_internal_routes.py` — 6 tests covering vector search, KG search with/without profile, error handling, 503 when KG service unavailable
- `apps/backend/tests/test_rag_pipeline.py` — 16 tests covering KG context formatting, vector formatting, mixed formatting, source extraction for vector/KG/graphiti, dedup, truncation, system prompt content

**Results:** 22/22 new tests pass. Full suite: 221/223 pass (2 pre-existing failures in `test_search_service.py` unrelated to M5).

---

## Files Summary

```
New files:
  apps/backend/src/dc_agent/api/internal.py
  apps/backend/src/dc_agent/api/internal_models.py
  apps/backend/tests/test_internal_routes.py
  apps/backend/tests/test_rag_pipeline.py

Modified files:
  apps/backend/src/dc_agent/main.py                    # mount internal router
  apps/backend/src/dc_agent/models/n8n.py               # +classification_confidence, +result_counts
  apps/backend/src/dc_agent/retrieval/rag.py             # KG-aware formatting, system prompt, source extraction
  n8n/workflows/retrieval-orchestration.json             # full rewrite with all M5 features

Updated feature progress:
  .ag/planning/features/n8n-retrieval-webhook/progress.md
  .ag/planning/features/n8n-query-classifier/progress.md
  .ag/planning/features/n8n-retrieval-router/progress.md
  .ag/planning/features/n8n-result-fusion/progress.md
  .ag/planning/features/n8n-trace-logging/progress.md
  .ag/planning/features/backend-n8n-client/progress.md
  .ag/planning/features/rag-pipeline-n8n/progress.md
```

---

## End-to-End Verification (Requires Docker Stack)

### Prerequisites
1. `docker compose up -d` (Neo4j, ChromaDB, n8n)
2. `uv run uvicorn dc_agent.main:app --port 8001 --reload` (backend)
3. Import workflow at http://localhost:5678 → Import from File → `n8n/workflows/retrieval-orchestration.json` → Activate

### Test Commands

```bash
# Vector path (conceptual query)
curl -s -X POST http://localhost:5678/webhook/retrieval \
  -H 'Content-Type: application/json' \
  -d '{"query": "how does epoxy curing work", "top_k": 3}' | uv run python -m json.tool

# KG path (specific property lookup)
curl -s -X POST http://localhost:5678/webhook/retrieval \
  -H 'Content-Type: application/json' \
  -d '{"query": "what is the viscosity of DCA 221", "top_k": 3}' | uv run python -m json.tool

# Hybrid path (comparison)
curl -s -X POST http://localhost:5678/webhook/retrieval \
  -H 'Content-Type: application/json' \
  -d '{"query": "compare DCA 221 and MHHPA 301 viscosity", "top_k": 3}' | uv run python -m json.tool

# Forced intent via hint
curl -s -X POST http://localhost:5678/webhook/retrieval \
  -H 'Content-Type: application/json' \
  -d '{"query": "DCA 221", "top_k": 3, "intent_hint": "kg"}' | uv run python -m json.tool
```

### What to Check in Each Response
- `metadata.intent` matches expected classification
- `metadata.classification_confidence` is 0.0–1.0
- `metadata.execution_id` is non-empty (linkable to n8n UI)
- `metadata.timing_ms` has per-source breakdown (`classify`, `vector`/`kg`/`retrieval`)
- `metadata.result_counts` has `fused_count` > 0
- `results[]` items have `content`, `source_type`, `score`, `product_name`

### Visual Debugging
After running queries, go to http://localhost:5678 → Executions. Each execution shows the full path: Webhook → Classifier → Router → Search node(s) → Fusion → Respond.

---

## ROADMAP Status After Session 7

| Milestone | Status |
|-----------|--------|
| M1: Neo4j Foundation & Schema Design | ✅ Complete |
| M2: KG Data Ingestion Pipeline | ✅ Complete |
| M3: KG Query Service | ✅ Complete |
| M4: Graphiti Episodic Memory | ✅ Complete |
| M5: n8n Retrieval Orchestration | ✅ Complete |
| M6: KG API Endpoints | ✅ Complete |
| M7: Testing & Quality Assurance | 🟡 Unit tests done; integration + perf tests remain |

---

## What's Next

### From ROADMAP
1. **M7 integration tests** — live Neo4j tests with Docker-based test fixtures
2. **M7 performance tests** — benchmark query response times against requirements (<1s graph traversal, <300ms entity lookup)

### From Session 6 backlog (broader project)
3. **Runtime validation in backend** — wire generated Pydantic models into the ingestion pipeline
4. **Runtime validation in frontend** — use generated TS types in Astro/React
5. **CI/CD integration** — `make check-schemas` and schema validation in GitHub Actions
6. **Frontend implementation** — Astro + React chat interface and product browser
7. **Vector DB ingestion** — ingest validated product data into ChromaDB
8. **Knowledge Graph ingestion** — load validated KG entities and triples into Neo4j via Graphiti
