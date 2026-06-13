# ============================================================
# Ozymandias — Root Makefile
# ============================================================
# Zentrale Build-/Test-/Lint-Targets für alle Schichten.
# ============================================================

.PHONY: help dev build test lint fmt clean \
        rust-build rust-test rust-lint rust-fmt \
        py-install py-test py-lint py-fmt py-type \
        fe-install fe-build fe-test fe-lint \
        docker-up docker-down docker-build

# --- Defaults ---
PYTHON ?= python
NPM    ?= npm

help: ## Zeigt diese Hilfe
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================================
# Alles auf einmal
# ============================================================

dev: docker-up ## Startet Gesamtsystem (Docker Compose)

build: rust-build fe-build ## Baut Rust + Frontend

test: rust-test py-test fe-test ## Testet alle Schichten

lint: rust-lint py-lint fe-lint ## Lint für alle Schichten

fmt: rust-fmt py-fmt ## Formatiert Rust + Python

clean: ## Räumt Build-Artefakte auf
	cd rust && cargo clean
	rm -rf frontend/dist
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# ============================================================
# Rust
# ============================================================

rust-build: ## Baut Rust-Workspace
	cd rust && cargo build --workspace

rust-test: ## Testet Rust-Workspace
	cd rust && cargo test --workspace

rust-lint: ## Clippy + fmt-Check für Rust
	cd rust && cargo fmt -- --check
	cd rust && cargo clippy --all-targets -- -D warnings

rust-fmt: ## Formatiert Rust-Code
	cd rust && cargo fmt

# ============================================================
# Python Backend
# ============================================================

py-install: ## Installiert Python-Abhängigkeiten
	cd backend && $(PYTHON) -m pip install --upgrade pip
	cd backend && $(PYTHON) -m pip install -r requirements.txt -r requirements-dev.txt

py-test: ## Pytest mit Coverage
	cd backend && $(PYTHON) -m pytest -q --cov=app/api --cov=app/services --cov=app/schemas \
		--cov-report=term-missing --cov-fail-under=85 tests

py-lint: ## Ruff + MyPy für Python
	cd backend && $(PYTHON) -m ruff check app tests
	cd backend && $(PYTHON) -m ruff format --check app tests
	cd backend && $(PYTHON) -m mypy --config-file pyproject.toml app tests

py-fmt: ## Formatiert Python-Code
	cd backend && $(PYTHON) -m ruff format app tests
	cd backend && $(PYTHON) -m ruff check --fix app tests

py-type: ## MyPy für Python
	cd backend && $(PYTHON) -m mypy --config-file pyproject.toml app tests

py-security: ## Bandit + pip-audit
	cd backend && $(PYTHON) -m bandit -r app
	cd backend && $(PYTHON) -m pip_audit -r requirements.txt

# ============================================================
# Frontend
# ============================================================

fe-install: ## Installiert Frontend-Abhängigkeiten
	cd frontend && $(NPM) install

fe-build: ## Baut Frontend (Produktion)
	cd frontend && $(NPM) run build

fe-test: ## Vitest für Frontend
	cd frontend && $(NPM) run test

fe-lint: ## TypeScript-Check für Frontend
	cd frontend && $(NPM) run typecheck

# ============================================================
# Docker
# ============================================================

docker-up: ## Docker Compose up (detached)
	docker compose up -d --build

docker-down: ## Docker Compose down (ohne Volumes!)
	docker compose down

docker-build: ## Nur Docker-Images bauen
	docker compose build
