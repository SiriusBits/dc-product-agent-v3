"""Vector database configuration settings."""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum


class VectorStoreType(Enum):
    """Supported vector store types."""
    
    CHROMA = "chroma"
    PINECONE = "pinecone"  # Future support
    WEAVIATE = "weaviate"  # Future support
    QDRANT = "qdrant"      # Future support


@dataclass
class VectorStoreConfig:
    """Vector store configuration."""
    
    store_type: VectorStoreType
    host: str
    port: int
    ssl: bool = False
    headers: Optional[Dict[str, str]] = None
    api_key: Optional[str] = None
    timeout: int = 30
    max_retries: int = 3
    
    @classmethod
    def from_env(cls, store_type: VectorStoreType = VectorStoreType.CHROMA) -> "VectorStoreConfig":
        """Create configuration from environment variables.
        
        Args:
            store_type: Type of vector store to configure
            
        Returns:
            Vector store configuration
        """
        if store_type == VectorStoreType.CHROMA:
            return cls(
                store_type=store_type,
                host=os.getenv("CHROMA_HOST", "localhost"),
                port=int(os.getenv("CHROMA_PORT", "8001")),
                ssl=os.getenv("CHROMA_SSL", "false").lower() == "true",
                headers=cls._parse_headers(os.getenv("CHROMA_HEADERS")),
                timeout=int(os.getenv("CHROMA_TIMEOUT", "30")),
                max_retries=int(os.getenv("CHROMA_MAX_RETRIES", "3"))
            )
        else:
            raise ValueError(f"Unsupported vector store type: {store_type}")
    
    @staticmethod
    def _parse_headers(headers_str: Optional[str]) -> Optional[Dict[str, str]]:
        """Parse headers from environment variable string.
        
        Args:
            headers_str: Headers string in format "key1=value1,key2=value2"
            
        Returns:
            Headers dictionary or None
        """
        if not headers_str:
            return None
        
        headers = {}
        for header_pair in headers_str.split(","):
            if "=" in header_pair:
                key, value = header_pair.split("=", 1)
                headers[key.strip()] = value.strip()
        
        return headers if headers else None


@dataclass
class EmbeddingConfig:
    """Embedding model configuration."""
    
    model_name: str
    dimension: int
    provider: str = "sentence_transformers"
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    batch_size: int = 32
    max_length: int = 512
    
    @classmethod
    def get_default_configs(cls) -> Dict[str, "EmbeddingConfig"]:
        """Get default embedding configurations.
        
        Returns:
            Dictionary of embedding configurations
        """
        return {
            "nomic-embed-text": cls(
                model_name="nomic-ai/nomic-embed-text-v1",
                dimension=768,
                provider="sentence_transformers"
            ),
            "all-MiniLM-L6-v2": cls(
                model_name="all-MiniLM-L6-v2",
                dimension=384,
                provider="sentence_transformers"
            ),
            "all-mpnet-base-v2": cls(
                model_name="all-mpnet-base-v2",
                dimension=768,
                provider="sentence_transformers"
            ),
            "text-embedding-ada-002": cls(
                model_name="text-embedding-ada-002",
                dimension=1536,
                provider="openai",
                api_key=os.getenv("OPENAI_API_KEY")
            )
        }
    
    @classmethod
    def from_env(cls, model_name: str = "nomic-embed-text") -> "EmbeddingConfig":
        """Create embedding configuration from environment variables.
        
        Args:
            model_name: Name of the embedding model
            
        Returns:
            Embedding configuration
        """
        default_configs = cls.get_default_configs()
        
        if model_name in default_configs:
            config = default_configs[model_name]
            
            # Override with environment variables if present
            config.api_key = os.getenv("EMBEDDING_API_KEY", config.api_key)
            config.api_url = os.getenv("EMBEDDING_API_URL", config.api_url)
            config.batch_size = int(os.getenv("EMBEDDING_BATCH_SIZE", str(config.batch_size)))
            config.max_length = int(os.getenv("EMBEDDING_MAX_LENGTH", str(config.max_length)))
            
            return config
        else:
            # Create custom configuration from environment
            return cls(
                model_name=model_name,
                dimension=int(os.getenv("EMBEDDING_DIMENSION", "768")),
                provider=os.getenv("EMBEDDING_PROVIDER", "sentence_transformers"),
                api_key=os.getenv("EMBEDDING_API_KEY"),
                api_url=os.getenv("EMBEDDING_API_URL"),
                batch_size=int(os.getenv("EMBEDDING_BATCH_SIZE", "32")),
                max_length=int(os.getenv("EMBEDDING_MAX_LENGTH", "512"))
            )


class VectorStoreFactory:
    """Factory for creating vector store instances."""
    
    @staticmethod
    def create_vector_store(config: VectorStoreConfig) -> Any:
        """Create a vector store instance based on configuration.
        
        Args:
            config: Vector store configuration
            
        Returns:
            Vector store instance
        """
        if config.store_type == VectorStoreType.CHROMA:
            from .chroma_store import ChromaVectorStore
            
            return ChromaVectorStore(
                host=config.host,
                port=config.port,
                ssl=config.ssl,
                headers=config.headers
            )
        else:
            raise ValueError(f"Unsupported vector store type: {config.store_type}")
    
    @staticmethod
    def create_from_env(store_type: VectorStoreType = VectorStoreType.CHROMA) -> Any:
        """Create vector store from environment configuration.
        
        Args:
            store_type: Type of vector store to create
            
        Returns:
            Vector store instance
        """
        config = VectorStoreConfig.from_env(store_type)
        return VectorStoreFactory.create_vector_store(config)


# Default configurations
DEFAULT_VECTOR_STORE_CONFIG = VectorStoreConfig.from_env()
DEFAULT_EMBEDDING_CONFIG = EmbeddingConfig.from_env()

# Collection configurations
DEFAULT_COLLECTION_CONFIGS = {
    "technical_bulletins": {
        "dimension": 768,
        "description": "Technical bulletin documents and extracts",
        "embedding_model": "nomic-embed-text",
        "chunk_size": 1000,
        "chunk_overlap": 200
    },
    "product_specifications": {
        "dimension": 768,
        "description": "Product specification documents",
        "embedding_model": "nomic-embed-text",
        "chunk_size": 800,
        "chunk_overlap": 150
    },
    "application_guides": {
        "dimension": 768,
        "description": "Application and usage guides",
        "embedding_model": "nomic-embed-text",
        "chunk_size": 1200,
        "chunk_overlap": 250
    }
}