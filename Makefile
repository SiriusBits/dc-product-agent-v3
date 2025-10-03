# Dixie Chemical Product Agent v3 - Development Makefile
.PHONY: help install dev build test lint format clean docker-up docker-down setup-env

# Default target
help: ## Show this help message
	@echo "Dixie Chemical Product Agent v3 - Development Commands"
	@echo "======================================================"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  %-20s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# Environment setup
setup-env: ## Set up development environment
	@echo "Setting up development environment..."
	@if ! command -v uv >/dev/null 2>&1; then \
		echo "Error: UV is not installed. Please install UV first."; \
		echo "Visit: https://docs.astral.sh/uv/getting-started/installation/"; \
		exit 1; \
	fi
	@if ! command -v pnpm >/dev/null 2>&1; then \
		echo "Error: pnpm is not installed. Please install pnpm first."; \
		echo "Run: npm install -g pnpm"; \
		exit 1; \
	fi
	@echo "✓ UV and pnpm are available"

# Installation
install: setup-env ## Install all dependencies
	@echo "Installing Node.js dependencies..."
	pnpm install
	@echo "Installing Python dependencies for backend..."
	cd apps/backend && uv sync --dev
	@echo "Installing Python dependencies for PDF extractor..."
	cd apps/pdf-extractor && uv sync --dev
	@echo "✓ All dependencies installed"

install-backend: ## Install backend Python dependencies only
	cd apps/backend && uv sync --dev

install-frontend: ## Install frontend Node.js dependencies only
	pnpm install --filter=dc-agent-frontend

install-extractor: ## Install PDF extractor Python dependencies only
	cd apps/pdf-extractor && uv sync --dev

# Development
dev: ## Start all development servers
	@echo "Starting development servers..."
	pnpm turbo run dev

dev-backend: ## Start backend development server only
	cd apps/backend && uv run uvicorn src.dc_agent.main:app --reload --host 0.0.0.0 --port 8080

dev-frontend: ## Start frontend development server only
	cd apps/frontend && pnpm dev

dev-docker: ## Start development with Docker services
	docker-compose -f infrastructure/docker/docker-compose.yml up -d
	@echo "Docker services started. Run 'make dev' to start application servers."

# Building
build: ## Build all applications
	pnpm turbo run build

build-backend: ## Build backend application
	cd apps/backend && uv build

build-frontend: ## Build frontend application
	cd apps/frontend && pnpm build

# Testing
test: ## Run all tests
	pnpm turbo run test

test-backend: ## Run backend tests only
	cd apps/backend && uv run pytest

test-frontend: ## Run frontend tests only
	cd apps/frontend && pnpm test

test-extractor: ## Run PDF extractor tests only
	cd apps/pdf-extractor && uv run pytest

test-unit: ## Run unit tests only
	pnpm turbo run test:unit

test-integration: ## Run integration tests only
	pnpm turbo run test:integration

test-watch: ## Run tests in watch mode
	cd apps/frontend && pnpm test:watch

# Code quality
lint: ## Run linting for all projects
	pnpm turbo run lint
	@echo "Running Python linting..."
	cd apps/backend && uv run ruff check .
	cd apps/pdf-extractor && uv run ruff check .

lint-fix: ## Fix linting issues
	@echo "Fixing TypeScript linting issues..."
	cd apps/frontend && pnpm lint --fix
	@echo "Fixing Python linting issues..."
	cd apps/backend && uv run ruff check --fix .
	cd apps/pdf-extractor && uv run ruff check --fix .

format: ## Format all code
	@echo "Formatting TypeScript code..."
	pnpm format
	@echo "Formatting Python code..."
	cd apps/backend && uv run black .
	cd apps/pdf-extractor && uv run black .

type-check: ## Run type checking
	pnpm turbo run type-check
	@echo "Running Python type checking..."
	cd apps/backend && uv run mypy src/
	cd apps/pdf-extractor && uv run mypy src/

# Docker operations
docker-up: ## Start all Docker services
	docker-compose -f infrastructure/docker/docker-compose.yml up -d

docker-down: ## Stop all Docker services
	docker-compose -f infrastructure/docker/docker-compose.yml down

docker-logs: ## View Docker service logs
	docker-compose -f infrastructure/docker/docker-compose.yml logs -f

docker-build: ## Build Docker images
	docker-compose -f infrastructure/docker/docker-compose.yml build

docker-clean: ## Clean Docker containers and volumes
	docker-compose -f infrastructure/docker/docker-compose.yml down -v
	docker system prune -f

docker-restart: ## Restart all Docker services
	docker-compose -f infrastructure/docker/docker-compose.yml restart

docker-rebuild: ## Rebuild and restart all Docker services
	docker-compose -f infrastructure/docker/docker-compose.yml down
	docker-compose -f infrastructure/docker/docker-compose.yml up -d --build

# Infrastructure setup and management
setup-infrastructure: ## Set up and initialize all infrastructure services
	cd infrastructure/docker && ./setup-infrastructure.sh

# Individual service management
neo4j-up: ## Start Neo4j service
	docker-compose -f infrastructure/docker/docker-compose.yml up -d neo4j

neo4j-down: ## Stop Neo4j service
	docker-compose -f infrastructure/docker/docker-compose.yml stop neo4j

neo4j-logs: ## View Neo4j logs
	docker-compose -f infrastructure/docker/docker-compose.yml logs -f neo4j

chroma-up: ## Start Chroma service
	docker-compose -f infrastructure/docker/docker-compose.yml up -d chroma

chroma-down: ## Stop Chroma service
	docker-compose -f infrastructure/docker/docker-compose.yml stop chroma

chroma-logs: ## View Chroma logs
	docker-compose -f infrastructure/docker/docker-compose.yml logs -f chroma

postgres-up: ## Start PostgreSQL service
	docker-compose -f infrastructure/docker/docker-compose.yml up -d postgres

postgres-down: ## Stop PostgreSQL service
	docker-compose -f infrastructure/docker/docker-compose.yml stop postgres

postgres-logs: ## View PostgreSQL logs
	docker-compose -f infrastructure/docker/docker-compose.yml logs -f postgres

n8n-up: ## Start n8n service
	docker-compose -f infrastructure/docker/docker-compose.yml up -d n8n

n8n-down: ## Stop n8n service
	docker-compose -f infrastructure/docker/docker-compose.yml stop n8n

n8n-logs: ## View n8n logs
	docker-compose -f infrastructure/docker/docker-compose.yml logs -f n8n

redis-up: ## Start Redis service
	docker-compose -f infrastructure/docker/docker-compose.yml up -d redis

redis-down: ## Stop Redis service
	docker-compose -f infrastructure/docker/docker-compose.yml stop redis

redis-logs: ## View Redis logs
	docker-compose -f infrastructure/docker/docker-compose.yml logs -f redis

minio-up: ## Start MinIO service
	docker-compose -f infrastructure/docker/docker-compose.yml up -d minio

minio-down: ## Stop MinIO service
	docker-compose -f infrastructure/docker/docker-compose.yml stop minio

minio-logs: ## View MinIO logs
	docker-compose -f infrastructure/docker/docker-compose.yml logs -f minio

# Database operations
db-reset: ## Reset all databases (WARNING: destroys data)
	@echo "Resetting databases..."
	docker-compose -f infrastructure/docker/docker-compose.yml down -v
	docker-compose -f infrastructure/docker/docker-compose.yml up -d neo4j chroma postgres
	@echo "Databases reset. Waiting for services to be ready..."
	sleep 10

# Data operations
ingest-sample: ## Ingest sample PDF data
	cd apps/pdf-extractor && uv run python -m dc_extractor.ingest --sample

extract-pdf: ## Extract data from a specific PDF (usage: make extract-pdf PDF=path/to/file.pdf)
	@if [ -z "$(PDF)" ]; then \
		echo "Usage: make extract-pdf PDF=path/to/file.pdf"; \
		exit 1; \
	fi
	cd apps/pdf-extractor && uv run python -m dc_extractor.extract_validator "$(PDF)"

# Cleanup
clean: ## Clean all build artifacts
	pnpm turbo run clean
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf apps/backend/.venv
	rm -rf apps/pdf-extractor/.venv
	rm -rf data/temp/*

clean-cache: ## Clean all caches
	pnpm store prune
	rm -rf .turbo
	rm -rf apps/*/.turbo
	rm -rf packages/*/.turbo

# Utilities
logs-backend: ## View backend logs
	cd apps/backend && tail -f logs/app.log

logs-frontend: ## View frontend development logs
	cd apps/frontend && pnpm dev --verbose

check-deps: ## Check for dependency updates
	pnpm outdated
	cd apps/backend && uv tree
	cd apps/pdf-extractor && uv tree

# Production
prod-build: ## Build for production
	NODE_ENV=production pnpm turbo run build
	cd apps/backend && uv build --wheel

prod-test: ## Run production tests
	NODE_ENV=production pnpm turbo run test

# Health checks
health-check: ## Check if all services are healthy
	@echo "Checking application health..."
	@curl -f http://localhost:8080/health > /dev/null 2>&1 && echo "✓ Backend is running" || echo "✗ Backend not responding"
	@curl -f http://localhost:3000 > /dev/null 2>&1 && echo "✓ Frontend is running" || echo "✗ Frontend not responding"
	@echo "Checking infrastructure health..."
	@curl -f http://localhost:7474 > /dev/null 2>&1 && echo "✓ Neo4j is running" || echo "✗ Neo4j not responding"
	@curl -f http://localhost:8001/api/v1/heartbeat > /dev/null 2>&1 && echo "✓ Chroma is running" || echo "✗ Chroma not responding"
	@docker-compose -f infrastructure/docker/docker-compose.yml exec -T postgres pg_isready -U dc_agent > /dev/null 2>&1 && echo "✓ PostgreSQL is running" || echo "✗ PostgreSQL not responding"
	@curl -f http://localhost:5678/healthz > /dev/null 2>&1 && echo "✓ n8n is running" || echo "✗ n8n not responding"
	@docker-compose -f infrastructure/docker/docker-compose.yml exec -T redis redis-cli ping > /dev/null 2>&1 && echo "✓ Redis is running" || echo "✗ Redis not responding"
	@curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1 && echo "✓ MinIO is running" || echo "✗ MinIO not responding"

infrastructure-health: ## Check infrastructure services health only
	@echo "Checking infrastructure health..."
	@curl -f http://localhost:7474 > /dev/null 2>&1 && echo "✓ Neo4j is running" || echo "✗ Neo4j not responding"
	@curl -f http://localhost:8001/api/v1/heartbeat > /dev/null 2>&1 && echo "✓ Chroma is running" || echo "✗ Chroma not responding"
	@docker-compose -f infrastructure/docker/docker-compose.yml exec -T postgres pg_isready -U dc_agent > /dev/null 2>&1 && echo "✓ PostgreSQL is running" || echo "✗ PostgreSQL not responding"
	@curl -f http://localhost:5678/healthz > /dev/null 2>&1 && echo "✓ n8n is running" || echo "✗ n8n not responding"
	@docker-compose -f infrastructure/docker/docker-compose.yml exec -T redis redis-cli ping > /dev/null 2>&1 && echo "✓ Redis is running" || echo "✗ Redis not responding"
	@curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1 && echo "✓ MinIO is running" || echo "✗ MinIO not responding"