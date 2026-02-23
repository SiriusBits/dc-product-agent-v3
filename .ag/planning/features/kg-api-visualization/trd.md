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
