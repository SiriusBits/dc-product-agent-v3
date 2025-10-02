# Validation Workflows

This guide summarizes the end-to-end steps for validating extracts produced by an LLM and the deterministic utilities.

## Base Extraction Validation

1. **Collect YAML from the LLM**: save the LLM response to a directory (e.g., `reference/work/base_yaml/`). YAML can include `${...}` placeholders that map to constants.
2. **Run the ingest command**:
   ```bash
   uv run pdf-data-extractor ingest \
     --base-yaml-dir reference/work/base_yaml \
     --output-dir reference/work/base_json \
     --pdf-root data/raw_pdfs \
     --schema-dir reference/gold/schema
   ```
   This converts YAML → JSON, merges the deterministic metadata (UUID, filepaths, hashes, PDF metadata), and validates against `base-technical-bulletin-with-defs.described.schema.json`.
3. **Review output**: JSON will be written to `reference/work/base_json`. The command fails with validation errors if any schema rule is violated.
4. **Optional**: use `make ingest` to run the same command against the gold directories.

## Derived Info Validation

1. **Obtain derived JSON/YAML from the LLM**. If the model emits YAML, convert to JSON (or eventually provide a helper) so the validator can run.
2. **Validate against the derived schema**:
   ```bash
   uv run pdf-data-extractor validate reference/work/derived_json \
     --schema-dir reference/gold/schema --schema-type derived
   ```
   or use `make validate-derived` to check the gold artifacts.
3. **Iterate**: address reported schema violations and rerun until the command exits cleanly.

## Tips

- Keep LLM runs deterministic by providing the schemas and clear prompts.
- Use `docs/prompts/base_extraction_prompt.md` and `docs/prompts/derived_info_prompt.md` as starting points for instructions.
- Each step can be automated in CI by running the same CLI commands.
