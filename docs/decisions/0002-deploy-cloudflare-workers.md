# 0002. Deploy with Cloudflare Workers static assets

Status: accepted

## Context
`CLAUDE.md` allows Cloudflare Workers or Pages. Cloudflare now recommends Workers with static assets for new projects. Building on Cloudflare's side needs Rust and `wasm-pack`, which we could not confirm exist in their build image.

## Decision
- Build in GitHub Actions, then upload `web/build/` with a pinned `wrangler` (`.github/workflows/deploy.yml`). Production on push to `main`; a preview URL (`pr-<number>`) on pull requests from this repository.
- Start on the free `workers.dev` address. A custom domain can be added later without app changes.
- The Cloudflare token (Workers Scripts: Edit only) and account ID are GitHub secrets, set only on the steps that use them. Fork PRs get none. `wrangler` install scripts stay disabled and telemetry is off.
- CSP: SvelteKit emits a `<meta>` CSP with a hash for its one inline script (`kit.csp`, hash mode). `static/_headers` adds the directives that only work as headers (`frame-ancestors`). One narrow exception: `style-src-attr 'unsafe-hashes'` for the exact inline style of SvelteKit's screen-reader route announcer, so it stays hidden. `tools/check-headers.mjs` verifies the result.

## Consequences
- Anything that needs inline scripts or styles will be blocked by design.
- If SvelteKit changes the announcer's style string, the hash must be updated (the console shows a CSP error and the header check fails).
