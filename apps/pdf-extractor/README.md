# Dixie Chemical PDF Extractor

Python utility for extracting and processing technical bulletins from PDF documents.

## Features

- PDF text and image extraction
- AI-powered content validation
- Structured data export
- Knowledge graph integration
- Batch processing support

## Development

```bash
# Install dependencies
uv sync --dev

# Run extraction on a single PDF
uv run python -m dc_extractor.extract_validator path/to/file.pdf

# Run batch ingestion
uv run python -m dc_extractor.ingest --sample

# Run tests
uv run pytest

# Run linting
uv run ruff check .

# Format code
uv run black .
```

## Usage

The extractor processes PDF files and outputs structured data that can be ingested into the knowledge graph and vector database.

## Configuration

Copy the backend's `.env` file or create your own with the necessary API keys and database connections.