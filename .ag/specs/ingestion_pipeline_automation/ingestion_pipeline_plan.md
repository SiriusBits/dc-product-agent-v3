# Ingestion Pipeline Implementation Plan

## Goal
Implement a full ingestion pipeline that automates the population of the Vector Database (Chroma) and Knowledge Graph (Neo4j) with product data. This includes:
1.  **Database Seeding**: Loading existing validated data from the `reference` directory into the databases.
2.  **Extraction Pipeline**: Implementing the LLM-based workflow to process new PDFs (PDF -> LLM -> YAML -> JSON -> LLM -> YAML -> JSON).

## User Review Required
> [!IMPORTANT]
> The "Human Validation" step in the extraction pipeline is critical. The current plan assumes an asynchronous workflow where the pipeline pauses or outputs to a "pending" directory for human review before proceeding.

## Proposed Changes

### Phase 1: Data Migration & Database Seeding (Automating `seed_db.py`)
This phase focuses on getting the existing 17 processed products into the database.

#### 1. Data Migration
- **Action**: Copy the contents of `reference/base_extraction`, `reference/derived_info`, `reference/pdfs`, and `reference/images` to `data/extracts`.
- **Destination Structure**:
    - `data/extracts/base_extraction/*.json`
    - `data/extracts/derived_info/*.json`
    - `data/extracts/pdfs/*.pdf`
    - `data/extracts/images/*`

#### 2. Implement `seed_db_full.py`
- **Location**: `apps/backend/scripts/seed_db_full.py`
- **Logic**:
    - Iterate through `data/extracts/derived_info/*.json`.
    - For each file:
        - Load the corresponding `base_extraction` JSON (linked by `doc_id` or filename).
        - **Vector Store**:
            - Extract text chunks from `base_extraction` (e.g., `applications_text`, `key_benefits`, `product_info`).
            - Generate embeddings and add to Chroma.
        - **Knowledge Graph**:
            - Use `GraphitiKGStore` to ingest the aggregated text content as an "episode".
            - Graphiti automatically handles the extraction of entities and relationships from the text.
    - **Idempotency**: Ensure the script can be run multiple times without duplicating data (managed by Graphiti and Chroma IDs).

### Phase 2: Extraction Pipeline Implementation
This phase implements the workflow for processing *new* PDFs.

#### 1. LLM Client Setup
- **Location**: `apps/pdf-extractor/backend/llm.py` (New)
- **Logic**:
    - Setup client for "powerful LLM" (e.g., Gemini 1.5 Pro or GPT-4o) which supports long context and vision.
    - Implement retry logic and rate limiting.

#### 2. Base Extraction (PDF -> YAML)
- **Location**: `apps/pdf-extractor/backend/extract_base.py` (New)
- **Input**: Raw PDF file.
- **Process**:
    - Read `docs/prompts/base_extraction_prompt.md`.
    - Read schemas: `common-defs.described.schema.json`, `base-technical-bulletin-llm.schema.json`.
    - Construct prompt with PDF content (as text or multimodal input).
    - Call LLM.
    - Output: `data/extracts/base_extraction_yaml/{filename}_base.yaml`.

#### 3. Base Ingestion (YAML -> JSON)
- **Existing Tool**: Use `apps/pdf-extractor/backend/ingest.py` (via CLI `ingest` command).
- **Action**: Convert validated YAML to JSON in `data/extracts/base_extraction`.

#### 4. Derived Info Extraction (JSON -> YAML)
- **Location**: `apps/pdf-extractor/backend/extract_derived.py` (New)
- **Input**: Validated Base JSON.
- **Process**:
    - Read `docs/prompts/derived_info_prompt.md`.
    - Read schemas: `derived-info-with-knowledge-graph-with-defs.described.schema.json`, `kg-entity.schema.json`, `kg-triple.schema.json`.
    - Construct prompt with Base JSON content.
    - Call LLM.
    - Output: `data/extracts/derived_info_yaml/{filename}_derived.yaml`.

#### 5. Derived Ingestion (YAML -> JSON)
- **Existing Tool**: Use `apps/pdf-extractor/backend/ingest.py` (via CLI `ingest` command).
- **Action**: Convert validated YAML to JSON in `data/extracts/derived_info`.

### Phase 3: Integration & Workflow
- **Master Script**: `apps/backend/scripts/ingest_pdf.py`
- **Workflow**:
    1.  `python apps/backend/scripts/ingest_pdf.py --step base --input my.pdf` -> Outputs YAML.
    2.  (User manually validates/edits YAML).
    3.  `python apps/backend/scripts/ingest_pdf.py --step ingest-base --input my_base.yaml` -> Outputs JSON.
    4.  `python apps/backend/scripts/ingest_pdf.py --step derived --input my_base.json` -> Outputs YAML.
    5.  (User manually validates/edits YAML).
    6.  `python apps/backend/scripts/ingest_pdf.py --step ingest-derived --input my_derived.yaml` -> Outputs JSON.
    7.  `python apps/backend/scripts/seed_db_full.py` -> Loads into DB.

## Verification Plan

### Automated Tests
- **Unit Tests**:
    - Test `seed_db_full.py` with a mock Chroma/Neo4j to ensure it parses JSONs correctly.
    - Test `ingest.py` (existing) to ensure YAML->JSON conversion works.

### Manual Verification
- **Database Seeding**:
    - Run `seed_db_full.py`.
    - Check Neo4j Browser: `MATCH (n) RETURN count(n)` should show nodes.
    - Check Chroma: Query for a product name and ensure results are returned.
- **Extraction Pipeline**:
    - Run the pipeline on a *new* sample PDF.
    - Verify intermediate YAMLs are generated.
    - Verify final JSONs match the schema.
