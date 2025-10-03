-- PostgreSQL Initialization Script for DC Agent Metadata Database
-- This script creates the initial schema for user data, sessions, and metadata

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS metadata;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Users and authentication
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

-- User sessions
CREATE TABLE IF NOT EXISTS auth.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation history
CREATE TABLE IF NOT EXISTS metadata.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS metadata.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES metadata.conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document metadata
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

-- Vector collection metadata
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

-- Knowledge graph metadata
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

-- Query analytics
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

-- System metrics
CREATE TABLE IF NOT EXISTS analytics.system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value FLOAT NOT NULL,
    metric_unit VARCHAR(50),
    tags JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON auth.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON auth.sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON metadata.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON metadata.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON metadata.messages(created_at);

CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON metadata.documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON metadata.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_processed_at ON metadata.documents(processed_at);

CREATE INDEX IF NOT EXISTS idx_kg_entities_entity_id ON metadata.kg_entities(entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_entities_entity_type ON metadata.kg_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_kg_entities_canonical_name ON metadata.kg_entities(canonical_name);

CREATE INDEX IF NOT EXISTS idx_query_logs_user_id ON analytics.query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_created_at ON analytics.query_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_query_logs_query_type ON analytics.query_logs(query_type);

CREATE INDEX IF NOT EXISTS idx_system_metrics_metric_name ON analytics.system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON analytics.system_metrics(recorded_at);

-- Create GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_messages_metadata_gin ON metadata.messages USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_documents_extraction_metadata_gin ON metadata.documents USING GIN (extraction_metadata);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags_gin ON analytics.system_metrics USING GIN (tags);

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS idx_messages_content_fts ON metadata.messages USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_documents_filename_fts ON metadata.documents USING GIN (to_tsvector('english', filename));

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON metadata.conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON metadata.documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vector_collections_updated_at BEFORE UPDATE ON metadata.vector_collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kg_entities_updated_at BEFORE UPDATE ON metadata.kg_entities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123 - should be changed in production)
INSERT INTO auth.users (username, email, password_hash, role) 
VALUES ('admin', 'admin@dixiechemical.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBdXzgVjHUxrLW', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Create default vector collection
INSERT INTO metadata.vector_collections (name, description, embedding_model, dimension)
VALUES ('technical_bulletins', 'Technical bulletin documents and extracts', 'nomic-embed-text', 768)
ON CONFLICT (name) DO NOTHING;

SELECT 'PostgreSQL metadata database initialized successfully' AS status;