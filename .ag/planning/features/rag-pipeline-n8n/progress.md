# Progress: rag-pipeline-n8n

## Subtasks
- [x] Modify ChatService to use N8nRetrievalClient
- [x] Extend format_context for ContextBlock input (dispatches by chunk_type)
- [x] Add format_kg_context method (_format_kg_context)
- [x] Update system prompt with KG instructions
- [x] Update extract_sources for KG provenance
- [x] Retain SearchService fallback path
- [x] Write unit tests for new formatting (test_rag_pipeline.py — 16 tests)
- [ ] Run regression tests on existing queries
