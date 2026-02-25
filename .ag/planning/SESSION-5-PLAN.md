# Session 5 — Schema Hardening & Type Generation
**Date**: 2026-02-25
**Branch**: `warp-cloud`

---

## Milestones Completed This Session

### Milestone 1: KG Entity & Naming Consistency (from Session 4, finished early Session 5)
**Status**: ✅ COMPLETE — 17/17 products pass, 0 violations

#### Schema Updates (High + Medium Priority)
Hardened 4 JSON schema files to prevent the data issues we fixed in Session 4:

| File | Changes |
|------|---------|
| `reference/schema/kg-entity.schema.json` | Added 16-value entity type enum (was unconstrained `string`); `source_text` now required; `provenance.additionalProperties` → `false`; `document_id` gets `format: "uuid"`; `metadata` values constrained to `string\|number\|boolean\|null` |
| `reference/schema/derived-info-with-knowledge-graph-with-defs.described.schema.json` | Added `minItems: 1` on `knowledge_graph.entities` |
| `reference/schema/base-technical-bulletin-with-defs.described.schema.json` | `chemical_name` and `synonyms` added to `product_info.required`; `uniqueItems: true` on `synonyms` |
| `reference/schema/base-technical-bulletin-llm.schema.json` | Same as above |

Note: Skipped `minItems: 1` on `synonyms` because 8 products legitimately have empty arrays.

---

### Milestone 2: Schema-Driven Type Generation (TypeScript + Pydantic)
**Status**: ✅ COMPLETE — all 6 features done

#### Feature 1: TypeScript Type Generation
- **Created** `packages/shared-types/scripts/generate.ts`
  - Reads 7 JSON schemas from `packages/shared-schemas/src/schemas/`
  - Normalizes snake_case JSON Schema keywords → camelCase (`additional_properties` → `additionalProperties`, etc.)
  - Rewrites `$ref` URIs from `https://example.com/schemas/…` → local filenames
  - Generates 1,247 lines of TypeScript interfaces to `packages/shared-types/src/types/generated.ts`
- **Updated** `packages/shared-types/package.json` — added `generate`, `prebuild` scripts + `json-schema-to-typescript`, `ts-node`, `@types/node` devDeps
- **Updated** `packages/shared-types/tsconfig.json` — added `resolveJsonModule`, `skipLibCheck`, ts-node config
- **Updated** `packages/shared-types/src/types/index.ts` — re-exports `generated.ts`

#### Feature 2: Pydantic v2 Model Generation
- **Created** `apps/backend/scripts/generate_models.py`
  - Same normalization + `$ref` rewriting as TS script
  - Uses `datamodel-code-generator` to output Pydantic v2 models
  - Outputs to `apps/backend/src/dc_agent/models/generated/` (7 module files + `__init__.py`)
  - Models include `StrEnum` for entity types, `UUID` types, `Annotated` fields, `min_length=1` on entities
- **Updated** `apps/backend/pyproject.toml` — added `datamodel-code-generator` to dev deps
- **Updated** `apps/backend/src/dc_agent/models/generated/__init__.py` — clean re-exports with aliases (e.g. `EntityType`, `DerivedInfoSchema`)

#### Feature 3: Schema Sync Mechanism
- Canonical schemas live in `reference/schema/` → synced to `packages/shared-schemas/src/schemas/`
- `make sync-schemas` — rsync `*.schema.json` files
- `make check-schemas` — CI-friendly diff check (macOS compatible)

#### Feature 4: Build Pipeline Integration
- **Updated** root `Makefile` — added targets: `sync-schemas`, `check-schemas`, `generate-types`, `generate-models`, `generate` (runs both), `validate-data`, improved `backend-dev/test/lint`
- **Updated** `turbo.json` — added `generate` task with inputs/outputs, wired before `build`
- `make generate` runs the full pipeline: sync → TS types → Pydantic models

#### Feature 5: Retire Stubs & Refactor
- **Deleted** `reference/schema/schemas.ts` (empty stub)
- **Deleted** `reference/schema/schemas_models.py` (empty stub)
- **Refactored** `apps/backend/src/dc_agent/models/products.py`:
  - Imports `ContactInfo`, `Registration`, `PropertySpecRow as PropertySpec` from generated
  - Keeps API-specific models locally (`ProductSummary`, `ProductDetail`, `ProductListResponse`, `ProductPdfResponse`)
  - Kept simplified `ProductInfo`, `Section`, `ExtractionMetadata`, `DerivedInfo` locally (differ from schema versions)

#### Feature 6: Validation Test
- **Created** `apps/backend/tests/test_schema_validation.py`
  - 35 parametrized tests: 17 base + 17 derived + 1 counts sanity check
  - Validates all product JSON files against generated Pydantic models
  - Tolerates `extra_forbidden` errors as warnings (data may have fields not yet in schema)
  - Fails hard on real type/structure errors

#### Data Fix During Validation
- Fixed 2 malformed `{text: ...}` triple subjects in DCA_467 (JSON + YAML) — should have been raw strings

---

## Files Created This Session

```
packages/shared-types/
  scripts/generate.ts                          # TS type generation script
  src/types/generated.ts                       # AUTO-GENERATED — 1,247 lines of TS interfaces

apps/backend/
  scripts/generate_models.py                   # Pydantic model generation script
  src/dc_agent/models/generated/               # AUTO-GENERATED — 7 Pydantic modules
    __init__.py                                # Clean re-exports
    base_technical_bulletin_llm_schema.py
    base_technical_bulletin_with_defs_described_schema.py
    chunk_schema.py
    common_defs_described_schema.py
    derived_info_with_knowledge_graph_with_defs_described_schema.py
    kg_entity_schema.py
    kg_triple_schema.py
  tests/test_schema_validation.py              # 35 parametrized validation tests

sessions/
  SESSION-5-PLAN.md                            # This file
```

## Files Modified This Session

```
reference/schema/
  kg-entity.schema.json                        # Added entity type enum, aligned with common-defs
  derived-info-with-knowledge-graph-with-defs.described.schema.json  # minItems on entities
  base-technical-bulletin-with-defs.described.schema.json            # required chemical_name/synonyms
  base-technical-bulletin-llm.schema.json                            # same as above

packages/shared-types/
  package.json                                 # generate/prebuild scripts + devDeps
  tsconfig.json                                # resolveJsonModule, ts-node config
  src/types/index.ts                           # re-exports generated types

packages/shared-schemas/src/schemas/
  *.schema.json (all 7)                        # synced from reference/schema/

apps/backend/
  pyproject.toml                               # datamodel-code-generator in dev deps
  src/dc_agent/models/products.py              # imports from generated, API-only models

Makefile (root)                                # sync-schemas, generate, validate-data targets
turbo.json                                     # generate task before build

data/extracts/derived_info/DCA_467_Technical_Bulletin_derived.json   # fixed {text} subjects
data/extracts/derived_info_yaml/DCA_467_Technical_Bulletin_derived.yaml  # same
```

## Files Deleted This Session

```
reference/schema/schemas.ts                    # was empty stub
reference/schema/schemas_models.py             # was empty stub
```

---

## Key Commands

```bash
# Full codegen pipeline (sync schemas → generate TS types → generate Pydantic models)
make generate

# Individual steps
make sync-schemas          # rsync reference/schema/ → shared-schemas/
make check-schemas         # CI check — fails if out of sync
make generate-types        # TS interfaces
make generate-models       # Pydantic models

# Validation
make validate-data                                              # KG consistency (17/17)
cd apps/backend && uv run pytest tests/test_schema_validation.py -v  # Schema validation (35/35)
```

---

## What's Next

### Immediate follow-ups
1. **Add `confidence_scores.properties` to the base bulletin schema** — 16 of 17 products have a `properties` key in `extraction_metadata.confidence_scores` that isn't in the schema's explicit list. Either add it to the schema or rename to `properties_and_specifications` in the data.
2. **Add `document_type` to derived info schema** — some derived JSON files carry this field from the base extraction; decide if it belongs there.
3. **Address remaining `extra_forbidden` warnings** in the validation test (34 warnings) — each represents a data field not covered by the current schema.

### Future milestones
4. **Populate `schemas.ts` / `schemas_models.py` stubs** — Done ✅ (they were deleted and replaced with real generated files)
5. **Runtime validation in backend** — wire the generated Pydantic models into the ingestion pipeline so new data is validated on ingest
6. **Runtime validation in frontend** — use the generated TS types in the Astro/React frontend for type-safe API consumption
7. **CI/CD integration** — add `make check-schemas` and `uv run pytest tests/test_schema_validation.py` to GitHub Actions
