# Feature: kg-api-search

## Milestone
M6 — KG API Endpoints

## Requirements
KG-powered search endpoints for entity search, application browsing, and relationship queries.

## Acceptance Criteria
- [ ] `POST /kg/search` — semantic search over knowledge graph
- [ ] `GET /kg/entities?type={type}&q={query}` — entity search with type filter
- [ ] `GET /kg/applications` — list all known applications
- [ ] `GET /kg/applications/{name}/products` — products for a given application
- [ ] All endpoints return Pydantic response models
- [ ] Pagination support where appropriate

## Dependencies
- kg-entity-search (M3)
