# Implementation Strategy: rag-pipeline-n8n

## Database Changes
None.

## API Modifications
- Modify `services/chat.py`:
  - Inject `N8nRetrievalClient` (primary) and `SearchService` (fallback)
  - Call orchestrate() → get context_blocks → format for LLM
- Modify `retrieval/rag.py`:
  - `format_context` accepts `List[ContextBlock]` in addition to `List[SearchResult]`
  - New method: `format_kg_context(kg_blocks)` for structured KG data
  - Update system prompt with KG instruction addendum
  - `extract_sources` handles both vector and KG sources

## UI Components
None.

## Testing Approach
- Unit test: format_context with mixed vector+KG blocks
- Integration test: full chat flow through n8n
- A/B comparison: same queries with and without KG context
- Regression test: existing test queries produce same or better answers
