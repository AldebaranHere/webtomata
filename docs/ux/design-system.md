# Design system

The design tokens of WebTomata: colors, type, space, radii, focus ring and motion. The values come from the approved wireframes ("Automata Tool Wireframes", 2026-10-21), with three changes so that everything passes WCAG 2.2 AA (see "What changed from the wireframes").

The tokens are in [`web/src/lib/styles/tokens.css`](../../web/src/lib/styles/tokens.css). The base styles (fonts, page defaults, focus ring, reduced motion) are in [`base.css`](../../web/src/lib/styles/base.css), loaded once by `web/src/routes/+layout.svelte`.

## Rules

1. **Components use only tokens.** No raw color in a component. `pnpm check:tokens` fails CI on a hex color or a color function outside `tokens.css`. `transparent`, `currentColor` and `inherit` are fine. For a size, use a `--space-*`, `--text-*`, `--radius-*` or `--target-min` token.
2. **Names say what a value is for.** `--color-muted` is secondary text, not "gray". A dark theme can later redefine the same names.
3. **A new color needs a contrast pair.** Add the pair to `tools/contrast-pairs.mjs`, or mark the color as decorative there. `pnpm check:contrast` fails CI if a color token is in no pair, or if a pair is below its level.
4. **Light theme only for v1.** The tokens are named by role so that a dark theme can be added later.
5. **Touch targets are at least 44 × 44 px** (`--target-min`). Inputs use at least `--text-md` (16px), so that phones do not zoom in.
6. **Focus is always visible.** `:focus-visible` gets a 2px accent outline with a 2px offset (5.5:1 on the ground, 5.9:1 on a surface). Never remove it; style it with the tokens if it must change.

## Colors

| Token                   | Value     | Use                                                                  | Do not                                        |
| ----------------------- | --------- | -------------------------------------------------------------------- | --------------------------------------------- |
| `--color-ground`        | `#f6f7f9` | The page and the canvas                                              |                                               |
| `--color-surface`       | `#ffffff` | Cards, panels, inputs, the header                                    |                                               |
| `--color-ink`           | `#16181d` | Body text and headings                                               |                                               |
| `--color-muted`         | `#5b6270` | Secondary text, labels, hints, the "unknown" row of a trace          | Use for the main message                      |
| `--color-on-ink`        | `#ffffff` | Text on `--color-ink` (the selected tab)                             |                                               |
| `--color-border`        | `#dde1e7` | Separators and card edges                                            | Use as the only edge of an input or a control |
| `--color-border-strong` | `#737b88` | The edge of an input and of controls that have no other edge         | Use for text                                  |
| `--color-accent`        | `#2f5bd3` | The current state and step, links, the main button, the focus ring   |                                               |
| `--color-on-accent`     | `#ffffff` | Text on `--color-accent`                                             |                                               |
| `--color-accent-ink`    | `#1e3f9e` | Text on `--color-accent-tint`                                        |                                               |
| `--color-accent-tint`   | `#eaf0fd` | The fill of the current state, the selected tool, the current step   |                                               |
| `--color-success`       | `#1f7a4d` | Valid, saved, accepted (icons, "Tersimpan di perangkat ini")         |                                               |
| `--color-success-ink`   | `#165c3a` | Text on `--color-success-tint`                                       |                                               |
| `--color-success-tint`  | `#e4f4ea` | The fill of a success message or badge                               |                                               |
| `--color-warning`       | `#b86e00` | **Lines and fills only**: the wrong part of an answer, a dashed edge | Use for text (3.99:1 on white)                |
| `--color-warning-ink`   | `#6b3d00` | **Warning text**                                                     |                                               |
| `--color-warning-tint`  | `#fff4e0` | The fill of a warning message                                        |                                               |
| `--color-neutral-ink`   | `#3b414c` | Chips, badges and the strokes of the diagram                         |                                               |
| `--color-neutral-tint`  | `#eef0f3` | The fill of a chip or badge ("DFSM", "Ditolak")                      |                                               |
| `--color-canvas-dot`    | `#d3d8e0` | The dots of the canvas (decorative)                                  |                                               |

There is no red. The tone of the feedback is calm ("Belum tepat, tapi sudah dekat."), so a wrong answer uses the warning color and never an alarm color.

## What changed from the wireframes

The wireframes pass AA except four things. They are fixed in the tokens:

1. **Warning text.** The plain warning orange `#b86e00` has 3.99:1 on white, below 4.5:1. It stays for lines and fills (3:1 is enough there). Text in a warning message uses `--color-warning-ink` `#6b3d00` (9.16:1), as the wireframes already did.
2. **The "unknown" trace row** used `#8a909b` (3.21:1 on white). It uses `--color-muted` `#5b6270` (6.13:1).
3. **The edge of an input.** The wireframes used `#c9cfd8` (1.57:1 on white), and for a text field the edge is the only thing that shows where it is (WCAG 1.4.11 asks for 3:1). Inputs use the new `--color-border-strong` `#737b88` (4.27:1 on white, 3.98:1 on the ground).
4. **The separator** `#dde1e7` (1.31:1) is decorative. It stays as `--color-border`, and it is never the only edge of a control.

## Type

| Token                                                      | Value                                                                                                                                                                           |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--font-ui`                                                | Plus Jakarta Sans, then the system font                                                                                                                                         |
| `--font-math`                                              | The system math and serif fonts (Cambria Math, STIX Two Math, Times New Roman, Georgia, serif); nothing is downloaded. Used for a regular expression drawn as a book writes it. |
| `--font-mono`                                              | JetBrains Mono, then the system mono font. Used for strings, symbols and traces.                                                                                                |
| `--weight-regular`, `--weight-strong`                      | 400, 600. Only these two (`CLAUDE.md` allows two weights). The bold 700 of the wireframes' project name is 600.                                                                 |
| `--text-2xs` … `--text-2xl`                                | 11, 12, 13, 14 (base), 16, 20, 24 px, and a fluid 28–40 px for the page title. All in `rem`, so the reader's font size is respected.                                            |
| `--leading-tight`, `--leading-normal`, `--leading-relaxed` | 1.25, 1.5, 1.6                                                                                                                                                                  |

**Fonts** are self-hosted from the packages `@fontsource/plus-jakarta-sans` and `@fontsource/jetbrains-mono` (SIL Open Font License 1.1), Latin only, in woff2 only, with `font-display: swap`. The home page loads three files (UI regular and strong, mono regular: about 46 KB). The Greek letters of the mono font (ε, Σ), 4 KB each, are a separate file that the browser downloads only when a page shows such a letter. Symbols such as `∪` and `→` are not in the Latin subset, and fall back to the system font.

## Space, radii, motion

- **Space** is on a 4px grid: `--space-1` (4px), `-1-5` (6px), `-2` (8), `-3` (12), `-4` (16), `-5` (20), `-6` (24), `-8` (32), `-10` (40), `-14` (56), `-16` (64).
- **Radii:** `--radius-sm` 6px, `-md` 8px (buttons, inputs), `-lg` 10px, `-xl` 12px, `-2xl` 16px (sheets), `-pill`.
- **Elevation:** `--shadow-popover` for menus and sheets.
- **Motion:** `--duration-fast` 120ms, `--duration-base` 200ms, `--ease-standard`. `base.css` turns animations and transitions off for people who set `prefers-reduced-motion`.

## Layout

One breakpoint: 40rem (640px). Below it the header shows a Menu button and the layout is one column; from it the links sit in the bar. A media query cannot use a CSS variable, so this one value is written in the components that need it (`SiteHeader.svelte`). Page content has a maximum width of 40rem for text.

## Contrast results

Made by `node tools/check-contrast.mjs --markdown` (run it again when a token changes). WCAG 2.2: 4.5:1 for text (1.4.3), 3:1 for graphics, the edges of controls and the focus ring (1.4.11).

| Pair                                        | Colors                 | Ratio | Needed | Result |
| ------------------------------------------- | ---------------------- | ----- | ------ | ------ |
| Ink on ground                               | `#16181d` on `#f6f7f9` | 16.57 | 4.5    | pass   |
| Ink on surface                              | `#16181d` on `#ffffff` | 17.76 | 4.5    | pass   |
| Ink on neutral tint                         | `#16181d` on `#eef0f3` | 15.55 | 4.5    | pass   |
| Muted on surface                            | `#5b6270` on `#ffffff` | 6.13  | 4.5    | pass   |
| Muted on ground                             | `#5b6270` on `#f6f7f9` | 5.72  | 4.5    | pass   |
| Muted on neutral tint                       | `#5b6270` on `#eef0f3` | 5.37  | 4.5    | pass   |
| Neutral ink on neutral tint (chips)         | `#3b414c` on `#eef0f3` | 8.99  | 4.5    | pass   |
| Neutral ink on surface                      | `#3b414c` on `#ffffff` | 10.26 | 4.5    | pass   |
| Neutral ink on ground                       | `#3b414c` on `#f6f7f9` | 9.57  | 4.5    | pass   |
| On accent on accent (primary button)        | `#ffffff` on `#2f5bd3` | 5.90  | 4.5    | pass   |
| On ink on ink (selected tab)                | `#ffffff` on `#16181d` | 17.76 | 4.5    | pass   |
| Accent on surface (link)                    | `#2f5bd3` on `#ffffff` | 5.90  | 4.5    | pass   |
| Accent on ground (link)                     | `#2f5bd3` on `#f6f7f9` | 5.51  | 4.5    | pass   |
| Accent ink on accent tint (active state)    | `#1e3f9e` on `#eaf0fd` | 8.13  | 4.5    | pass   |
| Accent ink on surface                       | `#1e3f9e` on `#ffffff` | 9.29  | 4.5    | pass   |
| Success on surface                          | `#1f7a4d` on `#ffffff` | 5.32  | 4.5    | pass   |
| Success on success tint (badge)             | `#1f7a4d` on `#e4f4ea` | 4.67  | 4.5    | pass   |
| Success ink on success tint                 | `#165c3a` on `#e4f4ea` | 7.02  | 4.5    | pass   |
| Warning ink on warning tint                 | `#6b3d00` on `#fff4e0` | 8.40  | 4.5    | pass   |
| Warning ink on surface                      | `#6b3d00` on `#ffffff` | 9.16  | 4.5    | pass   |
| Warning ink on ground                       | `#6b3d00` on `#f6f7f9` | 8.55  | 4.5    | pass   |
| Diagram stroke on ground                    | `#3b414c` on `#f6f7f9` | 9.57  | 3      | pass   |
| Diagram stroke on accent tint               | `#3b414c` on `#eaf0fd` | 8.98  | 3      | pass   |
| Accent on ground (active state, focus ring) | `#2f5bd3` on `#f6f7f9` | 5.51  | 3      | pass   |
| Accent on surface (focus ring)              | `#2f5bd3` on `#ffffff` | 5.90  | 3      | pass   |
| Accent on accent tint (active state edge)   | `#2f5bd3` on `#eaf0fd` | 5.17  | 3      | pass   |
| Warning on ground (wrong part of an answer) | `#b86e00` on `#f6f7f9` | 3.72  | 3      | pass   |
| Warning on surface                          | `#b86e00` on `#ffffff` | 3.99  | 3      | pass   |
| Warning on warning tint (label edge)        | `#b86e00` on `#fff4e0` | 3.66  | 3      | pass   |
| Success on ground (valid, saved)            | `#1f7a4d` on `#f6f7f9` | 4.96  | 3      | pass   |
| Border strong on surface (input edge)       | `#737b88` on `#ffffff` | 4.27  | 3      | pass   |
| Border strong on ground (input edge)        | `#737b88` on `#f6f7f9` | 3.98  | 3      | pass   |
