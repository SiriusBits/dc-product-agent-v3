# Project Memory — Neo4j Knowledge Graph Integration

## Completed Milestones

### Milestone 1: Neo4j Foundation & Schema Design ✅
- Rewrote `Neo4jKGStore` as fully async with retry logic, MERGE semantics, connection pooling
- Defined graph schema: 13 node labels, 25 canonical relationship types, fulltext index
- Schema init is idempotent (`IF NOT EXISTS`) — safe to call on every startup
- 5 unit tests passing

### Milestone 2: KG Data Ingestion Pipeline ✅
- Pydantic models for entities/triples with variant normalization (subject_id, object_id, doc_id aliases; plain UUID, {id,name}, {text:...} subject formats)
- 294 raw YAML predicates → 25 canonical relationship types via PREDICATE_MAP + prefix rules
- Polymorphic object handling: 11 shapes (string, entity ref, property-value, temperature, complex measurement, null)
- CLI script: `scripts/ingest_kg_data.py` with --validate-only, --dry-run, --clear
- Ingestion: 17 YAML files → 235 entities merged, 764 triples merged, <5s, idempotent
- 21 unit tests passing

### Milestone 3: KG Query Service ✅
- `KGQueryService` with 9 async methods over `KGStore`
- `_resolve_node`: id → canonical_name → aliases (case-insensitive)
- `_to_dict` helper for safe Neo4j driver object conversion (Node/Relationship → dict)
- `_str` helper for None coercion (Neo4j returns None for non-existent properties)
- All Cypher is parameterized; labels/rel-types validated against schema whitelist before interpolation
- 42 unit tests passing

## Graph State
- **Direct Neo4j (M1-M3)**: 499 nodes across 13 labels, 576 relationships across 28 types
- **Graphiti Episodic (M4)**: 17 products ingested as episodes, Entity/Episodic/Community nodes + RELATES_TO/MENTIONS/HAS_MEMBER edges
- 17 products sourced from `data/extracts/derived_info_yaml/`
- Product canonical_names are full names (e.g. "Dixie Chemical Amine 221"); short names (e.g. "DCA 221") are in aliases
- Graphiti search returns rich facts (e.g. "DCE 142 has a viscosity of 500-1,300 cPs at 25°C")

### Milestone 4: Graphiti Episodic Memory Integration ✅
- Rewrote `GraphitiKGStore`: async context manager, lazy init, `build_indices_and_constraints()`, `health_check()`, graceful `close()`
- Hardened `OllamaEmbedder` + `OllamaLLMClient`: tenacity retry on transient errors, structured logging, `OllamaAdapterError` (no silent `return {}`)
- New `graphiti_models.py`: `GraphitiSearchResult`, `GraphitiSearchResponse`, `EpisodeInput`
- New `graphiti_episodes.py`: `prepare_episode()` (YAML → EpisodeInput), `ingest_episodes()` with rate limiting, dry-run, progress callback
- New `scripts/ingest_graphiti_episodes.py`: CLI with --source-dir, --dry-run, --rate-limit
- Fixed module-level `GraphitiKGStore()` crash in routes.py → app.state lifecycle
- `/query-kg` now returns typed `GraphitiSearchResponse` (was raw `str(answer)`)
- Graphiti v0.28.1 schema (Entity/Episodic/Community) coexists safely with M1 schema (13 labels)
- **Hybrid LLM architecture**: Ollama `nomic-embed-text` for embeddings + OpenAI `gpt-4o-mini` for Graphiti extraction
- `GRAPHITI_LLM_PROVIDER` config (default `"openai"`) + `GRAPHITI_LLM_MODEL` (default `"gpt-4o-mini"`)
- `small_model` explicitly set to same as `model` (Graphiti defaults to `gpt-4.1-nano` which may not be accessible)
- **17/17 products ingested as episodes** — search verified working
- 36 tests passing (was 35 — split health check into OpenAI + Ollama variants)

### Milestone 5: n8n Retrieval Orchestration ✅
- n8n workflow JSON: `n8n/workflows/retrieval-orchestration.json` (version-controlled, importable via UI or CLI)
- Workflow architecture: Webhook Trigger → Query Classifier (rule-based code node) → Intent Router (Switch: vector/kg/hybrid) → HTTP Request nodes → Result Fusion (code nodes) → Respond to Webhook
- Query classifier: regex-based pattern matching for KG (property lookups, product names, safety data), vector (conceptual/explanatory), hybrid (comparisons, relationships) — no LLM latency
- Backend `N8nClient` (`services/n8n_client.py`): async httpx, timeout handling, `N8nClientError`, flexible response parsing (handles n8n array wrapping, flat lists, standard shape)
- `models/n8n.py`: `N8nRetrievalRequest`, `N8nRetrievalResponse`, `N8nResultItem`, `N8nTraceMetadata`, `QueryIntent` enum
- `ChatService` integration: tries n8n retrieval first, falls back transparently to direct vector search on `N8nClientError`
- Config: `N8N_ENABLED=true`, `N8N_WEBHOOK_URL`, `N8N_TIMEOUT` in `config.py` and `.env.sample`
- n8n workflow calls backend endpoints: `/api/v1/search` (vector), `/api/v1/kg/search` (KG entities), `/api/v1/query-kg` (Graphiti)
- n8n uses `host.docker.internal:8001` to reach the host backend from Docker
- n8n import: workflow JSON must be imported via UI or CLI restart (SQLite lock prevents import while running)
- 20 tests passing (response parsing, client lifecycle, retrieve, health check, timeout, fallback, ChatService integration)

### Milestone 6: KG API Endpoints ✅
- New `api/kg_routes.py` router mounted at `/api/v1/kg` with 12 endpoints
- Product endpoints: `GET /products/{name}`, `/safety`, `/related`, `/formulations`
- Compare: `POST /compare` (cross-product property comparison)
- Search: `POST /search` (fulltext entity search), `GET /entity/{id}`, `GET /entity/{id}/neighbors`
- Traversal: `POST /traverse` (variable-length path traversal)
- Admin: `GET /health` (Neo4j + Graphiti), `GET /stats` (node/rel counts by label/type)
- `api/kg_models.py`: `KGSearchRequest`, `KGCompareRequest`, `KGTraverseRequest`, `KGHealthResponse`, `KGStatsResponse`
- Neo4jKGStore stays open for app lifetime (was disposing after schema init)
- `KGQueryService` on `app.state.kg_query_service` — all KG routes use dependency injection via `request.app.state`
- Graceful 503 responses when Neo4j or KG service unavailable
- 29 tests passing (all endpoints, 404/400/503 error cases, health variants)

## Key Files — `apps/backend/src/dc_agent/kg/`
- `store.py` — `KGStore` ABC (async context manager)
- `neo4j.py` — `Neo4jKGStore` (async driver, retry, MERGE, verify_connectivity)
- `schema.py` — Constraints, indexes, fulltext index init; `init_schema()`, `validate_schema()`, `wipe_and_reinit()`
- `models.py` — Ingestion models: KGEntity, KGTriple, IngestionReport, ValidationReport
- `predicates.py` — ENTITY_TYPE_MAP, PREDICATE_MAP, PREDICATE_PREFIX_RULES, STRING_CREATES_NODE, SELF_REF_RELATIONSHIPS
- `validation.py` — Pre-ingestion validation
- `ingestion.py` — parse_file(), ingest_entities(), ingest_triples(), ingest_corpus()
- `query_models.py` — Response models: KGNode, KGRelationship, ProductProfile, SafetyProfile, PropertyComparisonResult, FormulationResult, EntitySearchResult, TraversalResult, RelatedProductsResult, NeighborEntry
- `query_service.py` — KGQueryService with get_product_profile, get_safety_profile, compare_property, get_formulations, search_entities, find_related_products, traverse, get_entity_by_id, get_entity_neighbors
- `graphiti_store.py` — GraphitiKGStore (async context manager, lazy init, health_check, typed search, episode ingestion)
- `graphiti_models.py` — GraphitiSearchResult, GraphitiSearchResponse, EpisodeInput
- `graphiti_episodes.py` — prepare_episode(), ingest_episodes()
- `ollama_adapter.py` — OllamaEmbedder, OllamaLLMClient (retry, structured logging, OllamaAdapterError)

## Key Files — `apps/backend/src/dc_agent/api/`
- `kg_routes.py` — 12 KG API endpoints (products, search, compare, traverse, health, stats)
- `kg_models.py` — Request/response models for KG API

## Key Files — `apps/backend/src/dc_agent/services/`
- `n8n_client.py` — N8nClient (async httpx, webhook calls, response parsing, N8nClientError)
- `chat.py` — ChatService with n8n integration and fallback

## Key Files — `apps/backend/src/dc_agent/models/`
- `n8n.py` — N8nRetrievalRequest/Response, N8nResultItem, N8nTraceMetadata, QueryIntent

## Key Files — `n8n/`
- `workflows/retrieval-orchestration.json` — n8n retrieval workflow (webhook → classify → route → fuse → respond)
- `README.md` — Import instructions and architecture docs

## Tests — `apps/backend/tests/`
- `test_kg_db.py` — 5 tests (M1: Neo4jKGStore, sanitize_label)
- `test_kg_ingestion.py` — 21 tests (M2: models, validation, predicates, parsing)
- `test_kg_query_service.py` — 42 tests (M3: all query methods, validation helpers)
- `test_graphiti_store.py` — 16 tests (M4: lifecycle, health check OpenAI+Ollama, search, episodes)
- `test_ollama_adapter.py` — 14 tests (M4: _clean_json, embedder, LLM client, error handling)
- `test_graphiti_episodes.py` — 6 tests (M4: prepare_episode, ingest_episodes, dry-run)
- `test_kg_routes.py` — 29 tests (M6: all KG API endpoints, error cases, 503 handling)
- `test_n8n_client.py` — 20 tests (M5: response parsing, client lifecycle, retrieve, health, fallback)
- Total project tests: 153 passing (+ 2 pre-existing search_service failures)
- Note: `test_search_service.py` has 2 pre-existing failures (unrelated to KG work)

## Config
- Neo4j: `bolt://127.0.0.1:7687`, user `neo4j`, password `password`
- Backend port: 8001 (not 8000)
- Ollama: `http://localhost:11434`, embedding model `nomic-embed-text:latest`
- Graphiti LLM: OpenAI `gpt-4o-mini` via `GRAPHITI_LLM_PROVIDER=openai`, `GRAPHITI_LLM_MODEL=gpt-4o-mini`
- Ollama LLM (`llama3.1:8b`) available as fallback but too small for Graphiti extraction
- Data source: `data/extracts/derived_info_yaml/` (17 *_derived.yaml files)
- JSON equivalents at `data/extracts/derived_info/` (identical KG data)
- API keys: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY all set in `.env`
- n8n: `http://localhost:5678` (healthy), webhook at `/webhook/retrieval`
- n8n API requires `X-N8N-API-KEY` header; webhook endpoints do NOT require API key
- N8N_ENABLED=true, N8N_WEBHOOK_URL=http://localhost:5678/webhook/retrieval, N8N_TIMEOUT=10.0

## API Endpoints (Backend :8001)
- `POST /api/v1/search` — Vector semantic search (ChromaDB)
- `POST /api/v1/query-kg` — Graphiti episodic memory search
- `POST /api/v1/query` — Basic vector query with sources
- `POST /api/v1/chat` — RAG chat with model selection (now with n8n retrieval)
- `GET /api/v1/products` — Product catalog listing
- `GET /api/v1/products/{id}` — Product detail
- `GET /api/v1/products/{id}/pdf` — Product PDF URL
- `GET /api/v1/models` — Available LLM models
- `GET /api/v1/documents` — Unique product list from vector store
- `POST /api/v1/ingest` — Ingestion trigger (placeholder)
- **KG endpoints (M6):**
  - `GET /api/v1/kg/products/{name}` — Product profile from KG
  - `GET /api/v1/kg/products/{name}/safety` — Safety profile
  - `GET /api/v1/kg/products/{name}/related` — Related products
  - `GET /api/v1/kg/products/{name}/formulations` — Formulation components
  - `POST /api/v1/kg/compare` — Cross-product property comparison
  - `POST /api/v1/kg/search` — Fulltext entity search
  - `GET /api/v1/kg/entity/{id}` — Entity lookup
  - `GET /api/v1/kg/entity/{id}/neighbors` — One-hop neighbors
  - `POST /api/v1/kg/traverse` — Variable-length path traversal
  - `GET /api/v1/kg/health` — Neo4j + Graphiti health
  - `GET /api/v1/kg/stats` — Node/relationship counts

## Dependencies (pinned in pyproject.toml)
- graphiti-core>=0.28.1, openai>=2.21.0, neo4j>=6.1.0
- pydantic>=2.12.5, pydantic-settings>=2.13.1, uvicorn>=0.41.0
- fastapi>=0.109.0 (held at current 0.121.3), chromadb>=0.4.22 (held at current 1.3.5)
- httpx (used by N8nClient for async webhook calls)

## Architectural Decisions
- n8n is the retrieval orchestrator (M5) — routes queries to vector/KG/hybrid via webhook
- Query classification is rule-based (regex patterns), not LLM-based — avoids latency overhead
- ChatService tries n8n first, falls back to direct vector search on any N8nClientError
- Neo4jKGStore stays open for app lifetime (not disposed after schema init) — shared by KG routes
- KG API endpoints return 503 when Neo4j is unavailable (graceful degradation)
- `KGStore` ABC allows swapping Neo4j for other backends
- All ingestion is MERGE-based and idempotent
- Predicate normalization happens at ingestion time, not query time
- Entity dedup by canonical_name within same label (cross-file)
- Auto-created nodes (from string triple objects) use deterministic UUIDs
- n8n workflow is version-controlled as JSON, imported via UI (CLI blocked by SQLite lock while running)
