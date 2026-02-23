"""Graphiti episode ingestion from derived YAML product files.

Reads product summaries from derived YAML extracts and ingests them
as Graphiti episodes with source attribution.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

import yaml

from dc_agent.kg.graphiti_models import EpisodeInput
from dc_agent.kg.graphiti_store import GraphitiKGStore

logger = logging.getLogger(__name__)

# __file__ = apps/backend/src/dc_agent/kg/graphiti_episodes.py
# parents: [0]=kg, [1]=dc_agent, [2]=src, [3]=backend, [4]=apps, [5]=project_root
DEFAULT_SOURCE_DIR = Path(__file__).resolve().parents[5] / "data" / "extracts" / "derived_info_yaml"
GROUP_ID = "dixie-products"


def prepare_episode(yaml_path: Path) -> EpisodeInput:
    """Parse a derived YAML file into a validated ``EpisodeInput``.

    Raises ``ValueError`` if required fields are missing.
    """
    data: dict[str, Any] = yaml.safe_load(yaml_path.read_text())

    doc_id: str = data.get("doc_id", "")
    if not doc_id:
        raise ValueError(f"Missing doc_id in {yaml_path.name}")

    filename: str = data.get("filename", yaml_path.name)

    # --- summary body ---
    derived_info = data.get("derived_info") or {}
    summary: str = derived_info.get("summary", "")
    if not summary:
        raise ValueError(f"Missing derived_info.summary in {yaml_path.name}")

    # --- reference time ---
    extraction_meta = data.get("extraction_metadata") or {}
    date_str: str = extraction_meta.get("extraction_date", "")
    if date_str and not date_str.startswith("$"):
        reference_time = datetime.fromisoformat(date_str)
    else:
        reference_time = datetime.now(tz=timezone.utc)

    return EpisodeInput(
        name=doc_id,
        body=summary,
        source_description=filename,
        reference_time=reference_time,
        group_id=GROUP_ID,
    )


async def ingest_episodes(
    store: GraphitiKGStore,
    source_dir: Path | None = None,
    *,
    rate_limit_sec: float = 1.0,
    dry_run: bool = False,
    on_progress: Optional[Callable[[int, int, str], None]] = None,
) -> dict[str, Any]:
    """Ingest all derived YAML files as Graphiti episodes.

    Parameters
    ----------
    store:
        An initialized ``GraphitiKGStore``.
    source_dir:
        Directory containing ``*_derived.yaml`` files.
    rate_limit_sec:
        Seconds to sleep between Ollama-heavy ``add_episode`` calls.
    dry_run:
        If True, parse and validate only — don't ingest.
    on_progress:
        Optional callback ``(current, total, filename) -> None``.

    Returns
    -------
    dict with ``ingested``, ``skipped``, ``errors`` counts and ``details``.
    """
    source = source_dir or DEFAULT_SOURCE_DIR
    yaml_files = sorted(source.glob("*_derived.yaml"))

    if not yaml_files:
        logger.warning("No *_derived.yaml files found in %s", source)
        return {"ingested": 0, "skipped": 0, "errors": 0, "details": []}

    total = len(yaml_files)
    ingested = 0
    skipped = 0
    errors = 0
    details: list[dict[str, str]] = []

    for idx, path in enumerate(yaml_files, 1):
        if on_progress:
            on_progress(idx, total, path.name)

        # Parse
        try:
            episode = prepare_episode(path)
        except (ValueError, yaml.YAMLError) as exc:
            logger.error("Skipping %s: %s", path.name, exc)
            errors += 1
            details.append({"file": path.name, "status": "parse_error", "error": str(exc)})
            continue

        if dry_run:
            skipped += 1
            details.append({"file": path.name, "status": "dry_run", "doc_id": episode.name})
            continue

        # Ingest
        try:
            await store.add_episode(episode)
            ingested += 1
            details.append({"file": path.name, "status": "ingested", "doc_id": episode.name})
            logger.info("[%d/%d] Ingested %s (%s)", idx, total, path.name, episode.name)
        except Exception as exc:
            errors += 1
            details.append({"file": path.name, "status": "ingest_error", "error": str(exc)})
            logger.error("[%d/%d] Failed to ingest %s: %s", idx, total, path.name, exc)

        # Rate limit between Ollama calls
        if idx < total:
            await asyncio.sleep(rate_limit_sec)

    report = {"ingested": ingested, "skipped": skipped, "errors": errors, "details": details}
    logger.info("Episode ingestion complete: %d ingested, %d skipped, %d errors", ingested, skipped, errors)
    return report
