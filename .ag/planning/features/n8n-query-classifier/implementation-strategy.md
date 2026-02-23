# Implementation Strategy: n8n-query-classifier

## Database Changes
None.

## API Modifications
None — n8n workflow nodes.

## n8n Workflow Design
- **Code node** (JavaScript): Pattern matching against query text
  - Check for KG keywords/patterns
  - Check for comparison patterns (2+ product names)
  - Default to vector for unmatched queries
  - Output: `{strategy: "vector"|"kg"|"hybrid", confidence: 0.0-1.0, reason: string}`
- **Switch node**: Route based on `strategy` value
- **Optional**: HTTP Request node to Ollama for ambiguous queries

## UI Components
None.

## Testing Approach
- Test with sample queries for each strategy type
- Verify classification accuracy against a test set
- Measure classification latency
