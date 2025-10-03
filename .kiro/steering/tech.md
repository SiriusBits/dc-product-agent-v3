# Technology Stack & Build System

## Package Management

- **Python**: Use UV package manager exclusively (NO pip install)
- **Node.js**: Use pnpm exclusively (NO npm or npx)
- **Monorepo**: Turbo Repo for build orchestration

## Backend Stack (Python 3.11+)

- **Framework**: FastAPI with async/await patterns
- **Vector Database**: Chroma (with swappable interface)
- **Knowledge Graph**: Neo4j + Graphiti for entity management
- **Cache**: Redis for session and query caching
- **Database**: PostgreSQL (via asyncpg) for metadata
- **Authentication**: python-jose with JWT tokens
- **Validation**: Pydantic v2 for data models
- **Testing**: pytest with asyncio support

## Frontend Stack (TypeScript Only)

- **Framework**: Astro + React (NO JavaScript files)
- **Styling**: Tailwind CSS 4
- **UI Components**: Lucide React icons, class-variance-authority
- **Testing**: Vitest with Testing Library
- **Type Safety**: Strict TypeScript mode enabled

## Infrastructure Services

- **Neo4j**: Knowledge graph (port 7474/7687)
- **Chroma**: Vector database (port 8001)
- **Redis**: Cache layer (port 6379)
- **PostgreSQL**: Metadata storage (port 5432)
- **n8n**: Workflow automation (port 5678)
- **MinIO**: Object storage (port 9000/9001)
- **Ollama**: External AI models (port 11434, runs outside Docker)

## Development Commands

```bash
# Environment setup
make setup-env          # Check prerequisites
make install            # Install all dependencies

# Development
make dev                # Start all services
make dev-backend        # Backend only
make dev-frontend       # Frontend only

# Testing
make test               # All tests
make test-backend       # Python tests with pytest
make test-frontend      # TypeScript tests with vitest

# Code quality
make lint               # Run all linting (ruff, eslint)
make format             # Format code (black, prettier)
make type-check         # Type checking (mypy, tsc)

# Infrastructure
make docker-up          # Start Docker services
make docker-down        # Stop Docker services
make db-reset           # Reset databases (destroys data)

# Data operations
make ingest-sample      # Process sample PDFs
make extract-pdf PDF=path/to/file.pdf  # Extract specific PDF
```

## Code Quality Standards

### Python

- **Linting**: ruff for fast linting
- **Formatting**: black (88 character line length)
- **Type Checking**: mypy with strict settings
- **Testing**: pytest with coverage reporting

### TypeScript

- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier with Astro plugin
- **Type Safety**: Strict mode, no `any` types
- **Testing**: Vitest for unit tests

## External Dependencies

- **Ollama**: Must be installed and running locally for AI models
- **Docker**: Required for infrastructure services
- **UV**: Python package manager
- **pnpm**: Node.js package manager

### MCP Servers

- **Context7**: MCP server for documentation access. ALWAYS refer to the latest documentation using Context7 tools.
