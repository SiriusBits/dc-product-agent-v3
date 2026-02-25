.PHONY: install dev build test lint clean sync-schemas generate-types generate-models generate check-schemas

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

# ── Schema sync & codegen ──────────────────────────────────────────
sync-schemas:
	@echo "Syncing schemas from reference/schema/ → packages/shared-schemas/src/schemas/"
	rsync -a --include='*.schema.json' --exclude='*' reference/schema/ packages/shared-schemas/src/schemas/

check-schemas:
	@for f in reference/schema/*.schema.json; do \
		base=$$(basename $$f); \
		if ! diff -q "$$f" "packages/shared-schemas/src/schemas/$$base" > /dev/null 2>&1; then \
			echo "ERROR: $$base out of sync. Run 'make sync-schemas'."; \
			exit 1; \
		fi; \
	done
	@echo "Schemas in sync ✓"

generate-types: sync-schemas
	cd packages/shared-types && pnpm generate

generate-models: sync-schemas
	cd apps/backend && uv run python scripts/generate_models.py

generate: generate-types generate-models

# ── Backend ────────────────────────────────────────────────────────
backend-dev:
	cd apps/backend && uv run uvicorn dc_agent.api.main:app --reload

backend-test:
	cd apps/backend && uv run pytest

backend-lint:
	cd apps/backend && uv run ruff check src/ scripts/ tests/

# ── Frontend ───────────────────────────────────────────────────────
frontend-dev:
	cd apps/frontend && pnpm dev

frontend-build:
	cd apps/frontend && pnpm build

# ── Data operations ────────────────────────────────────────────────
ingest-data:
	@echo "Ingesting data..."

validate-data:
	cd apps/backend && uv run python scripts/validate_kg_consistency.py
