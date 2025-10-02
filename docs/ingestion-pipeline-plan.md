# Ingestion and Validation Pipeline Plan

## Objectives

* Provide a reproducible pipeline to compile YAML extracts into validated JSON ready for ingestion into:
  * A Chroma vector database (embeddings + metadata)
  * A knowledge graph store or export format (entities + triples)
* Make the pipeline easy for LLM-assisted extraction to self-validate against schemas.
* Support rapid, iterative schema hardening and normalization with clear quality gates.

## Scope

* Source-of-truth remains human-authored YAML with constants/placeholders.
* Build/assemble step resolves placeholders, fills defaults, normalizes and validates.
* Ingestion CLI produces:
  * Validated JSON extracts (base + derived)
  * Embedding chunks with provenance-rich metadata
  * Knowledge graph export (JSONL/NDJSON)
* Normalizers enforce consistency and allow safe placeholder substitution.


## Milestones and Checklists

### Milestone 1 — Baseline Builders + Formatters (existing, tighten where needed)

Deliverables:

* YAML → JSON assembler with placeholder resolution, defaults, nested-null handling, schema-ordering, and validation.
* Base + derived normalizers and converters.

Checklist:

- [x] Base assembler: `backend/extract_validator/build_extracts.py` (placeholders, defaults, nested fill, order, validate)
- [x] Base converters + formatters: `convert_base_json_to_yaml.py`, normalizers (sections/contact), spacing rules
- [x] Derived converter: `convert_derived_json_to_yaml.py` (filepath, extractor_version, ORG canonical, provenance ${doc_id})
- [x] Derived normalizer: `normalize_derived_yaml.py` (placeholders + formatting)
- [x] Schema updates per rules (Applications/Availability sections, Typical Properties, images/table descriptions)
- [x] Image caption enrichment pass for base YAMLs (fallback → human-friendly captions)

Acceptance:

- [x] All base/derived YAML compile to JSON (AP-6G validated end-to-end)
- [x] Spacing/ordering consistent with schema in YAML

Summary (Completed):

* Built and validated all base and derived YAMLs (17/17 each). Added a required-fields normalizer ensuring arrays, `other_tables` containment of Typical Properties, image descriptions, and an Availability section with a default sentence. Implemented a caption enrichment pass to replace fallback image descriptions with concise, human-friendly captions (including trends/ranges for graphs). Formatting is normalized idempotently.

### Milestone 2 — Ingest CLI (compile and emit ingest artifacts)

Deliverables:

* `backend/ingest/ingest_extracts.py` CLI:
  * Compiles YAML → JSON (using existing assembler)
  * Emits embedding chunks and KG export
  * Summary report (counts, failures, output paths)

Checklist:

- [x] Create `backend/ingest/ingest_extracts.py`
- [x] Accept inputs: `--base-yaml-dir`, `--derived-yaml-dir`, `--out`, `--schema-dir`, `--constants`, `--strict`
- [x] Call assembler per file; stop or skip on validation error based on `--strict`
- [x] Emit embedding chunks to `out/embeddings/*.jsonl`
- [x] Emit KG export to `out/kg/entities.jsonl` and `out/kg/triples.jsonl`
- [x] Emit run report `out/report.json`
- [x] Doc README for usage
- [x] PNPM scripts to run normalize → enrich-images → assemble → ingest

Acceptance:

- [x] Running end-to-end produces JSONLs and report with zero errors on pilot set

Summary (Completed):

* Implemented `ingest_extracts.py` and integrated with the assembler. Outputs embeddings JSONL, KG entities/triples JSONL, and a run report. Added PNPM scripts to execute normalize → enrich images → assemble → ingest with `--strict`. End-to-end run completes cleanly.

### Milestone 3 — Embedding Chunker

Deliverables:

* Pluggable chunker over base + derived JSON with heuristics and metadata.

Checklist:

- [x] Implement chunker module `backend/ingest/chunker.py`
- [x] Chunk base sections: `sections[*].text` with names and page
- [x] Chunk Typical/Spec tables: serialize rows (name, value, unit, method, page)
- [x] Chunk derived: `derived_info.summary`, `derived_info.personas.*`, and key applications (joined)
- [x] Metadata: `doc_id`, `source`, `page`, `node_path`, `filename`, `product_name` (if available)
- [x] Token-aware splitting knobs: `--max-tokens`, strategy (by lines/sentences)
- [x] Validate chunks against explicit JSON Schema
- [x] Add retrieval smoke tests to query embeddings JSONLs and print top chunks

Acceptance:

- [x] JSONL chunks validate against a simple chunk schema (id, text, metadata)
- [x] Spot check: representative queries retrieve relevant chunks

### Milestone 4 — Knowledge Graph Export

Deliverables:

* Deterministic export of KG nodes and triples with provenance.

Checklist:

- [x] Implement `backend/ingest/kg_export.py`
- [x] Export entities (id, type, canonical_name, aliases, provenance, metadata)
- [x] Export triples (subject, predicate, object, provenance, confidence)
- [x] Optional: map ORGANIZATION canonical_name placeholder to resolved constant at export time
- [x] Validate exported lines with lightweight schema (structural)

Acceptance:

- [x] Entities/triples validate structurally and export without errors; JSONLs are ready for loading.

### Milestone 5 — Taxonomy Normalization (optional but recommended)

Deliverables:

* Normalizers and canonical vocab files to unify common labels used in QA.

Checklist:

- [x] Add `reference/gold/taxonomy/applications.yaml`, `hazards.yaml`, `ppe.yaml`, `test_methods.yaml`
- [x] Implement normalizer `backend/ingest/taxonomy_normalizer.py` (map variants → canonical)
- [x] Apply normalization to base (applications) and derived triples (applications, hazards, PPE, test methods) when string-valued
- [x] Add `--normalize-taxonomy` flag to ingest CLI

Acceptance:

- [x] Canonical labels consistently present for normalized fields when enabled

### Milestone 6 — Self-Validation for LLM Workflows

Deliverables:

* Simple harness to let a multi-modal LLM generate YAML, run assembler+validator, and return errors inline.

Checklist:

- [x] Add script `backend/extract_validator/llm_self_validate.py` (invoke build steps and aggregate errors)
- [x] Provide `--stdin`/`--file` inputs and return structured error list
- [x] Example prompt template `docs/llm_self_validate_prompt.md` for LLM to self-correct based on schema violations

Acceptance:

- [x] Round-trip flow available: LLM produces YAML → validator returns structured errors → YAML can be corrected and validated to ok=true

### Milestone 7 — CI and Quality Gates

Deliverables:

* Automated checks for schema validation, formatting, and basic linting.

Checklist:

- [x] Add CI job (GitHub Actions) to run:
  - [x] Assemble base/derived YAMLs
  - [x] Validate JSON against schemas (via ingest run and loader checks)
  - [x] Run normalizers in `--format-only` mode and assert a clean diff
  - [x] Run unit tests for chunker and kg export
- [x] Fail PR on any validation or formatting drift

Acceptance:

- [x] CI green on main; failures point to actionable messages

### Milestone 8 — Pilot Integration with Chat Backend

Deliverables:

* Minimal ingestion hook in the chat backend to import JSONLs (embeddings + KG) and initialize stores.

Checklist:

- [x] Define embedding index schema for Chroma (`backend/chat/embed_store.py`)
- [x] Define KG load script for graph store or in-memory index (`backend/ingest/kg_load_test.py` reused + bootstrap)
- [x] Wire ingestion outputs into backend bootstrap scripts (`backend/chat/bootstrap_ingestion.py`)
- [x] Add a handful of golden queries for smoke tests (`docs/retrieval_prompts.txt`)

Acceptance:

- [x] Bootstrap script initializes vector index and KG; retrieval smoke tests succeed on golden prompts

### Milestone 9 — Iteration and Schema Hardening

Deliverables:

* Feedback loop to tighten schemas and normalizers.

Checklist:

- [ ] Add targeted constraints (e.g., require image descriptions, table descriptions)
- [ ] Expand derived predicates as needed (e.g., `measured_by`, `unit`)
- [ ] Add tests covering new constraints and normalizations
- [ ] Refresh YAMLs with normalizers as rules evolve

Acceptance:

- [ ] Reduced validation errors on new data; improved answer coverage


## Implementation Map (Files/Modules)

* Builders/validators (existing):
  * `backend/extract_validator/build_extracts.py`
  * `backend/extract_validator/json_schema_validator.py`
  * `backend/extract_validator/convert_base_json_to_yaml.py`
  * `backend/extract_validator/convert_derived_json_to_yaml.py`
  * `backend/extract_validator/normalize_yaml_sections_and_contact.py`
  * `backend/extract_validator/normalize_derived_yaml.py`
* New ingestion:
  * `backend/ingest/ingest_extracts.py` (new)
  * `backend/ingest/chunker.py` (new)
  * `backend/ingest/kg_export.py` (new)
  * `backend/ingest/taxonomy_normalizer.py` (new, optional)
  * `reference/gold/taxonomy/*.yaml` (new, optional)

## Validation Plan (Commands)

* Assemble + validate base:
  * `python3 backend/extract_validator/build_extracts.py --type base --in reference/gold/base_extraction_yaml --out reference/build/base_extraction -s reference/gold/schema -c reference/gold/config/constants.yaml`
* Assemble + validate derived:
  * `python3 backend/extract_validator/build_extracts.py --type derived --in reference/gold/derived_info_yaml --out reference/build/derived_info -s reference/gold/schema -c reference/gold/config/constants.yaml`
* Normalize formatting (idempotent):
  * Base: `python3 backend/extract_validator/normalize_yaml_sections_and_contact.py --in reference/gold/base_extraction_yaml --constants reference/gold/config/constants.yaml --format-only`
  * Derived: `python3 backend/extract_validator/normalize_derived_yaml.py --in reference/gold/derived_info_yaml --constants reference/gold/config/constants.yaml --schema-dir reference/gold/schema --format-only`

## Risks and Mitigations

* Over-constraining schemas may block ingestion: stage changes behind feature flags and test on pilots.
* Normalization drift: enforce idempotent normalizers and CI format checks.
* KG scope creep: maintain a small predicate set; expand only when driven by missed questions.

## Success Criteria

* YAML → JSON assembly and validation fully automated.
* Ingestion artifacts (embeddings, KG) generated reliably.
* Chat backend can answer golden queries with traceable provenance.

