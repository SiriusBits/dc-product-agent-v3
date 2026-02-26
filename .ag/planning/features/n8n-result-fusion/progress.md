# Progress: n8n-result-fusion

## Subtasks
- [x] Implement Merge node in n8n workflow
- [x] Implement fusion Code node (dedup, score, sort) — 3 nodes: vector, KG, hybrid
- [x] Define context_block output schema (N8nResultItem model)
- [x] Add workflow variables for weights (staticData: vector_weight=0.6, kg_weight=0.4)
- [x] Handle single-source passthrough (vector-only and KG-only paths)
- [ ] Test with overlapping results (requires running containers)
- [ ] Test weight tuning (requires running containers)
