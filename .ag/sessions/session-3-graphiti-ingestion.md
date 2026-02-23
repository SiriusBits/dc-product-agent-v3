# Session 3 — Graphiti Ingestion Fix & Dependency Upgrades

**Date**: 2026-02-23
**Branch**: warp-cloud

## Summary
Resolved the M4 Graphiti ingestion blocker by switching to a hybrid LLM architecture (Ollama embeddings + OpenAI API for extraction). Upgraded dependencies to latest stable versions. Successfully ingested all 17 products as Graphiti episodes with verified search results.

## Phase 1: Resolve Graphiti LLM Blocker ✅

### Decision: Option A — Hybrid (Ollama embeddings + OpenAI LLM)
Infrastructure check confirmed:
- All 3 Docker containers running (Neo4j, Chroma, n8n)
- All 3 API keys set (OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY)
- Ollama models available: `gemma3:27b`, `qwen2.5:14b`, `nomic-embed-text:latest`, others

### Changes
- **`config.py`**: Added `GRAPHITI_LLM_PROVIDER` (default `"openai"`) and `GRAPHITI_LLM_MODEL` (default `"gpt-4o-mini"`)
- **`graphiti_store.py`**:
  - `_ensure_initialized()` now branches on provider: uses Graphiti's built-in `OpenAIClient` + `LLMConfig` for OpenAI, keeps `OllamaLLMClient` fallback
  - Set `small_model=settings.GRAPHITI_LLM_MODEL` to override Graphiti's default `gpt-4.1-nano` (user's OpenAI project didn't have access to that model)
  - `health_check()` now reports `ollama_embeddings` and `llm` separately, with provider-specific checks
  - Added `from openai import AsyncOpenAI` for health check
  - Tracks `_llm_provider` state
- **`test_graphiti_store.py`**: Split single health check test into `test_health_check_initialized_openai` and `test_health_check_initialized_ollama`

### Bug found and fixed
- Graphiti `LLMConfig` defaults `small_model` to `gpt-4.1-nano` — first product ingested fine (used `model`), but subsequent calls used `small_model` for simpler prompts, causing 403 errors. Fixed by explicitly setting `small_model` to same value as `model`.

## Dependency Upgrades ✅

### graphiti-core upgrade
- `0.25.0` → `0.28.1` (latest stable, released 2026-02-19)
- Graphiti docs confirm: "works best with LLM services that support Structured Output (such as OpenAI and Gemini)"

### Other upgrades (recommended safe set)
- `openai` 2.14.0 → **2.21.0** (critical for Graphiti's OpenAI client)
- `neo4j` 6.0.3 → **6.1.0**
- `pydantic` 2.12.4 → **2.12.5**
- `pydantic-settings` 2.12.0 → **2.13.1**
- `uvicorn` 0.38.0 → **0.41.0**

### Held back (higher risk, not needed now)
- `fastapi` 0.121.3 → 0.131.0 (large jump)
- `chromadb` 1.3.5 → 1.5.1 (significant jump)

All version pins updated in `pyproject.toml`.

## Phase 2: Complete Episode Ingestion ✅

### Dry run
- 17/17 YAML files parsed successfully
- Store initialized with "Graphiti LLM: OpenAI gpt-4o-mini"

### Live ingestion
- **17/17 products ingested, 0 errors**
- Rate limit: 1.0s between episodes

### Search verification
- `"viscosity"` → 10 results (e.g., "DCE 142 has a viscosity of 500-1,300 cPs at 25°C")
- `"epoxy curing agent"` → 10 results (e.g., "ECA 1000L is used as an epoxy curing agent")

## Test summary
- 104 tests passing (was 103 — gained 1 from split health check test)
- 0 regressions across all upgrades

## Files changed
**Modified (3):**
- `src/dc_agent/config.py` — Graphiti LLM provider settings, updated dep pins
- `src/dc_agent/kg/graphiti_store.py` — Hybrid LLM init, health check refactor
- `tests/test_graphiti_store.py` — Split health check tests
- `pyproject.toml` — Dependency version pins

## What's next
- **Phase 3 (M5)**: n8n retrieval orchestration — see SESSION-4-PLAN.md
- n8n container running at port 5678 (healthy, API needs X-N8N-API-KEY header)
- Backend exposes: `/search` (vector), `/query-kg` (Graphiti), `/chat` (RAG), `/products` (catalog)
- M6 (KG API Endpoints) may need to come before or alongside M5 to expose M3 KG query service methods
