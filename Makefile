.PHONY: install test lint build audit e2e

install:
	python3 -m venv .venv
	.venv/bin/pip install -e '.[dev]'
	cd web && npm ci

test:
	.venv/bin/pytest
	cd web && npm test

lint:
	.venv/bin/ruff check .
	.venv/bin/ruff format --check .
	.venv/bin/bandit -q -r spoofscope
	cd web && npm run lint && npm run format:check

build:
	.venv/bin/pip wheel --no-deps . -w /tmp/spoofscope-dist
	cd web && npm run build

audit:
	.venv/bin/pip-audit --skip-editable
	cd web && npm audit

e2e:
	scripts/e2e.sh
