# Implementation Strategy: n8n-retrieval-webhook

## Database Changes
None.

## API Modifications
None — this is an n8n workflow, not backend code.

## n8n Workflow Design
- **Node 1**: Webhook (POST) — receives query payload
- **Node 2**: Set node — normalize input, set defaults
- Connect to classifier node (Feature 2)
- Final node: Respond to Webhook — return fused results + trace

## UI Components
None.

## Testing Approach
- Manual test: curl POST to webhook URL, verify response shape
- Integration test: backend sends request, receives valid response
- Test with n8n in test mode vs production mode
