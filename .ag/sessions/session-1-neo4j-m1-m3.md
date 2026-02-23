# Session 1 — Neo4j KG Integration: Milestones 1–3

**Date**: 2026-02-22 / 2026-02-23
**Branch**: warp-cloud

## Summary
Implemented and validated the first three milestones of the Neo4j Knowledge Graph integration: foundation/schema (M1), data ingestion pipeline (M2), and query service (M3).

## Milestone 1: Neo4j Foundation & Schema Design
**Status**: Complete ✅

### What was built
- Rewrote `Neo4jKGStore` (`kg/neo4j.py`) from scratch: fully async, MERGE-based upserts, exponential backoff retry on transient errors, connection pooling, label sanitization
- Defined `KGStore` ABC (`kg/store.py`) with async context manager protocol
- Created schema module (`kg/schema.py`): 13 uniqueness constraints, 12 property indexes, 1 fulltext index (`entity_names`), all idempotent with `IF NOT EXISTS`
- Documented full schema in `docs/kg-schema.md` (node labels, relationship types, property schemas, query patterns)

### Validation
- 5 unit tests (mock-based, no live Neo4j required)
- Schema applied successfully to live Neo4j container

## Milestone 2: KG Data Ingestion Pipeline
**Status**: Complete ✅

### What was built
- Pydantic models (`kg/models.py`): KGEntity, KGTriple with variant normalization (subject_id→subject, object_id→object, doc_id→document_id; plain UUID string subjects, {id,name} dicts, {text:...} anonymous subjects)
- Predicate normalization (`kg/predicates.py`): 60+ explicit mappings + prefix rules → 25 canonical relationship types. Includes ENTITY_TYPE_MAP, STRING_CREATES_NODE, SELF_REF_RELATIONSHIPS
- Validation (`kg/validation.py`): Pre-ingestion checks for required fields, referential integrity, unknown types
- Ingestion engine (`kg/ingestion.py`): parse_file(), entity MERGE with type→label mapping, polymorphic triple ingestion (11 object shapes), auto-node creation with deterministic UUIDs
- CLI script (`scripts/ingest_kg_data.py`): --source-dir, --validate-only, --dry-run, --clear, progress reporting

### Validation
- 21 unit tests
- Full ingestion: 17 YAML files → 235 entities, 764 triples, 0 errors, <5s
- Idempotency verified (re-run produces same node counts)
- Graph state: 499 nodes (13 labels), 576 relationships (28 types)

### Issues encountered and resolved
- YAML data had variant subject formats (plain UUID vs dict) — fixed with Pydantic validators
- `subject_id`/`object_id` field aliases in some triples — handled with model_validator
- Template variable entities (`${manufacturer.name}`) — filtered with warning

## Milestone 3: KG Query Service
**Status**: Complete ✅

### What was built
- Response models (`kg/query_models.py`): 16 Pydantic models (KGNode, KGRelationship, ProductProfile, SafetyProfile, PropertyComparisonResult, FormulationResult, EntitySearchResult, TraversalResult, RelatedProductsResult, NeighborEntry, etc.)
- Query service (`kg/query_service.py`): `KGQueryService` with 9 async methods:
  - `get_entity_by_id` — Direct ID/name/alias lookup
  - `get_product_profile` — Full profile: classification, applications, properties, identifiers, manufacturer, benefits
  - `get_safety_profile` — Hazards, PPE, first aid, storage, toxicity
  - `compare_property` — Cross-product property comparison with optional temperature filter
  - `get_formulations` — Formulation components with optional formulation_name filter
  - `search_entities` — Fulltext search using `entity_names` index with optional label filter
  - `find_related_products` — Products sharing a relationship to a named entity
  - `traverse` — Variable-length path traversal (capped at 3 hops) with optional rel-type filter
  - `get_entity_neighbors` — One-hop neighborhood (out/in/both) with optional rel-type filter
- Safety: All Cypher parameterized; labels/rel-types validated against schema whitelist before interpolation

### Validation
- 42 unit tests (mock-based)
- Live integration test against Neo4j: all 9 methods executed successfully

### Issues encountered and resolved
- Neo4j driver returns `None` for non-existent properties (not missing key) — `_str()` helper for None→"" coercion
- Neo4j driver `Node`/`Relationship` objects have `__iter__` (yields keys) but `dict()` fails — `_to_dict()` helper using `.items()` instead
- Product short names (e.g. "DCA 221") stored in `aliases`, not `canonical_name` — extended `_resolve_node` to search id → canonical_name → aliases

## Test Summary
- `test_kg_db.py`: 5 tests (M1)
- `test_kg_ingestion.py`: 21 tests (M2)
- `test_kg_query_service.py`: 42 tests (M3)
- **Total: 68 KG tests, all passing**

## What's Next
Per `.ag/planning/ROADMAP.md`, the next milestone is **M4: Graphiti Episodic Memory Integration**. See `SESSION-2-PLAN.md` for details.
