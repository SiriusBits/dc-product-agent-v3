"""Chat service for LLM-powered Q&A with RAG."""

import logging
import uuid
from typing import List, Optional

import httpx

from dc_agent.config import settings
from dc_agent.models.chat import (
    ChatMessage,
    ChatResponse,
    CitedSource,
)
from dc_agent.models.search import SearchResult
from dc_agent.services.search import SearchService, get_search_service
from dc_agent.retrieval.rag import RAGPipeline

logger = logging.getLogger(__name__)


class ChatService:
    """Service for chat-based Q&A using RAG with Ollama LLM.
    
    This service:
    1. Retrieves relevant context from the vector store via SearchService
    2. Formats the context for the LLM
    3. Calls Ollama to generate a response
    4. Returns the answer with cited sources
    """
    
    def __init__(
        self,
        search_service: Optional[SearchService] = None,
        ollama_host: Optional[str] = None,
        ollama_model: Optional[str] = None,
    ):
        """Initialize the ChatService.
        
        Args:
            search_service: SearchService instance. If not provided, uses singleton.
            ollama_host: Ollama API host URL. Defaults to OLLAMA_BASE_URL setting.
            ollama_model: Ollama model name. Defaults to OLLAMA_LLM_MODEL setting.
        """
        self._search_service = search_service or get_search_service()
        self._ollama_host = ollama_host or settings.OLLAMA_BASE_URL
        self._ollama_model = ollama_model or settings.OLLAMA_LLM_MODEL
        self._rag_pipeline = RAGPipeline()
        
        logger.info(
            f"ChatService initialized with Ollama at {self._ollama_host} "
            f"using model {self._ollama_model}"
        )
    
    @property
    def search_service(self) -> SearchService:
        """Get the underlying search service."""
        return self._search_service
    
    @property
    def ollama_host(self) -> str:
        """Get the Ollama host URL."""
        return self._ollama_host
    
    @property
    def ollama_model(self) -> str:
        """Get the Ollama model name."""
        return self._ollama_model
    
    async def _call_ollama(self, messages: List[dict]) -> str:
        """Call Ollama API to generate a response.
        
        Args:
            messages: List of message dictionaries with role and content.
            
        Returns:
            Generated response text.
            
        Raises:
            httpx.HTTPError: If the Ollama API call fails.
        """
        payload = {
            "model": self._ollama_model,
            "messages": messages,
            "stream": False,
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            logger.debug(f"Calling Ollama at {self._ollama_host}/api/chat")
            response = await client.post(
                f"{self._ollama_host}/api/chat",
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
            
            return result["message"]["content"]
    
    async def chat(
        self,
        query: str,
        conversation_history: Optional[List[ChatMessage]] = None,
        conversation_id: Optional[str] = None,
        top_k: int = 5,
    ) -> ChatResponse:
        """Process a chat query and return an answer with sources.
        
        Args:
            query: The user's question or message.
            conversation_history: Optional list of previous messages for context.
            conversation_id: Optional ID to continue an existing conversation.
            top_k: Number of context chunks to retrieve (default: 5).
            
        Returns:
            ChatResponse with the answer, sources, and conversation ID.
        """
        logger.info(f"Processing chat query: '{query[:100]}...' with top_k={top_k}")
        
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
        
        # Step 4: Call Ollama to generate response
        try:
            answer = await self._call_ollama(messages)
            logger.info("Successfully generated response from Ollama")
        except httpx.HTTPError as e:
            logger.error(f"Failed to call Ollama: {e}")
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
