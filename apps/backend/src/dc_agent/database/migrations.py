"""Database migration management."""

import logging
import os
from typing import List, Dict, Any, Optional
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .connection import DatabaseManager
from .models import Base

logger = logging.getLogger(__name__)


class Migration:
    """Represents a database migration."""
    
    def __init__(
        self,
        version: str,
        description: str,
        up_sql: str,
        down_sql: Optional[str] = None
    ):
        """Initialize migration.
        
        Args:
            version: Migration version (e.g., "001", "002")
            description: Migration description
            up_sql: SQL to apply migration
            down_sql: SQL to rollback migration (optional)
        """
        self.version = version
        self.description = description
        self.up_sql = up_sql
        self.down_sql = down_sql
        self.timestamp = datetime.utcnow()
    
    def __repr__(self) -> str:
        return f"<Migration(version='{self.version}', description='{self.description}')>"


class MigrationManager:
    """Manages database migrations."""
    
    def __init__(self, db_manager: DatabaseManager):
        """Initialize migration manager.
        
        Args:
            db_manager: Database manager instance
        """
        self.db_manager = db_manager
        self.migrations: List[Migration] = []
        self._load_migrations()
    
    def _load_migrations(self) -> None:
        """Load migration definitions."""
        # Migration 001: Create schemas
        self.migrations.append(Migration(
            version="001",
            description="Create database schemas",
            up_sql="""
                CREATE SCHEMA IF NOT EXISTS auth;
                CREATE SCHEMA IF NOT EXISTS metadata;
                CREATE SCHEMA IF NOT EXISTS analytics;
                
                -- Enable extensions
                CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
                CREATE EXTENSION IF NOT EXISTS "pg_trgm";
            """,
            down_sql="""
                DROP SCHEMA IF EXISTS analytics CASCADE;
                DROP SCHEMA IF EXISTS metadata CASCADE;
                DROP SCHEMA IF EXISTS auth CASCADE;
            """
        ))
        
        # Migration 002: Create migration tracking table
        self.migrations.append(Migration(
            version="002",
            description="Create migration tracking table",
            up_sql="""
                CREATE TABLE IF NOT EXISTS public.schema_migrations (
                    version VARCHAR(255) PRIMARY KEY,
                    description TEXT NOT NULL,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    applied_by VARCHAR(255) DEFAULT CURRENT_USER
                );
                
                CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
                ON public.schema_migrations(applied_at);
            """,
            down_sql="""
                DROP TABLE IF EXISTS public.schema_migrations;
            """
        ))
        
        # Migration 003: Create auth tables
        self.migrations.append(Migration(
            version="003",
            description="Create authentication tables",
            up_sql="""
                -- Users table
                CREATE TABLE IF NOT EXISTS auth.users (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    username VARCHAR(255) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(50) DEFAULT 'user',
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- Sessions table
                CREATE TABLE IF NOT EXISTS auth.sessions (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
                    token_hash VARCHAR(255) NOT NULL,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- Indexes
                CREATE INDEX IF NOT EXISTS idx_users_username ON auth.users(username);
                CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users(email);
                CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth.sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON auth.sessions(expires_at);
            """,
            down_sql="""
                DROP TABLE IF EXISTS auth.sessions;
                DROP TABLE IF EXISTS auth.users;
            """
        ))
        
        # Migration 004: Create metadata tables
        self.migrations.append(Migration(
            version="004",
            description="Create metadata tables",
            up_sql="""
                -- Conversations table
                CREATE TABLE IF NOT EXISTS metadata.conversations (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
                    title VARCHAR(255),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- Messages table
                CREATE TABLE IF NOT EXISTS metadata.messages (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    conversation_id UUID REFERENCES metadata.conversations(id) ON DELETE CASCADE,
                    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    metadata JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- Documents table
                CREATE TABLE IF NOT EXISTS metadata.documents (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    filename VARCHAR(255) NOT NULL,
                    file_path VARCHAR(500) NOT NULL,
                    file_hash VARCHAR(64) UNIQUE NOT NULL,
                    file_size BIGINT NOT NULL,
                    mime_type VARCHAR(100),
                    processed_at TIMESTAMP WITH TIME ZONE,
                    processing_status VARCHAR(50) DEFAULT 'pending',
                    extraction_metadata JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- Vector collections table
                CREATE TABLE IF NOT EXISTS metadata.vector_collections (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    name VARCHAR(255) UNIQUE NOT NULL,
                    description TEXT,
                    embedding_model VARCHAR(255) NOT NULL,
                    dimension INTEGER NOT NULL,
                    document_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- Knowledge graph entities table
                CREATE TABLE IF NOT EXISTS metadata.kg_entities (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    entity_id VARCHAR(255) UNIQUE NOT NULL,
                    entity_type VARCHAR(100) NOT NULL,
                    canonical_name VARCHAR(255) NOT NULL,
                    aliases TEXT[],
                    source_document_id UUID REFERENCES metadata.documents(id),
                    confidence FLOAT DEFAULT 1.0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- Indexes
                CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON metadata.conversations(user_id);
                CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON metadata.messages(conversation_id);
                CREATE INDEX IF NOT EXISTS idx_messages_created_at ON metadata.messages(created_at);
                CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON metadata.documents(file_hash);
                CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON metadata.documents(processing_status);
                CREATE INDEX IF NOT EXISTS idx_documents_processed_at ON metadata.documents(processed_at);
                CREATE INDEX IF NOT EXISTS idx_kg_entities_entity_id ON metadata.kg_entities(entity_id);
                CREATE INDEX IF NOT EXISTS idx_kg_entities_entity_type ON metadata.kg_entities(entity_type);
                CREATE INDEX IF NOT EXISTS idx_kg_entities_canonical_name ON metadata.kg_entities(canonical_name);
                
                -- GIN indexes for JSONB
                CREATE INDEX IF NOT EXISTS idx_messages_metadata_gin ON metadata.messages USING GIN (metadata);
                CREATE INDEX IF NOT EXISTS idx_documents_extraction_metadata_gin ON metadata.documents USING GIN (extraction_metadata);
                
                -- Full-text search indexes
                CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON metadata.messages USING GIN (to_tsvector('english', content));
                CREATE INDEX IF NOT EXISTS idx_documents_filename_fts ON metadata.documents USING GIN (to_tsvector('english', filename));
            """,
            down_sql="""
                DROP TABLE IF EXISTS metadata.kg_entities;
                DROP TABLE IF EXISTS metadata.vector_collections;
                DROP TABLE IF EXISTS metadata.documents;
                DROP TABLE IF EXISTS metadata.messages;
                DROP TABLE IF EXISTS metadata.conversations;
            """
        ))
        
        # Migration 005: Create analytics tables
        self.migrations.append(Migration(
            version="005",
            description="Create analytics tables",
            up_sql="""
                -- Query logs table
                CREATE TABLE IF NOT EXISTS analytics.query_logs (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    user_id UUID REFERENCES auth.users(id),
                    query_text TEXT NOT NULL,
                    query_type VARCHAR(50),
                    response_time_ms INTEGER,
                    result_count INTEGER,
                    sources_used VARCHAR(100)[],
                    satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- System metrics table
                CREATE TABLE IF NOT EXISTS analytics.system_metrics (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    metric_name VARCHAR(100) NOT NULL,
                    metric_value FLOAT NOT NULL,
                    metric_unit VARCHAR(50),
                    tags JSONB,
                    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- Indexes
                CREATE INDEX IF NOT EXISTS idx_query_logs_user_id ON analytics.query_logs(user_id);
                CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON analytics.query_logs(created_at);
                CREATE INDEX IF NOT EXISTS idx_query_logs_query_type ON analytics.query_logs(query_type);
                CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_name ON analytics.system_metrics(metric_name);
                CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON analytics.system_metrics(recorded_at);
                CREATE INDEX IF NOT EXISTS idx_system_metrics_tags_gin ON analytics.system_metrics USING GIN (tags);
            """,
            down_sql="""
                DROP TABLE IF EXISTS analytics.system_metrics;
                DROP TABLE IF EXISTS analytics.query_logs;
            """
        ))
        
        # Migration 006: Create triggers and functions
        self.migrations.append(Migration(
            version="006",
            description="Create triggers and functions",
            up_sql="""
                -- Function to update updated_at timestamp
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
                
                -- Triggers for updated_at
                CREATE TRIGGER update_users_updated_at 
                    BEFORE UPDATE ON auth.users 
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                
                CREATE TRIGGER update_conversations_updated_at 
                    BEFORE UPDATE ON metadata.conversations 
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                
                CREATE TRIGGER update_documents_updated_at 
                    BEFORE UPDATE ON metadata.documents 
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                
                CREATE TRIGGER update_vector_collections_updated_at 
                    BEFORE UPDATE ON metadata.vector_collections 
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
                
                CREATE TRIGGER update_kg_entities_updated_at 
                    BEFORE UPDATE ON metadata.kg_entities 
                    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            """,
            down_sql="""
                DROP TRIGGER IF EXISTS update_kg_entities_updated_at ON metadata.kg_entities;
                DROP TRIGGER IF EXISTS update_vector_collections_updated_at ON metadata.vector_collections;
                DROP TRIGGER IF EXISTS update_documents_updated_at ON metadata.documents;
                DROP TRIGGER IF EXISTS update_conversations_updated_at ON metadata.conversations;
                DROP TRIGGER IF EXISTS update_users_updated_at ON auth.users;
                DROP FUNCTION IF EXISTS update_updated_at_column();
            """
        ))
        
        # Migration 007: Insert default data
        self.migrations.append(Migration(
            version="007",
            description="Insert default data",
            up_sql="""
                -- Insert default admin user (password: admin123)
                INSERT INTO auth.users (username, email, password_hash, role) 
                VALUES ('admin', 'admin@dixiechemical.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXzgVjHUxrLW', 'admin')
                ON CONFLICT (username) DO NOTHING;
                
                -- Insert default vector collection
                INSERT INTO metadata.vector_collections (name, description, embedding_model, dimension)
                VALUES ('technical_bulletins', 'Technical bulletin documents and extracts', 'nomic-embed-text', 768)
                ON CONFLICT (name) DO NOTHING;
            """,
            down_sql="""
                DELETE FROM metadata.vector_collections WHERE name = 'technical_bulletins';
                DELETE FROM auth.users WHERE username = 'admin';
            """
        ))
    
    async def get_applied_migrations(self) -> List[str]:
        """Get list of applied migration versions.
        
        Returns:
            List of applied migration versions
        """
        try:
            async with self.db_manager.get_connection() as conn:
                # Check if migrations table exists
                table_exists = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'schema_migrations'
                    )
                """)
                
                if not table_exists:
                    return []
                
                # Get applied migrations
                rows = await conn.fetch("""
                    SELECT version FROM public.schema_migrations 
                    ORDER BY version
                """)
                
                return [row['version'] for row in rows]
                
        except Exception as e:
            logger.error(f"Failed to get applied migrations: {e}")
            return []
    
    async def apply_migration(self, migration: Migration) -> bool:
        """Apply a single migration.
        
        Args:
            migration: Migration to apply
            
        Returns:
            True if successful
        """
        try:
            async with self.db_manager.get_connection() as conn:
                async with conn.transaction():
                    # Execute migration SQL
                    await conn.execute(migration.up_sql)
                    
                    # Record migration
                    await conn.execute("""
                        INSERT INTO public.schema_migrations (version, description)
                        VALUES ($1, $2)
                        ON CONFLICT (version) DO NOTHING
                    """, migration.version, migration.description)
                    
                    logger.info(f"Applied migration {migration.version}: {migration.description}")
                    return True
                    
        except Exception as e:
            logger.error(f"Failed to apply migration {migration.version}: {e}")
            return False
    
    async def rollback_migration(self, migration: Migration) -> bool:
        """Rollback a single migration.
        
        Args:
            migration: Migration to rollback
            
        Returns:
            True if successful
        """
        if not migration.down_sql:
            logger.error(f"Migration {migration.version} has no rollback SQL")
            return False
        
        try:
            async with self.db_manager.get_connection() as conn:
                async with conn.transaction():
                    # Execute rollback SQL
                    await conn.execute(migration.down_sql)
                    
                    # Remove migration record
                    await conn.execute("""
                        DELETE FROM public.schema_migrations 
                        WHERE version = $1
                    """, migration.version)
                    
                    logger.info(f"Rolled back migration {migration.version}: {migration.description}")
                    return True
                    
        except Exception as e:
            logger.error(f"Failed to rollback migration {migration.version}: {e}")
            return False
    
    async def migrate_up(self, target_version: Optional[str] = None) -> bool:
        """Apply migrations up to target version.
        
        Args:
            target_version: Target migration version (None for latest)
            
        Returns:
            True if all migrations applied successfully
        """
        applied_migrations = await self.get_applied_migrations()
        
        success = True
        for migration in self.migrations:
            # Skip if already applied
            if migration.version in applied_migrations:
                continue
            
            # Stop if we've reached target version
            if target_version and migration.version > target_version:
                break
            
            # Apply migration
            if not await self.apply_migration(migration):
                success = False
                break
        
        return success
    
    async def migrate_down(self, target_version: str) -> bool:
        """Rollback migrations down to target version.
        
        Args:
            target_version: Target migration version
            
        Returns:
            True if all rollbacks successful
        """
        applied_migrations = await self.get_applied_migrations()
        
        # Find migrations to rollback (in reverse order)
        migrations_to_rollback = []
        for migration in reversed(self.migrations):
            if migration.version in applied_migrations and migration.version > target_version:
                migrations_to_rollback.append(migration)
        
        success = True
        for migration in migrations_to_rollback:
            if not await self.rollback_migration(migration):
                success = False
                break
        
        return success
    
    async def get_migration_status(self) -> Dict[str, Any]:
        """Get current migration status.
        
        Returns:
            Migration status information
        """
        applied_migrations = await self.get_applied_migrations()
        
        pending_migrations = []
        for migration in self.migrations:
            if migration.version not in applied_migrations:
                pending_migrations.append({
                    "version": migration.version,
                    "description": migration.description
                })
        
        return {
            "total_migrations": len(self.migrations),
            "applied_count": len(applied_migrations),
            "pending_count": len(pending_migrations),
            "applied_migrations": applied_migrations,
            "pending_migrations": pending_migrations,
            "latest_version": self.migrations[-1].version if self.migrations else None,
            "current_version": applied_migrations[-1] if applied_migrations else None
        }
    
    async def reset_database(self) -> bool:
        """Reset database by dropping all schemas and reapplying migrations.
        
        WARNING: This will destroy all data!
        
        Returns:
            True if successful
        """
        try:
            async with self.db_manager.get_connection() as conn:
                async with conn.transaction():
                    # Drop all schemas
                    await conn.execute("DROP SCHEMA IF EXISTS analytics CASCADE")
                    await conn.execute("DROP SCHEMA IF EXISTS metadata CASCADE")
                    await conn.execute("DROP SCHEMA IF EXISTS auth CASCADE")
                    await conn.execute("DROP TABLE IF EXISTS public.schema_migrations")
                    
                    logger.info("Database reset completed")
            
            # Reapply all migrations
            return await self.migrate_up()
            
        except Exception as e:
            logger.error(f"Failed to reset database: {e}")
            return False