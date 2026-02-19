"""Pydantic models for chat functionality."""

from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum
import uuid


class MessageRole(str, Enum):
    """Role of a chat message sender."""
    
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    """Individual chat message with role and content."""
    
    role: MessageRole = Field(..., description="Role of the message sender.")
    content: str = Field(..., description="Content of the message.")


class ChatRequest(BaseModel):
    """Request model for the chat endpoint."""
    
    message: str = Field(..., description="The user's chat message.")
    conversation_history: Optional[List[ChatMessage]] = Field(
        default=None,
        description="Optional conversation history for context."
    )
    conversation_id: Optional[str] = Field(
        default=None,
        description="Optional conversation ID to continue an existing conversation."
    )


class CitedSource(BaseModel):
    """A source cited in a chat response."""
    
    product_name: str = Field(..., description="Name of the source product.")
    section: str = Field(..., description="Section name within the document.")
    relevance: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Relevance score (0-1, higher is more relevant)."
    )
    chunk_text: Optional[str] = Field(
        default=None,
        description="Text excerpt from the source (optional)."
    )
    product_id: Optional[str] = Field(
        default=None,
        description="Product identifier for linking."
    )


class ChatResponse(BaseModel):
    """Response model for the chat endpoint."""
    
    answer: str = Field(..., description="The generated answer from the LLM.")
    sources: List[CitedSource] = Field(
        default_factory=list,
        description="List of cited sources used to generate the answer."
    )
    conversation_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Conversation ID for continuing the conversation."
    )
