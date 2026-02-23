# Feature: graphiti-search-refinement

## Milestone
M4 — Graphiti Episodic Memory Integration

## Requirements
Improve Graphiti search quality, result formatting, and error handling.

## Acceptance Criteria
- [ ] Search results mapped to typed Pydantic models
- [ ] Configurable search parameters (limit, threshold)
- [ ] Results formatted for RAG context consumption
- [ ] Debug print statements removed from OllamaLLMClient
- [ ] Empty/error results handled gracefully (not exceptions)
- [ ] Structured logging throughout

## Dependencies
- graphiti-init-lifecycle
