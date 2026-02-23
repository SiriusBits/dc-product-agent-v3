#!/usr/bin/env bash
# Generate feature directories for all milestones
# Run from project root

BASE="features"

# ============================================================
# MILESTONE 1: Neo4j Foundation & Schema Design
# ============================================================

# --- neo4j-schema-design ---
mkdir -p "$BASE/neo4j-schema-design"
cat > "$BASE/neo4j-schema-design/trd.md" << 'EOF'
# Feature: neo4j-schema-design

## Milestone
M1 — Neo4j Foundation & Schema Design

## Requirements
Design the canonical Neo4j graph schema for the Dixie Chemical product knowledge graph, derived from entity types and relationship predicates in the derived YAML extractions.

## Acceptance Criteria
- [ ] Node labels defined: Chemical, ChemicalClass, Organization, Identifier, Material, Application, Property
- [ ] Relationship types defined: IS_A, DERIVED_FROM, IS_PRODUCED_BY, HAS_CAS_NUMBER, HAS_REACH_REGISTRATION, HAS_APPLICATION, HAS_TYPICAL_PROPERTY, CAN_BE_FORMULATED_WITH, CAN_BE_STORED_IN, HAS_SAFETY_HAZARD, HAS_STORAGE_REQUIREMENT, HAS_SHELF_LIFE, HAS_VISCOSITY_AT_TEMPERATURE, HAS_SPECIFIC_GRAVITY_AT_TEMPERATURE
- [ ] Property constraints documented for each node label (required vs optional fields)
- [ ] Uniqueness constraints identified (entity `id` field)
- [ ] Index strategy documented (name, type, canonical_name lookups)
- [ ] Schema diagram or visual representation created
- [ ] Schema reviewed against all 17 derived YAML files to confirm coverage

## Dependencies
- Derived YAML files in `reference/derived_info_yaml/` (existing)

## Notes
- Entity types from YAML: CHEMICAL, CHEMICAL_CLASS, ORGANIZATION, IDENTIFIER, MATERIAL
- Need to decide whether Application and Property are first-class nodes or relationship properties
- Schema must support future entity types without breaking changes
EOF

cat > "$BASE/neo4j-schema-design/implementation-strategy.md" << 'EOF'
# Implementation Strategy: neo4j-schema-design

## Database Changes
- Define Cypher DDL for all node labels and relationship types
- Create schema document at `docs/kg-schema.md` with full specification
- Map YAML entity `type` values to Neo4j node labels (e.g., CHEMICAL → :Chemical)
- Map YAML `predicate` values to relationship types (e.g., is_a → IS_A)
- Define property schemas per node label:
  - All nodes: `id` (UUID, unique), `canonical_name`, `aliases` (list), `source_text`
  - Chemical: + `product_short_name`, `cas_number`, `chemical_name`
  - Identifier: + `registration_number`, `jurisdiction`
  - Application: + `description`
  - Property: + `value`, `unit`, `test_method`
- Define relationship property schemas (e.g., HAS_TYPICAL_PROPERTY carries value, unit)
- Handle polymorphic triple objects:
  - Entity references → match by ID
  - Plain strings (applications) → create/merge Application nodes
  - Property dicts → create Property nodes or store on relationship

## API Modifications
None — this is a design-only feature.

## UI Components
None.

## Testing Approach
- Validate schema covers all entity types across all 17 derived YAMLs
- Script to parse all YAMLs and report any unmapped entity types or predicates
EOF

cat > "$BASE/neo4j-schema-design/progress.md" << 'EOF'
# Progress: neo4j-schema-design

## Subtasks
- [ ] Audit all 17 derived YAML files for entity types and predicates
- [ ] Define node label specifications with property schemas
- [ ] Define relationship type specifications with property schemas
- [ ] Document polymorphic object handling strategy
- [ ] Create schema diagram
- [ ] Write `docs/kg-schema.md`
- [ ] Validate schema coverage against full YAML corpus
EOF

# --- neo4j-driver-refactor ---
mkdir -p "$BASE/neo4j-driver-refactor"
cat > "$BASE/neo4j-driver-refactor/trd.md" << 'EOF'
# Feature: neo4j-driver-refactor

## Milestone
M1 — Neo4j Foundation & Schema Design

## Requirements
Rewrite `Neo4jKGStore` (apps/backend/src/dc_agent/kg/neo4j.py) to use the async Neo4j Python driver with proper MERGE operations, connection management, and error handling.

## Acceptance Criteria
- [ ] `Neo4jKGStore` uses `neo4j.AsyncGraphDatabase` driver
- [ ] `add_entity` uses MERGE on entity `id` (not CREATE)
- [ ] `add_relationship` matches nodes by ID before creating relationships
- [ ] Connection pooling configured with sensible defaults
- [ ] Retry logic for transient Neo4j errors (ServiceUnavailable, SessionExpired)
- [ ] Structured logging for all operations (not print statements)
- [ ] `KGStore` ABC updated to async methods
- [ ] Async context manager support (`async with Neo4jKGStore() as store:`)
- [ ] All existing code that imports `Neo4jKGStore` updated

## Dependencies
- neo4j-schema-design (need to know the schema to write proper MERGE queries)
- `neo4j>=5.14.0` (already in pyproject.toml — confirm async driver support)

## Notes
- Current implementation uses synchronous `GraphDatabase.driver` — must switch to `AsyncGraphDatabase`
- Current `_create_node` uses CREATE instead of MERGE (causes duplicates)
- Current `_create_relationship` matches nodes by full property set (fragile and slow)
EOF

cat > "$BASE/neo4j-driver-refactor/implementation-strategy.md" << 'EOF'
# Implementation Strategy: neo4j-driver-refactor

## Database Changes
None — this refactors the Python driver code, not the schema.

## API Modifications
- Update `KGStore` ABC (`kg/store.py`) to use async methods:
  - `async def add_entity(...)`, `async def add_relationship(...)`, `async def query_graph(...)`, `async def close(...)`
- Rewrite `Neo4jKGStore` (`kg/neo4j.py`):
  - Constructor: `AsyncGraphDatabase.driver(uri, auth=(...))` with connection pool config
  - `add_entity`: `MERGE (n:{label} {id: $id}) SET n += $props`
  - `add_relationship`: `MATCH (a {id: $start_id}), (b {id: $end_id}) MERGE (a)-[r:{rel_type}]->(b) SET r += $rel_props`
  - `query_graph`: async session with parameterized Cypher
  - `close`: driver.close()
  - `__aenter__`/`__aexit__` for context manager
- Add retry decorator for transient errors
- Update `routes.py` and any other consumers of the old sync API

## UI Components
None.

## Testing Approach
- Unit tests with mocked `AsyncSession` and `AsyncTransaction`
- Test MERGE idempotency (same entity added twice → single node)
- Test relationship creation between existing nodes
- Test error handling (connection refused, timeout)
- Test retry logic triggers on ServiceUnavailable
EOF

cat > "$BASE/neo4j-driver-refactor/progress.md" << 'EOF'
# Progress: neo4j-driver-refactor

## Subtasks
- [ ] Update `KGStore` ABC to async methods
- [ ] Rewrite `Neo4jKGStore.__init__` with async driver + pool config
- [ ] Rewrite `add_entity` with proper MERGE
- [ ] Rewrite `add_relationship` with ID-based matching
- [ ] Add `query_graph` with parameterized Cypher
- [ ] Add async context manager support
- [ ] Add retry decorator for transient errors
- [ ] Add structured logging
- [ ] Update all consumers (routes.py, scripts)
- [ ] Write unit tests
EOF

# --- neo4j-schema-init ---
mkdir -p "$BASE/neo4j-schema-init"
cat > "$BASE/neo4j-schema-init/trd.md" << 'EOF'
# Feature: neo4j-schema-init

## Milestone
M1 — Neo4j Foundation & Schema Design

## Requirements
Build a schema initialization module that applies constraints and indexes to Neo4j on startup, with support for development reset.

## Acceptance Criteria
- [ ] Uniqueness constraints created for entity `id` on all node labels
- [ ] Indexes created for `canonical_name` on all node labels
- [ ] Indexes created for `type` lookups where applicable
- [ ] Full-text index on `canonical_name` and `aliases` for search
- [ ] Schema init is idempotent (safe to run multiple times)
- [ ] `wipe_and_reinit()` function clears all data and re-applies schema
- [ ] Schema validation on startup logs current state
- [ ] Init can run as standalone script or as part of app startup

## Dependencies
- neo4j-schema-design (schema spec)
- neo4j-driver-refactor (async driver)

## Notes
- Neo4j Community Edition has limited constraint support — verify which constraint types are available
- Full-text indexes use `db.index.fulltext.createNodeIndex` in Neo4j 5.x
EOF

cat > "$BASE/neo4j-schema-init/implementation-strategy.md" << 'EOF'
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
EOF

cat > "$BASE/neo4j-schema-init/progress.md" << 'EOF'
# Progress: neo4j-schema-init

## Subtasks
- [ ] Create `kg/schema.py` module
- [ ] Implement `init_schema()` with all constraints
- [ ] Implement `init_schema()` with all indexes including full-text
- [ ] Implement `validate_schema()` with status logging
- [ ] Implement `wipe_and_reinit()`
- [ ] Integrate into FastAPI startup
- [ ] Add standalone script option
- [ ] Write integration tests
EOF

# ============================================================
# MILESTONE 2: KG Data Ingestion Pipeline
# ============================================================

# --- kg-entity-ingestion ---
mkdir -p "$BASE/kg-entity-ingestion"
cat > "$BASE/kg-entity-ingestion/trd.md" << 'EOF'
# Feature: kg-entity-ingestion

## Milestone
M2 — KG Data Ingestion Pipeline

## Requirements
Parse entities from derived YAML `knowledge_graph.entities` sections and create Neo4j nodes with proper label mapping, unique ID-based MERGE, and provenance tracking.

## Acceptance Criteria
- [ ] Entity `type` mapped to Neo4j node label (CHEMICAL → :Chemical, etc.)
- [ ] Entity `id` used as unique key for MERGE (no duplicates)
- [ ] Properties stored: `canonical_name`, `aliases`, `source_text`
- [ ] Provenance attached: `document_id`, `page` from YAML
- [ ] Cross-document entities merged correctly (same entity in multiple YAMLs)
- [ ] Unknown entity types logged as warnings, not errors
- [ ] Entity count after ingestion matches unique entities across all YAMLs

## Dependencies
- M1: neo4j-schema-design, neo4j-driver-refactor, neo4j-schema-init
- PyYAML for YAML parsing

## Notes
- Some entities appear in multiple product YAMLs (e.g., "Dixie Chemical" organization)
- Aliases should accumulate across documents (union, not replace)
EOF

cat > "$BASE/kg-entity-ingestion/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-entity-ingestion

## Database Changes
- New module: `apps/backend/src/dc_agent/kg/ingestion.py`
- `EntityIngester` class:
  - `parse_entities(yaml_data: dict) -> List[KGEntity]` — Extract and validate entities
  - `ingest_entity(entity: KGEntity) -> None` — MERGE single entity into Neo4j
  - `ingest_batch(entities: List[KGEntity]) -> IngestionReport` — Batch with progress
- Cypher pattern per entity:
  ```
  MERGE (n:{label} {id: $id})
  SET n.canonical_name = $canonical_name,
      n.source_text = $source_text,
      n.document_id = $document_id,
      n.page = $page
  WITH n
  FOREACH (alias IN $aliases | SET n.aliases = coalesce(n.aliases, []) + alias)
  ```
- Pydantic model: `KGEntity(id, type, canonical_name, aliases, source_text, provenance)`

## API Modifications
None — this is a data pipeline module, not an API endpoint.

## UI Components
None.

## Testing Approach
- Unit test: parse entities from sample YAML
- Unit test: verify Cypher generation for each entity type
- Integration test: ingest sample entities, query Neo4j to verify
- Test cross-document merge (same entity ID from two YAMLs)
EOF

cat > "$BASE/kg-entity-ingestion/progress.md" << 'EOF'
# Progress: kg-entity-ingestion

## Subtasks
- [ ] Define `KGEntity` Pydantic model
- [ ] Implement YAML entity parser
- [ ] Implement entity type → node label mapping
- [ ] Implement single entity MERGE operation
- [ ] Implement batch ingestion with progress reporting
- [ ] Handle alias accumulation across documents
- [ ] Write unit tests for parsing
- [ ] Write integration test for Neo4j ingestion
EOF

# --- kg-triple-ingestion ---
mkdir -p "$BASE/kg-triple-ingestion"
cat > "$BASE/kg-triple-ingestion/trd.md" << 'EOF'
# Feature: kg-triple-ingestion

## Milestone
M2 — KG Data Ingestion Pipeline

## Requirements
Parse `kg_triples` from derived YAML files and create Neo4j relationships, handling polymorphic object types (entity references, plain strings, property dicts, measurement dicts).

## Acceptance Criteria
- [ ] Predicate mapped to uppercase relationship type (is_a → IS_A)
- [ ] Entity-reference objects matched by subject/object `id`
- [ ] String objects (e.g., applications) create/merge Application nodes
- [ ] Property dict objects (`{property, value}`) create Property nodes or store on relationship
- [ ] Measurement dict objects (`{temperature, value}`) stored as relationship properties
- [ ] Relationship count after ingestion matches total kg_triples across all YAMLs
- [ ] No orphan relationships (both endpoints must exist)

## Dependencies
- kg-entity-ingestion (entities must exist before relationships)

## Notes
- Triple object types observed in YAML:
  - `{id, name}` — entity reference
  - `string` — plain value (applications, hazards, storage requirements)
  - `{property, value}` — physical property
  - `{temperature, value}` — temperature-dependent measurement
EOF

cat > "$BASE/kg-triple-ingestion/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-triple-ingestion

## Database Changes
- Extend `apps/backend/src/dc_agent/kg/ingestion.py`:
- `TripleIngester` class:
  - `parse_triples(yaml_data: dict) -> List[KGTriple]`
  - `classify_object(obj) -> ObjectType` — Determine object type (entity_ref, string, property_dict, measurement_dict)
  - `ingest_triple(triple: KGTriple) -> None`
  - `ingest_batch(triples: List[KGTriple]) -> IngestionReport`
- Cypher patterns by object type:
  - Entity ref: `MATCH (a {id: $subj_id}), (b {id: $obj_id}) MERGE (a)-[r:REL_TYPE]->(b)`
  - String: `MATCH (a {id: $subj_id}) MERGE (b:Application {name: $obj_value}) MERGE (a)-[r:HAS_APPLICATION]->(b)`
  - Property dict: `MATCH (a {id: $subj_id}) MERGE (a)-[r:HAS_TYPICAL_PROPERTY {property: $prop_name}]->(a) SET r.value = $value`
  - Measurement: `MATCH (a {id: $subj_id}) CREATE (a)-[r:HAS_VISCOSITY_AT_TEMPERATURE {temperature: $temp, value: $val}]->(a)`

## API Modifications
None.

## UI Components
None.

## Testing Approach
- Unit test: classify each object type correctly
- Unit test: parse triples from sample YAML
- Integration test: ingest triples after entities, verify relationships in Neo4j
- Test: attempt triple with missing entity → logged warning, not crash
EOF

cat > "$BASE/kg-triple-ingestion/progress.md" << 'EOF'
# Progress: kg-triple-ingestion

## Subtasks
- [ ] Define `KGTriple` and `ObjectType` Pydantic models
- [ ] Implement YAML triple parser
- [ ] Implement object type classifier
- [ ] Implement Cypher generation per object type
- [ ] Implement single triple ingestion
- [ ] Implement batch ingestion with progress
- [ ] Handle missing entity references gracefully
- [ ] Write unit tests
- [ ] Write integration tests
EOF

# --- kg-ingestion-cli ---
mkdir -p "$BASE/kg-ingestion-cli"
cat > "$BASE/kg-ingestion-cli/trd.md" << 'EOF'
# Feature: kg-ingestion-cli

## Milestone
M2 — KG Data Ingestion Pipeline

## Requirements
CLI tool for batch ingesting knowledge graph data from derived YAML/JSON files into Neo4j, with idempotency, dry-run mode, and progress reporting.

## Acceptance Criteria
- [ ] Script at `apps/backend/scripts/ingest_kg_data.py`
- [ ] `--source-dir` flag for derived YAML/JSON directory (default: `reference/derived_info_yaml/`)
- [ ] `--clear` flag wipes existing KG data before ingestion
- [ ] `--dry-run` flag validates and reports without writing to Neo4j
- [ ] Progress bar showing file-by-file and entity/triple progress
- [ ] Summary report: entities created/merged, triples created, warnings, errors
- [ ] Idempotent: re-running produces identical graph state
- [ ] Ingestion completes in < 30 seconds for all 17 products
- [ ] Runnable via `uv run python scripts/ingest_kg_data.py`

## Dependencies
- kg-entity-ingestion, kg-triple-ingestion, kg-data-validation

## Notes
- Follow the pattern of existing `ingest_reference_data.py` for ChromaDB
- Should be addable to Makefile as `make ingest-kg`
EOF

cat > "$BASE/kg-ingestion-cli/implementation-strategy.md" << 'EOF'
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
EOF

cat > "$BASE/kg-ingestion-cli/progress.md" << 'EOF'
# Progress: kg-ingestion-cli

## Subtasks
- [ ] Create `scripts/ingest_kg_data.py` with argparse
- [ ] Implement YAML file discovery and loading
- [ ] Wire up EntityIngester and TripleIngester
- [ ] Add --clear flag (calls wipe_and_reinit)
- [ ] Add --dry-run flag (validation only)
- [ ] Add progress bar (tqdm or rich)
- [ ] Add summary report output
- [ ] Add to Makefile as `make ingest-kg`
- [ ] Write integration tests
EOF

# --- kg-data-validation ---
mkdir -p "$BASE/kg-data-validation"
cat > "$BASE/kg-data-validation/trd.md" << 'EOF'
# Feature: kg-data-validation

## Milestone
M2 — KG Data Ingestion Pipeline

## Requirements
Pre-ingestion validation of entity and triple schemas in derived YAML files, with referential integrity checks.

## Acceptance Criteria
- [ ] Validates entity required fields: id, type, canonical_name
- [ ] Validates triple required fields: subject (with id), predicate, object
- [ ] Checks referential integrity: triple subject/object IDs reference known entities
- [ ] Reports warnings for missing optional fields (aliases, source_text, provenance)
- [ ] Reports errors for invalid entity types or unknown predicates
- [ ] Returns structured validation report (errors, warnings, stats)
- [ ] Usable standalone and as part of ingestion pipeline

## Dependencies
- KG schema design (to know valid entity types and predicates)

## Notes
- Validation should be fast — no Neo4j connection needed
- Could also validate the YAML structure itself (expected top-level keys)
EOF

cat > "$BASE/kg-data-validation/implementation-strategy.md" << 'EOF'
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
EOF

cat > "$BASE/kg-data-validation/progress.md" << 'EOF'
# Progress: kg-data-validation

## Subtasks
- [ ] Define validation models and report structure
- [ ] Implement entity schema validator
- [ ] Implement triple schema validator
- [ ] Implement referential integrity checker
- [ ] Implement standalone validation script
- [ ] Integrate into ingestion pipeline (pre-ingestion step)
- [ ] Write unit tests with valid and invalid fixtures
EOF

# ============================================================
# MILESTONE 3: KG Query Service
# ============================================================

# --- kg-product-queries ---
mkdir -p "$BASE/kg-product-queries"
cat > "$BASE/kg-product-queries/trd.md" << 'EOF'
# Feature: kg-product-queries

## Milestone
M3 — KG Query Service

## Requirements
Build `KGProductService` providing typed product queries against the Neo4j knowledge graph.

## Acceptance Criteria
- [ ] `get_product(name_or_id)` returns full product node with all connected entities
- [ ] `get_product_properties(name)` returns all typical properties
- [ ] `get_product_applications(name)` returns all applications
- [ ] `get_product_family(name)` returns chemical class and sibling products
- [ ] `get_product_storage_info(name)` returns storage materials, requirements, shelf life
- [ ] All methods return Pydantic models (not raw dicts)
- [ ] Product lookup by short name (e.g., "ASA 100") and by ID both work
- [ ] Response time < 300ms per query

## Dependencies
- M1 (schema, driver), M2 (data ingested)
EOF

cat > "$BASE/kg-product-queries/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-product-queries

## Database Changes
None — read-only queries.

## API Modifications
- New service: `apps/backend/src/dc_agent/kg/services/product_service.py`
- Pydantic response models in `dc_agent/models/kg.py`:
  - `KGProduct`, `KGProperty`, `KGApplication`, `KGProductFamily`, `KGStorageInfo`
- Cypher queries use parameterized lookups:
  ```
  MATCH (p:Chemical {canonical_name: $name})-[r]->(related)
  RETURN p, type(r) as rel_type, related
  ```

## UI Components
None — service layer only.

## Testing Approach
- Unit tests with mocked Neo4j sessions returning sample records
- Integration tests against populated test database
- Benchmark response times
EOF

cat > "$BASE/kg-product-queries/progress.md" << 'EOF'
# Progress: kg-product-queries

## Subtasks
- [ ] Define KG Pydantic response models
- [ ] Implement `get_product()`
- [ ] Implement `get_product_properties()`
- [ ] Implement `get_product_applications()`
- [ ] Implement `get_product_family()`
- [ ] Implement `get_product_storage_info()`
- [ ] Write unit tests with mocked sessions
- [ ] Write integration tests
- [ ] Benchmark response times
EOF

# --- kg-relationship-traversal ---
mkdir -p "$BASE/kg-relationship-traversal"
cat > "$BASE/kg-relationship-traversal/trd.md" << 'EOF'
# Feature: kg-relationship-traversal

## Milestone
M3 — KG Query Service

## Requirements
Multi-hop query capabilities for finding related products and shared attributes across the knowledge graph.

## Acceptance Criteria
- [ ] `find_related_products(name, max_hops=2)` returns products within N hops
- [ ] `find_products_by_application(application)` returns all products sharing an application
- [ ] `find_products_by_family(family_name)` returns all products in a chemical class
- [ ] `find_common_applications(product_a, product_b)` returns shared applications
- [ ] `get_product_comparison(product_a, product_b)` returns side-by-side properties
- [ ] Multi-hop traversal completes in < 1s
- [ ] Results include path information (how products are connected)

## Dependencies
- kg-product-queries (base product service)
EOF

cat > "$BASE/kg-relationship-traversal/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-relationship-traversal

## Database Changes
None — read-only traversal queries.

## API Modifications
- Extend `KGProductService` or create `KGTraversalService`
- Cypher uses variable-length paths:
  ```
  MATCH path = (a:Chemical {canonical_name: $name})-[*1..2]-(b:Chemical)
  RETURN b, path
  ```
- Response models: `RelatedProduct`, `ProductComparison`, `SharedApplication`

## UI Components
None.

## Testing Approach
- Integration tests with known graph topology
- Verify path information is correct
- Benchmark multi-hop queries
EOF

cat > "$BASE/kg-relationship-traversal/progress.md" << 'EOF'
# Progress: kg-relationship-traversal

## Subtasks
- [ ] Implement `find_related_products()` with variable-length paths
- [ ] Implement `find_products_by_application()`
- [ ] Implement `find_products_by_family()`
- [ ] Implement `find_common_applications()`
- [ ] Implement `get_product_comparison()`
- [ ] Define response models with path info
- [ ] Write integration tests
- [ ] Benchmark traversal performance
EOF

# --- kg-entity-search ---
mkdir -p "$BASE/kg-entity-search"
cat > "$BASE/kg-entity-search/trd.md" << 'EOF'
# Feature: kg-entity-search

## Milestone
M3 — KG Query Service

## Requirements
General-purpose entity search over the knowledge graph using full-text indexing.

## Acceptance Criteria
- [ ] `search_entities(query, entity_type=None, limit=20)` returns matching entities
- [ ] `get_entity_by_id(id)` returns single entity with relationships
- [ ] `get_entities_by_type(type, limit=50)` lists entities of a given type
- [ ] Search uses Neo4j full-text index for performance
- [ ] Partial name matching works (e.g., "ASA" matches "ASA 100", "ASA 150", "ASA 155")
- [ ] Alias matching works (e.g., "HDSA" matches "ASA 100")

## Dependencies
- neo4j-schema-init (full-text index must exist)
- kg-entity-ingestion (data must be loaded)
EOF

cat > "$BASE/kg-entity-search/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-entity-search

## Database Changes
- Relies on full-text index created in neo4j-schema-init
- Query uses: `CALL db.index.fulltext.queryNodes('entity_search', $query) YIELD node, score`

## API Modifications
- New service: `dc_agent/kg/services/entity_service.py`
- Response models: `EntitySearchResult`, `EntityDetail`

## UI Components
None.

## Testing Approach
- Integration tests with known entities
- Test partial matching, alias matching
- Verify type filtering works
- Benchmark search performance
EOF

cat > "$BASE/kg-entity-search/progress.md" << 'EOF'
# Progress: kg-entity-search

## Subtasks
- [ ] Implement `search_entities()` using full-text index
- [ ] Implement `get_entity_by_id()`
- [ ] Implement `get_entities_by_type()`
- [ ] Define response models
- [ ] Write integration tests
- [ ] Test alias and partial matching
EOF

# --- kg-cypher-service ---
mkdir -p "$BASE/kg-cypher-service"
cat > "$BASE/kg-cypher-service/trd.md" << 'EOF'
# Feature: kg-cypher-service

## Milestone
M3 — KG Query Service

## Requirements
Safe, parameterized Cypher execution layer with query templates and result mapping to Pydantic models.

## Acceptance Criteria
- [ ] All Cypher queries use parameterized inputs (no string interpolation)
- [ ] Query template registry for common patterns
- [ ] Result records mapped to Pydantic models automatically
- [ ] Query timeout enforcement (configurable, default 5s)
- [ ] Query execution logged with timing for performance monitoring
- [ ] No Cypher injection possible through user-provided inputs

## Dependencies
- neo4j-driver-refactor (async driver)
EOF

cat > "$BASE/kg-cypher-service/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-cypher-service

## Database Changes
None.

## API Modifications
- New module: `dc_agent/kg/cypher.py`
- `CypherService` class:
  - `execute(query_template, params, result_model) -> List[T]`
  - `execute_single(query_template, params, result_model) -> Optional[T]`
  - Query templates stored as named constants
  - Result mapping via Pydantic `model_validate`
- Used by `KGProductService`, `KGTraversalService`, `KGEntityService`

## UI Components
None.

## Testing Approach
- Unit test: parameterization prevents injection
- Unit test: result mapping to Pydantic models
- Unit test: timeout enforcement
- Test: timing logged correctly
EOF

cat > "$BASE/kg-cypher-service/progress.md" << 'EOF'
# Progress: kg-cypher-service

## Subtasks
- [ ] Create `kg/cypher.py` module
- [ ] Implement parameterized query execution
- [ ] Implement result → Pydantic model mapping
- [ ] Define query template registry
- [ ] Add timeout enforcement
- [ ] Add execution timing logging
- [ ] Write unit tests
EOF

# ============================================================
# MILESTONE 4: Graphiti Episodic Memory
# ============================================================

# --- graphiti-init-lifecycle ---
mkdir -p "$BASE/graphiti-init-lifecycle"
cat > "$BASE/graphiti-init-lifecycle/trd.md" << 'EOF'
# Feature: graphiti-init-lifecycle

## Milestone
M4 — Graphiti Episodic Memory Integration

## Requirements
Add proper async lifecycle management, health checks, and connection validation to GraphitiKGStore.

## Acceptance Criteria
- [ ] Async context manager (`async with GraphitiKGStore() as store:`)
- [ ] Connection validation on startup (ping Neo4j, verify Ollama models available)
- [ ] Graceful shutdown with resource cleanup
- [ ] `health_check()` method returns connection status for all dependencies
- [ ] Retry logic for transient connection failures (Neo4j, Ollama)
- [ ] Structured logging replacing all print statements

## Dependencies
- neo4j-driver-refactor (shared Neo4j connection)
- Ollama running locally with required models
EOF

cat > "$BASE/graphiti-init-lifecycle/implementation-strategy.md" << 'EOF'
# Implementation Strategy: graphiti-init-lifecycle

## Database Changes
None.

## API Modifications
- Refactor `GraphitiKGStore` in `kg/graphiti_store.py`:
  - Add `__aenter__`/`__aexit__`
  - Add `health_check() -> HealthStatus`
  - Validate Ollama model availability on init
  - Replace `close()` with proper async cleanup
- Wire health check into FastAPI health endpoint

## UI Components
None.

## Testing Approach
- Test context manager lifecycle (init, use, cleanup)
- Test health check with Neo4j up/down
- Test health check with Ollama up/down
- Test retry on transient failure
EOF

cat > "$BASE/graphiti-init-lifecycle/progress.md" << 'EOF'
# Progress: graphiti-init-lifecycle

## Subtasks
- [ ] Add async context manager to GraphitiKGStore
- [ ] Implement connection validation on startup
- [ ] Implement health_check() method
- [ ] Add retry logic for transient failures
- [ ] Replace all print statements with structured logging
- [ ] Wire into FastAPI startup/shutdown
- [ ] Write tests
EOF

# --- graphiti-episode-ingestion ---
mkdir -p "$BASE/graphiti-episode-ingestion"
cat > "$BASE/graphiti-episode-ingestion/trd.md" << 'EOF'
# Feature: graphiti-episode-ingestion

## Milestone
M4 — Graphiti Episodic Memory Integration

## Requirements
Ingest product documents as Graphiti episodes with source attribution, using derived YAML summaries and section content.

## Acceptance Criteria
- [ ] Each product's derived summary ingested as a Graphiti episode
- [ ] Source attribution via `source_description` (document ID, filename)
- [ ] `reference_time` set from YAML `extraction_date` metadata
- [ ] Batch ingestion with rate limiting for Ollama
- [ ] Progress reporting per product
- [ ] Failed episodes skipped with error logged (doesn't halt batch)

## Dependencies
- graphiti-init-lifecycle
- Derived YAML files with `derived_info.summary` content
EOF

cat > "$BASE/graphiti-episode-ingestion/implementation-strategy.md" << 'EOF'
# Implementation Strategy: graphiti-episode-ingestion

## Database Changes
- Graphiti creates its own nodes/edges in Neo4j (Entity, Episodic nodes)

## API Modifications
- Fix `add_episode` signature: use `source_description` (not `source_url`)
- New script: `scripts/ingest_graphiti_episodes.py`
- Rate limiting: configurable delay between episodes (Ollama throughput)

## UI Components
None.

## Testing Approach
- Integration test: ingest one product, verify Graphiti entities created in Neo4j
- Test with Ollama running: verify embeddings generated
- Test error recovery: simulate Ollama timeout, verify skip and continue
EOF

cat > "$BASE/graphiti-episode-ingestion/progress.md" << 'EOF'
# Progress: graphiti-episode-ingestion

## Subtasks
- [ ] Fix add_episode method signature
- [ ] Implement YAML summary extraction for episodes
- [ ] Add rate limiting for Ollama calls
- [ ] Add progress reporting
- [ ] Add error recovery (skip failed, continue)
- [ ] Create ingestion script
- [ ] Write integration tests
EOF

# --- graphiti-search-refinement ---
mkdir -p "$BASE/graphiti-search-refinement"
cat > "$BASE/graphiti-search-refinement/trd.md" << 'EOF'
# Feature: graphiti-search-refinement

## Milestone
M4 — Graphiti Episodic Memory Integration

## Requirements
Improve Graphiti search quality, result formatting, and error handling.

## Acceptance Criteria
- [ ] Search results mapped to typed Pydantic models
- [ ] Configurable search parameters (limit, threshold)
- [ ] Results formatted for RAG context consumption
- [ ] Debug print statements removed from OllamaLLMClient
- [ ] Empty/error results handled gracefully (not exceptions)
- [ ] Structured logging throughout

## Dependencies
- graphiti-init-lifecycle
EOF

cat > "$BASE/graphiti-search-refinement/implementation-strategy.md" << 'EOF'
# Implementation Strategy: graphiti-search-refinement

## Database Changes
None.

## API Modifications
- Define `GraphitiSearchResult` Pydantic model
- Refactor `search()` method to return typed results
- Add parameters: `limit`, `min_score`
- Clean up `OllamaLLMClient`: remove debug prints, add logging
- Handle Graphiti SDK exceptions gracefully

## UI Components
None.

## Testing Approach
- Unit test: result mapping to Pydantic models
- Test: empty results return empty list (not error)
- Test: Ollama errors caught and logged
EOF

cat > "$BASE/graphiti-search-refinement/progress.md" << 'EOF'
# Progress: graphiti-search-refinement

## Subtasks
- [ ] Define GraphitiSearchResult model
- [ ] Refactor search() return type
- [ ] Add configurable search parameters
- [ ] Remove debug print statements from OllamaLLMClient
- [ ] Add structured logging
- [ ] Handle empty/error results
- [ ] Write tests
EOF

# ============================================================
# MILESTONE 5: n8n Retrieval Orchestration
# ============================================================

# --- n8n-retrieval-webhook ---
mkdir -p "$BASE/n8n-retrieval-webhook"
cat > "$BASE/n8n-retrieval-webhook/trd.md" << 'EOF'
# Feature: n8n-retrieval-webhook

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
Create the core n8n workflow triggered by webhook that receives queries from the backend and returns orchestrated retrieval context.

## Acceptance Criteria
- [ ] n8n workflow with Webhook trigger node accepting POST requests
- [ ] Receives `{query, top_k, conversation_id}` payload
- [ ] Returns `{context_blocks[], trace_metadata}` response
- [ ] Workflow exported as JSON in `n8n/workflows/retrieval-orchestrator.json`
- [ ] Webhook URL configurable and stable
- [ ] Workflow activatable/deactivatable via n8n UI

## Dependencies
- n8n container running (docker-compose)
- Backend internal endpoints (for downstream routing)

## Notes
- n8n webhooks use `/webhook/` or `/webhook-test/` URL paths
- Workflow JSON should be version-controlled for reproducibility
EOF

cat > "$BASE/n8n-retrieval-webhook/implementation-strategy.md" << 'EOF'
# Implementation Strategy: n8n-retrieval-webhook

## Database Changes
None.

## API Modifications
None — this is an n8n workflow, not backend code.

## n8n Workflow Design
- **Node 1**: Webhook (POST) — receives query payload
- **Node 2**: Set node — normalize input, set defaults
- Connect to classifier node (Feature 2)
- Final node: Respond to Webhook — return fused results + trace

## UI Components
None.

## Testing Approach
- Manual test: curl POST to webhook URL, verify response shape
- Integration test: backend sends request, receives valid response
- Test with n8n in test mode vs production mode
EOF

cat > "$BASE/n8n-retrieval-webhook/progress.md" << 'EOF'
# Progress: n8n-retrieval-webhook

## Subtasks
- [ ] Create n8n workflow with Webhook trigger
- [ ] Configure input schema validation
- [ ] Add Set node for input normalization
- [ ] Add Respond to Webhook node for output
- [ ] Export workflow JSON to `n8n/workflows/`
- [ ] Test webhook endpoint manually
- [ ] Document webhook URL configuration
EOF

# --- n8n-query-classifier ---
mkdir -p "$BASE/n8n-query-classifier"
cat > "$BASE/n8n-query-classifier/trd.md" << 'EOF'
# Feature: n8n-query-classifier

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
n8n node(s) that classify incoming queries into retrieval strategies (vector, KG, hybrid) using rule-based patterns with optional LLM fallback.

## Acceptance Criteria
- [ ] Rule-based classification via n8n Code node
- [ ] Relationship keywords → KG ("related to", "family", "compare", "CAS number", "sibling")
- [ ] Structured lookup patterns → KG ("what is the [property] of [product]")
- [ ] General/open-ended → Vector ("tell me about", "explain", "describe", "what is")
- [ ] Multi-product + property → Hybrid
- [ ] Optional LLM fallback for ambiguous queries (via Ollama HTTP call)
- [ ] Classification result + confidence stored in trace metadata
- [ ] Switch node routes to appropriate downstream path

## Dependencies
- n8n-retrieval-webhook (workflow context)

## Notes
- Start with rule-based only; LLM fallback is an enhancement
- Classification should be fast (< 50ms for rule-based)
EOF

cat > "$BASE/n8n-query-classifier/implementation-strategy.md" << 'EOF'
# Implementation Strategy: n8n-query-classifier

## Database Changes
None.

## API Modifications
None — n8n workflow nodes.

## n8n Workflow Design
- **Code node** (JavaScript): Pattern matching against query text
  - Check for KG keywords/patterns
  - Check for comparison patterns (2+ product names)
  - Default to vector for unmatched queries
  - Output: `{strategy: "vector"|"kg"|"hybrid", confidence: 0.0-1.0, reason: string}`
- **Switch node**: Route based on `strategy` value
- **Optional**: HTTP Request node to Ollama for ambiguous queries

## UI Components
None.

## Testing Approach
- Test with sample queries for each strategy type
- Verify classification accuracy against a test set
- Measure classification latency
EOF

cat > "$BASE/n8n-query-classifier/progress.md" << 'EOF'
# Progress: n8n-query-classifier

## Subtasks
- [ ] Implement rule-based classification in n8n Code node
- [ ] Define keyword/pattern lists for KG, Vector, Hybrid
- [ ] Add Switch node for routing
- [ ] Store classification result in trace metadata
- [ ] Build test query set with expected classifications
- [ ] Test classification accuracy
- [ ] (Optional) Add LLM fallback via Ollama HTTP call
EOF

# --- n8n-retrieval-router ---
mkdir -p "$BASE/n8n-retrieval-router"
cat > "$BASE/n8n-retrieval-router/trd.md" << 'EOF'
# Feature: n8n-retrieval-router

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
n8n Switch/If nodes that route classified queries to the appropriate backend internal endpoints, including parallel execution for hybrid queries.

## Acceptance Criteria
- [ ] Vector path calls `POST /internal/vector-search` on backend
- [ ] KG path calls `POST /internal/kg-search` and/or `POST /internal/kg-product`
- [ ] Hybrid path calls both in parallel, waits for both responses
- [ ] Error handling: KG failure falls back to vector-only
- [ ] Timing captured at each HTTP Request node
- [ ] Backend internal endpoints exist and return expected response shapes

## Dependencies
- n8n-query-classifier (provides routing decision)
- M3 KG Query Service (backend KG endpoints)
- Existing vector search (SearchService)

## Notes
- n8n supports parallel execution via split/merge nodes
- Backend URL within Docker network: `http://host.docker.internal:8080` or service name
EOF

cat > "$BASE/n8n-retrieval-router/implementation-strategy.md" << 'EOF'
# Implementation Strategy: n8n-retrieval-router

## Database Changes
None.

## API Modifications
- New internal FastAPI router: `dc_agent/api/internal.py`
  - `POST /internal/vector-search` — wraps SearchService.semantic_search
  - `POST /internal/kg-search` — wraps KGEntityService/KGProductService
  - `POST /internal/kg-product` — structured product data from KG
- Mount internal router in main.py (restricted access)

## n8n Workflow Design
- **Switch node**: 3 outputs (vector, kg, hybrid)
- **Vector branch**: HTTP Request → backend /internal/vector-search
- **KG branch**: HTTP Request → backend /internal/kg-search
- **Hybrid branch**: Split → parallel HTTP Requests → Merge
- **Error handling**: Each HTTP Request has error output → fallback path

## UI Components
None.

## Testing Approach
- Test each routing path independently
- Test hybrid parallel execution
- Test KG failure fallback to vector
- Verify timing data captured
EOF

cat > "$BASE/n8n-retrieval-router/progress.md" << 'EOF'
# Progress: n8n-retrieval-router

## Subtasks
- [ ] Create backend internal router (`api/internal.py`)
- [ ] Implement /internal/vector-search endpoint
- [ ] Implement /internal/kg-search endpoint
- [ ] Implement /internal/kg-product endpoint
- [ ] Build n8n vector routing branch
- [ ] Build n8n KG routing branch
- [ ] Build n8n hybrid parallel branch
- [ ] Add error handling / fallback nodes
- [ ] Test each path end-to-end
EOF

# --- n8n-result-fusion ---
mkdir -p "$BASE/n8n-result-fusion"
cat > "$BASE/n8n-result-fusion/trd.md" << 'EOF'
# Feature: n8n-result-fusion

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
n8n Code node that merges, deduplicates, and ranks results from multiple retrieval sources.

## Acceptance Criteria
- [ ] Deduplicates overlapping information (same product from both sources)
- [ ] Applies configurable weights (vector_weight, kg_weight as n8n workflow variables)
- [ ] KG results provide structured facts, vector results provide prose
- [ ] Output: ordered list of `context_blocks` with source attribution
- [ ] Fusion parameters editable in n8n UI without code changes
- [ ] Handles single-source results (vector-only or KG-only) as passthrough

## Dependencies
- n8n-retrieval-router (provides raw results from both sources)
EOF

cat > "$BASE/n8n-result-fusion/implementation-strategy.md" << 'EOF'
# Implementation Strategy: n8n-result-fusion

## Database Changes
None.

## API Modifications
None — n8n Code node.

## n8n Workflow Design
- **Merge node**: Combines outputs from vector and KG branches
- **Code node** (JavaScript): Fusion logic
  - Deduplicate by product name
  - Score: `combined = vector_weight * vector_score + kg_weight * kg_score`
  - Sort by combined score descending
  - Format as `context_blocks[]` with `{source, type, content, score, product_name}`
- **Workflow variables**: `vector_weight` (default 0.6), `kg_weight` (default 0.4)

## UI Components
None.

## Testing Approach
- Test with overlapping results from both sources
- Test with single-source results
- Test weight adjustment changes ranking
- Verify deduplication works correctly
EOF

cat > "$BASE/n8n-result-fusion/progress.md" << 'EOF'
# Progress: n8n-result-fusion

## Subtasks
- [ ] Implement Merge node in n8n workflow
- [ ] Implement fusion Code node (dedup, score, sort)
- [ ] Define context_block output schema
- [ ] Add workflow variables for weights
- [ ] Handle single-source passthrough
- [ ] Test with overlapping results
- [ ] Test weight tuning
EOF

# --- backend-n8n-client ---
mkdir -p "$BASE/backend-n8n-client"
cat > "$BASE/backend-n8n-client/trd.md" << 'EOF'
# Feature: backend-n8n-client

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
Python HTTP client in the backend that calls the n8n retrieval webhook and handles the orchestrated response, with fallback to direct vector search.

## Acceptance Criteria
- [ ] `N8nRetrievalClient` class in `dc_agent/services/n8n_client.py`
- [ ] Calls n8n webhook URL (configurable via `N8N_WEBHOOK_URL` setting)
- [ ] Sends `{query, top_k, conversation_id}` payload
- [ ] Receives and parses `{context_blocks[], trace_metadata}` response
- [ ] Timeout configurable (default 10s)
- [ ] Retry on transient failures (1 retry with backoff)
- [ ] Fallback to direct `SearchService.semantic_search` if n8n unreachable
- [ ] Trace metadata logged at INFO level
- [ ] Returns typed `OrchestrationResult` Pydantic model

## Dependencies
- n8n-retrieval-webhook (webhook must be running)
- httpx for async HTTP calls (already a dependency)

## Notes
- N8N_WEBHOOK_URL added to Settings in config.py
- First n8n call after restart can be slow (workflow loading)
EOF

cat > "$BASE/backend-n8n-client/implementation-strategy.md" << 'EOF'
# Implementation Strategy: backend-n8n-client

## Database Changes
None.

## API Modifications
- New config: `N8N_WEBHOOK_URL` in `dc_agent/config.py` Settings
- New service: `dc_agent/services/n8n_client.py`
  - `N8nRetrievalClient`:
    - `async def orchestrate(query, top_k, conversation_id) -> OrchestrationResult`
    - Uses `httpx.AsyncClient` with timeout
    - Fallback: catches `httpx.ConnectError`, `httpx.TimeoutException` → direct vector search
- New models in `dc_agent/models/orchestration.py`:
  - `ContextBlock(source, type, content, score, product_name)`
  - `TraceMetadata(execution_id, classification, timing_ms, result_counts)`
  - `OrchestrationResult(context_blocks, trace_metadata, fallback_used)`

## UI Components
None.

## Testing Approach
- Unit test with mocked httpx responses
- Test fallback: mock connection error → verify direct search used
- Test timeout handling
- Integration test with running n8n
EOF

cat > "$BASE/backend-n8n-client/progress.md" << 'EOF'
# Progress: backend-n8n-client

## Subtasks
- [ ] Add N8N_WEBHOOK_URL to config.py Settings
- [ ] Define OrchestrationResult, ContextBlock, TraceMetadata models
- [ ] Implement N8nRetrievalClient with httpx
- [ ] Add timeout and retry logic
- [ ] Implement fallback to direct vector search
- [ ] Add trace metadata logging
- [ ] Write unit tests with mocked responses
- [ ] Write integration test with running n8n
EOF

# --- rag-pipeline-n8n ---
mkdir -p "$BASE/rag-pipeline-n8n"
cat > "$BASE/rag-pipeline-n8n/trd.md" << 'EOF'
# Feature: rag-pipeline-n8n

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
Integrate n8n-orchestrated retrieval context into the existing RAG pipeline, replacing direct SearchService calls with the n8n orchestration client.

## Acceptance Criteria
- [ ] ChatService calls N8nRetrievalClient instead of SearchService directly
- [ ] RAGPipeline.format_context handles both vector and KG context blocks
- [ ] System prompt updated to instruct LLM on using structured KG data
- [ ] extract_sources updated to include KG provenance from trace metadata
- [ ] Direct SearchService fallback retained when n8n unavailable
- [ ] All existing vector-only queries produce equivalent or better results
- [ ] No regression in chat quality for general queries

## Dependencies
- backend-n8n-client
- Existing RAG pipeline (retrieval/rag.py)
- Existing ChatService (services/chat.py)
EOF

cat > "$BASE/rag-pipeline-n8n/implementation-strategy.md" << 'EOF'
# Implementation Strategy: rag-pipeline-n8n

## Database Changes
None.

## API Modifications
- Modify `services/chat.py`:
  - Inject `N8nRetrievalClient` (primary) and `SearchService` (fallback)
  - Call orchestrate() → get context_blocks → format for LLM
- Modify `retrieval/rag.py`:
  - `format_context` accepts `List[ContextBlock]` in addition to `List[SearchResult]`
  - New method: `format_kg_context(kg_blocks)` for structured KG data
  - Update system prompt with KG instruction addendum
  - `extract_sources` handles both vector and KG sources

## UI Components
None.

## Testing Approach
- Unit test: format_context with mixed vector+KG blocks
- Integration test: full chat flow through n8n
- A/B comparison: same queries with and without KG context
- Regression test: existing test queries produce same or better answers
EOF

cat > "$BASE/rag-pipeline-n8n/progress.md" << 'EOF'
# Progress: rag-pipeline-n8n

## Subtasks
- [ ] Modify ChatService to use N8nRetrievalClient
- [ ] Extend format_context for ContextBlock input
- [ ] Add format_kg_context method
- [ ] Update system prompt with KG instructions
- [ ] Update extract_sources for KG provenance
- [ ] Retain SearchService fallback path
- [ ] Write unit tests for new formatting
- [ ] Run regression tests on existing queries
EOF

# --- n8n-trace-logging ---
mkdir -p "$BASE/n8n-trace-logging"
cat > "$BASE/n8n-trace-logging/trd.md" << 'EOF'
# Feature: n8n-trace-logging

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
Structured execution metadata returned with every n8n retrieval response, enabling visual debugging of retrieval paths.

## Acceptance Criteria
- [ ] Every response includes `trace_metadata` with:
  - `execution_id` (n8n execution ID, linkable to n8n UI)
  - `classification` (vector / kg / hybrid)
  - `classification_confidence` (0.0-1.0)
  - `retrieval_sources` (list of endpoints called)
  - `timing_ms` (total and per-source breakdown)
  - `result_counts` (per source: vector_count, kg_count, fused_count)
- [ ] Backend logs trace metadata at INFO level with each request
- [ ] Trace data optionally returned to frontend via response headers or body
- [ ] n8n execution ID links directly to execution detail in n8n UI (http://localhost:5678)

## Dependencies
- n8n-retrieval-webhook, n8n-query-classifier, n8n-retrieval-router, n8n-result-fusion

## Notes
- n8n provides `$execution.id` in workflow expressions
- Timing can be captured via `Date.now()` at start/end of each branch
EOF

cat > "$BASE/n8n-trace-logging/implementation-strategy.md" << 'EOF'
# Implementation Strategy: n8n-trace-logging

## Database Changes
None.

## API Modifications
- n8n workflow: accumulate trace data through pipeline
  - Set node at start: capture `start_time`, `execution_id = $execution.id`
  - After classification: store `classification`, `confidence`
  - After each retrieval: store `source_timing`, `result_count`
  - Final Code node: assemble `trace_metadata` object
- Backend: `N8nRetrievalClient` parses `trace_metadata` from response
- Backend: log trace at INFO level
- Optional: return trace in chat response for frontend dev tools

## UI Components
None directly — but trace_metadata enables frontend debugging tools.

## Testing Approach
- Verify all trace fields populated for each strategy (vector, kg, hybrid)
- Verify execution_id matches n8n UI
- Verify timing values are reasonable
- Test: missing trace fields handled gracefully
EOF

cat > "$BASE/n8n-trace-logging/progress.md" << 'EOF'
# Progress: n8n-trace-logging

## Subtasks
- [ ] Add execution_id capture in n8n workflow
- [ ] Add timing capture at pipeline start/end and per-branch
- [ ] Add classification metadata to trace
- [ ] Add result counts to trace
- [ ] Assemble trace_metadata in final n8n Code node
- [ ] Parse trace in backend N8nRetrievalClient
- [ ] Log trace at INFO level in backend
- [ ] Test all trace fields populated
EOF

# ============================================================
# MILESTONE 6: KG API Endpoints
# ============================================================

# --- kg-api-products ---
mkdir -p "$BASE/kg-api-products"
cat > "$BASE/kg-api-products/trd.md" << 'EOF'
# Feature: kg-api-products

## Milestone
M6 — KG API Endpoints

## Requirements
FastAPI endpoints exposing product graph data including relationships, related products, family tree, and product comparison.

## Acceptance Criteria
- [ ] `GET /kg/products/{name}/relationships` — all relationships for a product
- [ ] `GET /kg/products/{name}/related` — related products via shared attributes
- [ ] `GET /kg/products/{name}/family` — product family tree
- [ ] `GET /kg/products/compare?a={name}&b={name}` — side-by-side comparison
- [ ] All endpoints return Pydantic response models
- [ ] 404 for unknown products
- [ ] OpenAPI docs generated

## Dependencies
- kg-product-queries, kg-relationship-traversal (M3)
EOF

cat > "$BASE/kg-api-products/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-api-products

## Database Changes
None — read-only endpoints.

## API Modifications
- New router: `dc_agent/api/kg_routes.py`
- Mount under `/kg/products/` prefix
- Each endpoint delegates to KGProductService / KGTraversalService
- Response models in `dc_agent/models/kg.py`

## UI Components
None — API only (frontend will consume these).

## Testing Approach
- Unit test with mocked services
- Integration test with populated Neo4j
- Test 404 for missing products
- Verify OpenAPI schema
EOF

cat > "$BASE/kg-api-products/progress.md" << 'EOF'
# Progress: kg-api-products

## Subtasks
- [ ] Create `api/kg_routes.py` router
- [ ] Implement relationships endpoint
- [ ] Implement related products endpoint
- [ ] Implement family endpoint
- [ ] Implement comparison endpoint
- [ ] Define response models
- [ ] Write tests
- [ ] Verify OpenAPI docs
EOF

# --- kg-api-search ---
mkdir -p "$BASE/kg-api-search"
cat > "$BASE/kg-api-search/trd.md" << 'EOF'
# Feature: kg-api-search

## Milestone
M6 — KG API Endpoints

## Requirements
KG-powered search endpoints for entity search, application browsing, and relationship queries.

## Acceptance Criteria
- [ ] `POST /kg/search` — semantic search over knowledge graph
- [ ] `GET /kg/entities?type={type}&q={query}` — entity search with type filter
- [ ] `GET /kg/applications` — list all known applications
- [ ] `GET /kg/applications/{name}/products` — products for a given application
- [ ] All endpoints return Pydantic response models
- [ ] Pagination support where appropriate

## Dependencies
- kg-entity-search (M3)
EOF

cat > "$BASE/kg-api-search/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-api-search

## Database Changes
None.

## API Modifications
- Add search routes to `api/kg_routes.py`
- Delegate to KGEntityService
- Add pagination parameters (offset, limit)

## UI Components
None.

## Testing Approach
- Integration tests with populated data
- Test type filtering
- Test pagination
- Verify response schemas
EOF

cat > "$BASE/kg-api-search/progress.md" << 'EOF'
# Progress: kg-api-search

## Subtasks
- [ ] Implement /kg/search endpoint
- [ ] Implement /kg/entities endpoint with filters
- [ ] Implement /kg/applications listing
- [ ] Implement /kg/applications/{name}/products
- [ ] Add pagination
- [ ] Write tests
EOF

# --- kg-api-visualization ---
mkdir -p "$BASE/kg-api-visualization"
cat > "$BASE/kg-api-visualization/trd.md" << 'EOF'
# Feature: kg-api-visualization

## Milestone
M6 — KG API Endpoints

## Requirements
Graph visualization data endpoints returning nodes and edges in a format compatible with frontend graph rendering libraries.

## Acceptance Criteria
- [ ] `GET /kg/graph/product/{name}` — subgraph centered on a product
- [ ] `GET /kg/graph/overview` — high-level product relationship overview
- [ ] Response includes nodes (id, label, type, properties) and edges (source, target, type)
- [ ] Compatible with D3.js / vis.js / Cytoscape.js data format
- [ ] Configurable depth for subgraph extraction

## Dependencies
- kg-product-queries, kg-relationship-traversal (M3)
EOF

cat > "$BASE/kg-api-visualization/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-api-visualization

## Database Changes
None.

## API Modifications
- Add visualization routes to `api/kg_routes.py`
- Response models: `GraphNode`, `GraphEdge`, `SubgraphResponse`
- Cypher: extract subgraph with `MATCH path = (n)-[*0..depth]-(m) RETURN path`
- Transform Neo4j paths to node/edge lists

## UI Components
Frontend will consume these endpoints — data format must be compatible.

## Testing Approach
- Test subgraph extraction for known product
- Verify node/edge counts match expected topology
- Test depth parameter
EOF

cat > "$BASE/kg-api-visualization/progress.md" << 'EOF'
# Progress: kg-api-visualization

## Subtasks
- [ ] Define GraphNode, GraphEdge, SubgraphResponse models
- [ ] Implement product subgraph endpoint
- [ ] Implement overview endpoint
- [ ] Add depth parameter
- [ ] Transform Neo4j paths to node/edge format
- [ ] Write tests
EOF

# --- kg-api-admin ---
mkdir -p "$BASE/kg-api-admin"
cat > "$BASE/kg-api-admin/trd.md" << 'EOF'
# Feature: kg-api-admin

## Milestone
M6 — KG API Endpoints

## Requirements
Admin and health endpoints for Neo4j, Graphiti, and n8n monitoring plus KG management operations.

## Acceptance Criteria
- [ ] `GET /kg/health` — Neo4j + Graphiti + n8n connection status
- [ ] `GET /kg/stats` — node/edge counts by type
- [ ] `POST /kg/reindex` — trigger re-ingestion of KG data
- [ ] `GET /kg/traces/recent` — recent n8n execution traces for debugging
- [ ] Health endpoint returns structured status per dependency

## Dependencies
- All M1-M5 components
EOF

cat > "$BASE/kg-api-admin/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-api-admin

## Database Changes
None.

## API Modifications
- Add admin routes to `api/kg_routes.py`
- Health: ping Neo4j, check Graphiti, check n8n webhook
- Stats: `MATCH (n) RETURN labels(n), count(n)` + edge equivalent
- Reindex: trigger ingestion pipeline async
- Traces: query n8n API for recent executions (n8n has a REST API)

## UI Components
None.

## Testing Approach
- Test health with services up/down
- Test stats against known data
- Test reindex trigger
EOF

cat > "$BASE/kg-api-admin/progress.md" << 'EOF'
# Progress: kg-api-admin

## Subtasks
- [ ] Implement /kg/health endpoint
- [ ] Implement /kg/stats endpoint
- [ ] Implement /kg/reindex endpoint
- [ ] Implement /kg/traces/recent endpoint
- [ ] Write tests
EOF

# ============================================================
# MILESTONE 7: Testing & QA
# ============================================================

# --- kg-unit-tests ---
mkdir -p "$BASE/kg-unit-tests"
cat > "$BASE/kg-unit-tests/trd.md" << 'EOF'
# Feature: kg-unit-tests

## Milestone
M7 — Testing & Quality Assurance

## Requirements
Unit tests with mocked Neo4j driver covering all KG modules.

## Acceptance Criteria
- [ ] Tests for Neo4jKGStore CRUD operations
- [ ] Tests for schema initialization logic
- [ ] Tests for entity/triple parsing and mapping
- [ ] Tests for query builder parameterization
- [ ] Tests for KG service methods
- [ ] Tests for n8n client with mocked HTTP
- [ ] Tests for query classification logic
- [ ] Tests for result fusion ranking
- [ ] ≥80% coverage across KG modules

## Dependencies
- All M1-M6 features (tests written as features complete)
EOF

cat > "$BASE/kg-unit-tests/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-unit-tests

## Database Changes
None.

## API Modifications
None.

## Testing Approach
- pytest with async support (pytest-asyncio)
- Mock Neo4j async sessions using unittest.mock / pytest-mock
- Mock httpx for n8n client tests
- Fixtures for sample entities, triples, YAML data
- Test directory: `apps/backend/tests/kg/`
EOF

cat > "$BASE/kg-unit-tests/progress.md" << 'EOF'
# Progress: kg-unit-tests

## Subtasks
- [ ] Set up test directory and fixtures
- [ ] Write Neo4jKGStore unit tests
- [ ] Write schema init tests
- [ ] Write entity/triple parser tests
- [ ] Write KG service tests
- [ ] Write n8n client tests
- [ ] Write query classifier tests
- [ ] Write result fusion tests
- [ ] Verify ≥80% coverage
EOF

# --- kg-integration-tests ---
mkdir -p "$BASE/kg-integration-tests"
cat > "$BASE/kg-integration-tests/trd.md" << 'EOF'
# Feature: kg-integration-tests

## Milestone
M7 — Testing & Quality Assurance

## Requirements
Integration tests running against live Neo4j + n8n via Docker.

## Acceptance Criteria
- [ ] End-to-end ingestion pipeline (YAML → Neo4j)
- [ ] Query service against real graph data
- [ ] API endpoint responses with real KG backend
- [ ] Graphiti episode ingestion and search
- [ ] n8n orchestration end-to-end (webhook → classify → route → fuse → return)
- [ ] Hybrid retrieval through n8n
- [ ] Trace metadata correctness
- [ ] Tests skip gracefully when Docker services unavailable

## Dependencies
- Docker for Neo4j + n8n containers
- pytest
EOF

cat > "$BASE/kg-integration-tests/implementation-strategy.md" << 'EOF'
# Implementation Strategy: kg-integration-tests

## Database Changes
- Test database uses isolated Neo4j instance or separate database within same instance

## API Modifications
None.

## Testing Approach
- pytest markers: `@pytest.mark.integration` for Docker-dependent tests
- conftest.py: check Docker service availability, skip if unavailable
- Fixture: populate test Neo4j with known data before each test
- Fixture: activate n8n test workflow
- Test directory: `apps/backend/tests/integration/kg/`
EOF

cat > "$BASE/kg-integration-tests/progress.md" << 'EOF'
# Progress: kg-integration-tests

## Subtasks
- [ ] Set up integration test infrastructure
- [ ] Create Docker service availability checks
- [ ] Create test data fixtures
- [ ] Write ingestion pipeline tests
- [ ] Write query service tests
- [ ] Write API endpoint tests
- [ ] Write n8n orchestration tests
- [ ] Write trace metadata tests
- [ ] Add to CI configuration
EOF

# --- kg-performance-tests ---
mkdir -p "$BASE/kg-performance-tests"
cat > "$BASE/kg-performance-tests/trd.md" << 'EOF'
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
EOF

cat > "$BASE/kg-performance-tests/implementation-strategy.md" << 'EOF'
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
EOF

cat > "$BASE/kg-performance-tests/progress.md" << 'EOF'
# Progress: kg-performance-tests

## Subtasks
- [ ] Set up benchmark infrastructure
- [ ] Write entity lookup benchmark
- [ ] Write product query benchmark
- [ ] Write traversal benchmark
- [ ] Write hybrid query benchmark
- [ ] Write ingestion benchmark
- [ ] Configure CI reporting
EOF

echo ""
echo "✅ Created $(find "$BASE" -name "*.md" | wc -l | tr -d ' ') feature files across $(ls -d "$BASE"/*/ | wc -l | tr -d ' ') feature directories."
