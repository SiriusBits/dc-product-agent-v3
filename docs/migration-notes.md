# Migration Notes: pdf-data-extractor Utility

This document captures the changes needed for downstream projects (e.g., `dc-product-agent-v2`) after extracting the reusable PDF tooling into this repository.

## Dependency Integration

* Add a direct dependency on this repo in the downstream `pyproject.toml`, for example:
  ```toml
  pdf-data-extractor-utility = { url = "file:///Users/benjaminbykowski/projects/ai-apps/forks/qwen-dc-product/dc-product-agent" }
  ```
  or replace with the appropriate path/URL in CI.
* Run `uv sync` after updating dependencies.

## Makefile Targets

The following targets are now available (and already wired into `dc-product-agent-v2/backend/Makefile`):

* `make metadata-export` – writes per-PDF metadata JSON to `data/pdf_metadata/`.
* `make metadata-sync` – back-fills `document_file_metadata` inside base JSON/YAML using the raw PDFs.
* `uv run pdf-data-extractor ingest ...` – use in CI or scripts to regenerate JSON from YAML once YAML-first extracts become available.

## Validation Workflow

Downstream CI can call the new CLI commands:

```bash
uv run pdf-data-extractor validate data/base_extraction --schema-dir data/schema
uv run pdf-data-extractor ingest --base-yaml-dir data/base_extraction_yaml --output-dir data/base_extraction --pdf-root data/raw_pdfs --schema-dir data/schema
```

Use these commands after updating YAML or PDF content to keep the JSON artifacts in sync and validated.

## Housekeeping

* Generated metadata (`data/pdf_metadata/`) should be ignored in downstream repos (updated in `dc-product-agent-v2/.gitignore`).
* Legacy scripts (`backend/extract_validator/*`, `tools/build_extracts.py`, pnpm commands) have been removed; use the CLI instead.
* Refer back here when onboarding new ingestion pipelines so that UUID generation, SHA hashes, and metadata enrichment come from the utility rather than LLM output.
