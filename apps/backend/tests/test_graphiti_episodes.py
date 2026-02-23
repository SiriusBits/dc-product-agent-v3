"""Tests for Graphiti episode ingestion (prepare + ingest).

All tests use mock data and mock store — no live services needed.
"""

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dc_agent.kg.graphiti_episodes import prepare_episode, ingest_episodes
from dc_agent.kg.graphiti_models import EpisodeInput


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


SAMPLE_YAML = """\
doc_id: "82c28fb6-3a9e-5b8b-b074-a706bbf606a2"
filename: "AP-6G_Technical_Bulletin.pdf"
filepath: "/data/raw_pdfs/AP-6G_Technical_Bulletin.pdf"
extraction_metadata:
  extraction_date: "2025-08-26T15:10:00-04:00"
  extractor_version: "1.0"
derived_info:
  summary: "AP-6G is a quaternary ammonium salt used as a phase-transfer catalyst."
  key_applications:
    - Phase-transfer catalyst
    - Industrial chemical processes
knowledge_graph:
  entities: []
"""

SAMPLE_YAML_TEMPLATE_DATE = """\
doc_id: "abc-123"
filename: "test.pdf"
extraction_metadata:
  extraction_date: "${extraction.extraction_date}"
derived_info:
  summary: "A test product summary."
"""

SAMPLE_YAML_NO_SUMMARY = """\
doc_id: "xyz-789"
filename: "empty.pdf"
derived_info:
  key_applications: []
"""

SAMPLE_YAML_NO_DOC_ID = """\
filename: "orphan.pdf"
derived_info:
  summary: "Has summary but no doc_id."
"""


# ---------------------------------------------------------------------------
# prepare_episode tests
# ---------------------------------------------------------------------------


class TestPrepareEpisode:
    def test_valid_yaml(self, tmp_path: Path):
        yaml_file = tmp_path / "AP-6G_derived.yaml"
        yaml_file.write_text(SAMPLE_YAML)

        episode = prepare_episode(yaml_file)

        assert isinstance(episode, EpisodeInput)
        assert episode.name == "82c28fb6-3a9e-5b8b-b074-a706bbf606a2"
        assert "phase-transfer catalyst" in episode.body
        assert episode.source_description == "AP-6G_Technical_Bulletin.pdf"
        assert episode.reference_time.year == 2025
        assert episode.group_id == "dixie-products"

    def test_template_date_uses_utc_now(self, tmp_path: Path):
        yaml_file = tmp_path / "test_derived.yaml"
        yaml_file.write_text(SAMPLE_YAML_TEMPLATE_DATE)

        episode = prepare_episode(yaml_file)

        # Template variable dates should fallback to now (UTC)
        assert episode.reference_time.tzinfo is not None
        assert episode.name == "abc-123"

    def test_missing_summary_raises(self, tmp_path: Path):
        yaml_file = tmp_path / "empty_derived.yaml"
        yaml_file.write_text(SAMPLE_YAML_NO_SUMMARY)

        with pytest.raises(ValueError, match="summary"):
            prepare_episode(yaml_file)

    def test_missing_doc_id_raises(self, tmp_path: Path):
        yaml_file = tmp_path / "orphan_derived.yaml"
        yaml_file.write_text(SAMPLE_YAML_NO_DOC_ID)

        with pytest.raises(ValueError, match="doc_id"):
            prepare_episode(yaml_file)


# ---------------------------------------------------------------------------
# ingest_episodes tests
# ---------------------------------------------------------------------------


def _make_mock_store() -> MagicMock:
    """Create a mock GraphitiKGStore."""
    store = MagicMock()
    store.add_episode = AsyncMock()
    return store


class TestIngestEpisodes:
    @pytest.mark.asyncio
    async def test_ingest_valid_files(self, tmp_path: Path):
        # Write two valid YAML files
        (tmp_path / "a_derived.yaml").write_text(SAMPLE_YAML)
        (tmp_path / "b_derived.yaml").write_text(SAMPLE_YAML_TEMPLATE_DATE)

        store = _make_mock_store()
        report = await ingest_episodes(store, tmp_path, rate_limit_sec=0.0)

        assert report["ingested"] == 2
        assert report["errors"] == 0
        assert store.add_episode.await_count == 2

    @pytest.mark.asyncio
    async def test_dry_run_does_not_ingest(self, tmp_path: Path):
        (tmp_path / "a_derived.yaml").write_text(SAMPLE_YAML)

        store = _make_mock_store()
        report = await ingest_episodes(store, tmp_path, dry_run=True, rate_limit_sec=0.0)

        assert report["ingested"] == 0
        assert report["skipped"] == 1
        store.add_episode.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_parse_error_skipped(self, tmp_path: Path):
        # One valid, one invalid
        (tmp_path / "good_derived.yaml").write_text(SAMPLE_YAML)
        (tmp_path / "bad_derived.yaml").write_text(SAMPLE_YAML_NO_DOC_ID)

        store = _make_mock_store()
        report = await ingest_episodes(store, tmp_path, rate_limit_sec=0.0)

        assert report["ingested"] == 1
        assert report["errors"] == 1
        assert any(d["status"] == "parse_error" for d in report["details"])

    @pytest.mark.asyncio
    async def test_ingest_error_skipped(self, tmp_path: Path):
        (tmp_path / "fail_derived.yaml").write_text(SAMPLE_YAML)

        store = _make_mock_store()
        store.add_episode.side_effect = RuntimeError("Ollama timeout")

        report = await ingest_episodes(store, tmp_path, rate_limit_sec=0.0)

        assert report["ingested"] == 0
        assert report["errors"] == 1
        assert report["details"][0]["status"] == "ingest_error"

    @pytest.mark.asyncio
    async def test_empty_directory(self, tmp_path: Path):
        store = _make_mock_store()
        report = await ingest_episodes(store, tmp_path, rate_limit_sec=0.0)

        assert report["ingested"] == 0
        assert report["errors"] == 0

    @pytest.mark.asyncio
    async def test_progress_callback(self, tmp_path: Path):
        (tmp_path / "a_derived.yaml").write_text(SAMPLE_YAML)
        (tmp_path / "b_derived.yaml").write_text(SAMPLE_YAML_TEMPLATE_DATE)

        store = _make_mock_store()
        calls: list[tuple[int, int, str]] = []

        def on_progress(current: int, total: int, filename: str) -> None:
            calls.append((current, total, filename))

        await ingest_episodes(store, tmp_path, rate_limit_sec=0.0, on_progress=on_progress)

        assert len(calls) == 2
        assert calls[0][0] == 1
        assert calls[1][0] == 2
        assert calls[0][1] == 2
