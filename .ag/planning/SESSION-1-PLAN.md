# Session 1 Plan — Neo4j Knowledge Graph Integration

## Objective
Plan the full Neo4j knowledge graph integration for the Dixie Chemical Product Agent v3, breaking it into milestones, features, and implementation artifacts.

## Research Conducted
Before planning, the following areas were investigated:

### Existing Code Audit
- **`kg/store.py`** — Abstract `KGStore` base class (sync, 4 methods)
- **`kg/neo4j.py`** — `Neo4jKGStore` rough implementation (sync driver, CREATE instead of MERGE, fragile relationship matching)
- **`kg/graphiti_store.py`** — `GraphitiKGStore` async wrapper with Ollama adapters
- **`kg/ollama_adapter.py`** — `OllamaEmbedder` + `OllamaLLMClient` with debug prints
- **`config.py`** — Neo4j URI/user/password settings in place
- **`docker-compose.yml`** — Neo4j, Chroma, n8n containers configured
- **`api/routes.py`** — Minimal `/query-kg` endpoint proxying to Graphiti

### Data Model Analysis
- Analyzed `reference/derived_info_yaml/ASA_100_Technical_Bulletin_derived.yaml` as representative sample
- Identified entity types: CHEMICAL, CHEMICAL_CLASS, ORGANIZATION, IDENTIFIER, MATERIAL
- Identified 14+ relationship predicates from kg_triples
- Identified 4 polymorphic object types in triples: entity refs, strings, property dicts, measurement dicts
- Confirmed 17 product YAML files available for ingestion

### Architecture Review
- Reviewed `apps/backend/src/dc_agent/` module structure
- Reviewed `services/search.py` and `retrieval/rag.py` for RAG integration points
- Reviewed `.ag/requirements.md` for acceptance criteria (Requirement 4: Knowledge Graph, Requirement 5: Hybrid Retrieval)
- Reviewed existing scripts (`test_graphiti.py`, `inspect_neo4j_data.py`, `ingest_reference_data.py`)

## Key Decisions Made

### 1. n8n as Retrieval Orchestrator
Instead of embedding query routing logic in Python, n8n serves as the orchestration layer for hybrid retrieval. Rationale:
- Visual traceability of every routing decision
- Adjust routing rules without code deploys
- Debug poor retrieval by inspecting exact path taken in n8n UI
- n8n container already configured in docker-compose

### 2. Milestone Structure (7 milestones, 28 features)
```
M1: Neo4j Foundation (3 features)
M2: KG Ingestion Pipeline (4 features)
M3: KG Query Service (4 features)
M4: Graphiti Episodic Memory (3 features)
M5: n8n Retrieval Orchestration (7 features)
M6: KG API Endpoints (4 features)
M7: Testing & QA (3 features)
```

### 3. Internal Endpoints for n8n
Backend exposes `/internal/vector-search`, `/internal/kg-search`, `/internal/kg-product` for n8n to call, keeping the orchestration boundary clean.

### 4. Trace Metadata for Debugging
Every n8n execution returns structured `trace_metadata` (execution_id, classification, timing, result counts) enabling:
- Linking to n8n execution detail UI
- Backend logging for monitoring
- Optional frontend developer tooling

## Artifacts Created
- `.ag/planning/ROADMAP.md` — Master roadmap with all milestones
- `.ag/planning/milestones/M1-M7` — 7 milestone documents
- `features/` — 28 feature directories, each with `trd.md`, `implementation-strategy.md`, `progress.md`
- `.ag/planning/SESSION-1-PLAN.md` — This document
- `.ag/planning/sessions/2026-02-20_neo4j-integration-planning.md` — Session outcome

## Next Steps
1. Review the roadmap and milestone documents
2. Approve or adjust the plan
3. Begin implementation with Milestone 1 (Neo4j Foundation & Schema Design)
4. First feature to implement: `neo4j-schema-design` (audit YAMLs, define schema)
