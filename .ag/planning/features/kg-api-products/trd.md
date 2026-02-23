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
