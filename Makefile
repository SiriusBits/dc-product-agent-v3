.PHONY: install dev build test lint clean

install:
	pnpm install

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

lint:
	pnpm lint

clean:
	pnpm clean
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules

# Backend specific commands
backend-dev:
	cd apps/backend && make dev

backend-test:
	cd apps/backend && make test

# Frontend specific commands
frontend-dev:
	cd apps/frontend && pnpm dev

frontend-build:
	cd apps/frontend && pnpm build

# Data operations (placeholders)
ingest-data:
	@echo "Ingesting data..."

validate-data:
	@echo "Validating data..."
