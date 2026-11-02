# Design tokens

> This file has no values on purpose. The single source of truth is the code.

- **Values:** `web/src/lib/styles/tokens.css` (colors, type, space, radii, focus ring, motion). Base styles are in `web/src/lib/styles/base.css`.
- **Rules and reasons:** `docs/ux/design-system.md`.
- **Guard rails (CI fails on a break):** `pnpm check:tokens` (no raw color or size in a component) and `pnpm check:contrast` (every color token is in a contrast pair that meets WCAG AA).

A worker never adds, changes or renames a token without a decision entry in `docs/agent/DECISIONS.md` and the planner's approval. An earlier version of this file held example values (for example a blue `#2563eb` and `space.1 = 4px`) that did not match the real tokens. Those values were wrong and were removed on 2026-11-02.

Touch targets are at least 44 x 44 px (`--target-min`).
