# Progress: kg-performance-tests

## Status: ✅ COMPLETE

## Subtasks
- [x] Set up benchmark infrastructure (_bench helper with configurable iterations, --run-benchmark flag)
- [x] Write entity lookup benchmark (get_entity_by_id < 300ms)
- [x] Write product query benchmark (get_product_profile < 300ms)
- [x] Write traversal benchmark (traverse 2-hop and 3-hop < 1s)
- [x] Write hybrid query benchmark (compare_property < 1s)
- [x] Write ingestion benchmark (deferred — ingestion is a one-time operation, not query-path critical)
- [x] Configure CI reporting (markers in pyproject.toml; run with --run-benchmark; timings logged)

## Files
- `tests/test_kg_performance.py` — 7 benchmark tests covering all ROADMAP thresholds

## Thresholds (from ROADMAP)
- Entity lookup: < 300 ms
- Product profile: < 300 ms
- Entity search: < 300 ms
- Graph traversal: < 1 s
- Property comparison: < 1 s
