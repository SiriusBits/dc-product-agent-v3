# n8n Retrieval Orchestration Workflows

## Overview

This directory contains version-controlled n8n workflow definitions for the
hybrid retrieval orchestration layer. The workflows route queries to the
appropriate backend retrieval services (vector search, knowledge graph, or
both) based on query intent classification.

## Workflow: Retrieval Orchestration

**File:** `workflows/retrieval-orchestration.json`

**Webhook URL:** `POST http://localhost:5678/webhook/retrieval`

### Architecture

```
[Webhook Trigger] → [Query Classifier] → [Intent Router]
                                              ├── vector  → [Vector Search] → [Fuse Vector]  → [Respond]
                                              ├── kg      → [KG Search + Graphiti] → [Fuse KG] → [Respond]
                                              └── hybrid  → [Vector + Graphiti]  → [Fuse Hybrid] → [Respond]
```

### Query Classification Rules

The classifier uses rule-based pattern matching (no LLM latency):

- **KG**: specific property lookups, product names, CAS numbers, safety data
- **Hybrid**: comparisons, relationships, multi-product queries
- **Vector**: conceptual/explanatory, "how does", "what is", process questions

The caller can also provide `intent_hint` to bypass classification.

### Request Format

```json
{
  "query": "What is the viscosity of DCA 221?",
  "top_k": 5,
  "conversation_id": "optional-uuid",
  "intent_hint": null
}
```

### Response Format

```json
{
  "results": [
    {
      "content": "...",
      "source": "DCA 221",
      "source_type": "vector|kg|graphiti",
      "score": 0.85,
      "product_name": "DCA 221",
      "metadata": {}
    }
  ],
  "metadata": {
    "execution_id": "n8n-exec-id",
    "intent": "kg",
    "sources_queried": ["kg", "graphiti"],
    "timing_ms": { "kg": 120 },
    "total_ms": 150
  }
}
```

## Importing Workflows

### Option 1: n8n UI (recommended)

1. Open the n8n UI at http://localhost:5678
2. Go to **Workflows** → **Import from File**
3. Select `workflows/retrieval-orchestration.json`
4. Click **Activate** to enable the webhook

### Option 2: CLI (requires container restart)

```bash
# Stop the n8n container
docker compose stop n8n

# Import the workflow
docker compose run --rm n8n n8n import:workflow --input=/tmp/retrieval-orchestration.json

# Start n8n again
docker compose start n8n
```

### Option 3: Copy and import during fresh start

```bash
# Copy workflow into container
docker cp n8n/workflows/retrieval-orchestration.json dc-product-agent-v3-n8n-1:/tmp/

# Restart n8n to release the DB lock, then import
docker compose restart n8n
docker exec dc-product-agent-v3-n8n-1 n8n import:workflow --input=/tmp/retrieval-orchestration.json
```

## Backend Integration

The backend's `ChatService` automatically routes through n8n when
`N8N_ENABLED=true` (default). If n8n is unreachable or the webhook times
out, it falls back transparently to direct vector search.

Configuration (in `.env`):

```
N8N_ENABLED=true
N8N_WEBHOOK_URL=http://localhost:5678/webhook/retrieval
N8N_TIMEOUT=10.0
```

## Exporting Workflows

To export the current workflow from a running n8n instance:

```bash
docker exec dc-product-agent-v3-n8n-1 n8n export:workflow --all --output=/tmp/workflows/
docker cp dc-product-agent-v3-n8n-1:/tmp/workflows/ n8n/workflows/
```
