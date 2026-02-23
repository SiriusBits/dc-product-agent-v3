# Implementation Strategy: neo4j-schema-init

## Database Changes
- New module: `apps/backend/src/dc_agent/kg/schema.py`
- Functions:
  - `async def init_schema(driver)` — Apply all constraints and indexes
  - `async def validate_schema(driver)` — Check constraints/indexes exist, log status
  - `async def wipe_and_reinit(driver)` — DELETE all nodes/relationships, re-apply schema
- Constraints (Cypher):
  ```
  CREATE CONSTRAINT chemical_id IF NOT EXISTS FOR (n:Chemical) REQUIRE n.id IS UNIQUE
  CREATE CONSTRAINT chemical_class_id IF NOT EXISTS FOR (n:ChemicalClass) REQUIRE n.id IS UNIQUE
  ... (for each node label)
  ```
- Indexes:
  ```
  CREATE INDEX chemical_name IF NOT EXISTS FOR (n:Chemical) ON (n.canonical_name)
  CREATE FULLTEXT INDEX entity_search IF NOT EXISTS FOR (n:Chemical|ChemicalClass|Organization|Material|Application) ON EACH [n.canonical_name]
  ```

## API Modifications
- Add `init_schema` call to FastAPI startup event in `main.py`
- Add `--init-schema` flag to relevant CLI scripts

## UI Components
None.

## Testing Approach
- Integration test: run init_schema, verify constraints exist via `SHOW CONSTRAINTS`
- Test idempotency: run init_schema twice, no errors
- Test wipe_and_reinit: create data, wipe, verify empty, re-check constraints
