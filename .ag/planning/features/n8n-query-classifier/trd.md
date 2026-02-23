# Feature: n8n-query-classifier

## Milestone
M5 — n8n Retrieval Orchestration & Hybrid Retrieval

## Requirements
n8n node(s) that classify incoming queries into retrieval strategies (vector, KG, hybrid) using rule-based patterns with optional LLM fallback.

## Acceptance Criteria
- [ ] Rule-based classification via n8n Code node
- [ ] Relationship keywords → KG ("related to", "family", "compare", "CAS number", "sibling")
- [ ] Structured lookup patterns → KG ("what is the [property] of [product]")
- [ ] General/open-ended → Vector ("tell me about", "explain", "describe", "what is")
- [ ] Multi-product + property → Hybrid
- [ ] Optional LLM fallback for ambiguous queries (via Ollama HTTP call)
- [ ] Classification result + confidence stored in trace metadata
- [ ] Switch node routes to appropriate downstream path

## Dependencies
- n8n-retrieval-webhook (workflow context)

## Notes
- Start with rule-based only; LLM fallback is an enhancement
- Classification should be fast (< 50ms for rule-based)
