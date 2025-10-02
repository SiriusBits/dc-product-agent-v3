# UUID Remediation and Guardrails Plan

Goals

* doc_id: Unique per product, consistent across base and derived, propagated to knowledge_graph provenance.
* source_file_hash: Every base extract has a valid SHA-256 for its source PDF.
* entity.id: Valid UUIDs, globally unique across the corpus, with triples referencing existing entity IDs.

## Phase 0 — Prep

- [x] Backup gold/build (optional)
  * Latest backup: created under `reference/backups/` (timestamped)
- [x] Confirm roots:
  * Raw PDFs: `data/raw_pdfs` (present)
  * Base YAML: `reference/gold/base_extraction_yaml` (present)
  * Derived YAML: `reference/gold/derived_info_yaml` (present)

## Phase 1 — Normalize doc_id everywhere

* [x] Deterministic doc_id at assemble/ingest (UUID5 by normalized filename stem)
* [x] Update YAML doc_id in-place (base + derived) to deterministic
  * Command run: `pnpm yaml:docids`
* [x] Refresh gold JSON from YAML
  * Command run: `pnpm gold:refresh`
* [x] Rebuild build JSON (optional)
  * Command run: `pnpm ingest:assemble`
* [x] Audit duplicates (by product)
  * Command run: `pnpm audit:doc-ids` (clean)
* [x] Enforce provenance.document_id equals product doc_id (derived)
  * Added: `backend/extract_validator/check_provenance_doc_ids.py`
  * Commands run: `pnpm audit:provenance` → mismatches found; `pnpm fix:provenance`; `pnpm audit:provenance` → clean

## Phase 2 — PDF hash presence and correctness

* [x] Implemented `backend/extract_validator/compute_source_hashes.py` to compute/verify `source_file_hash.sha256`
* [x] Added pnpm script `audit:pdf-hashes` (validate mode, fails on missing/mismatch)
* [x] Added CI step to run the audit on build outputs
* Audit results are now clean after fixing YAML hashes and refreshing JSON

## Phase 3 — Global uniqueness and stability for entity IDs

* [x] Implemented `fix_entity_ids.py` to rewrite entity.id deterministically and update triple refs
  * id = UUID5("dc-product-agent:entity:{doc_id}:{type}:{canonical or text}")
* [x] Added `pnpm fix:entity-ids` and `pnpm audit:entity-ids` (UUID format, uniqueness, reference integrity)
* Results: entity/audit clean after fix

## Phase 4 — CI and Ingest Guardrails

* [x] CI includes: assemble, ingest, chunk and KG schema checks, format-only normalizers + diff, Prettier/Ruff/Black, doc_id audit, audit:pdf-hashes
* [x] CI now also runs: `audit:provenance`, `audit:entity-ids`
* [x] Ingest: added `--audit` flag to run provenance and entity ID audits post-emit
* [ ] Ingest: optional `--fix-provenance` (deferred; standalone fixer available)

## Phase 5 — One-time migration steps

* pnpm yaml:docids
* pnpm gold:refresh and pnpm ingest:assemble
* Implement and run provenance fixer; refresh JSON again
* Implement and run entity ID fixer; re-assemble and ingest; run audits
* make validate and optionally pnpm chat:bootstrap

## Acceptance Criteria

* doc_id unique and consistent; provenance matches doc_id in derived
* Every base JSON has a valid source_file_hash matching the actual PDF
* All entity IDs are valid UUIDs, globally unique, and triple refs resolve
* CI runs audits and fails on violations

## Current Commands

* pnpm yaml:docids — refresh YAML doc_id deterministically
* pnpm gold:refresh — rebuild gold JSON
* pnpm ingest:assemble — build JSON
* pnpm ingest:run:clean — clean and ingest (embeddings and KG)
* pnpm audit:doc-ids — doc_id audit
* make validate — end-to-end local validation

## Planned Commands (to add)

* pnpm audit:provenance — provenance doc_id consistency
* pnpm audit:pdf-hashes — PDF hash presence and match
* pnpm fix:entity-ids and pnpm audit:entity-ids — entity ID rewrite and verification
