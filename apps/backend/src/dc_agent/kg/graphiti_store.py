from graphiti_core import Graphiti
from dc_agent.config import settings
from typing import List, Dict, Any, Optional
import os

from dc_agent.kg.ollama_adapter import OllamaEmbedder, OllamaLLMClient

class GraphitiKGStore:
    """Graphiti implementation of the Knowledge Graph Store."""

    def __init__(self):
        # Initialize Adapters
        embedder = OllamaEmbedder(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_EMBEDDING_MODEL
        )
        llm_client = OllamaLLMClient(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_LLM_MODEL
        )

        # Initialize Graphiti client
        self.client = Graphiti(
            uri=settings.NEO4J_URI,
            user=settings.NEO4J_USER,
            password=settings.NEO4J_PASSWORD,
            embedder=embedder,
            llm_client=llm_client
        )

    async def close(self):
        await self.client.close()

    async def add_episode(self, name: str, text: str, source_description: str, reference_time: str):
        """Add an episode to the graph."""
        await self.client.add_episode(
            name=name,
            episode_body=text,
            source_description=source_description,
            reference_time=reference_time
        )

    async def search(self, query: str) -> str:
        """Search the graph."""
        # Search returns a SearchResults object, which we probably want to format or return as is.
        # Let's inspect what it returns or just return it. 
        # For the API response, we probably want the text answer or facts.
        results = await self.client.search(query)
        return results
