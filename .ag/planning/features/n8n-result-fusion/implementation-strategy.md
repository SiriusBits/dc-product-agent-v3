# Implementation Strategy: n8n-result-fusion

## Database Changes
None.

## API Modifications
None — n8n Code node.

## n8n Workflow Design
- **Merge node**: Combines outputs from vector and KG branches
- **Code node** (JavaScript): Fusion logic
  - Deduplicate by product name
  - Score: `combined = vector_weight * vector_score + kg_weight * kg_score`
  - Sort by combined score descending
  - Format as `context_blocks[]` with `{source, type, content, score, product_name}`
- **Workflow variables**: `vector_weight` (default 0.6), `kg_weight` (default 0.4)

## UI Components
None.

## Testing Approach
- Test with overlapping results from both sources
- Test with single-source results
- Test weight adjustment changes ranking
- Verify deduplication works correctly
