# Contributing

Thank you for improving SpoofScope. Open an issue before large changes, keep collection passive and bounded, and never add exploit delivery, credential collection, authentication bypass, or unbounded scanning.

1. Fork and create a focused branch.
2. Use Python 3.11+ and Node.js 22.22.2+, then install `pip install -e '.[dev]'` and `npm ci` in `web/`.
3. Run `ruff check .`, `pytest`, `pip-audit --skip-editable`, `npm test`, `npm run build`, and `npm audit`.
4. Add tests for behavior changes and document new configuration.
5. Submit a pull request explaining security and privacy implications.

Please report vulnerabilities privately as described in `SECURITY.md`.

Changes to Docker services, migrations, workers, or networking should also pass `scripts/e2e.sh` on a clean Docker host.
