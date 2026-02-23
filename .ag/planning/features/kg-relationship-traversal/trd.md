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
