# Progress: neo4j-driver-refactor

## Status: COMPLETE

## Subtasks
- [x] Update `KGStore` ABC to async methods (`add_entity`, `add_relationship`, `query`, `execute`, `close`, `__aenter__`/`__aexit__`)
- [x] Rewrite `Neo4jKGStore.__init__` with `AsyncGraphDatabase.driver` + configurable pool size/timeout
- [x] Rewrite `add_entity` with MERGE on `id` (not CREATE)
- [x] Rewrite `add_relationship` with ID-based MATCH + MERGE (not full-property matching)
- [x] Split query operations: `query()` for reads (execute_read), `execute()` for writes (execute_write)
- [x] Add async context manager support (`async with Neo4jKGStore() as store:`)
- [x] Add `_retry_transient` decorator with exponential backoff (ServiceUnavailable, SessionExpired)
- [x] Replace all print statements with structured `logging` module
- [x] Add `_sanitize_label()` for safe Cypher label/type interpolation
- [x] Add `verify_connectivity()` health check method
- [x] Update `scripts/seed_db.py` — async with context manager
- [x] Update `scripts/seed_db_full.py` — removed dead Neo4jKGStore import
- [x] Rewrite `tests/test_kg_db.py` — 5 async tests with mocked AsyncGraphDatabase driver
- [x] Add `pytest-asyncio>=0.23.0` to dev dependencies

## Files Changed
- `src/dc_agent/kg/store.py` — Async ABC with 5 abstract methods + context manager
- `src/dc_agent/kg/neo4j.py` — Full async rewrite (215 lines → production-ready)
- `scripts/seed_db.py` — Async + structured logging
- `scripts/seed_db_full.py` — Cleaned imports
- `tests/test_kg_db.py` — 5 passing async tests
- `pyproject.toml` — Added pytest-asyncio
