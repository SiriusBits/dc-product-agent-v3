"""Batch KG ingestion CLI.

Usage::

    # Full ingestion (idempotent)
    uv run python scripts/ingest_kg_data.py

    # Dry run — parse and validate only, no writes
    uv run python scripts/ingest_kg_data.py --dry-run

    # Clear existing data first, then ingest
    uv run python scripts/ingest_kg_data.py --clear

    # Validate only (no Neo4j needed)
    uv run python scripts/ingest_kg_data.py --validate-only

    # Custom source directory
    uv run python scripts/ingest_kg_data.py --source-dir /path/to/yamls
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import time
from pathlib import Path

logger = logging.getLogger("ingest_kg")

# Default source relative to project root (backend runs from apps/backend/)
DEFAULT_SOURCE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "extracts" / "derived_info_yaml"


async def _run(args: argparse.Namespace) -> None:
    source_dir = Path(args.source_dir)
    if not source_dir.exists():
        logger.error("Source directory not found: %s", source_dir)
        sys.exit(1)

    yaml_files = sorted(source_dir.glob("*_derived.yaml"))
    logger.info("Found %d YAML files in %s", len(yaml_files), source_dir)

    # --- validate-only mode ---
    if args.validate_only:
        from dc_agent.kg.validation import validate_corpus

        report = validate_corpus(source_dir)
        _print_validation_report(report)
        sys.exit(0 if report.is_valid else 1)

    # --- Neo4j-connected modes ---
    from dc_agent.kg.neo4j import Neo4jKGStore
    from dc_agent.kg.ingestion import ingest_corpus
    from dc_agent.kg.schema import init_schema, wipe_and_reinit

    async with Neo4jKGStore() as store:
        if not await store.verify_connectivity():
            logger.error("Cannot reach Neo4j — aborting")
            sys.exit(1)

        # --clear: wipe and reinit schema
        if args.clear:
            logger.info("Clearing existing KG data …")
            await wipe_and_reinit(store)
        else:
            # Ensure schema is up to date
            await init_schema(store)

        # --- ingest ---
        t0 = time.monotonic()
        report = await ingest_corpus(store, source_dir, dry_run=args.dry_run)
        elapsed = time.monotonic() - t0

    _print_ingestion_report(report, elapsed, dry_run=args.dry_run)


def _print_ingestion_report(
    report: "IngestionReport",
    elapsed: float,
    *,
    dry_run: bool,
) -> None:
    mode = "DRY RUN" if dry_run else "INGESTION"
    print(f"\n{'='*60}")
    print(f" {mode} REPORT")
    print(f"{'='*60}")
    print(f" Files processed:    {report.files_processed}")
    print(f" Entities parsed:    {report.total_entities_parsed}")
    print(f" Entities merged:    {report.total_entities_merged}")
    print(f" Triples parsed:     {report.total_triples_parsed}")
    print(f" Triples merged:     {report.total_triples_merged}")
    print(f" Triples skipped:    {report.total_triples_skipped}")
    print(f" Warnings:           {report.total_warnings}")
    print(f" Errors:             {report.total_errors}")
    print(f" Elapsed:            {elapsed:.1f}s")
    print(f"{'='*60}")

    # Per-file breakdown
    for fr in report.file_reports:
        status = "✓" if not fr.errors else "✗"
        print(f"  {status} {fr.filename:50s} E={fr.entities_merged:3d} T={fr.triples_merged:3d} skip={fr.triples_skipped:2d} warn={len(fr.warnings):2d}")

    if report.total_errors:
        print(f"\n ERRORS ({report.total_errors}):")
        for fr in report.file_reports:
            for err in fr.errors:
                print(f"   ✗ [{fr.filename}] {err}")

    print()


def _print_validation_report(report: "ValidationReport") -> None:
    print(f"\n{'='*60}")
    print(f" VALIDATION REPORT")
    print(f"{'='*60}")
    print(f" Files checked:      {report.files_checked}")
    print(f" Total entities:     {report.total_entities}")
    print(f" Total triples:      {report.total_triples}")
    print(f" Errors:             {len(report.errors)}")
    print(f" Warnings:           {len(report.warnings)}")
    print(f" Valid:              {'YES' if report.is_valid else 'NO'}")
    print(f"{'='*60}")

    if report.errors:
        print(f"\n ERRORS ({len(report.errors)}):")
        for issue in report.errors:
            print(f"   ✗ [{issue.file}] {issue.message}")

    if report.warnings:
        print(f"\n WARNINGS ({len(report.warnings)}) — showing first 20:")
        for issue in report.warnings[:20]:
            print(f"   ⚠ [{issue.file}] {issue.message}")
        if len(report.warnings) > 20:
            print(f"   … and {len(report.warnings) - 20} more")

    print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest knowledge graph data from derived YAML files into Neo4j"
    )
    parser.add_argument(
        "--source-dir",
        default=str(DEFAULT_SOURCE_DIR),
        help=f"Directory containing *_derived.yaml files (default: {DEFAULT_SOURCE_DIR})",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Wipe existing Neo4j data before ingestion",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and count without writing to Neo4j",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate YAML data only (no Neo4j connection needed)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(_run(args))


if __name__ == "__main__":
    main()
