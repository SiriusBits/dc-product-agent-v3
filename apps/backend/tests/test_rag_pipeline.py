"""Tests for the RAG pipeline — context formatting and source extraction.

Covers both vector-only and KG-aware code paths.
"""

from __future__ import annotations

import pytest

from dc_agent.models.search import SearchResult
from dc_agent.retrieval.rag import RAGPipeline


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def pipeline() -> RAGPipeline:
    return RAGPipeline()


def _vector_result(**overrides) -> SearchResult:
    defaults = dict(
        product_id="p1",
        product_name="DCA 221",
        section_name="Properties",
        chunk_text="DCA 221 has a viscosity of 10 cP at 25°C.",
        relevance_score=0.85,
        chunk_type=None,
        doc_id="doc-1",
    )
    defaults.update(overrides)
    return SearchResult(**defaults)


def _kg_result(**overrides) -> SearchResult:
    defaults = dict(
        product_id="",
        product_name="DCA 221",
        section_name="",
        chunk_text="Product: DCA 221\nClassification: Cycloaliphatic Amine\nApplications: Epoxy Curing",
        relevance_score=1.0,
        chunk_type="kg",
        doc_id=None,
    )
    defaults.update(overrides)
    return SearchResult(**defaults)


def _graphiti_result(**overrides) -> SearchResult:
    defaults = dict(
        product_id="",
        product_name="",
        section_name="",
        chunk_text="DCA 221 is used as a curing agent for epoxy resins",
        relevance_score=0.7,
        chunk_type="graphiti",
        doc_id=None,
    )
    defaults.update(overrides)
    return SearchResult(**defaults)


# ---------------------------------------------------------------------------
# format_context
# ---------------------------------------------------------------------------


class TestFormatContext:
    def test_empty_results(self, pipeline: RAGPipeline) -> None:
        assert pipeline.format_context([]) == ""

    def test_vector_only(self, pipeline: RAGPipeline) -> None:
        ctx = pipeline.format_context([_vector_result()])
        assert "technical documentation" in ctx
        assert "DCA 221" in ctx
        assert "Properties" in ctx
        assert "0.85" in ctx

    def test_kg_only(self, pipeline: RAGPipeline) -> None:
        ctx = pipeline.format_context([_kg_result()])
        assert "knowledge graph" in ctx
        assert "KG Fact 1" in ctx
        assert "DCA 221" in ctx

    def test_mixed_vector_and_kg(self, pipeline: RAGPipeline) -> None:
        ctx = pipeline.format_context([_kg_result(), _vector_result()])
        # KG comes first
        kg_pos = ctx.index("knowledge graph")
        vec_pos = ctx.index("technical documentation")
        assert kg_pos < vec_pos

    def test_graphiti_treated_as_kg(self, pipeline: RAGPipeline) -> None:
        ctx = pipeline.format_context([_graphiti_result()])
        assert "knowledge graph" in ctx
        assert "KG Fact 1" in ctx

    def test_vector_index_offset_with_kg(self, pipeline: RAGPipeline) -> None:
        """When KG results are present, vector source numbering starts after."""
        ctx = pipeline.format_context([_kg_result(), _vector_result()])
        # 1 KG result → vector starts at Source 2
        assert "[Source 2:" in ctx


# ---------------------------------------------------------------------------
# _format_kg_context
# ---------------------------------------------------------------------------


class TestFormatKGContext:
    def test_includes_product_name_label(self, pipeline: RAGPipeline) -> None:
        ctx = RAGPipeline._format_kg_context([_kg_result()])
        assert "[KG Fact 1: DCA 221]" in ctx

    def test_no_product_name(self, pipeline: RAGPipeline) -> None:
        result = _graphiti_result()  # product_name is empty
        ctx = RAGPipeline._format_kg_context([result])
        assert "[KG Fact 1]" in ctx


# ---------------------------------------------------------------------------
# extract_sources
# ---------------------------------------------------------------------------


class TestExtractSources:
    def test_vector_sources(self, pipeline: RAGPipeline) -> None:
        sources = pipeline.extract_sources([_vector_result()])
        assert len(sources) == 1
        assert sources[0].product_name == "DCA 221"
        assert sources[0].section == "Properties"

    def test_kg_sources(self, pipeline: RAGPipeline) -> None:
        sources = pipeline.extract_sources([_kg_result()])
        assert len(sources) == 1
        assert sources[0].section == "Knowledge Graph (kg)"

    def test_graphiti_sources(self, pipeline: RAGPipeline) -> None:
        sources = pipeline.extract_sources([_graphiti_result()])
        assert len(sources) == 1
        assert sources[0].section == "Knowledge Graph (graphiti)"

    def test_dedup_same_product_same_type(self, pipeline: RAGPipeline) -> None:
        """Two KG results for the same product should be deduped."""
        r1 = _kg_result(chunk_text="Fact A")
        r2 = _kg_result(chunk_text="Fact B")
        sources = pipeline.extract_sources([r1, r2])
        assert len(sources) == 1

    def test_mixed_sources_dedup(self, pipeline: RAGPipeline) -> None:
        """Vector and KG results for the same product are NOT deduped."""
        sources = pipeline.extract_sources([_vector_result(), _kg_result()])
        assert len(sources) == 2

    def test_long_text_truncated(self, pipeline: RAGPipeline) -> None:
        long_text = "x" * 300
        result = _vector_result(chunk_text=long_text)
        sources = pipeline.extract_sources([result])
        assert sources[0].chunk_text.endswith("...")
        assert len(sources[0].chunk_text) < 210


# ---------------------------------------------------------------------------
# build_messages
# ---------------------------------------------------------------------------


class TestBuildMessages:
    def test_system_prompt_includes_kg_instructions(self, pipeline: RAGPipeline) -> None:
        prompt = pipeline.build_system_prompt()
        assert "Knowledge graph facts" in prompt
        assert "Document excerpts" in prompt

    def test_messages_structure(self, pipeline: RAGPipeline) -> None:
        messages = pipeline.build_messages(
            query="What is DCA 221?",
            context="Some context",
        )
        assert messages[0]["role"] == "system"
        assert messages[-1]["role"] == "user"
        assert "DCA 221" in messages[-1]["content"]
