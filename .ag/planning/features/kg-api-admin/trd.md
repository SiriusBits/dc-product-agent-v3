# Feature: kg-api-admin

## Milestone
M6 — KG API Endpoints

## Requirements
Admin and health endpoints for Neo4j, Graphiti, and n8n monitoring plus KG management operations.

## Acceptance Criteria
- [ ] `GET /kg/health` — Neo4j + Graphiti + n8n connection status
- [ ] `GET /kg/stats` — node/edge counts by type
- [ ] `POST /kg/reindex` — trigger re-ingestion of KG data
- [ ] `GET /kg/traces/recent` — recent n8n execution traces for debugging
- [ ] Health endpoint returns structured status per dependency

## Dependencies
- All M1-M5 components
