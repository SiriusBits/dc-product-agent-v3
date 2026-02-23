# Implementation Strategy: kg-data-validation

## Database Changes
None — pure validation, no writes.

## API Modifications
None.

## UI Components
None.

## Testing Approach
- Unit test: valid entity passes
- Unit test: entity missing `id` → error
- Unit test: entity with unknown `type` → warning
- Unit test: triple with missing subject → error
- Unit test: triple referencing non-existent entity ID → warning
- Test with real YAML files to verify no unexpected warnings
