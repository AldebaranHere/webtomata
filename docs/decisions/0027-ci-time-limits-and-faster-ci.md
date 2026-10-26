# 0027. Time limits on every CI job, and a faster CI in three steps

Status: accepted (the owner approved the plan on 2026-10-27). Steps A and B are described here; step C adds its part when it lands.

## Context
We measured the last 14 CI runs (2026-10-27). A pull request waited about 8 to 10 minutes for `web`, of which the browser tests were about 70%. Three runs of 14 were much slower: the step `playwright install-deps` of the job `cross-browser` spent 8 to 36 minutes in `apt-get`, because the package mirror of the runner hung until apt gave up on it. The same step takes about 30 seconds in a normal run. A job has no time limit by default except GitHub's 6 hours, so a stalled step can hold a job for that long. The cache of the repository was also over GitHub's limit of 10 GB (74 caches, 10.8 GB), mostly caches of pull requests that were already merged.

## Decision
The plan has three steps, each one pull request, and quality does not change: every check that runs today still runs on every pull request.
- **A. Stop the stalls.** Every job in every workflow has `timeout-minutes` (at most 30; `tools/check-workflows.mjs` fails the build without it). The `cross-browser` job tells apt to give up on a mirror after 15 seconds, with 3 retries, and its install steps have their own limit of 6 minutes. A stall now fails in minutes, and the job can be run again.
- **B. Split and gate.** `ci.yml` has these jobs: `rust` (unchanged), `checks` (everything that needs no browser), `e2e` (the Chrome tests in 3 shards, each test in exactly one), `lighthouse`, `cross-browser` (Firefox and WebKit as two jobs, each with only its own system libraries), and `web`, a gate. The gate waits for all of them, runs also when one failed (`if: always()`, because a skipped required check counts as passed) and is green only if every result is `success`. It keeps the name `web`, so the ruleset (required checks `rust` and `web`) is not edited, and the Firefox and WebKit tests are part of the merge gate from now on. `tools/check-workflows.mjs` fails the build if `web` does not wait for a job of the file or lacks `if: always()`. A push to `dev-initial` no longer starts a second run: the run of its pull request covers it. This matters now that a run has nine jobs, because a free repository runs at most 20 jobs at once.
- **C. Caches** (after B). Only `staging` and `main` save caches, and a small workflow deletes the caches of a pull request when it closes.

## Consequences
- A real slow step (a first run with cold caches) must stay under the limits: 15 minutes for `rust`, 25 for `web`, 20 for `cross-browser`. The normal times are 1, 10 and 6 minutes.
- A job that hits its limit fails with a clear message. It costs a re-run, instead of a silent wait of hours.
- Deleting the 46 caches of closed pull requests (6.1 GB) was done by hand on 2026-10-27, with the owner's approval; step C keeps it from growing back.
- Each of the e2e shards, the Lighthouse job and the two browser jobs builds the WASM module and the site itself (about 20 seconds with warm caches), which is cheaper than moving a build between jobs and keeps each job independent. The cost is more runner minutes, which are free for a public repository.
- Because the tests are split by file, a shard can be a little slower than the others; the gate waits for the slowest. If one shard stays far behind, the number of shards is one number in `ci.yml`.
