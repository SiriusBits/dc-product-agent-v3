# Batch Feature Generation

When generating features for an entire milestone, you can call the script in a loop.

## Example: Generate from a list

```bash
SCRIPT=".ag/skills/generate-features/scripts/generate_feature.sh"
MILESTONE="M2 — KG Data Ingestion Pipeline"

bash "$SCRIPT" \
  --name "kg-entity-ingestion" \
  --milestone "$MILESTONE" \
  --requirements "Parse entities from derived YAML and create Neo4j nodes." \
  --acceptance "Entity type mapped to node label,Entity id used as MERGE key,Provenance attached"

bash "$SCRIPT" \
  --name "kg-triple-ingestion" \
  --milestone "$MILESTONE" \
  --requirements "Parse kg_triples and create Neo4j relationships." \
  --acceptance "Predicate mapped to relationship type,Polymorphic objects handled"
```

## Example: Generate from a CSV-like input

```bash
SCRIPT=".ag/skills/generate-features/scripts/generate_feature.sh"

while IFS='|' read -r name milestone requirements; do
  bash "$SCRIPT" \
    --name "$name" \
    --milestone "$milestone" \
    --requirements "$requirements"
done << 'DATA'
feature-alpha|M1 — Foundation|Build the foundation layer
feature-beta|M1 — Foundation|Add schema validation
feature-gamma|M2 — Ingestion|Create data pipeline
DATA
```

## Tips

- Use `--dry-run` first to verify what will be created
- Use `--force` when regenerating after template changes
- Pipe the output to a log file for audit: `bash script.sh ... >> feature-gen.log`
