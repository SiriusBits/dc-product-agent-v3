# Feature: neo4j-schema-design

## Milestone
M1 — Neo4j Foundation & Schema Design

## Requirements
Design the canonical Neo4j graph schema for the Dixie Chemical product knowledge graph, derived from entity types and relationship predicates in the derived YAML extractions.

## Acceptance Criteria
- [x] Node labels defined: 13 labels (Chemical, ChemicalClass, Product, Organization, Application, Document, Identifier, Material, Property, Benefit, Hazard, Location, ChemicalFunction)
- [x] Relationship types defined: 25 normalized types from 294 raw predicates (IS_A, DERIVED_FROM, FUNCTIONS_AS, PRODUCED_BY, PUBLISHES, LOCATED_AT, HAS_IDENTIFIER, HAS_PROPERTY, HAS_APPLICATION, HAS_BENEFIT, HAS_HAZARD, REQUIRES_PPE, HAS_FIRST_AID, HAS_STORAGE, HAS_TOXICITY, COMPATIBLE_WITH, INCOMPATIBLE_WITH, REACTS_WITH, CONTAINS, FORMULATED_WITH, ACHIEVES, HAS_CURE_DATA, HAS_DOSAGE, COMPARED_TO, MODIFIES, + 3 minor)
- [x] Property constraints documented for each node label (common properties + label-specific)
- [x] Uniqueness constraints identified (13 constraints on `id` per label)
- [x] Index strategy documented (name lookups, identifier lookups, provenance lookups, full-text search)
- [ ] Schema diagram or visual representation created (deferred)
- [x] Schema reviewed against all 17 derived YAML files to confirm coverage

## Dependencies
- Derived YAML files in `reference/derived_info_yaml/` (existing)

## Notes
- Application and Property are first-class nodes — string objects auto-create nodes during ingestion
- 294 → 25 predicate normalization via explicit PREDICATE_MAP + PREDICATE_PREFIX_RULES
- HAS_PROPERTY is the workhorse relationship absorbing ~135 predicates via condition properties
- Polymorphic object handling documented for all 11 shapes found in corpus
- Data quality: 34 null objects, template variables, cross-file entity duplicates identified
