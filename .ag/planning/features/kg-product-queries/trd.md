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
