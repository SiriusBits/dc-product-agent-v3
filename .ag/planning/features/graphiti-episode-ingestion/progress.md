# Progress: graphiti-episode-ingestion

## Status: Complete ✅

## Subtasks
- [x] Fix add_episode method signature (accepts EpisodeInput with datetime)
- [x] Implement YAML summary extraction for episodes (prepare_episode in graphiti_episodes.py)
- [x] Add rate limiting for Ollama calls (rate_limit_sec param with asyncio.sleep)
- [x] Add progress reporting (on_progress callback)
- [x] Add error recovery (skip failed, continue with logger.error)
- [x] Create ingestion script (scripts/ingest_graphiti_episodes.py)
- [x] Write tests (test_graphiti_episodes.py — 6 tests)
