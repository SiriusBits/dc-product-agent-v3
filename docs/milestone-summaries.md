# Milestone Summaries

## Milestone 1 — Baseline Builders + Formatters (Completed)

* Assembler: Compiles base/derived YAML to JSON with placeholder resolution, defaults, nested-null handling, schema ordering, and validation.
* Normalizers: Base sections/contact formatting; derived formatting and placeholders.
* Schema updates: Reinforced Applications/Availability, Typical Properties, images/table descriptions.
* Required-fields normalizer: Ensures arrays (applications, benefits, registrations, images), injects `Typical Properties` into `other_tables`, adds/repairs `Availability` section with standardized text (Pasadena, TX), and image descriptions.
* Image caption enrichment: Replaces fallback descriptions; for graphs, summarizes axes, trend, and value ranges.
* Status: 17/17 base and 17/17 derived validated end-to-end.

## Milestone 2 — Ingest CLI (Completed)

* CLI: `backend/ingest/ingest_extracts.py` compiles YAML → JSON, emits embeddings and KG export, and writes a run report.
* Outputs: `out/embeddings/*.jsonl`, `out/kg/entities.jsonl`, `out/kg/triples.jsonl`, `out/report.json`.
* PNPM pipeline: `ingest:normalize` → `ingest:enrich-images` → `ingest:assemble` → `ingest:run`.
* Status: End-to-end ingest completes with zero errors on the pilot set.

## Milestone 3 — Embedding Chunker (Completed)

* Chunker: `backend/ingest/chunker.py` with sentence/line token-aware splitting; chunks base sections and properties/spec rows; derived summary/personas/applications.
* Chunk schema: Explicit JSON Schema used to validate emitted chunks (id, text, metadata core fields).
* Defaults: `--max-tokens 256`, `--split-strategy sentences` (configurable via PNPM pass-through).
* Retrieval smoke tests: Added `backend/ingest/retrieval_smoke_test.py` and `docs/retrieval_prompts.txt`; run with `pnpm ingest:test-retrieval` to print top-k matches for sample prompts.
* Summary: Chunker integrated, explicit schema validation in place, and retrieval smoke tests pass on representative prompts.

## Milestone 4 — Knowledge Graph Export (Completed)

* Exporter: `backend/ingest/kg_export.py` normalizes entities (id, text, type, canonical_name, aliases, provenance, metadata) and triples (subject, predicate, object, provenance, confidence), unwrapping nested entity references.
* Schemas: `reference/gold/schema/kg-entity.schema.json` and `kg-triple.schema.json` for structural validation.
* Ingest integration: `backend/ingest/ingest_extracts.py` validates and emits `kg/entities.jsonl` and `kg/triples.jsonl`.
* Loader test: `backend/ingest/kg_load_test.py` loads JSONLs into a NetworkX MultiDiGraph and reports counts. Example:
  * `python3 backend/ingest/kg_load_test.py --kg-dir reference/ingest_out/kg`
* Sanity checks: loader fails non-zero if the graph is empty or if essential predicates (e.g., `has_cas_number`, `has_application`, `has_manufacturer`) are missing.
* Summary: KG entities/triples normalized and schema-validated; artifacts load into the NetworkX test harness with basic graph sanity checks.

## Milestone 5 — Taxonomy Normalization (Completed)

* Taxonomy files: `reference/gold/taxonomy/*.yaml` for applications, hazards, PPE, and test methods.
* Normalizer: `backend/ingest/taxonomy_normalizer.py` maps variants → canonical labels.
* Ingest flag: `--normalize-taxonomy` applies normalization to base applications and derived triples with string-valued objects (`has_application`, `has_hazard`, `requires_ppe`, test-method predicates).
* Summary: Canonical labels are applied consistently when normalization is enabled, improving retrieval and downstream QA.

## Milestone 6 — Self-Validation for LLM Workflows (Completed)

* Script: `backend/extract_validator/llm_self_validate.py` validates base/derived YAML from `--file` or `--stdin` after assembler-style transforms; emits structured JSON with errors.
* Prompt: `docs/llm_self_validate_prompt.md` provides a minimal prompt and command examples for a round-trip correction loop.
* Summary: Self-validation flow enables rapid iteration: YAML → validate → fix until `ok=true` for both base and derived schemas.

## Milestone 7 — CI and Quality Gates (Completed)

* CI: `.github/workflows/ci.yml` sets up uv and pnpm, assembles base/derived, runs unit tests, ingests (chunks + KG), runs format-only normalizers, checks for a clean diff, loads KG with sanity checks, and runs Python linting (ruff/black --check). Caches uv and pnpm stores for faster builds.
* Unit tests: `tests/test_chunker.py`, `tests/test_kg_export.py`.
* Summary: Automatic validation runs on pushes and PRs; any schema, lint, or formatting drift fails the build with actionable messages.

## Milestone 8 — Pilot Integration with Chat Backend (Completed)

* Vector index: `backend/chat/embed_store.py` loads embeddings JSONLs into a Chroma collection (`products`) with provenance-rich metadata.
* KG bootstrap: `backend/chat/bootstrap_ingestion.py` initializes Chroma and loads KG JSONLs (reusing the loader), reporting counts and top predicates.
* Scripts: `pnpm chat:bootstrap` to initialize stores from `reference/ingest_out` artifacts.
* Golden prompts: `docs/retrieval_prompts.txt` used for smoke validation.
* Summary: Minimal ingestion hook in place; artifacts are loadable into vector and KG stores for pilot chat integration.


