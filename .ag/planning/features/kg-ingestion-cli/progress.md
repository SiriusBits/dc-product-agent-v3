# Progress: kg-ingestion-cli

## Subtasks
- [ ] Create `scripts/ingest_kg_data.py` with argparse
- [ ] Implement YAML file discovery and loading
- [ ] Wire up EntityIngester and TripleIngester
- [ ] Add --clear flag (calls wipe_and_reinit)
- [ ] Add --dry-run flag (validation only)
- [ ] Add progress bar (tqdm or rich)
- [ ] Add summary report output
- [ ] Add to Makefile as `make ingest-kg`
- [ ] Write integration tests
