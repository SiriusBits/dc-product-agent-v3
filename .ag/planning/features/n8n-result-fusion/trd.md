# Feature: n8n-result-fusion

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
n8n Code node that merges, deduplicates, and ranks results from multiple retrieval sources.

## Acceptance Criteria
- [ ] Deduplicates overlapping information (same product from both sources)
- [ ] Applies configurable weights (vector_weight, kg_weight as n8n workflow variables)
- [ ] KG results provide structured facts, vector results provide prose
- [ ] Output: ordered list of `context_blocks` with source attribution
- [ ] Fusion parameters editable in n8n UI without code changes
- [ ] Handles single-source results (vector-only or KG-only) as passthrough

## Dependencies
- n8n-retrieval-router (provides raw results from both sources)
