# Session 3 Plan — Graphiti Ingestion Fix & M5 Kickoff

## Prerequisites
- Read `.ag/memory.md` for project state and architectural context
- Read `.ag/sessions/session-2-graphiti-m4.md` for Session 2 outcomes
- Read `.ag/planning/ROADMAP.md` for the full milestone plan

## Starting State
- **M1–M4 code complete**: All KG modules built and tested (103 tests passing)
- **M4 BLOCKER**: Graphiti episode ingestion fails with `llama3.1:8b` — model returns JSON Schema instead of populated data
- **Graph (M1-M3)**: 499 nodes, 576 relationships, 17 products ingested via direct Neo4j
- **Graph (Graphiti)**: Empty — 0 episodes ingested
- **Branch**: `warp-cloud`

## Phase 1: Resolve Graphiti LLM Model Blocker

### Problem
`llama3.1:8b` cannot produce valid structured JSON for Graphiti's internal extraction models (`ExtractedEntities`, `ExtractedEdges`, `NodeResolutions`). It outputs the Pydantic schema definition (`$defs`, `properties`, `required`) instead of instance data.

### Options (in order of preference)

#### Option A: Hybrid — Ollama embeddings + API LLM (recommended)
- Keep `nomic-embed-text:latest` for embeddings (fast, local, works perfectly)
- Switch Graphiti's LLM to OpenAI `gpt-4o-mini` or Anthropic `claude-3-haiku` for extraction
- Requires: Modify `GraphitiKGStore._ensure_initialized()` to use different LLM client based on config
- Cost: Minimal (~$0.01-0.05 per product ingestion)
- Changes: New `OpenAILLMAdapter` or use Graphiti's built-in OpenAI support

#### Option B: Larger Ollama model
- Try `qwen2.5:32b`, `llama3.1:70b`, or `deepseek-coder-v2:16b`
- Pro: Stays fully local
- Con: Slower, high memory usage, may still have structured JSON issues

#### Option C: Custom extraction (bypass Graphiti's internal LLM)
- Pre-extract entities and edges ourselves (we already have this data in derived YAML `knowledge_graph` sections)
- Use Graphiti's `add_triplet()` API instead of `add_episode()` to insert pre-extracted facts
- Pro: No LLM needed at ingestion time, uses data we already have
- Con: Loses Graphiti's automatic entity resolution and temporal reasoning

### Decision needed
Which option to pursue? User should decide based on:
- Are API keys available/preferred? → Option A
- Want to stay fully local? → Option B (need to check available models)
- Want fastest path to working KG? → Option C

## Phase 2: Complete Episode Ingestion
After resolving the LLM blocker:
1. Re-run `scripts/ingest_graphiti_episodes.py` with the fixed model
2. Verify all 17 products ingest successfully
3. Test `/query-kg` endpoint returns real results
4. Suppress `neo4j.notifications` warnings (add to ingestion script logging config)

## Phase 3: Begin M5 — n8n Retrieval Orchestration

### Scope (from ROADMAP.md)
**Goal**: Use n8n as the visual orchestration layer for hybrid retrieval.

### Features
1. `n8n-retrieval-webhook` — n8n webhook workflow that receives queries from the backend
2. `n8n-query-classifier` — n8n node(s) that classify query intent (vector / KG / hybrid)
3. `n8n-retrieval-router` — Switch node routing to backend vector and/or KG internal endpoints
4. `n8n-result-fusion` — n8n node that merges, deduplicates, and ranks results from multiple sources
5. `backend-n8n-client` — Backend HTTP client that calls n8n webhook and consumes orchestrated results
6. `rag-pipeline-n8n` — Integrate n8n-orchestrated context into `RAGPipeline.build_messages`
7. `n8n-trace-logging` — Structured execution metadata returned with results for debugging

### Key questions to research at Session start
1. Is n8n container running and accessible at port 5678?
2. What n8n workflows exist already (if any)?
3. What internal API endpoints does n8n need to call? (existing: `/api/v1/search`, `/api/v1/query-kg`; M3: KG query service not yet exposed as API)
4. Does M6 (KG API Endpoints) need to come before M5, or can n8n call internal service methods?

### Dependencies
- M3 (KG Query Service) ✅
- M4 (Graphiti) ✅ (code complete, ingestion blocked)
- n8n container configured in docker-compose ✅
- Backend vector search endpoints ✅
