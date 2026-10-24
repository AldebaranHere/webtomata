# Security policy

WebTomata is a free, open-source tool for learning finite state machines. It is a static website: there is no server of ours, no account and no database. Machines that a visitor builds stay in that visitor's browser.

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

1. Open the **Security** tab of this repository on GitHub.
2. Click **Report a vulnerability**.
3. Describe what you found and how to repeat it.

You get a first answer within 7 days. This is a student project, so there is no bug bounty and no guarantee of a fix date, but a real problem is fixed before it is made public.

## What is in scope

- The website at its `workers.dev` address and the code in this repository.
- Reading of untrusted files: `.jff` files, machine JSON, and share links.
- The build and deploy pipeline (`.github/workflows`).

Things that are not in scope: problems in Cloudflare, GitHub or a browser itself, and denial of service that needs more traffic than a static site on a free plan can carry.

## What we already do

- **No tracking and no third-party requests.** The Content Security Policy only allows our own address (`connect-src 'self'`).
- **Untrusted input is limited and fuzzed.** Files, budgets and texts have size limits, and the parsers are fuzzed (see `docs/decisions/`).
- **The deploy key is isolated.** The Cloudflare key exists only in one job that runs no build code. A check in CI (`tools/check-workflows.mjs`) keeps it that way. See `docs/decisions/0015-deploy-isolation.md`.
- **Dependencies are pinned and aged.** Lockfiles are used with `--frozen-lockfile` and `--locked`, install scripts are off, new versions wait two weeks, and a weekly audit looks for known vulnerabilities.

## If the deploy key may have leaked

The steps for the maintainer are in `docs/runbook-leaked-key.md`.
