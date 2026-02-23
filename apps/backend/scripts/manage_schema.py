"""Standalone CLI for Neo4j schema management.

Usage::

    # Apply schema (idempotent)
    uv run python scripts/manage_schema.py init

    # Validate existing schema
    uv run python scripts/manage_schema.py validate

    # Wipe all data and re-apply schema (DESTRUCTIVE)
    uv run python scripts/manage_schema.py wipe
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from dc_agent.kg.neo4j import Neo4jKGStore
from dc_agent.kg.schema import init_schema, validate_schema, wipe_and_reinit

logger = logging.getLogger("manage_schema")


async def _run(action: str) -> None:
    async with Neo4jKGStore() as store:
        if not await store.verify_connectivity():
            logger.error("Cannot reach Neo4j — aborting")
            sys.exit(1)

        if action == "init":
            await init_schema(store)
        elif action == "validate":
            summary = await validate_schema(store)
            logger.info("Validation summary: %s", summary)
        elif action == "wipe":
            confirm = input(
                "This will DELETE ALL Neo4j data. Type 'yes' to confirm: "
            )
            if confirm.strip().lower() != "yes":
                logger.info("Aborted")
                return
            await wipe_and_reinit(store)
        else:
            logger.error("Unknown action: %s", action)
            sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Neo4j schema management")
    parser.add_argument(
        "action",
        choices=["init", "validate", "wipe"],
        help="Action to perform",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(_run(args.action))


if __name__ == "__main__":
    main()
