# Dixie Chemical Product Agent v3

A comprehensive agentic RAG (Retrieval-Augmented Generation) application for intelligent search and question-answering over technical chemical product documents.

## Architecture

This project uses a monorepo structure with:

- **Backend**: FastAPI application with hybrid retrieval system
- **Frontend**: Astro + React application with modern UI
- **PDF Extractor**: Utility for processing technical bulletins
- **Shared Packages**: Common types and schemas

## Tech Stack

- **Backend**: FastAPI, Python 3.11+, UV package manager
- **Frontend**: Astro, React, TypeScript, Tailwind CSS 4, ShadCN
- **Databases**: Neo4j (Knowledge Graph), Chroma (Vector DB), Redis (Cache)
- **Infrastructure**: Docker Compose, Turbo Repo, pnpm
- **AI/ML**: Ollama (External), Graphiti (Entity Management)

## Quick Start

### Prerequisites

- **Node.js** 18+ and **pnpm** (package manager)
- **Python** 3.11+ and **UV**
- **Docker** and **Docker Compose**
- **Ollama** (running externally on macOS)

### Installation

1. **Clone and setup environment:**
   ```bash
   git clone <repository-url>
   cd dixie-product-agent-v3
   make setup-env
   ```

2. **Install dependencies:**
   ```bash
   make install
   ```

3. **Start infrastructure services:**
   ```bash
   make docker-up
   ```

4. **Start development servers:**
   ```bash
   make dev
   ```

### Development Commands

```bash
# Environment setup
make setup-env          # Check prerequisites
make install            # Install all dependencies

# Development
make dev                # Start all development servers
make dev-backend        # Start backend only
make dev-frontend       # Start frontend only

# Testing
make test               # Run all tests
make test-backend       # Run backend tests
make test-frontend      # Run frontend tests

# Code quality
make lint               # Run linting
make format             # Format code
make type-check         # Run type checking

# Docker operations
make docker-up          # Start Docker services
make docker-down        # Stop Docker services
make docker-logs        # View service logs

# Database operations
make db-reset           # Reset all databases (WARNING: destroys data)

# Data operations
make ingest-sample      # Ingest sample PDF data
make extract-pdf PDF=path/to/file.pdf  # Extract specific PDF

# Cleanup
make clean              # Clean build artifacts
make clean-cache        # Clean all caches
```

## Project Structure

```
dixie-product-agent-v3/
├── apps/
│   ├── backend/                # FastAPI application
│   ├── frontend/               # Astro + React application
│   └── pdf-extractor/          # PDF processing utility
├── packages/
│   ├── shared-types/           # Shared TypeScript types
│   └── shared-schemas/         # JSON schemas
├── infrastructure/
│   └── docker/                 # Docker configurations
├── data/                       # Data directories (gitignored)
├── docs/                       # Documentation
├── scripts/                    # Development scripts
├── Makefile                    # Development commands
└── turbo.json                  # Turbo repo configuration
```

## Services

When running `make docker-up`, the following services will be available:

- **Neo4j**: http://localhost:7474 (neo4j/password123)
- **Chroma**: http://localhost:8001
- **Redis**: localhost:6379 (password: redis123)
- **PostgreSQL**: localhost:5432 (dc_agent/postgres123)
- **n8n**: http://localhost:5678 (admin/admin123)
- **MinIO**: http://localhost:9001 (minioadmin/minioadmin123)

## External Dependencies

### Ollama Setup (macOS)

1. Install Ollama: https://ollama.ai/download
2. Start Ollama service: `ollama serve`
3. Pull required models:
   ```bash
   ollama pull nomic-embed-text
   ollama pull llama2:7b-chat
   ```

The application will connect to Ollama at `http://localhost:11434` (or `http://host.docker.internal:11434` from Docker containers).

## Development Workflow

1. **Start infrastructure**: `make docker-up`
2. **Start development**: `make dev`
3. **Run tests**: `make test`
4. **Check code quality**: `make lint && make type-check`
5. **Format code**: `make format`

## Environment Configuration

Copy the example environment files and update as needed:

```bash
cp infrastructure/docker/.env.example infrastructure/docker/.env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

## Contributing

1. Follow the established code style (enforced by linting)
2. Write tests for new functionality
3. Update documentation as needed
4. Use conventional commit messages

## License

[Add your license information here]