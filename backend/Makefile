PYTHON ?= python

.PHONY: install-dev lint format-check type test test-cov security quality

install-dev:
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -r requirements-dev.txt

lint:
	$(PYTHON) -m ruff check app tests

format-check:
	$(PYTHON) -m ruff format --check app tests

type:
	$(PYTHON) -m mypy --config-file pyproject.toml app tests

test:
	$(PYTHON) -m pytest -q tests

test-cov:
	$(PYTHON) -m pytest -q --cov=app/api --cov=app/services --cov=app/schemas --cov-report=term-missing --cov-fail-under=85 tests

security:
	$(PYTHON) -m bandit -r app
	$(PYTHON) -m pip_audit -r requirements.txt

quality: lint format-check type test-cov security
