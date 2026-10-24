# 0015. The deploy key lives in one job that runs no build code

Status: accepted

## Context
The deploy needs a Cloudflare API token. Before this change, one job installed everything, built the site, and deployed. The token was set only on the deploy step, but all steps shared one computer and one file system. A tampered package that runs during the build (a compiler plugin, a bundler) could change `wrangler` on disk, and then leak the token when the deploy step ran. The pull request previews need the same token, and Cloudflare cannot limit a token to "upload but not deploy", so a GitHub environment alone would not keep the key from pull request jobs.

The token itself is already as narrow as Cloudflare allows: "Account – Workers Scripts – Edit", one account, no zones, no other products. (On 2026-10-24 two older broad tokens were removed: a template token for the disconnected Git build, and a read-only token that Cloudflare's assistant made.)

## Decision
- `deploy.yml` has three jobs:
  - **`build`**: no secrets. Installs, builds the WASM module and the site, and saves `web/build` as an artifact. Everything that compiles or bundles runs here.
  - **`deploy`**: the only job with the key. A new computer: it installs from the lockfile with `--ignore-scripts`, downloads the artifact, and runs `wrangler`. No build, lint, test or compile command runs here.
  - **`verify`**: no secrets. Runs the header check (production only) and the smoke test on the deployed URL.
- `tools/check-workflows.mjs` (tested, and run in CI) fails if `secrets.` appears outside the job `deploy` of `deploy.yml`, if the deploy job installs without `--ignore-scripts` or runs build code, if an action is not pinned to a full commit, or if `pull_request_target` is used.
- Every action is pinned to a full commit. The new `download-artifact` v8.0.2 was 17 days old when it was pinned.
- The token gets an end date of one year, renewed by hand (a dated chore).
- Not done: a GitHub `production` environment (it would add steps and not remove the key from pull request jobs, and the owner already approves every merge to `main`), and an account-owned token (one user only).
- `SECURITY.md` says how to report a vulnerability, and `docs/runbook-leaked-key.md` lists the steps if the key may have leaked.

## Consequences
- Code that runs during the build can still change **what is deployed** (the site itself). The isolation protects the key, not the artifact. The CSP (`connect-src 'self'`) limits what injected code could send out, and the smoke test checks that the site runs.
- The deploy job still runs `wrangler` and its dependencies with the key. A compromised `wrangler` release would still leak it. The 2-week rule, the lockfile, and the weekly audit are the protection there.
- A deploy takes about one minute longer, because the artifact is uploaded and downloaded.
- A change to the workflows that breaks a rule fails CI before it can be merged.
