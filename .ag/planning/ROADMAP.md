# Neo4j Knowledge Graph Integration Roadmap

## Overview
Build out the Neo4j knowledge graph layer for the Dixie Chemical Product Agent v3, transforming the existing scaffolding into a production-ready KG system that powers relationship-aware product queries alongside the existing ChromaDB vector search.

**Key architectural decision**: n8n serves as the retrieval orchestrator. Rather than embedding query routing logic in Python, the hybrid retrieval pipeline is implemented as n8n workflows. The backend sends queries to n8n via webhook, n8n classifies the query, routes to the appropriate retrieval service(s) (vector, KG, or both), fuses results, and returns context to the backend for LLM generation. Every decision point is visible in n8n's execution log, enabling visual debugging and iterative improvement of retrieval strategies.

## Current State
- **Docker**: Neo4j 2025.10.1-community container configured (ports 7474/7687)
- **Config**: Settings for `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` in place
- **Abstract Interface**: `KGStore` ABC with `add_entity`, `add_relationship`, `query_graph`, `close`
- **Neo4jKGStore**: Rough synchronous implementation — MERGE logic incomplete, no constraints/indexes
- **GraphitiKGStore**: Async wrapper over Graphiti SDK with Ollama adapters (embedder + LLM)
- **Data Available**: Derived YAML files contain rich `knowledge_graph` sections (entities + kg_triples) ready for ingestion
- **API**: Minimal `/query-kg` endpoint proxying to Graphiti search
- **n8n**: Container configured in docker-compose (port 5678), connected to both Chroma and Neo4j, no retrieval workflows built yet
- **Gap**: No KG ingestion pipeline, no schema enforcement, no integration with RAG pipeline, no n8n retrieval orchestration

## Milestones

### Milestone 1: Neo4j Foundation & Schema Design
**Goal**: Establish a robust, schema-enforced Neo4j graph database with proper constraints, indexes, and initialization.
- Feature: `neo4j-schema-design` — Graph schema definition (node labels, relationship types, property constraints)
- Feature: `neo4j-driver-refactor` — Rewrite `Neo4jKGStore` with async driver, proper MERGE, error handling
- Feature: `neo4j-schema-init` — Schema initialization script (constraints, indexes, seed validation)

### Milestone 2: KG Data Ingestion Pipeline
**Goal**: Build an automated pipeline to ingest extracted knowledge graph data from derived YAML/JSON files into Neo4j.
- Feature: `kg-entity-ingestion` — Parse and ingest entities from derived YAML `knowledge_graph.entities`
- Feature: `kg-triple-ingestion` — Parse and ingest kg_triples as relationships
- Feature: `kg-ingestion-cli` — CLI tool for batch ingestion with idempotency, validation, and progress reporting
- Feature: `kg-data-validation` — Pre-ingestion validation of entity/triple schemas

### Milestone 3: KG Query Service
**Goal**: Build a service layer for structured and semantic queries against the knowledge graph.
- Feature: `kg-product-queries` — Product lookup, properties, applications by product name/ID
- Feature: `kg-relationship-traversal` — Multi-hop queries (e.g., "products with same application", "products in same family")
- Feature: `kg-entity-search` — Search entities by type, name pattern, or property values
- Feature: `kg-cypher-service` — Safe parameterized Cypher execution with result mapping to Pydantic models

### Milestone 4: Graphiti Episodic Memory Integration
**Goal**: Refine and harden the Graphiti layer for episodic memory over the Neo4j graph.
- Feature: `graphiti-init-lifecycle` — Proper initialization, health checks, graceful shutdown
- Feature: `graphiti-episode-ingestion` — Ingest product documents as episodes with source attribution
- Feature: `graphiti-search-refinement` — Improve search quality, result formatting, error handling

### Milestone 5: n8n Retrieval Orchestration & Hybrid Retrieval
**Goal**: Use n8n as the visual orchestration layer for hybrid retrieval, routing queries to vector search, KG, or both — with full execution traceability.
- Feature: `n8n-retrieval-webhook` — n8n webhook workflow that receives queries from the backend
- Feature: `n8n-query-classifier` — n8n node(s) that classify query intent (vector / KG / hybrid)
- Feature: `n8n-retrieval-router` — Switch node routing to backend vector and/or KG internal endpoints
- Feature: `n8n-result-fusion` — n8n node that merges, deduplicates, and ranks results from multiple sources
- Feature: `backend-n8n-client` — Backend HTTP client that calls n8n webhook and consumes orchestrated results
- Feature: `rag-pipeline-n8n` — Integrate n8n-orchestrated context into `RAGPipeline.build_messages`
- Feature: `n8n-trace-logging` — Structured execution metadata returned with results for debugging

### Milestone 6: KG API Endpoints
**Goal**: Expose knowledge graph capabilities through well-typed FastAPI endpoints.
- Feature: `kg-api-products` — Product graph endpoints (relationships, related products, family tree)
- Feature: `kg-api-search` — KG-powered search endpoints (entity search, relationship queries)
- Feature: `kg-api-visualization` — Graph visualization data endpoints (nodes, edges, subgraphs)
- Feature: `kg-api-admin` — Admin endpoints (stats, health, reindex)

### Milestone 7: Testing & Quality Assurance
**Goal**: Comprehensive test coverage for all KG components.
- Feature: `kg-unit-tests` — Unit tests for all KG services, query builders, data mappers
- Feature: `kg-integration-tests` — Integration tests with live Neo4j (docker-based)
- Feature: `kg-performance-tests` — Benchmark query response times against requirements (<1s graph traversal, <300ms entity lookup)

## Dependency Graph

```
M1 (Foundation) ──► M2 (Ingestion) ──► M3 (Query Service) ──► M5 (n8n Orchestration)
                                                              ▲
M1 (Foundation) ──► M4 (Graphiti) ────────────────────────────┘
                                                              │
                                    M3 + M5 ──► M6 (API Endpoints)
                                                              │
                              M1 through M6 ──► M7 (Testing)
```
Note: M5 depends on n8n container (already in docker-compose) and backend internal endpoints for vector search (existing) and KG queries (M3).

## Success Criteria
- All 17 products ingested into Neo4j with full entity and relationship data
- Sub-1s knowledge graph traversal queries
- Sub-300ms entity lookup queries
- KG context improves RAG answer quality for relationship and comparison queries
- All endpoints return well-typed responses with source attribution
- n8n retrieval workflows are visually traceable — every query's routing path, timing, and result counts are inspectable in the n8n execution log
- ≥80% test coverage across KG modules
