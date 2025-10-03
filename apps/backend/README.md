# Dixie Chemical Product Agent - Backend

FastAPI backend application for the Dixie Chemical Product Agent v3.

## Features

- FastAPI web framework with async support
- Hybrid retrieval system (vector + knowledge graph)
- Authentication and authorization
- Rate limiting and caching
- Structured logging
- Health check endpoints

## Development

```bash
# Install dependencies
uv sync --dev

# Run development server
uv run uvicorn src.dc_agent.main:app --reload --host 0.0.0.0 --port 8080

# Run tests
uv run pytest

# Run linting
uv run ruff check .

# Format code
uv run black .
```

## API Documentation

When running, visit:

- Swagger UI: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc
- Health check: http://localhost:8080/health

## Configuration

Copy `.env.example` to `.env` and update the values for your environment.
