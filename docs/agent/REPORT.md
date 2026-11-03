# Report — T-050

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-050
- title: A fast path in CI for pull requests that change only documents
- branch: `task/T-050-ci-docs-only-fast-path`
- pull request: https://github.com/AldebaranHere/webtomata/pull/129
- status: done

## What changed
- `tools/docs-only.mjs` (new):
  - Pure function `isAllowedPath(path)`: checks whether an individual path is strictly within the allowed documentation scope. Denies whitespace, newlines, carriage returns, backslashes, path traversals (`..`), leading slashes or `./`, duplicate slashes, and any path outside the allowlist.
  - Pure function `isDocsOnly(paths)`: returns `true` only if `paths` is an array, non-empty, and every entry satisfies `isAllowedPath`.
  - `parseNullSeparatedPaths(raw)`: parses NUL-delimited paths output by `git diff -z`.
  - CLI execution: reads standard input to EOF, parses NUL-separated paths, and prints `true\n` or `false\n`.
  - Exports `WORKFLOW_PATHS_IGNORE` matching the exact allowlist for workflows.
- `tools/docs-only.test.mjs` (new):
  - Comprehensive unit and integration test suite covering AC1:
    - Positive cases: allowed root files and allowed directories (`docs/`, `design/`, `.antigravity/`).
    - Negative cases explicitly required by AC1: `content/guides/x.md`, `web/src/README.md`, `.github/ISSUE_TEMPLATE/x.md`, `tools/x.mjs`, `docsx/a.md`, `docs/../web/src/a.ts`, `./docs/a.md`, `README.md.js`, paths with spaces or newlines, empty paths, empty path list, mixed lists.
    - CLI execution with child process stdin piping.
- `tools/ci-gate.mjs` (new):
  - Evaluates the merge gate (`web` job) based on the `needs` context and `docs_only` output:
    - Fails if `scope` job is missing or its result is not `success`.
    - Fails if any job failed or was cancelled.
    - If `docs_only` is `'true'`: heavy jobs may be `skipped` or `success`.
    - If `docs_only` is not `'true'`: every heavy job must be `success` (any `skipped` heavy job is a failure).
    - Fails on malformed, missing, or unexpected job results.
  - CLI execution: supports environment variables (`DOCS_ONLY`, `NEEDS_JSON`) and CLI flags (`--docs-only`, `--needs-json`).
- `tools/ci-gate.test.mjs` (new):
  - Comprehensive unit and integration tests covering AC2:
    - Every row of the decision table.
    - Failures for failed or cancelled jobs.
    - Missing or odd inputs.
    - CLI execution exit codes (0 on success, 1 on failure).
- `tools/check-workflows.mjs`:
  - Enforces that `ci.yml` contains the `scope` job with pinned runner, actions, and timeout.
  - Enforces that every heavy job in `ci.yml` (`rust`, `checks`, `e2e`, `lighthouse`, `cross-browser`) waits for `scope` (`needs: ...`) and has `if: needs.scope.outputs.docs_only != 'true'`.
  - Enforces that gate job `web` has `if: always()` and waits for `scope`.
  - Enforces that non-required workflows (`codeql.yml`, `deploy.yml`, `audit.yml`, `fuzz.yml`) under `pull_request` either have `paths-ignore` matching `WORKFLOW_PATHS_IGNORE` exactly (`codeql.yml`, `deploy.yml`), or have positive `paths:` that contain no allowlisted documentation paths (`audit.yml`, `fuzz.yml`).
- `tools/check-workflows.test.mjs`:
  - Updated `ci` template to include `scope`, heavy jobs with `needs: scope` and `if`, and gate waiting for `scope`.
  - Tests that missing `scope`, heavy jobs without `needs: scope`, heavy jobs without `if`, or gate without `if: always()` fail the check.
  - Tests that `codeql.yml` or `deploy.yml` without `paths-ignore` or with differing lists fail.
  - Tests that `audit.yml` or `fuzz.yml` with allowlisted entries in positive paths fail.
- `.github/workflows/ci.yml`:
  - Added `scope` job as the first job: runs on `ubuntu-24.04`, timeout 5 min, read-only permissions, pinned checkout action (`actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1` with `fetch-depth: 0`, `persist-credentials: false`).
  - Resolves commit range (`PR_BASE_SHA..PR_HEAD_SHA` for PRs, `PUSH_BEFORE..PUSH_SHA` for pushes). Forces `docs_only=false` on pushes to `main`. Pipes `git diff --name-only -z` into `tools/docs-only.mjs` as data.
  - Added `needs: scope` and `if: needs.scope.outputs.docs_only != 'true'` to `rust`, `checks`, `e2e`, `lighthouse`, and `cross-browser`.
  - Updated `web` gate job: waits for `[scope, checks, e2e, lighthouse, cross-browser]`, runs `node tools/ci-gate.mjs` with `DOCS_ONLY` and `NEEDS_JSON`.
- `.github/workflows/codeql.yml` & `.github/workflows/deploy.yml`:
  - Added `paths-ignore` under `pull_request` matching the exact documentation allowlist.
- `docs/decisions/0033-docs-only-fast-path-in-ci.md` (new):
  - Documents context, architecture, allowlist rationale, threat model, fail-safe rules, and consequences.

---

## Workflow Design Rationale: Option A for `audit.yml` and `fuzz.yml`

During specification review, it was identified that `audit.yml` and `fuzz.yml` already have specific positive `paths:` triggers:
- `audit.yml` runs only on lockfile changes (`Cargo.lock`, `fuzz/Cargo.lock`, `pnpm-lock.yaml`, `.github/workflows/audit.yml`).
- `fuzz.yml` runs only on engine core / fuzz changes (`crates/engine-core/**`, `fuzz/**`, `.github/workflows/fuzz.yml`).

In GitHub Actions:
1. `paths` and `paths-ignore` cannot be combined under the same event (`pull_request`). Doing so causes a workflow syntax validation error.
2. Replacing `paths` with `paths-ignore` would drastically widen their scope, causing `audit.yml` and `fuzz.yml` to run on every frontend Svelte, CSS, or script change where they previously never ran.
3. Because their positive `paths:` lists contain only code/lockfile paths, they already naturally never trigger on documentation-only pull requests.

Per owner confirmation (Option A):
- `codeql.yml` and `deploy.yml` receive `paths-ignore` matching the allowlist.
- `audit.yml` and `fuzz.yml` remain on their positive `paths` filters.
- `tools/check-workflows.mjs` verifies that non-required workflows either have `paths-ignore` matching the allowlist or positive `paths` containing no allowlisted paths.

---

## Deliberate Breaks (AC4)

### Deliberate Break 1: Add `content/` to `ALLOWLIST_DIRS` in `tools/docs-only.mjs`

Added `'content/'` to `ALLOWLIST_DIRS` in `tools/docs-only.mjs`, then ran `node --test tools/docs-only.test.mjs`:

```
✔ isAllowedPath: allowed root files (1.587796ms)
✔ isAllowedPath: allowed directories (0.189492ms)
✖ isAllowedPath: forbidden paths explicitly required by AC1 (2.250849ms)
✔ isDocsOnly: only allowed paths returns true (0.182406ms)
✔ isDocsOnly: one path outside the list returns false (0.116327ms)
✔ isDocsOnly: empty list returns false (0.118284ms)
✖ isDocsOnly: empty path or invalid path in list returns false (0.253464ms)
✔ WORKFLOW_PATHS_IGNORE matches allowlist exactly (0.72721ms)
✔ CLI: pipes NUL-separated input and outputs true/false (79.643083ms)
ℹ tests 9
ℹ suites 0
ℹ pass 7
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 167.257091

✖ failing tests:

test at tools/docs-only.test.mjs:19:1
✖ isAllowedPath: forbidden paths explicitly required by AC1 (2.250849ms)
  AssertionError [ERR_ASSERTION]: expected "content/guides/x.md" to be forbidden
  
  true !== false
  
      at TestContext.<anonymous> (file:///home/Aldebaran64/webtomata/tools/docs-only.test.mjs:35:10)
...
```

Code was restored, and all tests passed.

### Deliberate Break 2: Make gate accept a skipped heavy job when `docs_only` is not `true`

Commented out `if (!isDocsOnly && result === 'skipped')` in `tools/ci-gate.mjs`, then ran `node --test tools/ci-gate.test.mjs`:

```
✔ ci-gate: docs_only is true and heavy jobs are skipped -> ok (1.145637ms)
✔ ci-gate: docs_only is true and heavy jobs are success -> ok (0.257252ms)
✔ ci-gate: docs_only is false and all heavy jobs are success -> ok (0.179278ms)
✖ ci-gate: docs_only is false and a heavy job is skipped -> fail (0.982309ms)
✔ ci-gate: scope job is not success -> fail (0.330042ms)
✔ ci-gate: any job failed or was cancelled -> fail (0.236312ms)
✔ ci-gate: missing or odd input -> fail (0.175303ms)
✖ CLI: exits 0 on valid inputs and 1 on failure (64.024294ms)
ℹ tests 8
ℹ suites 0
ℹ pass 6
ℹ fail 2
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 150.683581

✖ failing tests:

test at tools/ci-gate.test.mjs:52:1
✖ ci-gate: docs_only is false and a heavy job is skipped -> fail (0.982309ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  true !== false
  
      at TestContext.<anonymous> (file:///home/Aldebaran64/webtomata/tools/ci-gate.test.mjs:63:9)
...
```

Code was restored, and all tests passed.

---

## AC5 Note on this Pull Request's CI Run

This pull request modifies `.github/workflows/**` and `tools/**`. Because neither `.github/` nor `tools/` is in the documentation allowlist, the `scope` job will output `docs_only=false`. Therefore, in this PR's CI run, every heavy job (`rust`, `checks`, `e2e`, `lighthouse`, `cross-browser`) and both required checks (`rust` and `web`) will run in full.

---

## Verification Output

### 1. `pnpm check:workflows`
```
$ node tools/check-workflows.mjs
ok   6 workflows follow the guard rails
```

### 2. `pnpm test:tools`
```
$ node --test "tools/*.test.mjs"
...
ℹ tests 130
ℹ suites 3
ℹ pass 130
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 11448.873417
```

### 3. `pnpm format:check`
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

### 4. `pnpm lint`
```
$ pnpm --filter web lint
$ eslint .
```

### 5. `tools/docs-only.mjs` CLI Verification
```
$ printf 'docs/a.md\0README.md\0' | node tools/docs-only.mjs
true
$ printf 'docs/a.md\0web/src/a.ts\0' | node tools/docs-only.mjs
false
```
