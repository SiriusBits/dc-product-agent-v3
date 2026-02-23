"""Tests for Ollama adapter (embedder + LLM client).

All tests mock httpx so no live Ollama is needed.
"""

import json

import httpx
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from dc_agent.kg.ollama_adapter import (
    OllamaAdapterError,
    OllamaEmbedder,
    OllamaLLMClient,
)


# ---------------------------------------------------------------------------
# _clean_json
# ---------------------------------------------------------------------------


class TestCleanJson:
    def test_plain_json(self):
        assert OllamaLLMClient._clean_json('{"a": 1}') == '{"a": 1}'

    def test_json_code_block(self):
        raw = '```json\n{"a": 1}\n```'
        assert OllamaLLMClient._clean_json(raw) == '{"a": 1}'

    def test_bare_code_block(self):
        raw = '```\n{"a": 1}\n```'
        assert OllamaLLMClient._clean_json(raw) == '{"a": 1}'

    def test_no_match_fallback(self):
        # Edge case: ``` present but regex doesn't match cleanly
        raw = '```json{"a": 1}```'
        result = OllamaLLMClient._clean_json(raw)
        assert "```" not in result

    def test_whitespace_stripped(self):
        assert OllamaLLMClient._clean_json("  \n{}\n  ") == "{}"


# ---------------------------------------------------------------------------
# OllamaEmbedder
# ---------------------------------------------------------------------------


class TestOllamaEmbedder:
    @pytest.mark.asyncio
    async def test_create_single_string(self):
        embedder = OllamaEmbedder(base_url="http://test:11434", model="nomic-embed-text")
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"embedding": [0.1, 0.2, 0.3]}
        mock_resp.raise_for_status = MagicMock()

        with patch("dc_agent.kg.ollama_adapter.httpx.AsyncClient") as MockClient:
            client_instance = AsyncMock()
            client_instance.post.return_value = mock_resp
            client_instance.__aenter__ = AsyncMock(return_value=client_instance)
            client_instance.__aexit__ = AsyncMock(return_value=None)
            MockClient.return_value = client_instance

            result = await embedder.create("hello world")
            assert result == [0.1, 0.2, 0.3]
            client_instance.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_list_of_strings(self):
        embedder = OllamaEmbedder(base_url="http://test:11434", model="nomic-embed-text")
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"embedding": [0.4, 0.5]}
        mock_resp.raise_for_status = MagicMock()

        with patch("dc_agent.kg.ollama_adapter.httpx.AsyncClient") as MockClient:
            client_instance = AsyncMock()
            client_instance.post.return_value = mock_resp
            client_instance.__aenter__ = AsyncMock(return_value=client_instance)
            client_instance.__aexit__ = AsyncMock(return_value=None)
            MockClient.return_value = client_instance

            result = await embedder.create(["hello", "world"])
            assert result == [0.4, 0.5]
            # Should join list into single string
            call_json = client_instance.post.call_args[1]["json"]
            assert call_json["prompt"] == "hello world"

    @pytest.mark.asyncio
    async def test_create_batch_sequential(self):
        embedder = OllamaEmbedder(base_url="http://test:11434", model="nomic-embed-text")

        call_count = 0

        async def _mock_create(input_data):
            nonlocal call_count
            call_count += 1
            return [float(call_count)]

        embedder.create = _mock_create  # type: ignore[assignment]
        result = await embedder.create_batch(["a", "b", "c"])
        assert result == [[1.0], [2.0], [3.0]]
        assert call_count == 3


# ---------------------------------------------------------------------------
# OllamaLLMClient
# ---------------------------------------------------------------------------


def _make_mock_response(content: str) -> MagicMock:
    """Build a mock httpx response with the given content."""
    resp = MagicMock()
    resp.json.return_value = {"message": {"content": content}}
    resp.raise_for_status = MagicMock()
    return resp


def _patch_httpx(mock_resp: MagicMock):
    """Patch httpx.AsyncClient to return mock_resp on post."""
    patcher = patch("dc_agent.kg.ollama_adapter.httpx.AsyncClient")
    MockClient = patcher.start()
    client_instance = AsyncMock()
    client_instance.post.return_value = mock_resp
    client_instance.__aenter__ = AsyncMock(return_value=client_instance)
    client_instance.__aexit__ = AsyncMock(return_value=None)
    MockClient.return_value = client_instance
    return patcher, client_instance


class TestOllamaLLMClient:
    @pytest.mark.asyncio
    async def test_generate_plain_text(self):
        from graphiti_core.prompts.models import Message

        client = OllamaLLMClient(base_url="http://test:11434", model="llama3.1:8b")
        mock_resp = _make_mock_response("Hello!")
        patcher, _ = _patch_httpx(mock_resp)

        try:
            result = await client._generate_response([Message(role="user", content="Hi")])
            assert result == {"content": "Hello!"}
        finally:
            patcher.stop()

    @pytest.mark.asyncio
    async def test_generate_json_valid(self):
        from graphiti_core.prompts.models import Message
        from pydantic import BaseModel

        class TestModel(BaseModel):
            name: str
            value: int

        client = OllamaLLMClient(base_url="http://test:11434", model="llama3.1:8b")
        mock_resp = _make_mock_response('```json\n{"name": "test", "value": 42}\n```')
        patcher, _ = _patch_httpx(mock_resp)

        try:
            result = await client._generate_response(
                [Message(role="user", content="give json")],
                response_model=TestModel,
            )
            assert result == {"name": "test", "value": 42}
        finally:
            patcher.stop()

    @pytest.mark.asyncio
    async def test_generate_json_parse_error_raises(self):
        from graphiti_core.prompts.models import Message
        from pydantic import BaseModel

        class TestModel(BaseModel):
            name: str

        client = OllamaLLMClient(base_url="http://test:11434", model="llama3.1:8b")
        mock_resp = _make_mock_response("not json at all {{{")
        patcher, _ = _patch_httpx(mock_resp)

        try:
            with pytest.raises(OllamaAdapterError, match="invalid JSON"):
                await client._generate_response(
                    [Message(role="user", content="give json")],
                    response_model=TestModel,
                )
        finally:
            patcher.stop()

    @pytest.mark.asyncio
    async def test_generate_json_validation_error_raises(self):
        from graphiti_core.prompts.models import Message
        from pydantic import BaseModel

        class StrictModel(BaseModel):
            required_field: int

        client = OllamaLLMClient(base_url="http://test:11434", model="llama3.1:8b")
        mock_resp = _make_mock_response('{"wrong_field": "oops"}')
        patcher, _ = _patch_httpx(mock_resp)

        try:
            with pytest.raises(OllamaAdapterError, match="did not match"):
                await client._generate_response(
                    [Message(role="user", content="give json")],
                    response_model=StrictModel,
                )
        finally:
            patcher.stop()
