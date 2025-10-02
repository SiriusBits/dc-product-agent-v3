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
	turbo run dev

dev-backend: ## Start backend development server only
	cd apps/backend && uv run uvicorn src.dc_agent.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Start frontend development server only
	cd apps/frontend && pnpm dev

dev-docker: ## Start development with Docker services
	docker-compose -f infrastructure/docker/docker-compose.yml up -d
	@echo "Docker services started. Run 'make dev' to start application servers."

# Building
build: ## Build all applications
	turbo run build

build-backend: ## Build backend application
	cd apps/backend && uv build

build-frontend: ## Build frontend application
	cd apps/frontend && pnpm build

# Testing
test: ## Run all tests
	turbo run test

test-backend: ## Run backend tests only
	cd apps/backend && uv run pytest

test-frontend: ## Run frontend tests only
	cd apps/frontend && pnpm test

test-extractor: ## Run PDF extractor tests only
	cd apps/pdf-extractor && uv run pytest

test-unit: ## Run unit tests only
	turbo run test:unit

test-integration: ## Run integration tests only
	turbo run test:integration

test-watch: ## Run tests in watch mode
	cd apps/frontend && pnpm test:watch

# Code quality
lint: ## Run linting for all projects
	turbo run lint
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
	turbo run type-check
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
	turbo run clean
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
	NODE_ENV=production turbo run build
	cd apps/backend && uv build --wheel

prod-test: ## Run production tests
	NODE_ENV=production turbo run test

# Health checks
health-check: ## Check if all services are healthy
	@echo "Checking service health..."
	@curl -f http://localhost:8000/health || echo "Backend not responding"
	@curl -f http://localhost:3000 || echo "Frontend not responding"
	@docker-compose -f infrastructure/docker/docker-compose.yml ps