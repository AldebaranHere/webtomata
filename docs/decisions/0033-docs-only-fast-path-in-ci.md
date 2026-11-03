# 0033. Fast path in CI for documents-only changes

Status: accepted (task T-050)

## Context

Every pull request runs the full CI pipeline: the Rust checks, the frontend build and checks, end-to-end tests across Chrome, Firefox, and WebKit (iPhone), Lighthouse score audits, plus CodeQL, cargo/pnpm audit, cargo-fuzz, and a Cloudflare preview deployment. A full CI run takes about 6 to 7 minutes.

When a pull request changes only documentation or design specs (such as `docs/`, `design/`, or root guidance files like `AGENTS.md` and `README.md`), running the heavy compilation, browser test shards, and deployment workflows wastes minutes and runner hours.

The challenge is to accelerate documents-only pull requests without weakening any security boundary, without leaving pull requests blocked forever on required status checks, and without allowing a malicious or accidental code change to disguise itself as a document change.

## Decision

### 1. Decision is made inside the workflow, not at the trigger

GitHub Actions supports `paths-ignore` on triggers, but a workflow whose trigger is suppressed by `paths-ignore` **never reports its required status checks**. Because the branch protection ruleset requires the checks `rust` and `web`, suppressing `ci.yml` with `paths-ignore` would cause every documentation pull request to wait indefinitely for checks that never report.

Instead, the decision is made **inside `ci.yml`**:
- A fast first job, `scope`, inspects the diff range.
- When `scope` determines the change is documents-only (`docs_only=true`), the heavy jobs (`rust`, `checks`, `e2e`, `lighthouse`, `cross-browser`) are skipped via `if: needs.scope.outputs.docs_only != 'true'`.
- In GitHub Actions branch protection, a check skipped by its own `if` condition counts as passed. `rust` is an independent required check, so its skip status satisfies branch protection.
- The gate job `web` always runs (`if: always()`). It waits for `scope` and all other jobs, executes `tools/ci-gate.mjs`, and validates that all jobs succeeded or were legitimately skipped under `docs_only=true`.
- The total pull request duration for documentation changes drops from 6–7 minutes to about 1 minute.

### 2. Strict, minimal allowlist (deny by default)

A pull request qualifies as documents-only if and only if **every** changed path is in the exact allowlist:
- Any file under `docs/`
- Any file under `design/`
- Any file under `.antigravity/`
- The root files: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSE`

Why each entry is safe:
- `docs/` and `design/`: Pure Markdown documentation, architectural decision records, and wireframes. No code or build scripts execute from these directories.
- `.antigravity/`: Agent rules (`rules.md`) read only by agent workflows.
- Root files (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSE`): Informational documentation and repository guidelines.

### 3. What is never skipped

The following are strictly forbidden from the allowlist and will always trigger the full CI:
- `main`: Push events to `main` (production deployments) never skip anything (`docs_only` is forced to `false`).
- `content/`: The question bank and guides are compiled directly into the application bundle at build time and verified against the WebAssembly engine.
- `.github/`: Workflow definitions, Actions configurations, and CI templates.
- `web/`: All frontend code, components, styles, tests, and nested Markdown files (such as `web/src/README.md`).
- `crates/`: Rust core engine, WASM bridge, and Rust tests.
- `tools/`: Build scripts, CI guard rails, and test utilities.
- `.cargo/`, `Cargo.lock`, `pnpm-lock.yaml`: Dependencies and configuration.

### 4. Non-required workflows (`codeql.yml`, `deploy.yml`, `audit.yml`, `fuzz.yml`)

Workflows that are not required status checks do not block merge when skipped at the trigger:
- `codeql.yml` and the preview part of `deploy.yml` have `paths-ignore` configured on `pull_request` matching the exact allowlist.
- `audit.yml` and `fuzz.yml` already have specific positive `paths:` filters (e.g., lockfiles and engine source files). In GitHub Actions, `paths` and `paths-ignore` cannot be combined on the same event. Replacing `paths` with `paths-ignore` would inadvertently widen `audit.yml` and `fuzz.yml` to trigger on every general code PR (such as frontend Svelte or CSS changes). Therefore, `audit.yml` and `fuzz.yml` keep their positive path filters, and the guard rail verifies that their path lists do not contain any allowlisted documentation paths.

### 5. Guard rails (`tools/check-workflows.mjs`)

The guard rail enforces:
- `ci.yml` contains the `scope` job with a pinned runner and timeout.
- Every heavy job (`rust`, `checks`, `e2e`, `lighthouse`, `cross-browser`) depends on `scope` and has `if: needs.scope.outputs.docs_only != 'true'`.
- The gate job `web` has `if: always()` and waits for `scope`.
- `codeql.yml` and `deploy.yml` have `paths-ignore` on `pull_request` exactly equal to the allowlist.
- `audit.yml` and `fuzz.yml` have positive paths containing no allowlisted entry.
- No workflow uses `pull_request_target`.

## Threat Model and Fail-Safe Rules

1. **A code change disguised as a document:**
   - Any modification outside the exact allowlist immediately sets `docs_only=false`. An empty diff, unresolvable commit range, shallow clone error, or script failure defaults to `false`.
   - Nested READMEs (e.g., `web/src/README.md`) are rejected because directory prefixes must match `docs/`, `design/`, or `.antigravity/` exactly.
   - Suffix attacks (e.g., `README.md.js`) fail exact root filename matching.
   - Directory prefix attacks (e.g., `docsx/`) fail the trailing slash check.
   - **Git rename detection bypass:** By default, git rename detection (`git diff --name-only`) reports only the destination path. If a code file (e.g., `web/src/a.ts`) is renamed to a docs path (e.g., `docs/a.md`), default rename detection lists only `docs/a.md`, which would allow code changes to bypass full CI. Passing `--no-renames` forces git diff to list both the deletion of `web/src/a.ts` and the creation of `docs/a.md`, ensuring the pull request is rejected by the allowlist. `tools/check-workflows.mjs` enforces that `--no-renames` is present in the `scope` job diff command.

2. **Crafted file names and injection:**
   - File paths from `git diff -z` are NUL-delimited and streamed directly into standard input of `tools/docs-only.mjs`.
   - File paths are never expanded or interpolated into a shell command line.
   - Character allowlist: only characters `[A-Za-z0-9._/-]` are allowed. Any path containing percent characters (`%`), non-ASCII letters, zero-width characters (e.g., zero-width spaces), whitespace, newlines (`\n`), carriage returns (`\r`), backslashes (`\`), directory traversal (`..`), or duplicate slashes (`//`) is rejected immediately.

3. **Skipped or tampered gate:**
   - The gate job `web` has `if: always()`. If a heavy job fails or is cancelled, `web` still runs and fails the build.
   - `tools/ci-gate.mjs` verifies that heavy jobs are only permitted to be `skipped` when `docs_only` is genuinely `'true'`. If `docs_only` is `'false'`, any skipped heavy job results in an immediate gate failure (exit 1).

4. **Accepted risk: scripts execute from PR checkout:**
   - Both the `scope` job and the `web` gate checkout the pull request commit and run scripts from the tree (`tools/docs-only.mjs` and `tools/ci-gate.mjs`). A malicious pull request could theoretically tamper with these scripts in its branch. However, any pull request modifying `tools/` or `.github/` is not in the documentation allowlist, so the diff against base will contain paths in `tools/` or `.github/`. Furthermore, changes to workflow files or guard rails always trigger full CI and must be reviewed and approved by the repository owner before merge.

## Consequences

- Documentation-only pull requests finish in ~1 minute instead of 6–7 minutes.
- Code pull requests continue to run the full verification suite without changes.
- CI compute minutes on GitHub Actions runners are conserved.
- Guard rails prevent accidental drift or silent weakening of the fast-path policy.

