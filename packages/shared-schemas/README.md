# Shared JSON Schemas

This package contains all JSON schemas used across the Dixie Chemical Product Agent v3 monorepo for data validation and API contract enforcement.

## Available Schemas

### API Schemas

- `api-response.schema.json` - Standard API response format
- `api-error.schema.json` - API error response format
- `chat-request.schema.json` - Chat API request format
- `chat-response.schema.json` - Chat API response format
- `product-search.schema.json` - Product search request format
- `kg-query.schema.json` - Knowledge graph query format
- `ingestion-request.schema.json` - Data ingestion request format

### Data Model Schemas

- `base-technical-bulletin-llm.schema.json` - Base PDF extraction format
- `derived-info.schema.json` - Derived information and knowledge graph data
- `kg-entity.schema.json` - Knowledge graph entity format
- `kg-triple.schema.json` - Knowledge graph triple/relationship format
- `chunk.schema.json` - Document chunk format for vector storage
- `common-defs.schema.json` - Shared definitions used across schemas

## Usage

### Node.js/JavaScript

```javascript
const { validate, getSchema, createValidator } = require('@repo/shared-schemas');

// Validate data against a schema
const result = validate('api-response', {
  data: { message: 'Hello' },
  success: true,
  timestamp: '2025-01-03T10:00:00Z'
});

if (result.isValid) {
  console.log('Data is valid!');
} else {
  console.log('Validation errors:', result.errors);
}

// Get a schema object
const schema = getSchema('chat-request');

// Create a reusable validator function
const validateChatRequest = createValidator('chat-request');
const chatResult = validateChatRequest({ query: 'What is ASA 150?' });
```

### Python

```python
import json
import jsonschema
from pathlib import Path

# Load a schema
schema_path = Path('node_modules/@repo/shared-schemas/schemas/api-response.schema.json')
with open(schema_path) as f:
    schema = json.load(f)

# Validate data
data = {
    "data": {"message": "Hello"},
    "success": True,
    "timestamp": "2025-01-03T10:00:00Z"
}

try:
    jsonschema.validate(data, schema)
    print("Data is valid!")
except jsonschema.ValidationError as e:
    print(f"Validation error: {e.message}")
```

## Development

### Adding New Schemas

1. Create a new `.schema.json` file in the `schemas/` directory
2. Use JSON Schema Draft 07 format
3. Include proper `$schema`, `$id`, `title`, and `description` fields
4. Run validation: `pnpm validate`
5. Update this README if needed

### Schema Validation

```bash
# Validate all schemas
pnpm validate

# Test schema loading and validation
node test-schemas.js
```

### Schema Guidelines

- Use descriptive titles and descriptions
- Include examples in descriptions where helpful
- Use appropriate constraints (minLength, maxLength, minimum, maximum)
- Define required fields explicitly
- Use `additionalProperties: false` for strict validation
- Reference common definitions from `common-defs.schema.json` when possible

## Schema Index

The `schemas/index.json` file is automatically generated and contains metadata about all available schemas. This file is updated whenever `pnpm validate` is run.
