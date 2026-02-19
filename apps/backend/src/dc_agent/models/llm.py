"""LLM model configuration and available models."""

from enum import Enum
from typing import List

from pydantic import BaseModel, Field


class ModelProvider(str, Enum):
    """Supported LLM providers."""

    OLLAMA = "ollama"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class ModelConfig(BaseModel):
    """Configuration for a single LLM model."""

    id: str = Field(..., description="Unique identifier used in API requests.")
    name: str = Field(..., description="Human-readable display name.")
    provider: ModelProvider = Field(..., description="Which provider serves this model.")
    model_id: str = Field(
        ...,
        description="Provider-specific model identifier passed to the provider API.",
    )
    description: str = Field(default="", description="Short description of the model.")


class ModelListResponse(BaseModel):
    """Response model for the GET /models endpoint."""

    models: List[ModelConfig]
    count: int


AVAILABLE_MODELS: List[ModelConfig] = [
    # Ollama (local) models
    ModelConfig(
        id="ollama/gpt-oss:20b",
        name="GPT-OSS 20B",
        provider=ModelProvider.OLLAMA,
        model_id="gpt-oss:20b",
        description="Local open-source 20B parameter model via Ollama.",
    ),
    ModelConfig(
        id="ollama/qwen2.5:14b",
        name="Qwen 2.5 14B",
        provider=ModelProvider.OLLAMA,
        model_id="qwen2.5:14b",
        description="Local Qwen 2.5 14B parameter model via Ollama.",
    ),
    # OpenAI models
    ModelConfig(
        id="openai/gpt-4o",
        name="GPT-4o",
        provider=ModelProvider.OPENAI,
        model_id="gpt-4o",
        description="OpenAI GPT-4o multimodal model.",
    ),
    ModelConfig(
        id="openai/gpt-5.2",
        name="GPT-5.2",
        provider=ModelProvider.OPENAI,
        model_id="gpt-5.2",
        description="OpenAI GPT-5.2 latest generation model.",
    ),
    # Anthropic models
    ModelConfig(
        id="anthropic/claude-sonnet-4.6",
        name="Claude Sonnet 4.6",
        provider=ModelProvider.ANTHROPIC,
        model_id="claude-sonnet-4.6",
        description="Anthropic Claude Sonnet 4.6 balanced model.",
    ),
    ModelConfig(
        id="anthropic/claude-haiku-4.5",
        name="Claude Haiku 4.5",
        provider=ModelProvider.ANTHROPIC,
        model_id="claude-haiku-4.5",
        description="Anthropic Claude Haiku 4.5 fast model.",
    ),
]

DEFAULT_MODEL_ID = "ollama/qwen2.5:14b"


def get_model_config(model_id: str) -> ModelConfig | None:
    """Look up a model config by its ID.

    Args:
        model_id: The unique model identifier.

    Returns:
        The matching ModelConfig or None if not found.
    """
    for model in AVAILABLE_MODELS:
        if model.id == model_id:
            return model
    return None
