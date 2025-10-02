# LLM Self-Validation Prompt (Minimal)

You will generate YAML for a product technical bulletin extraction. Your output must be valid YAML and conform to the provided JSON Schema (base or derived). Use placeholders like `${manufacturer.name}` only where expected. Do not include prose outside YAML.

Process:

* Produce YAML for the requested schema (base or derived).
* Then run the validator locally (simulated) and revise until validation passes.

Validation command (example):

* Base (from stdin):
  echo "<YAML>" | python3 backend/extract_validator/llm_self_validate.py --type base --stdin --schema-dir reference/gold/schema --constants reference/gold/config/constants.yaml
* Derived (from stdin):
  echo "<YAML>" | python3 backend/extract_validator/llm_self_validate.py --type derived --stdin --schema-dir reference/gold/schema --constants reference/gold/config/constants.yaml

If validation fails, you will receive a structured error list. Fix the YAML and try again until the report shows `"ok": true`.

Tips:

* Include all required top-level properties with `null` when unknown.
* Provide `images[*].description` and table `description` fields.
* For derived knowledge_graph entities, include `source_text` and `provenance`.


