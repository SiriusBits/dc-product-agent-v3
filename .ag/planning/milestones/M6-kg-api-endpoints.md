# Milestone 6: KG API Endpoints

## Goal
Expose knowledge graph capabilities through well-typed FastAPI endpoints.

## Context
The current API (`apps/backend/src/dc_agent/api/routes.py`) has a minimal `/query-kg` endpoint that proxies to Graphiti search. Product endpoints exist but are backed by ChromaDB metadata. This milestone adds dedicated KG-powered endpoints.

## Features

### Feature 1: `kg-api-products`
Product graph endpoints:
- `GET /kg/products/{name}/relationships` — All relationships for a product
- `GET /kg/products/{name}/related` — Related products (via shared applications, family, etc.)
- `GET /kg/products/{name}/family` — Product family tree
- `GET /kg/products/compare?a={name}&b={name}` — Product comparison from graph data

### Feature 2: `kg-api-search`
KG-powered search endpoints:
- `POST /kg/search` — Semantic search over the knowledge graph
- `GET /kg/entities?type={type}&q={query}` — Entity search with type filter
- `GET /kg/applications` — List all known applications
- `GET /kg/applications/{name}/products` — Products for a given application

### Feature 3: `kg-api-visualization`
Graph visualization data endpoints:
- `GET /kg/graph/product/{name}` — Subgraph centered on a product (nodes + edges for frontend rendering)
- `GET /kg/graph/overview` — High-level product relationship overview
- Response format compatible with common graph visualization libraries (nodes/edges with positions)

### Feature 4: `kg-api-admin`
Admin and health endpoints:
- `GET /kg/health` — Neo4j + Graphiti + n8n connection status
- `GET /kg/stats` — Node/edge counts by type
- `POST /kg/reindex` — Trigger re-ingestion of KG data
- `GET /kg/traces/recent` — Recent n8n execution traces for retrieval debugging

## Dependencies
- Milestone 3 (KG Query Service)
- Milestone 5 (n8n Retrieval Orchestration — for search endpoints and trace data)

## Acceptance Criteria
- [ ] All endpoints return well-typed Pydantic response models
- [ ] OpenAPI/Swagger docs are generated for all new endpoints
- [ ] Endpoints handle missing products/entities with proper 404 responses
- [ ] Visualization endpoints return data compatible with graph rendering
- [ ] Admin endpoints are accessible and return correct stats
- [ ] All endpoints include request validation
