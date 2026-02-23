# Progress: neo4j-schema-init

## Status: COMPLETE

## Subtasks
- [x] Create `kg/schema.py` module
- [x] Implement `init_schema()` with 13 uniqueness constraints
- [x] Implement `init_schema()` with 11 property indexes + 1 full-text index
- [x] Implement `validate_schema()` with status logging and summary dict
- [x] Implement `wipe_and_reinit()` with batched delete (10k nodes/batch) to avoid OOM
- [x] Integrate into FastAPI startup via async lifespan context manager
- [x] Add standalone script `scripts/manage_schema.py` (init/validate/wipe)
- [ ] Write integration tests (requires live Neo4j — deferred to M7)

## Files Changed
- `src/dc_agent/kg/schema.py` — New module: init_schema(), validate_schema(), wipe_and_reinit()
- `src/dc_agent/main.py` — Added lifespan hook for schema init on startup
- `scripts/manage_schema.py` — New standalone CLI (uv run python scripts/manage_schema.py init|validate|wipe)
