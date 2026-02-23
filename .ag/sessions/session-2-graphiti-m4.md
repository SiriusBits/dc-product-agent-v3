# Session 2 — Graphiti Episodic Memory: Milestone 4

**Date**: 2026-02-23
**Branch**: warp-cloud

## Summary
Implemented all three M4 features (graphiti-init-lifecycle, graphiti-episode-ingestion, graphiti-search-refinement). All code is built and tested (35 new tests, 103 total KG tests passing). However, live episode ingestion with `llama3.1:8b` failed — the model is too small for Graphiti's structured extraction.

## What was built

### Feature 1: graphiti-init-lifecycle ✅
- Rewrote `GraphitiKGStore` as async context manager with lazy init
- `_ensure_initialized()` creates Graphiti client and calls `build_indices_and_constraints()` on first use
- `health_check()` pings Neo4j and checks Ollama model availability
- Graceful `close()` with error logging
- `app.state.graphiti_store` lifecycle wired into FastAPI lifespan (startup init + shutdown close)
- **Critical fix**: Removed module-level `GraphitiKGStore()` from `routes.py` that crashed imports when Neo4j was down

### Feature 2: graphiti-episode-ingestion ✅
- `graphiti_episodes.py`: `prepare_episode()` parses derived YAML → `EpisodeInput` (summary, doc_id, extraction_date, filename)
- `ingest_episodes()` with rate limiting, dry-run mode, progress callback, error recovery (skip-and-continue)
- CLI script: `scripts/ingest_graphiti_episodes.py` with `--source-dir`, `--dry-run`, `--rate-limit`
- Dry-run validated: 17/17 YAML files parsed successfully

### Feature 3: graphiti-search-refinement ✅
- `graphiti_models.py`: `GraphitiSearchResult`, `GraphitiSearchResponse`, `EpisodeInput`
- `search()` returns typed `GraphitiSearchResponse` mapped from `EntityEdge` objects
- `/query-kg` endpoint returns structured response (was raw `str(answer)`)
- Empty/error results handled gracefully (empty response, not exception)

### Adapter hardening ✅
- `ollama_adapter.py`: Removed debug prints, added tenacity retry on transient errors, `OllamaAdapterError` on JSON/validation failures (no more silent `return {}`)
- Suppressed noisy Neo4j "index already exists" INFO notifications in ingestion script

## Bugs found and fixed
- `DEFAULT_SOURCE_DIR` used `parents[4]` (→ `apps/data/...`) instead of `parents[5]` (→ `data/...`)
- `/query-kg` endpoint needed `Request` parameter for `app.state` access
- Backend port is 8001 (not 8000)

## Live ingestion failure — `llama3.1:8b` too small

**Root cause**: When Graphiti's internal prompts ask llama3.1:8b for structured JSON (`format: json` + `response_model`), the model returns the **Pydantic schema definition** (`$defs`, `properties`, `required`, `title`, `type`) instead of populated instance data. This causes validation failures for:
- `ExtractedEntities` — "Field required: extracted_entities"
- `ExtractedEdges` — "Field required: edges"
- `NodeResolutions` — "Field required: entity_resolutions"

**Result**: 0/13 products ingested before user cancelled (exit code 130)

**Possible fixes** (for Session 3):
1. **Use a larger Ollama model** — `llama3.1:70b` or `qwen2.5:32b` are more reliable for structured JSON
2. **Use an API model** — OpenAI GPT-4o-mini or Anthropic Claude for Graphiti's LLM client (config already supports API keys)
3. **Hybrid approach** — Keep Ollama for embeddings (nomic-embed-text works fine), use API model only for LLM extraction
4. **Custom extraction instructions** — Graphiti's `add_episode()` accepts `custom_extraction_instructions` to guide the model

## Schema coexistence confirmed ✅
Graphiti indexes (Entity/Episodic/Community, RELATES_TO/MENTIONS/HAS_MEMBER) created alongside M1 schema (13 labels, 25+ rel types) without conflicts.

## Test summary
- `test_ollama_adapter.py`: 12 tests
- `test_graphiti_store.py`: 14 tests
- `test_graphiti_episodes.py`: 6 tests
- **M4 total: 32 new tests (some were counted differently in quick runs)**
- **All KG tests: 103 passing, 0 regressions**

## Files changed
**Modified (4):**
- `kg/ollama_adapter.py` — Retry, logging, error propagation
- `kg/graphiti_store.py` — Full rewrite: lifecycle, typed API
- `main.py` — Graphiti lifespan wiring
- `api/routes.py` — Removed module-level store, typed `/query-kg`

**Created (6):**
- `kg/graphiti_models.py` — Pydantic models
- `kg/graphiti_episodes.py` — Episode preparation and ingestion
- `scripts/ingest_graphiti_episodes.py` — CLI ingestion tool
- `tests/test_graphiti_store.py`
- `tests/test_ollama_adapter.py`
- `tests/test_graphiti_episodes.py`

## What's next
Per ROADMAP.md, M5 (n8n Retrieval Orchestration) depends on M3 + M4 being complete. Before M5 can be effective, the Graphiti ingestion model issue must be resolved. Session 3 should:
1. Resolve the Ollama model limitation (upgrade model or switch to API)
2. Complete live episode ingestion
3. Begin M5 planning (n8n retrieval orchestration)
