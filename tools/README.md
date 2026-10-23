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

## Other scripts

`budgets.mjs`, `check-size.mjs`, `check-lighthouse.mjs` and `check-headers.mjs` check the budgets and headers in CI.
