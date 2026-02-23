# Feature: rag-pipeline-n8n

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
Integrate n8n-orchestrated retrieval context into the existing RAG pipeline, replacing direct SearchService calls with the n8n orchestration client.

## Acceptance Criteria
- [ ] ChatService calls N8nRetrievalClient instead of SearchService directly
- [ ] RAGPipeline.format_context handles both vector and KG context blocks
- [ ] System prompt updated to instruct LLM on using structured KG data
- [ ] extract_sources updated to include KG provenance from trace metadata
- [ ] Direct SearchService fallback retained when n8n unavailable
- [ ] All existing vector-only queries produce equivalent or better results
- [ ] No regression in chat quality for general queries

## Dependencies
- backend-n8n-client
- Existing RAG pipeline (retrieval/rag.py)
- Existing ChatService (services/chat.py)
