# PDF Data Extractor

Standalone utility for extracting metadata and content from Technical Bulletin PDFs.

## Usage

This utility is designed to be run as a command-line tool or imported as a library.

### Installation

```bash
uv sync
```

### Commands

- `metadata`: Extract metadata from PDFs
- `ingest`: Convert YAML extracts to JSON
- `validate`: Validate JSON against schemas
- `sync-metadata`: Sync metadata back to source files

See `python -m backend.cli --help` for more details.
