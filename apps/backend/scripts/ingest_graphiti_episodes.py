#!/usr/bin/env python3
"""Ingest derived YAML product summaries as Graphiti episodes.

Usage:
    uv run python scripts/ingest_graphiti_episodes.py
    uv run python scripts/ingest_graphiti_episodes.py --dry-run
    uv run python scripts/ingest_graphiti_episodes.py --rate-limit 2.0
    uv run python scripts/ingest_graphiti_episodes.py --source-dir /path/to/yamls
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Ensure the backend src is importable when running from apps/backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from dc_agent.kg.graphiti_episodes import DEFAULT_SOURCE_DIR, ingest_episodes
from dc_agent.kg.graphiti_store import GraphitiKGStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
# Suppress noisy Neo4j "index already exists" INFO notifications
logging.getLogger("neo4j.notifications").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


def _progress(current: int, total: int, filename: str) -> None:
    print(f"  [{current}/{total}] {filename}")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest product YAML summaries as Graphiti episodes")
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=DEFAULT_SOURCE_DIR,
        help=f"Directory containing *_derived.yaml files (default: {DEFAULT_SOURCE_DIR})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and validate only — don't ingest into Graphiti",
    )
    parser.add_argument(
        "--rate-limit",
        type=float,
        default=1.0,
        help="Seconds to wait between episode ingestions (default: 1.0)",
    )
    args = parser.parse_args()

    print(f"Source directory: {args.source_dir}")
    print(f"Dry run: {args.dry_run}")
    print(f"Rate limit: {args.rate_limit}s")
    print()

    async with GraphitiKGStore() as store:
        report = await ingest_episodes(
            store,
            source_dir=args.source_dir,
            rate_limit_sec=args.rate_limit,
            dry_run=args.dry_run,
            on_progress=_progress,
        )

    print()
    print(f"Done: {report['ingested']} ingested, {report['skipped']} skipped, {report['errors']} errors")

    if report["errors"] > 0:
        print("\nErrors:")
        for d in report["details"]:
            if "error" in d:
                print(f"  {d['file']}: {d['error']}")


if __name__ == "__main__":
    asyncio.run(main())
