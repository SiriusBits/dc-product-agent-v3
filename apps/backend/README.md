# DC Agent Backend

Backend API for Dixie Chemical Product Agent - an agentic RAG application for chemical product documentation.

## Setup

### Prerequisites

- Python 3.11+
- [UV](https://docs.astral.sh/uv/) for package management

### Installation

```bash
# Install dependencies
uv sync
```

## Data Ingestion

The backend uses ChromaDB for vector storage. Product data from the `data/extracts/` directory needs to be ingested before the API can answer queries.

### Source Data

The ingestion script processes two types of JSON extract files:

- **Base Extraction** (`data/extracts/base_extraction/*_base.json`): Contains structured product information extracted from PDFs including properties, specifications, sections, formulation data, and safety information.

- **Derived Info** (`data/extracts/derived_info/*_derived.json`): Contains AI-generated summaries, sales/technical personas, and key applications.

### Running Ingestion

```bash
# From the apps/backend directory:

# Basic ingestion (appends to existing data)
uv run python scripts/ingest_reference_data.py

# Clear existing data and ingest fresh
uv run python scripts/ingest_reference_data.py --clear

# Ingest and verify results
uv run python scripts/ingest_reference_data.py --clear --verify

# Only run verification (no ingestion)
uv run python scripts/ingest_reference_data.py --verify-only
```

### Chunk Types

The ingestion creates the following chunk types with rich metadata:

| Chunk Type | Source | Description |
|------------|--------|-------------|
| `product_info` | Base | Product overview (chemical name, CAS, family, synonyms) |
| `key_benefits` | Base | Key product benefits |
| `applications` | Base | Application descriptions and list |
| `properties` | Base | Properties and specifications with test methods |
| `section` | Base | Individual document sections (Handling, Storage, etc.) |
| `formulation` | Base | Formulation data with epoxy resin compatibility |
| `safety` | Base | Safety and toxicity information |
| `summary` | Derived | Comprehensive product summary |
| `persona_sales_summary` | Derived | Sales-focused product description |
| `persona_technical_summary` | Derived | Technical product description |
| `key_applications` | Derived | AI-identified key applications |

### Metadata Fields

Each chunk includes the following metadata for filtering:

- `product_id`: Short product identifier (e.g., "MHHPA_301")
- `product_name`: Full product name
- `chunk_type`: Type of content (see table above)
- `section`: Section name within the document
- `doc_id`: Source document UUID
- `filename`: Original PDF filename
- `page`: Page number (when available)

### Verification

Run the verification script to confirm all 17 products are properly indexed:

```bash
# Basic verification
uv run python scripts/verify_ingestion.py

# Detailed verification with per-product chunk counts
uv run python scripts/verify_ingestion.py --detailed

# Output results as JSON
uv run python scripts/verify_ingestion.py --json
```

The verification checks:
1. Total document count in ChromaDB
2. All 17 expected products are indexed
3. All expected chunk types are present
4. Sample queries return relevant results

### Expected Products

The system should contain data for these 17 products:

- AP-6G
- ASA_100, ASA_150, ASA_155
- CG
- DCA_221, DCA_467
- DCE_142
- DDSA
- ECA_1000L, ECA_100KA1, ECA_608
- JP-10
- MHHPA_301, MHHPA_NC
- NMA_(Achieved)
- ODSA

## Running the API

```bash
# Development server with hot reload
uv run uvicorn dc_agent.api.main:app --reload

# Or use the Makefile from project root
make backend-dev
```

## Testing

```bash
# Run tests
uv run pytest

# Run tests with coverage
uv run pytest --cov=dc_agent
```

## Project Structure

```
apps/backend/
├── scripts/
│   ├── ingest_reference_data.py  # Main ingestion script
│   ├── verify_ingestion.py       # Verification script
│   └── ...                       # Other utility scripts
├── src/
│   └── dc_agent/
│       ├── api/                  # FastAPI routes
│       ├── config.py             # Configuration settings
│       ├── kg/                   # Knowledge graph services
│       ├── models/               # Data models
│       ├── retrieval/            # Retrieval logic
│       ├── services/             # Business logic
│       └── vector/               # Vector store interface
│           ├── store.py          # Abstract base class
│           └── chroma.py         # ChromaDB implementation
└── pyproject.toml
```