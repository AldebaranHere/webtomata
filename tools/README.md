# tools/

Dev-only scripts. Nothing here ships with the site.

## Differential-test fixtures (`gen_fixtures.py`)

The Rust tests in `crates/engine-core/tests/differential.rs` compare the engine with the Python package `automata-lib`. The answers of that package are in `crates/engine-core/tests/fixtures/*.json`: NFA → DFA (`determinize.json`), minimization (`minimize.json`), equivalence (`equivalence.json`) and XOR, union and intersection (`xor.json`, `union.json`, `intersection.json`: pairs of DFAs, NFAs and one of each, with the verdicts of both machines for a list of strings, so that the operation is also checked without the `^`, `|` or `&` of the package) and complement (`complement.json`: complete DFAs, with `~` of the package), and regular expression → NFA (`regex.json`: random expressions written in Rich's notation and in the syntax of the package, with `NFA.from_regex`; the empty set cannot be written in that syntax, so it is covered by the next paragraph). The tests also ask an acceptor that is written in the test (not `simulate`) about every string up to a length, and check hand-made machines for the corners that random machines rarely reach (the empty language, every string, only the empty string, ε-cycles, a state that no string reaches, symbols in another order, sparse state numbers, one symbol, no symbols). The reference of the XOR is made complete, because `^` gives a partial DFA without its trap state and the engine's machines are complete. The files are committed, so `cargo test` needs no Python.

Change the fixtures only when the script changes. To make them again:

1. Create a virtual environment: `python -m venv .venv-fixtures`
2. Install the pinned packages: `.venv-fixtures/bin/pip install --only-binary=:all: -r tools/requirements.txt` (on Windows, use `Scripts` in place of `bin`)
3. Run the script from the repository root: `.venv-fixtures/bin/python tools/gen_fixtures.py`
4. Run `cargo test -p engine-core --test differential`.

The seed is fixed. The same versions give the same files, on any computer (also with another `PYTHONHASHSEED`: the numbering of the states does not depend on the order of a set).

## Smoke test (`smoke.mjs`)

`node tools/smoke.mjs <url>` opens a page in headless Chrome and checks that the app runs: the home page must show the engine version (so the script, the worker and the WASM module loaded), and there must be no console error, uncaught exception, failed request, bad response or CSP violation. `pnpm smoke` runs it on the production build (served locally), and `deploy.yml` runs it on the production and preview URLs after each deploy. It talks to Chrome through a small DevTools client (`cdp.mjs`) with no extra package. `smoke-judge.mjs` decides pass or fail and is tested by `pnpm test:tools` (Node's test runner). The real user flows are tested with Playwright (see below).

## Browser tests (`web/e2e`)

`pnpm test:e2e` runs Playwright on the production build in `web/build` (so run `pnpm --filter web build` first). It serves the build with `serve-build.mjs` on port 4599 and uses the Chrome that is installed on the computer; set `CHROME_PATH` to use another one. Two projects run every test: `desktop` (1440 × 900) and `phone` (Pixel 7, with touch). Every test fails if the page logs a console error, throws, or loads something that fails (`e2e/fixtures.ts`). A test that reloads the page, or ends, right after the page opened must call `engineSettled(page)` first: the worker loads the WASM file a little after the first render, and a reload or the end of the test cancels that load, which the page logs as a failed request (WebKit, on a busy runner). `engineSettled` waits for the first check and for the request for the WASM file to be over. A change that waits for its delay of 800 ms is saved when the page is hidden, so a test that changes a saved record from outside (`putRow`) must not leave an edit waiting in the page that it then reloads. `expectNoAxeViolations(page)` scans a page with axe (WCAG 2.0 to 2.2 A and AA, and best practices) and allows no violation; `e2e/axe.spec.ts` proves that the scan can fail. axe finds only part of the accessibility problems, so G5 (a keyboard-only run and a screen-reader check) stays. Firefox and WebKit are not run yet (a decision at the start of M2).

## Workflow guard rails (`check-workflows.mjs`)

`pnpm check:workflows` reads `.github/workflows/*.yml` and fails if the Cloudflare key (`secrets.`) is used outside the job `deploy` of `deploy.yml`, if that job installs without `--ignore-scripts` or runs build code, if an action is not pinned to a full commit, or if `pull_request_target` is used. See `docs/decisions/0015-deploy-isolation.md`. Its tests run with `pnpm test:tools`.

## Design token checks

`pnpm check:contrast` (`check-contrast.mjs`) reads `web/src/lib/styles/tokens.css` and checks the color pairs in `contrast-pairs.mjs` against WCAG 2.2 (4.5:1 for text, 3:1 for graphics and the edges of controls). It also fails if a color token is in no pair and is not marked decorative. `--markdown` prints the table for `docs/ux/design-system.md`. `pnpm check:tokens` (`check-tokens-usage.mjs`) fails if a component or a css file other than `tokens.css` has a raw color. Their tests run with `pnpm test:tools`.

## No hard-coded text (`check-strings.mjs`)

`pnpm check:strings` reads every `web/src/**/*.svelte` with the Svelte compiler and fails on user-facing text that is not a message: literal text with a Latin letter in the markup, a literal in `aria-label`, `alt`, `title`, `placeholder` or the description of the page, or a string literal in braces. Greek letters (ε, Σ), digits and punctuation are allowed; the script and the style are not read. The message files are in `web/src/lib/i18n`. Its tests run with `pnpm test:tools`.

## Question files (`check-questions.mjs`)

`pnpm check:questions` checks every `content/questions/*.yaml` (a name that starts with `_` is a template). First the shape, against `content/questions/schema.json`, and that the id is the name of the file. Then, with the real WASM engine, that the solution is valid, meets the constraints and agrees with the examples. Messages name the file, the line and the field. `--schema-only` skips the engine, so it works without Rust or WASM (on Windows, the full check needs `pnpm build:wasm` in WSL; CI runs it in full). `--report` prints the first strings that each solution accepts, for a reviewer to compare with the statement. The logic is TypeScript in `web/src/lib/questions/`, which Node runs directly; see `docs/decisions/0021-question-format.md`. Its tests run with `pnpm test:tools` (the engine ones need the WASM package).

## Audits

`.github/workflows/audit.yml` runs `cargo audit` and `pnpm audit` weekly, when a lockfile changes, and by hand. It is not a required check.

## Other scripts

`budgets.mjs`, `check-size.mjs`, `check-lighthouse.mjs` and `check-headers.mjs` check the budgets and headers in CI.

## The regular expression operations and the audit (`crates/engine-core/tests/regex_oracle.rs`)

`regex_to_fsm`, `fsm_to_regex`, `simplify` and `simplify_via_machine` are checked against two references that are written in the tests and share no algorithm with the engine: `matches` (a regular expression matches a word, by dynamic programming over the pieces of the word, with no machine and no derivative) and `member` (a machine accepts a word, with sets of states). Both are checked first against the verdicts of `automata-lib` (`regex.json`, `union.json` and others). Then they are asked about every word up to a length, for every regular expression up to a size (all trees over `∅`, `ε`, `a`, `b`, `∪`, concatenation, `*` and `+`), for every complete DFSM with up to 2 states and every NFA with 2 states over one symbol and ε, and for random machines and expressions. These runs take seconds, so every pull request runs them. **The audit** is the same with bigger sizes: 58,332 regular expressions in `regex_to_fsm`, 9,436 in `simplify`, 5,898 complete DFSMs, and 32,768 NFAs with 2 states over two symbols and ε. Run it after a change of the engine, in a release build (a debug build takes minutes):

```
WEBTOMATA_EXHAUSTIVE=1 cargo test --release -p engine-core --test regex_oracle
```
