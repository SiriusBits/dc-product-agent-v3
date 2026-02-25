"""Async HTTP client for the n8n retrieval orchestration webhook.

The client sends queries to the n8n webhook, which classifies intent,
routes to the appropriate backend retrieval endpoints (vector / KG / both),
fuses results, and returns a unified response.

If n8n is unreachable or times out the caller should fall back to direct
retrieval.
"""

from __future__ import annotations

import logging
import time

import httpx

from dc_agent.config import settings
from dc_agent.models.n8n import (
    N8nRetrievalRequest,
    N8nRetrievalResponse,
    N8nTraceMetadata,
    QueryIntent,
)

logger = logging.getLogger(__name__)


class N8nClientError(Exception):
    """Raised when the n8n webhook call fails."""


class N8nClient:
    """Async client for the n8n retrieval orchestration webhook.

    Usage::

        async with N8nClient() as client:
            response = await client.retrieve("What is the viscosity of DCA 221?")
    """

    def __init__(
        self,
        webhook_url: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self._webhook_url = webhook_url or settings.N8N_WEBHOOK_URL
        self._timeout = timeout or settings.N8N_TIMEOUT
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> N8nClient:
        self._client = httpx.AsyncClient(timeout=self._timeout)
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    def _ensure_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def health_check(self) -> bool:
        """Return True if the n8n webhook is reachable."""
        client = self._ensure_client()
        try:
            resp = await client.post(
                self._webhook_url,
                json={"query": "__health_check__", "top_k": 1},
            )
            return resp.status_code in (200, 404)
        except (httpx.ConnectError, httpx.TimeoutException):
            return False
        except Exception:
            logger.exception("Unexpected error during n8n health check")
            return False

    async def retrieve(
        self,
        query: str,
        *,
        conversation_id: str | None = None,
        intent_hint: QueryIntent | None = None,
        top_k: int = 5,
    ) -> N8nRetrievalResponse:
        """Send a query to the n8n retrieval webhook.

        Parameters
        ----------
        query:
            Natural-language user query.
        conversation_id:
            Optional conversation context.
        intent_hint:
            Force a specific retrieval path (bypass n8n classifier).
        top_k:
            Number of results to request per source.

        Returns
        -------
        N8nRetrievalResponse
            Unified results with trace metadata.

        Raises
        ------
        N8nClientError
            On network errors, timeouts, or non-200 responses.
        """
        client = self._ensure_client()
        request = N8nRetrievalRequest(
            query=query,
            conversation_id=conversation_id,
            intent_hint=intent_hint,
            top_k=top_k,
        )

        start = time.monotonic()
        try:
            resp = await client.post(
                self._webhook_url,
                json=request.model_dump(mode="json", exclude_none=True),
            )
        except httpx.TimeoutException as exc:
            elapsed = (time.monotonic() - start) * 1000
            logger.warning(
                "n8n webhook timed out after %.0fms: %s", elapsed, exc
            )
            raise N8nClientError(f"n8n webhook timed out: {exc}") from exc
        except httpx.ConnectError as exc:
            logger.warning("n8n webhook unreachable: %s", exc)
            raise N8nClientError(f"n8n webhook unreachable: {exc}") from exc
        except httpx.HTTPError as exc:
            logger.error("n8n HTTP error: %s", exc)
            raise N8nClientError(f"n8n HTTP error: {exc}") from exc

        elapsed_ms = (time.monotonic() - start) * 1000

        if resp.status_code != 200:
            detail = resp.text[:200]
            logger.warning(
                "n8n returned %d: %s", resp.status_code, detail
            )
            raise N8nClientError(
                f"n8n returned HTTP {resp.status_code}: {detail}"
            )

        try:
            data = resp.json()
        except Exception as exc:
            raise N8nClientError(f"Invalid JSON from n8n: {exc}") from exc

        # Parse response — tolerate flat or nested shapes
        response = _parse_response(data, elapsed_ms)

        logger.info(
            "n8n retrieval: intent=%s results=%d elapsed=%.0fms",
            response.metadata.intent.value,
            len(response.results),
            elapsed_ms,
        )
        return response


# ------------------------------------------------------------------
# Response parsing helpers
# ------------------------------------------------------------------


def _parse_response(
    data: dict | list,
    elapsed_ms: float,
) -> N8nRetrievalResponse:
    """Parse the n8n webhook response into a typed model.

    n8n may return the response in different shapes depending on the
    workflow design.  This function handles:
      - Direct ``N8nRetrievalResponse`` shape (``{results, metadata}``)
      - Flat list of result items
      - Nested under a single-element list (n8n wraps in array)
    """
    # n8n often wraps webhook responses in a single-element array
    if isinstance(data, list):
        if len(data) == 1 and isinstance(data[0], dict):
            data = data[0]
        else:
            # Treat entire list as result items
            return N8nRetrievalResponse(
                results=[_coerce_item(item) for item in data if isinstance(item, dict)],
                metadata=N8nTraceMetadata(total_ms=elapsed_ms),
            )

    if not isinstance(data, dict):
        return N8nRetrievalResponse(
            metadata=N8nTraceMetadata(total_ms=elapsed_ms),
        )

    # Standard shape
    if "results" in data:
        try:
            resp = N8nRetrievalResponse.model_validate(data)
        except Exception:
            # Partial parse — at least get results
            results = [
                _coerce_item(r) for r in data.get("results", []) if isinstance(r, dict)
            ]
            resp = N8nRetrievalResponse(
                results=results,
                metadata=N8nTraceMetadata(total_ms=elapsed_ms),
            )
        resp.metadata.total_ms = elapsed_ms
        return resp

    # Single item (unexpected but safe)
    return N8nRetrievalResponse(
        results=[_coerce_item(data)] if data.get("content") else [],
        metadata=N8nTraceMetadata(total_ms=elapsed_ms),
    )


def _coerce_item(raw: dict) -> N8nRetrievalResponse:
    """Best-effort coercion of a dict into an N8nResultItem."""
    from dc_agent.models.n8n import N8nResultItem

    return N8nResultItem(
        content=raw.get("content", raw.get("chunk_text", raw.get("text", ""))),
        source=raw.get("source", raw.get("product_name", "")),
        source_type=raw.get("source_type", "vector"),
        score=float(raw.get("score", raw.get("relevance_score", 0.0))),
        product_name=raw.get("product_name", ""),
        metadata={
            k: v
            for k, v in raw.items()
            if k not in ("content", "chunk_text", "text", "source", "source_type", "score", "relevance_score", "product_name")
        },
    )
