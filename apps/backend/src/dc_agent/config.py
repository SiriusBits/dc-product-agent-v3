from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    """Application settings."""
    
    # ChromaDB Configuration
    CHROMA_PERSIST_DIRECTORY: str = "data/chroma"
    CHROMA_COLLECTION_NAME: str = "product_documents"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
