# Ingestion and Validation Pipeline — Workflow

This document shows how YAML extracts flow through assembly, validation, ingestion, and into downstream stores (embeddings + knowledge graph). It also includes the optional LLM self‑validation loop.

## Overview

* Source of truth is human/LLM‑authored YAML (base and derived).
* A self‑validation helper (optional) lets an LLM or a human quickly validate and fix YAML against the JSON Schemas before committing.
* Assembly compiles YAML → validated JSON with placeholder resolution, defaults, nested fill, key ordering, and deterministic `doc_id`.
* Ingest generates:
  * Embedding chunks (JSONL) for a vector index
  * Knowledge Graph entities/triples (JSONL)
  * A run report (counts, failures, paths)
* CI enforces quality gates: schema validation, format checks, chunk/KG tests, Prettier/Ruff/Black, and duplicate `doc_id` audits.

## Diagram

```mermaid
flowchart TD
    A[Author Extracts\n(Human or LLM)] --> B[Base/Derived YAML\nreference/gold/*_yaml]
    A2[LLM Self‑Validation (optional)\nbackend/extract_validator/llm_self_validate.py\nstdin/file inputs\nStructured error output] --> B

    B --> C[Format‑only Normalizers (idempotent)\nSections + Contact\nDerived formatting]

    C --> D[Assemble & Validate\nbackend/extract_validator/build_extracts.py\nPlaceholder resolution\nFill top‑level + nested\nApply defaults\nOrder keys by schema\nDeterministic doc_id (UUID5 by filename stem)]

    D --> E1[JSON (Base/Derived)\nreference/build/*]
    D -. gold refresh .-> E2[JSON (Base/Derived)\nreference/gold/*]

    subgraph Optional Taxonomy
      T1[Taxonomy YAMLs\nreference/gold/taxonomy/*.yaml]
      T2[Normalize string labels\nbackend/ingest/taxonomy_normalizer.py]
    end

    E1 -->|--normalize-taxonomy| T2 --> F[Ingest CLI\nbackend/ingest/ingest_extracts.py\nChunker (max-tokens/strategy)\nKG export + schema checks\nReport.json\nclean output option]

    F --> G1[Embeddings JSONL\nreference/ingest_out/embeddings/*.jsonl]
    F --> G2[KG JSONL\nreference/ingest_out/kg/entities.jsonl + triples.jsonl]

    subgraph Validation / Tests
      V1[Chunk schema check]
      V2[KG entity/triple schema check]
      V3[KG load test + sanity\n(NetworkX)]
      V4[Duplicate doc_id audit]
    end

    G1 --> V1
    G2 --> V2 --> V3
    E1 --> V4

    subgraph Pilot Integration
      P1[Chroma bootstrap\nbackend/chat/bootstrap_ingestion.py]
    end

    G1 --> P1
    G2 --> P1

    subgraph CI (GitHub Actions)
      CI1[uv sync + pnpm]
      CI2[Assemble base/derived]
      CI3[Ingest (strict)]
      CI4[Format-only normalizers + git diff]
      CI5[pytest, ruff, black, prettier]
      CI6[KG load test + doc_id audit]
    end

    E1 --> CI2
    G1 --> CI3
    G2 --> CI6
    CI1 --> CI2 --> CI3 --> CI4 --> CI5 --> CI6
```

## Key Commands

* Validate YAML during authoring (LLM or human):
  * Base (stdin):
    * `echo "<YAML>" | uv run python3 backend/extract_validator/llm_self_validate.py --type base --stdin --schema-dir reference/gold/schema --constants reference/gold/config/constants.yaml`
  * Derived (stdin):
    * `echo "<YAML>" | uv run python3 backend/extract_validator/llm_self_validate.py --type derived --stdin --schema-dir reference/gold/schema --constants reference/gold/config/constants.yaml`
* Assemble + validate JSON:
  * `pnpm ingest:assemble`
* Refresh gold JSONs (deterministic doc_id):
  * `pnpm gold:refresh`
* Normalize taxonomy labels (optional, at ingest):
  * `pnpm ingest:run -- --normalize-taxonomy`
* Clean re‑ingestion (removes old embeddings/KG before writing):
  * `pnpm ingest:run:clean`
* Audit duplicate doc_id across products:
  * `pnpm audit:doc-ids`
* End‑to‑end local validation:
  * `make validate`
* Pilot bootstrap (load vector + KG stores):
  * `pnpm chat:bootstrap`

## Notes & Clarifications

* Deterministic doc_id: The assembler computes `doc_id` via UUID5 from the normalized filename stem (e.g., `AP-6G_Technical_Bulletin` → one UUID). This guarantees:
  * Base and derived for the same product share one `doc_id`.
  * Different products get different `doc_id`.
  * Reproducible across machines/runs.
* Why YAML files are not modified by assemble: `ingest:assemble` compiles YAML → JSON; it does not rewrite YAML. Use `pnpm yaml:docids` if you want to update `doc_id` within YAML files to match the deterministic scheme.
* Cleaning old outputs: When `doc_id` changes, existing embeddings/KG JSONLs can appear stale. Use `--clean-out` (or `pnpm ingest:run:clean`) to wipe old outputs before regenerating.
* CI gates: The pipeline runs assemble, ingest, chunk/KG schema checks, Loader sanity checks, Prettier/Ruff/Black, and a duplicate `doc_id` audit to catch regressions early.

## SOTA LLM Workflow (Recommended)


1. Generate base/derived YAML from the LLM using the prompt in `docs/llm_self_validate_prompt.md`.
2. Validate with the self‑validation helper and fix errors until `ok: true`.
3. Commit YAML to the gold folders.
4. Run assemble/ingest to produce JSON outputs, embeddings, and KG.
5. Bootstrap stores for a chat pilot; iterate based on retrieval/QA.


