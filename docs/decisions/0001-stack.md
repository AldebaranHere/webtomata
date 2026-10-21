# 0001. Stack

Status: accepted

## Context
A free, fast, offline-capable tool for learning finite state machines, in Indonesian first, with no running cost, no accounts and no tracking.

## Decision
Rust engine compiled to WASM and run in a Web Worker; SvelteKit with `adapter-static` for the UI; SVG diagrams; IndexedDB for saved machines; Cloudflare static assets for hosting; GitHub Actions for CI. The full table is in `CLAUDE.md` §3.

## Consequences
- Correctness lives in one tested Rust crate that can also run natively later (`engine-native`).
- No backend means share links and saves are client-side only.
- Size and Lighthouse budgets are enforced in CI (`tools/budgets.mjs`).
