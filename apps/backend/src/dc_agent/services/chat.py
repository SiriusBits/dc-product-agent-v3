"""Chat service for LLM-powered Q&A with RAG."""

import logging
import uuid
from typing import List, Optional

from dc_agent.models.chat import (
    ChatMessage,
    ChatResponse,
    CitedSource,
)
from dc_agent.models.search import SearchResult
from dc_agent.services.search import SearchService, get_search_service
from dc_agent.services.llm import LLMService, get_llm_service
from dc_agent.retrieval.rag import RAGPipeline

logger = logging.getLogger(__name__)


class ChatService:
    """Service for chat-based Q&A using RAG with a pluggable LLM backend.
    
    This service:
    1. Retrieves relevant context from the vector store via SearchService
    2. Formats the context for the LLM
    3. Calls the selected LLM model to generate a response
    4. Returns the answer with cited sources
    """
    
    def __init__(
        self,
        search_service: Optional[SearchService] = None,
        llm_service: Optional[LLMService] = None,
    ):
        """Initialize the ChatService.
        
        Args:
            search_service: SearchService instance. If not provided, uses singleton.
            llm_service: LLMService instance. If not provided, uses singleton.
        """
        self._search_service = search_service or get_search_service()
        self._llm_service = llm_service or get_llm_service()
        self._rag_pipeline = RAGPipeline()
        
        logger.info("ChatService initialized with pluggable LLM backend")
    
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
        
        # Step 1: Retrieve relevant context
        search_response = self._search_service.semantic_search(
            query=query,
            top_k=top_k,
        )
        search_results = search_response.results
        
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


# Singleton instance
_chat_service: Optional[ChatService] = None


def get_chat_service() -> ChatService:
    """Get the singleton ChatService instance."""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service
