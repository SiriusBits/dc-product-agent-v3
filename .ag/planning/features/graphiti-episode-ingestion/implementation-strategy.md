# Implementation Strategy: graphiti-episode-ingestion

## Database Changes
- Graphiti creates its own nodes/edges in Neo4j (Entity, Episodic nodes)

## API Modifications
- Fix `add_episode` signature: use `source_description` (not `source_url`)
- New script: `scripts/ingest_graphiti_episodes.py`
- Rate limiting: configurable delay between episodes (Ollama throughput)

## UI Components
None.

## Testing Approach
- Integration test: ingest one product, verify Graphiti entities created in Neo4j
- Test with Ollama running: verify embeddings generated
- Test error recovery: simulate Ollama timeout, verify skip and continue
