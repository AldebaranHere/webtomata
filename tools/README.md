# tools/

Dev-only scripts. Nothing here ships with the site.

## Differential-test fixtures (`gen_fixtures.py`)

The Rust tests in `crates/engine-core/tests/differential.rs` compare the engine with the Python package `automata-lib`. The answers of that package are in `crates/engine-core/tests/fixtures/*.json`. The files are committed, so `cargo test` needs no Python.

Change the fixtures only when the script changes. To make them again:

1. Create a virtual environment: `python -m venv .venv-fixtures`
2. Install the pinned packages: `.venv-fixtures/bin/pip install --only-binary=:all: -r tools/requirements.txt` (on Windows, use `Scripts` in place of `bin`)
3. Run the script from the repository root: `.venv-fixtures/bin/python tools/gen_fixtures.py`
4. Run `cargo test -p engine-core --test differential`.

The seed is fixed. The same versions give the same files, on any computer.

## Smoke test (`smoke.mjs`)

`node tools/smoke.mjs <url>` opens a page in headless Chrome and checks that the app runs: the home page must show the engine version (so the script, the worker and the WASM module loaded), and there must be no console error, uncaught exception, failed request, bad response or CSP violation. `pnpm smoke` runs it on the production build (served locally), and `deploy.yml` runs it on the production and preview URLs after each deploy. It talks to Chrome through a small DevTools client (`cdp.mjs`) with no extra package. `smoke-judge.mjs` decides pass or fail and is tested by `pnpm test:tools` (Node's test runner). Playwright (Phase 2) will take over the real user flows.

## Audits

`.github/workflows/audit.yml` runs `cargo audit` and `pnpm audit` weekly, when a lockfile changes, and by hand. It is not a required check.

## Other scripts

`budgets.mjs`, `check-size.mjs`, `check-lighthouse.mjs` and `check-headers.mjs` check the budgets and headers in CI.
