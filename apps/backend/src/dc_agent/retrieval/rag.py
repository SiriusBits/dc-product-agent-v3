"""RAG Pipeline for orchestrating retrieval and generation."""

import logging
from typing import List, Optional

from dc_agent.models.search import SearchResult
from dc_agent.models.chat import ChatMessage, MessageRole, CitedSource

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are a knowledgeable Dixie Chemical product expert assistant. Your role is to help users understand our chemical products, their properties, applications, and specifications.

When answering questions:
1. Base your answers on the provided context from our technical documentation
2. Be precise and technical when discussing product specifications
3. If the context doesn't contain enough information to fully answer a question, acknowledge this and provide what information is available
4. When referencing specific products, mention their names clearly
5. If asked about something outside the scope of the provided context, politely explain that you can only answer questions about Dixie Chemical products based on the available documentation

You may receive two types of context:
- **Document excerpts** (from vector search): prose text from technical bulletins. Use these for detailed explanations and descriptions.
- **Knowledge graph facts** (from KG): structured data about products including classifications, properties, applications, identifiers, and relationships. When you see structured KG data, treat property values and classifications as authoritative facts. Synthesize KG facts into natural language rather than listing them verbatim.

Always maintain a professional, helpful tone appropriate for technical chemical product inquiries."""


NO_CONTEXT_RESPONSE = """I apologize, but I couldn't find any relevant information in our product documentation to answer your question. 

Could you please:
- Rephrase your question with more specific product names or terms
- Ask about a specific Dixie Chemical product or product family
- Inquire about particular product properties, applications, or specifications

I'm here to help you find information about our chemical products from our technical bulletins."""


class RAGPipeline:
    """Pipeline for Retrieval-Augmented Generation.
    
    Orchestrates the retrieval of relevant context and generation of responses
    using an LLM with that context.
    """
    
    def __init__(self):
        """Initialize the RAG pipeline."""
        pass
    
    def build_system_prompt(self) -> str:
        """Build the system prompt for the LLM.
        
        Returns:
            System prompt string explaining the assistant's role.
        """
        return SYSTEM_PROMPT
    
    def format_context(self, search_results: List[SearchResult]) -> str:
        """Format search results as context for the LLM.

        Dispatches to specialised formatters based on the ``chunk_type``
        (source_type) of each result so that KG and vector results are
        presented differently.

        Args:
            search_results: List of search results (may include vector, kg,
                and graphiti results).

        Returns:
            Formatted context string with source attribution.
        """
        if not search_results:
            return ""

        vector_results = [r for r in search_results if r.chunk_type in (None, "vector", "section", "properties", "summary")]
        kg_results = [r for r in search_results if r.chunk_type in ("kg", "graphiti")]

        parts: list[str] = []

        if kg_results:
            parts.append(self._format_kg_context(kg_results))
        if vector_results:
            parts.append(self._format_vector_context(vector_results, start_index=len(kg_results) + 1))

        return "\n\n".join(parts)

    # -- private formatters -------------------------------------------------

    @staticmethod
    def _format_vector_context(
        results: List[SearchResult],
        start_index: int = 1,
    ) -> str:
        """Format vector (prose) search results."""
        parts = ["Here is the relevant information from our technical documentation:\n"]
        for i, result in enumerate(results, start_index):
            header = f"[Source {i}: {result.product_name}"
            if result.section_name:
                header += f" - {result.section_name}"
            header += f"] (Relevance: {result.relevance_score:.2f})"
            parts.append(header)
            parts.append(result.chunk_text)
            parts.append("")  # blank line
        return "\n".join(parts)

    @staticmethod
    def _format_kg_context(results: List[SearchResult]) -> str:
        """Format knowledge-graph results as structured facts."""
        parts = ["Here are structured facts from the knowledge graph:\n"]
        for i, result in enumerate(results, 1):
            label = f"[KG Fact {i}"
            if result.product_name:
                label += f": {result.product_name}"
            label += "]"
            parts.append(label)
            parts.append(result.chunk_text)
            parts.append("")  # blank line
        return "\n".join(parts)
    
    def build_messages(
        self,
        query: str,
        context: str,
        conversation_history: Optional[List[ChatMessage]] = None,
    ) -> List[dict]:
        """Build the message list for the LLM API call.
        
        Args:
            query: The user's current query.
            context: Formatted context from retrieval.
            conversation_history: Optional previous conversation messages.
            
        Returns:
            List of message dictionaries for the LLM.
        """
        messages = []
        
        # Add system prompt
        messages.append({
            "role": "system",
            "content": self.build_system_prompt()
        })
        
        # Add conversation history if provided
        if conversation_history:
            for msg in conversation_history:
                messages.append({
                    "role": msg.role.value,
                    "content": msg.content
                })
        
        # Build user message with context
        if context:
            user_content = f"""Based on the following context, please answer my question.

{context}

Question: {query}

Please provide a comprehensive answer based on the context above. If the context doesn't fully address the question, say so."""
        else:
            user_content = query
        
        messages.append({
            "role": "user",
            "content": user_content
        })
        
        return messages
    
    def extract_sources(self, search_results: List[SearchResult]) -> List[CitedSource]:
        """Extract cited sources from search results.

        Handles both vector results (with section names) and KG results
        (with entity labels / source types).

        Args:
            search_results: List of search results.

        Returns:
            List of CitedSource objects.
        """
        sources: list[CitedSource] = []
        seen: set[tuple[str, str]] = set()

        for result in search_results:
            source_type = result.chunk_type or "vector"

            if source_type in ("kg", "graphiti"):
                # KG provenance: use product_name + source_type as key
                key = (result.product_name, source_type)
                section_label = f"Knowledge Graph ({source_type})"
            else:
                key = (result.product_name, result.section_name)
                section_label = result.section_name

            if key not in seen:
                seen.add(key)
                excerpt = result.chunk_text
                if len(excerpt) > 200:
                    excerpt = excerpt[:200] + "..."
                sources.append(CitedSource(
                    product_name=result.product_name,
                    section=section_label,
                    relevance=result.relevance_score,
                    chunk_text=excerpt,
                    product_id=result.product_id,
                ))

        return sources
    
    def get_no_context_response(self) -> str:
        """Get the response for when no relevant context is found.
        
        Returns:
            Default response explaining no relevant information was found.
        """
        return NO_CONTEXT_RESPONSE
