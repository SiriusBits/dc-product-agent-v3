# Milestone 3: KG Query Service

## Goal
Build a service layer for structured and semantic queries against the knowledge graph, enabling product lookups, relationship traversal, and entity search.

## Context
After Milestones 1-2, the graph will contain chemical products, their properties, applications, relationships, and provenance data. The RAG pipeline currently only uses ChromaDB for retrieval. This milestone creates the service layer that the hybrid retrieval system (M5) and API endpoints (M6) will consume.

## Features

### Feature 1: `kg-product-queries`
`KGProductService` class providing:
- `get_product(name_or_id)` — Full product node with all connected entities
- `get_product_properties(name)` — All typical properties for a product
- `get_product_applications(name)` — All applications for a product
- `get_product_family(name)` — Product's chemical class and sibling products
- `get_product_storage_info(name)` — Storage materials, requirements, shelf life
- Returns Pydantic models, not raw dicts

### Feature 2: `kg-relationship-traversal`
Multi-hop query capabilities:
- `find_related_products(name, max_hops=2)` — Products connected within N hops
- `find_products_by_application(application)` — All products sharing an application
- `find_products_by_family(family_name)` — All products in a chemical class
- `find_common_applications(product_a, product_b)` — Shared applications between products
- `get_product_comparison(product_a, product_b)` — Side-by-side property comparison from graph

### Feature 3: `kg-entity-search`
General entity search:
- `search_entities(query, entity_type=None, limit=20)` — Text search over entity names/aliases
- `get_entity_by_id(id)` — Direct entity lookup
- `get_entities_by_type(type, limit=50)` — List all entities of a given type
- Full-text index on `canonical_name` and `aliases` for fast search

### Feature 4: `kg-cypher-service`
Safe Cypher execution layer:
- Parameterized query builder (no string interpolation of user input)
- Query templates for common patterns
- Result mapping to Pydantic models
- Query timeout enforcement
- Logging of query plans for performance monitoring

## Dependencies
- Milestone 1 (Neo4j Foundation)
- Milestone 2 (KG Ingestion — data must be loaded)

## Acceptance Criteria
- [ ] Product queries return complete, typed responses in < 300ms
- [ ] Multi-hop traversal returns correct results in < 1s
- [ ] Entity search returns relevant results using full-text index
- [ ] All query methods use parameterized Cypher (no injection risk)
- [ ] Pydantic response models are defined for all return types
- [ ] Service is testable with mock/stub Neo4j sessions
