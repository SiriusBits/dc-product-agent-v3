# Session 2 Plan — Milestone 4: Graphiti Episodic Memory Integration

## Prerequisites
- Read `.ag/memory.md` for project state and architectural context
- Read `.ag/sessions/session-1-neo4j-m1-m3.md` for Session 1 outcomes
- Read `.ag/planning/ROADMAP.md` for the full milestone plan

## Starting State
- **M1–M3 complete**: Neo4j foundation, ingestion pipeline, and query service are built, tested (68 tests), and validated against live Neo4j
- **Graph**: 499 nodes (13 labels), 576 relationships (28 types), 17 products
- **Branch**: `warp-cloud`

## Milestone 4 Scope (from ROADMAP.md)
**Goal**: Refine and harden the Graphiti layer for episodic memory over the Neo4j graph.

### Features
1. **`graphiti-init-lifecycle`** — Proper initialization, health checks, graceful shutdown
2. **`graphiti-episode-ingestion`** — Ingest product documents as episodes with source attribution
3. **`graphiti-search-refinement`** — Improve search quality, result formatting, error handling

### Current Graphiti State (needs assessment)
- `kg/graphiti_store.py` — Bare-bones wrapper: `__init__`, `close`, `add_episode`, `search`
- `kg/ollama_adapter.py` — `OllamaEmbedder` (sequential batch), `OllamaLLMClient` (with DummyTracer, debug prints, basic JSON cleaning)
- `api/routes.py` — `/query-kg` endpoint directly instantiates `GraphitiKGStore` at module level (no lifecycle management)
- No health checks, no error handling, no graceful shutdown, no episode ingestion pipeline
- No tests for Graphiti components

### Key Questions to Resolve at Session Start
1. Is Graphiti still the right tool, or has the M1–M3 work superseded the need for episodic memory?
2. Should Graphiti episodes be product documents (derived YAML/JSON) or something else?
3. How does Graphiti's graph schema coexist with the M1 schema (same Neo4j instance)?
4. What Ollama models are available locally? Is `llama3.1:8b` sufficient for Graphiti's extraction?

### Implementation Approach (tentative)
1. Research: Inspect current Graphiti SDK version, API surface, and Neo4j graph impact
2. Fix lifecycle: context manager, health check, lazy init (not module-level)
3. Clean up `OllamaLLMClient`: remove debug prints, improve error handling, add retry
4. Build episode ingestion: read derived YAML/JSON, format as episodes, ingest with provenance
5. Improve search: typed results, error handling, result formatting for RAG context
6. Tests: mock-based unit tests for all Graphiti components

## After M4
The dependency graph shows two paths from M4:
```
M3 (Query Service) ──► M5 (n8n Orchestration)
                        ▲
M4 (Graphiti) ──────────┘
```
M5 (n8n Retrieval Orchestration) depends on both M3 and M4 being complete, as n8n needs to route to both vector search and KG endpoints.
