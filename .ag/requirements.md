# Requirements Document

## Introduction

This specification defines the requirements for building Dixie Chemical Product Agent v3, a comprehensive agentic RAG (Retrieval-Augmented Generation) application. The system will provide intelligent search and question-answering capabilities over technical chemical product documents using a combination of vector databases, knowledge graphs, and modern web technologies. The project will be structured as a monorepo incorporating an existing PDF Data Extractor Utility and adding new layers for vector search, knowledge graph reasoning, and user interfaces.

## Requirements

### Requirement 1: Monorepo Architecture and Project Structure

**User Story:** As a developer, I want a well-organized monorepo structure so that I can efficiently manage multiple related applications and shared components.

#### Acceptance Criteria

1. WHEN setting up the project THEN the system SHALL create a Turbo Repo monorepo structure with apps and packages directories
2. WHEN organizing applications THEN the system SHALL include separate apps for backend API, frontend UI, and PDF extractor utility
3. WHEN managing shared code THEN the system SHALL provide packages for shared TypeScript types and JSON schemas
4. WHEN configuring build tools THEN the system SHALL use pnpm for Node.js dependencies and UV for Python dependencies
5. WHEN setting up development tools THEN the system SHALL include Makefiles for common development tasks
6. WHEN managing dependencies THEN the system SHALL never use `pip install` or `npm` commands, only UV and pnpm respectively

### Requirement 2: PDF Data Extraction and Validation Pipeline

**User Story:** As a data engineer, I want to integrate the existing PDF Data Extractor Utility so that I can process technical bulletins into structured, validated data.

#### Acceptance Criteria

1. WHEN migrating existing code THEN the system SHALL migrate the PDF Data Extractor Utility from `/Users/benjaminbykowski/projects/ai-apps/forks/qwen-dc-product/dc-product-agent` to the monorepo structure
2. WHEN integrating the extractor THEN the system SHALL incorporate the existing PDF Data Extractor Utility as a monorepo app under `apps/pdf-extractor/`
3. WHEN preserving functionality THEN the system SHALL maintain all existing extraction, validation, and ingestion capabilities
4. WHEN processing PDFs THEN the system SHALL extract structured data using tuned prompts and JSON schemas
5. WHEN validating extractions THEN the system SHALL validate all outputs against comprehensive JSON schemas
6. WHEN generating outputs THEN the system SHALL produce both base extractions and derived information with knowledge graph data
7. WHEN handling data formats THEN the system SHALL support both YAML and JSON formats with placeholder resolution
8. WHEN ensuring quality THEN the system SHALL include comprehensive unit tests for all extraction and validation logic

### Requirement 3: Vector Database Integration with Chroma

**User Story:** As a search engineer, I want a vector database system so that I can perform semantic search over technical document content.

#### Acceptance Criteria

1. WHEN implementing vector storage THEN the system SHALL use Chroma as the primary vector database
2. WHEN designing the interface THEN the system SHALL create a swappable vector database interface for future alternatives
3. WHEN ingesting documents THEN the system SHALL generate embeddings from processed PDF extracts
4. WHEN performing searches THEN the system SHALL support semantic similarity search with configurable parameters
5. WHEN managing metadata THEN the system SHALL store rich metadata including document provenance and section information
6. WHEN ensuring performance THEN the system SHALL achieve sub-300ms response times for vector searches

### Requirement 4: Knowledge Graph Implementation with Neo4j and Graphiti

**User Story:** As a knowledge engineer, I want a knowledge graph system so that I can represent and query relationships between chemical products, properties, and applications.

#### Acceptance Criteria

1. WHEN implementing the knowledge graph THEN the system SHALL use Neo4j as the graph database
2. WHEN managing entities THEN the system SHALL use Graphiti for entity and relationship management
3. WHEN ingesting data THEN the system SHALL extract entities and relationships from PDF extracts
4. WHEN querying relationships THEN the system SHALL support multi-hop traversal for finding related products and concepts
5. WHEN ensuring data quality THEN the system SHALL validate all entities and relationships against defined schemas
6. WHEN tracking provenance THEN the system SHALL maintain source attribution for all graph data

### Requirement 5: Hybrid Retrieval System

**User Story:** As an AI engineer, I want a hybrid retrieval system so that I can combine vector search and knowledge graph reasoning for comprehensive query answering.

#### Acceptance Criteria

1. WHEN processing queries THEN the system SHALL route queries to appropriate retrieval strategies based on query type
2. WHEN performing retrieval THEN the system SHALL combine results from vector search and knowledge graph traversal
3. WHEN ranking results THEN the system SHALL implement result fusion algorithms to optimize relevance
4. WHEN handling different query types THEN the system SHALL support specification lookups, application searches, product comparisons, and relationship exploration
5. WHEN ensuring performance THEN the system SHALL achieve sub-2s response times for complex hybrid queries
6. WHEN providing context THEN the system SHALL include source attribution and confidence scores for all results

### Requirement 6: FastAPI Backend with Comprehensive Services

**User Story:** As a backend developer, I want a robust API layer so that I can provide reliable access to all system functionality.

#### Acceptance Criteria

1. WHEN implementing the API THEN the system SHALL use FastAPI with async/await patterns
2. WHEN organizing code THEN the system SHALL structure services into logical modules (vector, kg, retrieval, models)
3. WHEN handling requests THEN the system SHALL provide endpoints for chat, search, product browsing, and knowledge graph queries
4. WHEN managing dependencies THEN the system SHALL use UV and pyproject.toml for all Python package management
5. WHEN ensuring quality THEN the system SHALL include comprehensive unit and integration tests
6. WHEN maintaining code quality THEN the system SHALL use ruff, black, and mypy for linting and type checking

### Requirement 7: Astro + React Frontend with Chat and Browse Interfaces

**User Story:** As an end user, I want intuitive web interfaces so that I can easily search for product information and interact with the system.

#### Acceptance Criteria

1. WHEN implementing the frontend THEN the system SHALL use Astro + React with TypeScript (no JavaScript)
2. WHEN styling the interface THEN the system SHALL use Tailwind CSS 4 for consistent design
3. WHEN building UI components THEN the system SHALL use ShadCN for consistent, accessible component library
4. WHEN providing chat functionality THEN the system SHALL include a conversational interface for natural language queries
5. WHEN browsing products THEN the system SHALL provide a searchable catalog with detailed product views
6. WHEN managing dependencies THEN the system SHALL use pnpm for all Node.js package management
7. WHEN ensuring quality THEN the system SHALL include comprehensive component and integration tests using Vitest

### Requirement 8: Docker-based Development and Deployment

**User Story:** As a DevOps engineer, I want containerized deployment so that I can run the system consistently across different environments.

#### Acceptance Criteria

1. WHEN setting up development THEN the system SHALL provide docker-compose configuration for local development
2. WHEN running AI models THEN the system SHALL access Ollama externally from Docker containers on macOS
3. WHEN deploying services THEN the system SHALL include Dockerfiles for all applications
4. WHEN managing infrastructure THEN the system SHALL include Neo4j, Chroma, and optional Neon Postgres containers
5. WHEN ensuring portability THEN the system SHALL support deployment to cloud hosting services
6. WHEN handling external dependencies THEN the system SHALL properly configure network access to external Ollama instance

### Requirement 9: n8n Workflow Automation

**User Story:** As a system administrator, I want automated workflows so that I can manage data processing and system maintenance tasks.

#### Acceptance Criteria

1. WHEN implementing automation THEN the system SHALL include n8n for workflow orchestration
2. WHEN processing data THEN the system SHALL automate PDF extraction and ingestion workflows
3. WHEN monitoring quality THEN the system SHALL implement automated data validation and quality checks
4. WHEN handling updates THEN the system SHALL provide workflows for refreshing data and reindexing
5. WHEN managing notifications THEN the system SHALL send alerts for system issues and data updates
6. WHEN ensuring reliability THEN the system SHALL include error handling and retry logic in all workflows

### Requirement 10: Context7 MCP Integration for Documentation Access

**User Story:** As a developer, I want integrated documentation access so that I can efficiently reference framework and library documentation during development and operation.

#### Acceptance Criteria

1. WHEN accessing documentation THEN the system SHALL integrate Context7 via Model Context Protocol (MCP)
2. WHEN configuring MCP THEN the system SHALL provide proper MCP server configuration for Context7
3. WHEN looking up documentation THEN the system SHALL provide access to documentation for Docker, n8n, UV, Chroma, FastAPI, Neo4j, Graphiti, Astro, React, Tailwind CSS 4, Turbo Repo, and ShadCN
4. WHEN managing context THEN the system SHALL provide relevant documentation context for development tasks
5. WHEN ensuring compatibility THEN the system SHALL maintain compatibility with Kiro IDE MCP integration
6. WHEN handling updates THEN the system SHALL support automatic documentation updates through MCP

### Requirement 11: Comprehensive Testing and Quality Assurance

**User Story:** As a quality engineer, I want comprehensive testing coverage so that I can ensure system reliability and maintainability.

#### Acceptance Criteria

1. WHEN testing Python code THEN the system SHALL include unit tests for all services and utilities
2. WHEN testing TypeScript code THEN the system SHALL include component and integration tests for all frontend functionality
3. WHEN validating data THEN the system SHALL include schema validation tests for all data structures
4. WHEN testing integrations THEN the system SHALL include end-to-end tests for critical user workflows
5. WHEN ensuring performance THEN the system SHALL include performance tests for search and retrieval operations
6. WHEN maintaining quality THEN the system SHALL achieve minimum 80% test coverage across all codebases

### Requirement 12: Development Tools and Workflow Integration

**User Story:** As a developer, I want efficient development tools so that I can work productively with the codebase.

#### Acceptance Criteria

1. WHEN setting up development THEN the system SHALL provide comprehensive Makefile commands for all common tasks
2. WHEN managing code quality THEN the system SHALL integrate linting, formatting, and type checking into development workflow
3. WHEN running tests THEN the system SHALL provide unified test commands across all applications
4. WHEN building applications THEN the system SHALL use Turbo Repo for efficient build orchestration
5. WHEN managing environments THEN the system SHALL provide clear environment configuration for development and production
6. WHEN debugging issues THEN the system SHALL include comprehensive logging and error handling throughout the system