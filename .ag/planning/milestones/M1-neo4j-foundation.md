# Milestone 1: Neo4j Foundation & Schema Design

## Goal
Establish a robust, schema-enforced Neo4j graph database with proper constraints, indexes, and a rewritten async driver.

## Context
The existing `Neo4jKGStore` (apps/backend/src/dc_agent/kg/neo4j.py) is a rough synchronous implementation with acknowledged issues: the MERGE logic is incomplete, there are no constraints or indexes, and node matching for relationships is fragile. The abstract `KGStore` interface exists but needs to be extended for async operations.

## Features

### Feature 1: `neo4j-schema-design`
Design the canonical graph schema based on the entity types and relationship predicates found in the derived YAML data.

**Node Labels** (from derived YAML entity types):
- `Chemical` — Products and chemical compounds (ASA 100, MHHPA, DDSA, etc.)
- `ChemicalClass` — Product families (alkenylsuccinic anhydride, etc.)
- `Organization` — Manufacturers (Dixie Chemical)
- `Identifier` — CAS numbers, REACh registrations
- `Material` — Storage materials (mild steel, 304 SS, etc.)
- `Application` — Use cases (alkaline paper sizing agent, etc.)
- `Property` — Physical/chemical properties with values

**Relationship Types** (from derived YAML kg_triples predicates):
- `IS_A`, `DERIVED_FROM`, `IS_PRODUCED_BY`
- `HAS_CAS_NUMBER`, `HAS_REACH_REGISTRATION`
- `HAS_APPLICATION`, `HAS_TYPICAL_PROPERTY`
- `CAN_BE_FORMULATED_WITH`, `CAN_BE_STORED_IN`
- `HAS_SAFETY_HAZARD`, `HAS_STORAGE_REQUIREMENT`, `HAS_SHELF_LIFE`
- `HAS_VISCOSITY_AT_TEMPERATURE`, `HAS_SPECIFIC_GRAVITY_AT_TEMPERATURE`

### Feature 2: `neo4j-driver-refactor`
Rewrite `Neo4jKGStore` to use the async Neo4j driver with:
- Proper MERGE operations using unique ID-based matching
- Connection pooling and session management
- Retry logic for transient failures
- Structured error handling and logging
- Conformance to the updated `KGStore` ABC (async methods)

### Feature 3: `neo4j-schema-init`
Build a schema initialization module that:
- Creates uniqueness constraints on entity IDs
- Creates indexes on frequently queried properties (name, type, product_short_name)
- Validates schema is applied on startup
- Provides a `wipe_and_reinit` option for development

## Dependencies
- Neo4j Docker container (already configured in docker-compose.yml)
- `neo4j>=5.14.0` Python driver (already in pyproject.toml)

## Acceptance Criteria
- [ ] Graph schema document is defined and reviewed
- [ ] `Neo4jKGStore` uses async driver with proper MERGE
- [ ] Uniqueness constraints exist for entity IDs
- [ ] Indexes exist for name, type lookups
- [ ] Schema init runs idempotently on application startup
- [ ] All operations include structured logging
- [ ] Unit tests pass for driver operations (mocked)
