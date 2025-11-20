"""Console entry point for pdf-data-extractor."""

from __future__ import annotations

import argparse
import json
import sys
from collections import OrderedDict
from pathlib import Path
from typing import Iterable, List, Optional, Sequence

from jsonschema import Draft202012Validator, FormatChecker

from .metadata import extract_pdf_metadata
from .schema_loader import build_schema_store, load_schema, resolver_for
from .sync import sync_metadata
from .ingest import load_constants, process_base_directory


SCHEMA_FILES = {
    "base": "base-technical-bulletin-with-defs.described.schema.json",
    "derived": "derived-info-with-knowledge-graph-with-defs.described.schema.json",
}


def _iter_pdf_paths(inputs: Sequence[str]) -> List[Path]:
    paths: List[Path] = []
    for raw in inputs:
        p = Path(raw)
        if p.is_dir():
            paths.extend(sorted(p.rglob("*.pdf")))
        elif p.is_file() and p.suffix.lower() == ".pdf":
            paths.append(p)
    # remove duplicates while preserving order
    unique: List[Path] = []
    seen = set()
    for path in paths:
        resolved = path.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique.append(path)
    return unique


def _default_schema_dir() -> Optional[Path]:
    candidates = [
        Path.cwd() / "reference" / "gold" / "schema",
        Path(__file__).resolve().parent.parent / "reference" / "gold" / "schema",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _default_constants_path() -> Optional[Path]:
    candidates = [
        Path.cwd() / "reference" / "gold" / "config" / "constants.yaml",
        Path(__file__).resolve().parent.parent / "reference" / "gold" / "config" / "constants.yaml",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def cmd_metadata(args: argparse.Namespace) -> int:
    pdf_paths = _iter_pdf_paths(args.inputs)
    if not pdf_paths:
        print("No PDF files found for supplied paths.", file=sys.stderr)
        return 1

    results = [OrderedDict(extract_pdf_metadata(path)) for path in pdf_paths]

    if args.output_dir:
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        for path, metadata in zip(pdf_paths, results):
            out_path = output_dir / f"{path.stem}.metadata.json"
            with out_path.open("w", encoding="utf-8") as fh:
                json.dump(metadata, fh, indent=2, ensure_ascii=True)
                fh.write("\n")
        print(f"Wrote metadata for {len(results)} file(s) to {output_dir}")
    else:
        print(json.dumps(results, indent=2, ensure_ascii=True))
    return 0


def cmd_sync_metadata(args: argparse.Namespace) -> int:
    json_dir = Path(args.json_dir)
    yaml_dir = Path(args.yaml_dir) if args.yaml_dir else None
    pdf_root = Path(args.pdf_root) if args.pdf_root else None

    updates = sync_metadata(json_dir, pdf_root, yaml_dir=yaml_dir, dry_run=args.dry_run)
    if args.dry_run:
        for json_path, yaml_path in updates:
            target = [str(json_path)]
            if yaml_path:
                target.append(str(yaml_path))
            print("DRY-RUN:", ", ".join(target))
    else:
        print(f"Updated {len(updates)} JSON file(s)")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    schema_dir = Path(args.schema_dir) if args.schema_dir else _default_schema_dir()
    if not schema_dir or not schema_dir.exists():
        print("Schema directory not found. Provide --schema-dir.", file=sys.stderr)
        return 2

    schema_type = args.schema_type
    if schema_type not in SCHEMA_FILES:
        print(f"Unknown schema type: {schema_type}", file=sys.stderr)
        return 2

    schema = load_schema(schema_dir, SCHEMA_FILES[schema_type])
    store = build_schema_store(schema_dir)
    resolver = resolver_for(schema, store)
    validator = Draft202012Validator(schema, resolver=resolver, format_checker=FormatChecker())

    targets: List[Path] = []
    for value in args.targets:
        p = Path(value)
        if p.is_dir():
            targets.extend(sorted(p.glob("*.json")))
        elif p.suffix.lower() == ".json" and p.exists():
            targets.append(p)

    if not targets:
        print("No JSON files found for validation.", file=sys.stderr)
        return 1

    all_valid = True
    for path in targets:
        data = json.loads(path.read_text(encoding="utf-8"))
        errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
        if errors:
            all_valid = False
            print(f"Validation errors for {path}:")
            for error in errors:
                location = ".".join(str(part) for part in error.absolute_path)
                schema_path = ".".join(str(part) for part in error.schema_path)
                print(f"  - {error.message}")
                if location:
                    print(f"    at: {location}")
                if schema_path:
                    print(f"    schema: {schema_path}")
    if all_valid:
        print(f"Validated {len(targets)} file(s) successfully")
        return 0
    return 1


def cmd_ingest(args: argparse.Namespace) -> int:
    base_yaml_dir = Path(args.base_yaml_dir)
    if not base_yaml_dir.exists():
        print(f"Base YAML directory not found: {base_yaml_dir}", file=sys.stderr)
        return 2

    output_dir = Path(args.output_dir)
    pdf_root = Path(args.pdf_root) if args.pdf_root else None

    constants_data = None
    if args.constants:
        constants_data = load_constants(Path(args.constants))
    else:
        default_constants = _default_constants_path()
        if default_constants:
            constants_data = load_constants(default_constants)

    results = process_base_directory(
        base_yaml_dir,
        output_dir,
        pdf_root=pdf_root,
        constants=constants_data,
        extractor_version=args.extractor_version,
        extraction_date=args.extraction_date,
    )

    if args.no_validate:
        print(f"Converted {len(results)} file(s) without validation")
        return 0

    schema_dir = Path(args.schema_dir) if args.schema_dir else _default_schema_dir()
    if not schema_dir or not schema_dir.exists():
        print("Schema directory not found. Provide --schema-dir or use --no-validate.", file=sys.stderr)
        return 2

    schema = load_schema(schema_dir, SCHEMA_FILES["base"])
    store = build_schema_store(schema_dir)
    resolver = resolver_for(schema, store)
    validator = Draft202012Validator(schema, resolver=resolver, format_checker=FormatChecker())

    failures = 0
    for _, json_path in results:
        data = json.loads(json_path.read_text(encoding="utf-8"))
        errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
        if errors:
            failures += 1
            print(f"Validation errors for {json_path}:")
            for error in errors:
                location = ".".join(str(part) for part in error.absolute_path)
                schema_path = ".".join(str(part) for part in error.schema_path)
                print(f"  - {error.message}")
                if location:
                    print(f"    at: {location}")
                if schema_path:
                    print(f"    schema: {schema_path}")

    if failures:
        print(f"Converted {len(results)} file(s) with {failures} validation failure(s)", file=sys.stderr)
        return 1

    print(f"Converted and validated {len(results)} file(s)")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pdf-data-extractor", description="PDF metadata and schema utilities")
    subparsers = parser.add_subparsers(dest="command")

    meta_parser = subparsers.add_parser("metadata", help="Show metadata for PDFs")
    meta_parser.add_argument("inputs", nargs="+", help="PDF files or directories")
    meta_parser.add_argument("--output-dir", help="Optional directory to write metadata JSON files")
    meta_parser.set_defaults(func=cmd_metadata)

    sync_parser = subparsers.add_parser("sync-metadata", help="Update base JSON/YAML with metadata from PDFs")
    sync_parser.add_argument("--json-dir", required=True, help="Directory containing *_base.json files")
    sync_parser.add_argument("--pdf-root", help="Directory containing source PDFs (uses source_filepath fallback when omitted)")
    sync_parser.add_argument("--yaml-dir", help="Directory containing *_base.yaml files to keep in sync")
    sync_parser.add_argument("--dry-run", action="store_true", help="Show files that would change without writing")
    sync_parser.set_defaults(func=cmd_sync_metadata)

    validate_parser = subparsers.add_parser("validate", help="Validate JSON files against schemas")
    validate_parser.add_argument("targets", nargs="+", help="JSON files or directories to validate")
    validate_parser.add_argument("--schema-dir", help="Directory containing schema JSON documents")
    validate_parser.add_argument("--schema-type", default="base", choices=sorted(SCHEMA_FILES.keys()))
    validate_parser.set_defaults(func=cmd_validate)

    ingest_parser = subparsers.add_parser("ingest", help="Convert base YAML extracts into JSON and validate")
    ingest_parser.add_argument("--base-yaml-dir", required=True, help="Directory containing *_base.yaml files")
    ingest_parser.add_argument("--output-dir", required=True, help="Destination directory for generated JSON")
    ingest_parser.add_argument("--pdf-root", help="Directory containing source PDFs")
    ingest_parser.add_argument("--constants", help="Path to constants YAML for placeholder expansion")
    ingest_parser.add_argument("--extractor-version", help="Override extractor version for extraction metadata")
    ingest_parser.add_argument("--extraction-date", help="Optional ISO timestamp to use for extraction_metadata.extraction_date")
    ingest_parser.add_argument("--schema-dir", help="Schema directory used for validation")
    ingest_parser.add_argument("--no-validate", action="store_true", help="Skip schema validation after conversion")
    ingest_parser.set_defaults(func=cmd_ingest)

    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not hasattr(args, "func"):
        parser.print_help()
        return 1
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
