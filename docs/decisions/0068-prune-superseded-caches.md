# 0068. Prune superseded CI caches daily

Status: accepted (task T-088)

## Context

GitHub Actions gives a repository a shared 10 GB cache limit; past that limit, GitHub evicts the least recently used caches, which can drop the active caches of `staging` and `main` that every run restores (ADR 0027).

A snapshot on 2026-11-24 showed 34 caches totaling 4.0 GB, all owned by `refs/heads/staging`, of which about 2.5 GB were superseded and would never be restored again:

- **Rust caches of older lockfile generations**: 5 jobs (`rust`, `checks`, `e2e`, `cross-browser`, `lighthouse`) × 2 old generations (about 1.5 GB), which otherwise linger for 7 days unused.
- **CodeQL overlay base databases**: 9 of 11 caches (about 72–77 MB each); CodeQL saves a new overlay on every push to `staging`, while only the newest are useful bases for subsequent pull requests.
- **Old pnpm and Playwright browser caches** left behind after a lockfile change.

`.github/workflows/cleanup-caches.yml` only deleted caches of closed pull requests (`refs/pull/N/merge`), and pull requests no longer save caches (`save-if` restricts saving to `staging` and `main`), so superseded caches on `staging` and `main` were never cleaned up.

## Decision

1. **Tested script instead of inline shell.** `tools/prune-caches.mjs` exports pure functions `cacheFamily(key)` and `pickCachesToDelete(caches, options)` and provides a CLI that queries `gh cache list --limit 1000 --json id,key,ref,sizeInBytes,createdAt,lastAccessedAt`, prints and appends a Markdown table to `$GITHUB_STEP_SUMMARY`, and deletes chosen IDs via `gh cache delete <id>` when not in dry-run mode. Unit tests and fake-`gh` CLI tests live in `tools/prune-caches.test.mjs` and run under `pnpm test:tools`.
2. **Family rule (per ref).** A cache's family is derived by repeatedly stripping trailing hash segments (`-[0-9a-fA-F]{8,}$`) from its key. Grouping is per `(ref, family)`, so a cache on `refs/heads/main` is never deleted because of a newer cache on `refs/heads/staging`.
3. **Retention and allowlist.** Only four known key prefixes are eligible: `v0-rust-`, `node-cache-`, `playwright-`, and `codeql-overlay-base-database-`. Any cache with another prefix, and any cache on a `refs/pull/...` ref, is left alone and reported as such. Within each eligible `(ref, family)`, caches are ordered by `createdAt` descending (tie-breaking deterministically by higher `id`):
   - `codeql-overlay-base-database-*` keeps the newest **2** (so an in-flight pull request restoring the previous overlay is not racing a new push).
   - All other eligible families keep the newest **1**.
4. **Safety cap.** At most **50** deletions per run. If more than 50 caches are eligible for deletion, the oldest 50 are selected first and the summary reports that the run was capped.
5. **Workflow triggers and permissions.** `.github/workflows/cleanup-caches.yml` keeps the existing `cleanup` job guarded to `github.event_name == 'pull_request'` and adds a `prune` job guarded to `schedule` (daily at `03:17 UTC`, off-peak) and `workflow_dispatch` (with a boolean `dry_run` input defaulting to `true`; scheduled runs execute live). The workflow keeps its single top-level `permissions: actions: write` with no additional permissions, and pins `actions/checkout` and `actions/setup-node` by full commit SHA.
6. **No CI cache-key changes.** No cache key, `save-if`, restore step, or CodeQL configuration in any other workflow is modified. Sharing a Rust cache key across wasm jobs remains a separate future task if numbers justify it.

## Consequences

- On the 2026-11-24 fixture (34 `staging` caches plus 3 guard cases), pruning deletes 22 superseded caches, keeps 12 on `staging` (plus the `main` cache), leaves the PR and unknown-prefix caches alone, and frees ~2.5 GB.
- If a lockfile change is rolled back, the pruned older generation rebuilds once on the next run.
- Rollback is a single PR revert; no other workflow or cache key is affected.
