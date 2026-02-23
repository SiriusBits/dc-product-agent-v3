# Progress: graphiti-init-lifecycle

## Status: Complete ✅

## Subtasks
- [x] Add async context manager to GraphitiKGStore
- [x] Implement connection validation on startup (lazy init with _ensure_initialized)
- [x] Implement health_check() method (Neo4j ping + Ollama model check)
- [x] Add retry logic for transient failures (tenacity on OllamaEmbedder + OllamaLLMClient)
- [x] Replace all print statements with structured logging
- [x] Wire into FastAPI startup/shutdown (lifespan in main.py, app.state)
- [x] Write tests (test_graphiti_store.py, test_ollama_adapter.py)
