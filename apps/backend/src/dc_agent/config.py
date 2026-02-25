from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    """Application settings."""
    
    # ChromaDB Configuration
    CHROMA_PERSIST_DIRECTORY: str = "data/chroma"
    CHROMA_COLLECTION_NAME: str = "product_documents"

    # Neo4j Configuration
    NEO4J_URI: str = "bolt://127.0.0.1:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"

    # Ollama Configuration (embeddings always use Ollama)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_EMBEDDING_MODEL: str = "nomic-embed-text:latest"
    OLLAMA_LLM_MODEL: str = "llama3.1:8b"

    # Graphiti LLM provider: "openai" (default) or "ollama"
    GRAPHITI_LLM_PROVIDER: str = "openai"
    GRAPHITI_LLM_MODEL: str = "gpt-4o-mini"

    # n8n Orchestration
    N8N_ENABLED: bool = True
    N8N_WEBHOOK_URL: str = "http://localhost:5678/webhook/retrieval"
    N8N_TIMEOUT: float = 10.0  # seconds

    # External Provider API Keys
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
