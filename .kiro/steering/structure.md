# Project Structure & Organization

## Monorepo Layout

```
dixie-product-agent-v3/
├── apps/                           # Application packages
│   ├── backend/                    # FastAPI backend service
│   ├── frontend/                   # Astro + React frontend
│   └── pdf-extractor/              # PDF processing utility
├── packages/                       # Shared packages
│   ├── shared-types/               # TypeScript type definitions
│   └── shared-schemas/             # JSON schemas
├── infrastructure/                 # Infrastructure configuration
│   └── docker/                     # Docker Compose setup
├── data/                          # Data directories (gitignored)
├── docs/                          # Project documentation
├── reference/                     # Reference data and examples
├── raw_pdfs/                      # Source PDF files
└── scripts/                       # Development scripts
```

## Backend Structure (`apps/backend/`)

```
apps/backend/
├── src/
│   └── dc_agent/
│       ├── api/                   # FastAPI route handlers
│       ├── services/              # Business logic layer
│       ├── models/                # Pydantic data models
│       ├── vector/                # Vector database interface
│       ├── kg/                    # Knowledge graph services
│       ├── retrieval/             # Hybrid retrieval logic
│       ├── utils/                 # Utility functions
│       └── main.py                # FastAPI application entry
├── tests/                         # Test suite
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── performance/               # Performance tests
├── pyproject.toml                 # UV package configuration
└── README.md
```

## Frontend Structure (`apps/frontend/`)

```
apps/frontend/
├── src/
│   ├── components/                # React components
│   ├── pages/                     # Astro pages (routing)
│   ├── layouts/                   # Page layout components
│   ├── hooks/                     # React hooks
│   ├── lib/                       # Utility libraries
│   ├── styles/                    # Global styles
│   └── types/                     # Component-specific types
├── public/                        # Static assets
├── package.json                   # pnpm dependencies
├── astro.config.mjs              # Astro configuration
├── tailwind.config.js            # Tailwind CSS config
└── tsconfig.json                 # TypeScript config
```

## Shared Packages

### `packages/shared-types/`

- Common TypeScript interfaces and types
- API request/response types
- Data model definitions
- Exported via workspace references

### `packages/shared-schemas/`

- JSON Schema definitions
- Validation schemas for data extraction
- OpenAPI specifications

## Data Organization

### `reference/`

- **base_extraction/**: Validated extraction examples
- **derived_info/**: Processed knowledge graph data
- **schema/**: JSON schemas and validation rules
- **taxonomy/**: Domain-specific taxonomies
- **images/**: Extracted charts and diagrams

### `data/` (gitignored)

- **raw_pdfs/**: Source PDF documents
- **extracts/**: Processed extraction outputs
- **embeddings/**: Vector embeddings cache
- **kg/**: Knowledge graph exports

## Configuration Files

### Root Level

- **turbo.json**: Turbo Repo task configuration
- **package.json**: Workspace and script definitions
- **Makefile**: Development command shortcuts
- **pnpm-workspace.yaml**: pnpm workspace configuration

### Infrastructure

- **docker-compose.yml**: Local development services
- **.env.example**: Environment variable templates

## Naming Conventions

### Files and Directories

- Use kebab-case for directories: `pdf-extractor/`
- Use PascalCase for React components: `TestComponent.tsx`
- Use camelCase for utilities: `apiClient.ts`
- Use snake_case for Python modules: `extract_validator.py`

### Code Organization

- Group related functionality in service modules
- Separate API routes by domain (products, search, etc.)
- Use barrel exports in index files
- Keep components focused and single-purpose

## Import Patterns

### TypeScript

```typescript
// Workspace packages
import { ApiResponse } from "@repo/shared-types";

// Relative imports
import { Button } from "../components/Button";
import type { ProductData } from "./types";
```

### Python

```python
# Absolute imports from project root
from dc_agent.services.retrieval import HybridRetriever
from dc_agent.models.product import ProductModel

# Relative imports within modules
from .utils import validate_input
```

## Testing Organization

### Backend Tests

- **Unit**: Test individual functions and classes
- **Integration**: Test API endpoints with test database
- **Performance**: Load testing and benchmarks

### Frontend Tests

- **Component**: React component behavior
- **Integration**: User interaction flows
- **E2E**: Full application workflows (future)

## Documentation Standards

- README.md in each app/package
- Inline code documentation
- API documentation via FastAPI auto-generation
- Architecture decision records in `docs/`
