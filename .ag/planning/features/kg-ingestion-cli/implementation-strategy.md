# Implementation Strategy: kg-ingestion-cli

## Database Changes
None — orchestrates existing ingestion modules.

## API Modifications
None — this is a CLI script.

## UI Components
None.

## Testing Approach
- Integration test: run CLI against test YAMLs, verify Neo4j state
- Test --dry-run produces no side effects
- Test --clear wipes data before ingestion
- Test idempotency: run twice, verify same node/edge counts
- Test with malformed YAML (should report errors, continue with others)
