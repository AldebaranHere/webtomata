# 0016. Design tokens, fonts and the contrast check

Status: accepted

## Context
The approved wireframes use a fixed set of colors, two fonts and a type scale. `CLAUDE.md` says that components use only design tokens and that the interface is accessible. The roadmap (U2) asks for a token file and a CI script that checks WCAG AA contrast. Checking the wireframe colors showed that most pass and that four things do not (see `docs/ux/design-system.md`).

## Decision
- **One token file**, `web/src/lib/styles/tokens.css`, named by role (`--color-ink`, `--color-accent-tint`), with the values of the wireframes. `base.css` holds the fonts, the page defaults, the focus ring and reduced motion, and is loaded by `+layout.svelte`.
- **Light theme only for v1.** The names allow a dark theme later by redefining the same tokens.
- **Three changes to the wireframe colors** so that everything passes AA: warning text uses the dark `--color-warning-ink` (the plain orange is for lines and fills); the "unknown" trace text uses `--color-muted`; inputs get an edge of 3:1 (`--color-border-strong`). The light border stays for separators that are not the only edge of a control.
- **Fonts self-hosted** from `@fontsource/plus-jakarta-sans` and `@fontsource/jetbrains-mono` 5.3.0 (OFL-1.1, static files, no dependencies, no install scripts, 97 days old when added). Latin only, woff2 only, `font-display: swap`, two weights each (400 and 600; the wireframes' 700 became 600). The Greek letters of the mono font (4 KB per weight) have their own `@font-face` with `unicode-range`, so they download only on a page that shows ε or Σ. The faces are written in `base.css` and point into the packages, so Vite hashes and bundles only these six files; the CSS files of the packages would also bundle the `woff` fallbacks and every subset.
- **Two checks in CI**, both without a new dependency and both tested with Node's test runner:
  - `check-contrast.mjs` checks the pairs in `contrast-pairs.mjs` (4.5:1 for text, 3:1 for graphics, the edges of controls and the focus ring, WCAG 2.2 1.4.3 and 1.4.11) and fails if a color token is in no pair and is not marked decorative.
  - `check-tokens-usage.mjs` fails on a raw color (hex or a color function) in a component or a css file other than `tokens.css`, and on `--color-warning`, the borders or the canvas dots used as the text color.

## Consequences
- A new color needs a contrast pair, and a component cannot bring its own color. Both fail CI before a merge.
- The home page loads three font files (about 46 KB). Lighthouse after the change: performance 100, accessibility 100 (it was 97), layout shift 0.000, and the size budgets are unchanged.
- Symbols that are not in the Latin and Greek subsets (`∪`, `→`) use the system font. If that looks wrong in the editor, a later task can add a subset for them.
- The checks cover the colors that the tokens define. They do not know the real background of a component. A component that puts a token on an unexpected background must be checked by eye or by the axe tests of Phase 2.
