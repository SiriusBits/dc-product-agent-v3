# Implementation Strategy: graphiti-search-refinement

## Database Changes
None.

## API Modifications
- Define `GraphitiSearchResult` Pydantic model
- Refactor `search()` method to return typed results
- Add parameters: `limit`, `min_score`
- Clean up `OllamaLLMClient`: remove debug prints, add logging
- Handle Graphiti SDK exceptions gracefully

## UI Components
None.

## Testing Approach
- Unit test: result mapping to Pydantic models
- Test: empty results return empty list (not error)
- Test: Ollama errors caught and logged
