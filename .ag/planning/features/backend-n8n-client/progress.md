# Progress: backend-n8n-client

## Subtasks
- [x] Add N8N_WEBHOOK_URL to config.py Settings
- [x] Define OrchestrationResult, ContextBlock, TraceMetadata models (models/n8n.py)
- [x] Implement N8nRetrievalClient with httpx (services/n8n_client.py)
- [x] Add timeout and retry logic
- [x] Implement fallback to direct vector search (ChatService._retrieve)
- [x] Add trace metadata logging (INFO level in N8nClient.retrieve)
- [ ] Write unit tests with mocked responses
- [ ] Write integration test with running n8n
