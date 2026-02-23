# Session 4 Plan — M5: n8n Retrieval Orchestration & M6: KG API Endpoints

## Prerequisites
- Read `.ag/memory.md` for project state and architectural context
- Read `.ag/sessions/session-3-graphiti-ingestion.md` for Session 3 outcomes
- Read `.ag/planning/ROADMAP.md` for the full milestone plan

## Starting State
- **M1–M4 complete**: All KG modules built, tested (104 tests), and operational
- **Graph**: Direct Neo4j (499 nodes, 576 rels) + Graphiti episodic (17 products ingested, search verified)
- **Backend**: FastAPI on :8001 with vector search, KG search, chat, product catalog endpoints
- **n8n**: Container running at :5678 (healthy), API needs `X-N8N-API-KEY`, no workflows built yet
- **Branch**: `warp-cloud`

## Phase 1: M6 — KG API Endpoints (prerequisite for M5)

### Rationale
M5 (n8n orchestration) needs backend endpoints to call. The M3 `KGQueryService` has 9 query methods but they're not exposed as API endpoints yet. n8n will call these via HTTP, so we need to expose them first.

### Features
1. **`kg-api-products`** — Product graph endpoints
   - `GET /api/v1/kg/products/{name}` → `get_product_profile()`
   - `GET /api/v1/kg/products/{name}/safety` → `get_safety_profile()`
   - `GET /api/v1/kg/products/{name}/related` → `find_related_products()`
   - `POST /api/v1/kg/compare` → `compare_property()` (body: product_a, product_b, property)

2. **`kg-api-search`** — KG-powered search endpoints
   - `POST /api/v1/kg/search` → `search_entities()` (body: query, entity_type, limit)
   - `GET /api/v1/kg/entity/{id}` → `get_entity_by_id()`
   - `GET /api/v1/kg/entity/{id}/neighbors` → `get_entity_neighbors()`
   - `POST /api/v1/kg/traverse` → `traverse()` (body: start_node, relationship, depth)

3. **`kg-api-admin`** — Admin/health endpoints
   - `GET /api/v1/kg/health` → Neo4j connectivity + Graphiti health
   - `GET /api/v1/kg/stats` → Node/relationship counts by label/type

### Implementation approach
- New `api/kg_routes.py` router mounted at `/api/v1/kg`
- Pydantic request/response models (reuse `query_models.py` where possible)
- KGQueryService initialized via dependency injection or app.state
- Neo4jKGStore lifecycle managed in FastAPI lifespan (alongside existing Graphiti store)

## Phase 2: M5 — n8n Retrieval Orchestration

### Goal
Use n8n as the visual orchestration layer for hybrid retrieval — routing queries to vector search, KG, or both, with full execution traceability.

### Research needed at session start
1. n8n API key setup — find or generate `X-N8N-API-KEY` for API access
2. n8n workflow creation — can we create workflows via API or must use UI?
3. n8n webhook configuration — how to set up webhook trigger nodes
4. n8n → backend connectivity — n8n runs in Docker, backend on host; verify `host.docker.internal` works

### Features
1. **`n8n-retrieval-webhook`** — Webhook workflow that receives queries from the backend
   - Trigger: POST webhook at `http://localhost:5678/webhook/retrieval`
   - Input: `{ query, conversation_id?, intent_hint? }`
   - Output: `{ results[], sources[], metadata{} }`

2. **`n8n-query-classifier`** — Classify query intent
   - Categories: `vector` (semantic similarity), `kg` (entity/relationship), `hybrid` (both)
   - Implementation: LLM node or rule-based Switch node
   - Examples:
     - "What is the viscosity of DCA 221?" → `kg` (specific property lookup)
     - "Find products similar to ECA 608" → `kg` (relationship traversal)
     - "How do anhydride curing agents work?" → `vector` (conceptual/explanatory)
     - "Compare MHHPA 301 and MHHPA NC" → `hybrid` (needs both structured data + context)

3. **`n8n-retrieval-router`** — Route to appropriate backend endpoints
   - Vector path: `POST http://host.docker.internal:8001/api/v1/search`
   - KG path: `POST http://host.docker.internal:8001/api/v1/kg/search` (or specific KG endpoints)
   - Graphiti path: `POST http://host.docker.internal:8001/api/v1/query-kg`

4. **`n8n-result-fusion`** — Merge, deduplicate, rank results from multiple sources
   - Combine vector results (with scores) + KG results (with source attribution)
   - Remove duplicate content
   - Return unified ranked results with provenance

5. **`backend-n8n-client`** — Backend HTTP client that calls n8n webhook
   - New `services/n8n_client.py` with async httpx client
   - Config: `N8N_WEBHOOK_URL` in settings
   - Timeout and error handling (fallback to direct retrieval if n8n unavailable)

6. **`rag-pipeline-n8n`** — Integrate n8n-orchestrated context into RAG pipeline
   - Modify `ChatService` or `RAGPipeline` to use n8n client for retrieval
   - Fall back to direct vector search if n8n is unavailable

7. **`n8n-trace-logging`** — Execution metadata for debugging
   - n8n execution ID in response metadata
   - Timing per retrieval source
   - Decision path (which classifier branch was taken)

### n8n workflow architecture
```
[Webhook Trigger]
    ↓
[Query Classifier] (LLM or Switch node)
    ↓
[Switch: vector | kg | hybrid]
    ├── vector → [HTTP: /api/v1/search]
    ├── kg → [HTTP: /api/v1/kg/search + /api/v1/query-kg]
    └── hybrid → [parallel: vector + kg]
              ↓
[Result Fusion] (Code node: merge, dedup, rank)
    ↓
[Respond to Webhook]
```

## Phase 3: Integration Testing & Validation

1. End-to-end test: query → n8n → retrieval → response
2. Compare direct retrieval vs n8n-orchestrated retrieval quality
3. Measure latency overhead from n8n routing
4. Verify trace logging captures decision paths

## Open Questions
- Should the query classifier use an LLM (more flexible, higher latency) or rules (faster, less adaptive)?
- Should M6 KG endpoints also be used by the frontend directly, or only by n8n?
- Do we need to export/import n8n workflows as JSON for version control?
