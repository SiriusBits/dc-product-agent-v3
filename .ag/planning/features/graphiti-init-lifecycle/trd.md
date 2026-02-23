# Feature: graphiti-init-lifecycle

## Milestone
M4 — Graphiti Episodic Memory Integration

## Requirements
Add proper async lifecycle management, health checks, and connection validation to GraphitiKGStore.

## Acceptance Criteria
- [ ] Async context manager (`async with GraphitiKGStore() as store:`)
- [ ] Connection validation on startup (ping Neo4j, verify Ollama models available)
- [ ] Graceful shutdown with resource cleanup
- [ ] `health_check()` method returns connection status for all dependencies
- [ ] Retry logic for transient connection failures (Neo4j, Ollama)
- [ ] Structured logging replacing all print statements

## Dependencies
- neo4j-driver-refactor (shared Neo4j connection)
- Ollama running locally with required models
