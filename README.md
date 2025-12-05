# DC Product Agent v3

A product agent application featuring a PDF extraction pipeline, a Knowledge Graph (Neo4j) + Vector Store (ChromaDB) backend, and a React/Astro frontend.

## Prerequisites

- Docker & Docker Compose
- Node.js & pnpm
- Python 3.11+ & uv

## Quick Start

### 1. Start Databases
Start Neo4j and ChromaDB containers:
```bash
docker-compose up -d
```

### 2. Start Backend
The backend runs on port 8001.
```bash
cd apps/backend
uv run uvicorn src.dc_agent.main:app --port 8001 --reload
```

### 3. Start Frontend
The frontend runs on port 4321 (proxies API requests to backend).
```bash
cd apps/frontend
pnpm dev
```

## Accessing the App

- **Frontend**: Open [http://localhost:4321](http://localhost:4321) in your browser.
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Neo4j Browser**: [http://localhost:7474](http://localhost:7474) (Default login: neo4j/password)

## Data Ingestion

To ingest reference data into the databases:
```bash
cd apps/backend
uv run python scripts/ingest_reference_data.py
```
