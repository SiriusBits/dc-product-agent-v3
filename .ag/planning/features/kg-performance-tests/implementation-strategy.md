# Implementation Strategy: kg-performance-tests

## Database Changes
None.

## API Modifications
None.

## Testing Approach
- pytest-benchmark or custom timing harness
- Each benchmark runs N iterations, reports p50/p95/p99
- Fail test if p95 exceeds target threshold
- Test directory: `apps/backend/tests/performance/kg/`
