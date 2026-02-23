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
