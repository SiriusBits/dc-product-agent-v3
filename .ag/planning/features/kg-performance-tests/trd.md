# Feature: kg-performance-tests

## Milestone
M7 — Testing & Quality Assurance

## Requirements
Performance benchmarks verifying response times meet documented requirements.

## Acceptance Criteria
- [ ] Entity lookup: < 300ms
- [ ] Product queries (all properties): < 300ms
- [ ] Multi-hop traversal (2 hops): < 1s
- [ ] Full hybrid query (vector + KG via n8n): < 2s
- [ ] Bulk ingestion (17 products): < 30s
- [ ] Benchmarks runnable as part of CI
- [ ] Results reported in a parseable format

## Dependencies
- All M1-M6 features
- Docker services running
