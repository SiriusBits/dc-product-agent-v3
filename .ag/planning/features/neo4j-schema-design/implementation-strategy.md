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
