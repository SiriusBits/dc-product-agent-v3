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
- 499 nodes across 13 labels (Chemical: 124, Property: 157, Application: 79, Product: 21, ...)
- 576 relationships across 28 types
- 17 products ingested from `data/extracts/derived_info_yaml/`
- Product canonical_names are full names (e.g. "Dixie Chemical Amine 221"); short names (e.g. "DCA 221") are in aliases

### Milestone 4: Graphiti Episodic Memory Integration ✅
- Rewrote `GraphitiKGStore`: async context manager, lazy init, `build_indices_and_constraints()`, `health_check()`, graceful `close()`
- Hardened `OllamaEmbedder` + `OllamaLLMClient`: tenacity retry on transient errors, structured logging, `OllamaAdapterError` (no silent `return {}`)
- New `graphiti_models.py`: `GraphitiSearchResult`, `GraphitiSearchResponse`, `EpisodeInput`
- New `graphiti_episodes.py`: `prepare_episode()` (YAML → EpisodeInput), `ingest_episodes()` with rate limiting, dry-run, progress callback
- New `scripts/ingest_graphiti_episodes.py`: CLI with --source-dir, --dry-run, --rate-limit
- Fixed module-level `GraphitiKGStore()` crash in routes.py → app.state lifecycle
- `/query-kg` now returns typed `GraphitiSearchResponse` (was raw `str(answer)`)
- Graphiti v0.25.0 schema (Entity/Episodic/Community) coexists safely with M1 schema (13 labels)
- 35 new tests passing
- **BLOCKER**: Live episode ingestion fails — `llama3.1:8b` returns JSON Schema definitions instead of populated data for Graphiti's `ExtractedEntities`, `ExtractedEdges`, `NodeResolutions` models. 0/13 products ingested. Needs larger model or API provider.

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

## Tests — `apps/backend/tests/`
- `test_kg_db.py` — 5 tests (M1: Neo4jKGStore, sanitize_label)
- `test_kg_ingestion.py` — 21 tests (M2: models, validation, predicates, parsing)
- `test_kg_query_service.py` — 42 tests (M3: all query methods, validation helpers)
- `test_graphiti_store.py` — 15 tests (M4: lifecycle, health check, search, episodes)
- `test_ollama_adapter.py` — 14 tests (M4: _clean_json, embedder, LLM client, error handling)
- `test_graphiti_episodes.py` — 6 tests (M4: prepare_episode, ingest_episodes, dry-run)
- Total KG tests: 103 passing
- Note: `test_search_service.py` has 2 pre-existing failures (unrelated to KG work)

## Config
- Neo4j: `bolt://127.0.0.1:7687`, user `neo4j`, password `password`
- Backend port: 8001 (not 8000)
- Ollama: `http://localhost:11434`, embedding model `nomic-embed-text:latest` (works), LLM model `llama3.1:8b` (too small for Graphiti extraction)
- Data source: `data/extracts/derived_info_yaml/` (17 *_derived.yaml files)
- JSON equivalents at `data/extracts/derived_info/` (identical KG data)
- API keys: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY configurable in `.env`

## Architectural Decisions
- n8n is the retrieval orchestrator (M5) — routes queries to vector/KG/hybrid
- `KGStore` ABC allows swapping Neo4j for other backends
- All ingestion is MERGE-based and idempotent
- Predicate normalization happens at ingestion time, not query time
- Entity dedup by canonical_name within same label (cross-file)
- Auto-created nodes (from string triple objects) use deterministic UUIDs
