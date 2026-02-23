# Milestone 4: Graphiti Episodic Memory Integration

## Goal
Refine and harden the Graphiti layer for episodic memory over the Neo4j graph, adding proper lifecycle management and improved ingestion/search.

## Context
`GraphitiKGStore` and `OllamaAdapter` (embedder + LLM client) exist in `apps/backend/src/dc_agent/kg/`. The Graphiti client initializes with Neo4j credentials and Ollama adapters. Current issues:
- No proper lifecycle management (init/shutdown)
- `add_episode` method signature inconsistency (`source_url` vs `source_description`)
- No health checks or connection validation
- Error handling is minimal
- The `OllamaLLMClient` has debug print statements and empty error recovery

## Features

### Feature 1: `graphiti-init-lifecycle`
- Async context manager for `GraphitiKGStore`
- Connection validation on startup (ping Neo4j, verify Ollama models)
- Graceful shutdown with resource cleanup
- Health check method for API health endpoints
- Retry logic for transient connection failures

### Feature 2: `graphiti-episode-ingestion`
- Ingest each product's derived summary + sections as Graphiti episodes
- Source attribution via `source_description` (document ID, filename)
- `reference_time` set to extraction date from YAML metadata
- Batch ingestion with rate limiting (Ollama can be slow)
- Progress reporting and error recovery (skip failed, continue)

### Feature 3: `graphiti-search-refinement`
- Typed search results mapped to Pydantic models
- Configurable search parameters (limit, threshold)
- Result formatting for RAG context consumption
- Remove debug print statements, replace with structured logging
- Handle empty/error results gracefully

## Dependencies
- Milestone 1 (Neo4j Foundation — Graphiti writes to the same Neo4j instance)
- Ollama running locally with embedding model (`nomic-embed-text`) and LLM model (`llama3.1:8b`)

## Acceptance Criteria
- [ ] `GraphitiKGStore` initializes and shuts down cleanly as async context manager
- [ ] Health check validates Neo4j + Ollama connectivity
- [ ] Product episodes are ingested with correct attribution
- [ ] Search returns typed, formatted results
- [ ] No debug print statements remain
- [ ] Structured logging throughout
