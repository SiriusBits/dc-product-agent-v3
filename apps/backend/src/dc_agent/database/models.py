"""SQLAlchemy database models."""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy import (
    String, Text, Integer, Float, Boolean, DateTime, JSON,
    ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class User(Base):
    """User model for authentication and authorization."""
    
    __tablename__ = "users"
    __table_args__ = {"schema": "auth"}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    conversations: Mapped[List["Conversation"]] = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"


class Session(Base):
    """User session model for JWT token management."""
    
    __tablename__ = "sessions"
    __table_args__ = {"schema": "auth"}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")
    
    def __repr__(self) -> str:
        return f"<Session(id={self.id}, user_id={self.user_id}, expires_at={self.expires_at})>"


class Conversation(Base):
    """Conversation model for chat history."""
    
    __tablename__ = "conversations"
    __table_args__ = {"schema": "metadata"}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"))
    title: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Conversation(id={self.id}, title='{self.title}', user_id={self.user_id})>"


class Message(Base):
    """Message model for chat messages."""
    
    __tablename__ = "messages"
    __table_args__ = {"schema": "metadata"}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("metadata.conversations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
    
    # Constraints
    __table_args__ = (
        {"schema": "metadata"},
        Index("idx_messages_conversation_id", "conversation_id"),
        Index("idx_messages_created_at", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<Message(id={self.id}, role='{self.role}', conversation_id={self.conversation_id})>"


class Document(Base):
    """Document model for tracking processed documents."""
    
    __tablename__ = "documents"
    __table_args__ = {"schema": "metadata"}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100))
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    processing_status: Mapped[str] = mapped_column(String(50), default="pending")
    extraction_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Indexes
    __table_args__ = (
        {"schema": "metadata"},
        Index("idx_documents_file_hash", "file_hash"),
        Index("idx_documents_processing_status", "processing_status"),
        Index("idx_documents_processed_at", "processed_at"),
    )
    
    def __repr__(self) -> str:
        return f"<Document(id={self.id}, filename='{self.filename}', status='{self.processing_status}')>"


class VectorCollection(Base):
    """Vector collection metadata model."""
    
    __tablename__ = "vector_collections"
    __table_args__ = {"schema": "metadata"}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    embedding_model: Mapped[str] = mapped_column(String(255), nullable=False)
    dimension: Mapped[int] = mapped_column(Integer, nullable=False)
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self) -> str:
        return f"<VectorCollection(id={self.id}, name='{self.name}', dimension={self.dimension})>"


class KnowledgeGraphEntity(Base):
    """Knowledge graph entity metadata model."""
    
    __tablename__ = "kg_entities"
    __table_args__ = {"schema": "metadata"}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    canonical_name: Mapped[str] = mapped_column(String(255), nullable=False)
    aliases: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String))
    source_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("metadata.documents.id"))
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    source_document: Mapped[Optional["Document"]] = relationship("Document")
    
    # Indexes
    __table_args__ = (
        {"schema": "metadata"},
        Index("idx_kg_entities_entity_id", "entity_id"),
        Index("idx_kg_entities_entity_type", "entity_type"),
        Index("idx_kg_entities_canonical_name", "canonical_name"),
    )
    
    def __repr__(self) -> str:
        return f"<KnowledgeGraphEntity(id={self.id}, entity_id='{self.entity_id}', type='{self.entity_type}')>"


class QueryLog(Base):
    """Query analytics model."""
    
    __tablename__ = "query_logs"
    __table_args__ = {"schema": "analytics"}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("auth.users.id"))
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    query_type: Mapped[Optional[str]] = mapped_column(String(50))
    response_time_ms: Mapped[Optional[int]] = mapped_column(Integer)
    result_count: Mapped[Optional[int]] = mapped_column(Integer)
    sources_used: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String))
    satisfaction_score: Mapped[Optional[int]] = mapped_column(Integer)  # 1-5 rating
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user: Mapped[Optional["User"]] = relationship("User")
    
    # Indexes
    __table_args__ = (
        {"schema": "analytics"},
        Index("idx_query_logs_user_id", "user_id"),
        Index("idx_query_logs_created_at", "created_at"),
        Index("idx_query_logs_query_type", "query_type"),
    )
    
    def __repr__(self) -> str:
        return f"<QueryLog(id={self.id}, query_type='{self.query_type}', user_id={self.user_id})>"


class SystemMetric(Base):
    """System metrics model."""
    
    __tablename__ = "system_metrics"
    __table_args__ = {"schema": "analytics"}
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    metric_name: Mapped[str] = mapped_column(String(100), nullable=False)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    metric_unit: Mapped[Optional[str]] = mapped_column(String(50))
    tags: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # Indexes
    __table_args__ = (
        {"schema": "analytics"},
        Index("idx_system_metrics_metric_name", "metric_name"),
        Index("idx_system_metrics_recorded_at", "recorded_at"),
    )
    
    def __repr__(self) -> str:
        return f"<SystemMetric(id={self.id}, name='{self.metric_name}', value={self.metric_value})>"