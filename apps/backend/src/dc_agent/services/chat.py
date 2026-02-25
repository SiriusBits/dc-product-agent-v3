"""Chat service for LLM-powered Q&A with RAG.

When n8n orchestration is enabled (``N8N_ENABLED=true``), the service
routes retrieval through the n8n webhook for intent classification and
hybrid search.  If n8n is unavailable or times out, it falls back
transparently to direct vector search.
"""

import logging
import uuid
from typing import List, Optional

from dc_agent.config import settings
from dc_agent.models.chat import (
    ChatMessage,
    ChatResponse,
    CitedSource,
)
from dc_agent.models.search import SearchResult
from dc_agent.services.search import SearchService, get_search_service
from dc_agent.services.llm import LLMService, get_llm_service
from dc_agent.services.n8n_client import N8nClient, N8nClientError
from dc_agent.retrieval.rag import RAGPipeline

logger = logging.getLogger(__name__)


class ChatService:
    """Service for chat-based Q&A using RAG with a pluggable LLM backend.
    
    This service:
    1. Retrieves relevant context — via n8n orchestration if available,
       falling back to direct vector search.
    2. Formats the context for the LLM
    3. Calls the selected LLM model to generate a response
    4. Returns the answer with cited sources
    """
    
    def __init__(
        self,
        search_service: Optional[SearchService] = None,
        llm_service: Optional[LLMService] = None,
        n8n_client: Optional[N8nClient] = None,
    ):
        """Initialize the ChatService.
        
        Args:
            search_service: SearchService instance. If not provided, uses singleton.
            llm_service: LLMService instance. If not provided, uses singleton.
            n8n_client: Optional N8nClient. Created from config if not provided.
        """
        self._search_service = search_service or get_search_service()
        self._llm_service = llm_service or get_llm_service()
        self._rag_pipeline = RAGPipeline()
        self._n8n_client = n8n_client or (N8nClient() if settings.N8N_ENABLED else None)
        
        logger.info(
            "ChatService initialized (n8n_enabled=%s)",
            self._n8n_client is not None,
        )
    
    @property
    def search_service(self) -> SearchService:
        """Get the underlying search service."""
        return self._search_service
    
    @property
    def llm_service(self) -> LLMService:
        """Get the underlying LLM service."""
        return self._llm_service
    
    async def chat(
        self,
        query: str,
        conversation_history: Optional[List[ChatMessage]] = None,
        conversation_id: Optional[str] = None,
        top_k: int = 5,
        model_id: Optional[str] = None,
    ) -> ChatResponse:
        """Process a chat query and return an answer with sources.
        
        Args:
            query: The user's question or message.
            conversation_history: Optional list of previous messages for context.
            conversation_id: Optional ID to continue an existing conversation.
            top_k: Number of context chunks to retrieve (default: 5).
            model_id: Optional model identifier to use for generation.
            
        Returns:
            ChatResponse with the answer, sources, and conversation ID.
        """
        logger.info(f"Processing chat query: '{query[:100]}...' with top_k={top_k}, model_id={model_id}")
        
        # Generate or use provided conversation ID
        conv_id = conversation_id or str(uuid.uuid4())
        
        # Step 1: Retrieve relevant context (n8n orchestrated or direct)
        search_results = await self._retrieve(
            query=query,
            top_k=top_k,
            conversation_id=conv_id,
        )
        
        logger.info(f"Retrieved {len(search_results)} context chunks for query")
        
        # Step 2: Handle case where no relevant context found
        if not search_results:
            logger.warning("No relevant context found for query")
            return ChatResponse(
                answer=self._rag_pipeline.get_no_context_response(),
                sources=[],
                conversation_id=conv_id,
            )
        
        # Step 3: Format context and build messages
        context = self._rag_pipeline.format_context(search_results)
        messages = self._rag_pipeline.build_messages(
            query=query,
            context=context,
            conversation_history=conversation_history,
        )
        
        # Step 4: Call LLM to generate response
        try:
            answer = await self._llm_service.generate(messages, model_id=model_id)
            logger.info(f"Successfully generated response using model {model_id or 'default'}")
        except (ValueError, RuntimeError) as e:
            logger.error(f"Failed to generate LLM response: {e}")
            raise RuntimeError(f"Failed to generate response: {e}") from e
        
        # Step 5: Extract sources from search results
        sources = self._rag_pipeline.extract_sources(search_results)
        
        return ChatResponse(
            answer=answer,
            sources=sources,
            conversation_id=conv_id,
        )


    # ------------------------------------------------------------------
    # Private retrieval helpers
    # ------------------------------------------------------------------

    async def _retrieve(
        self,
        query: str,
        top_k: int,
        conversation_id: str | None = None,
    ) -> List[SearchResult]:
        """Retrieve context — try n8n first, fall back to direct search."""
        if self._n8n_client is not None:
            try:
                return await self._retrieve_via_n8n(
                    query, top_k=top_k, conversation_id=conversation_id
                )
            except N8nClientError as exc:
                logger.warning(
                    "n8n retrieval failed, falling back to direct search: %s", exc
                )

        return self._retrieve_direct(query, top_k=top_k)

    async def _retrieve_via_n8n(
        self,
        query: str,
        *,
        top_k: int = 5,
        conversation_id: str | None = None,
    ) -> List[SearchResult]:
        """Retrieve via the n8n orchestration webhook."""
        response = await self._n8n_client.retrieve(
            query,
            conversation_id=conversation_id,
            top_k=top_k,
        )

        logger.info(
            "n8n retrieval: intent=%s, %d results in %.0fms",
            response.metadata.intent.value,
            len(response.results),
            response.metadata.total_ms,
        )

        # Convert n8n results to SearchResult for the existing pipeline
        return [
            SearchResult(
                product_id=item.metadata.get("product_id", ""),
                product_name=item.product_name or item.source,
                section_name=item.metadata.get("section", ""),
                chunk_text=item.content,
                relevance_score=item.score,
                chunk_type=item.source_type,
                doc_id=item.metadata.get("doc_id"),
            )
            for item in response.results
            if item.content  # skip empty results
        ]

    def _retrieve_direct(self, query: str, *, top_k: int = 5) -> List[SearchResult]:
        """Retrieve directly from the vector store (fallback path)."""
        search_response = self._search_service.semantic_search(
            query=query,
            top_k=top_k,
        )
        return search_response.results


# Singleton instance
_chat_service: Optional[ChatService] = None


def get_chat_service() -> ChatService:
    """Get the singleton ChatService instance."""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service
