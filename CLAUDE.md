# CLAUDE.md

Instructions for Claude Code in this repository. Read this file and `MD_FILES/ROADMAP.md` at the start of every session.

## 1. What we are building

A free, open-source web tool for learning finite state machines, in **Indonesian first**, for Theory of Computation (ToC) students. First users: Fasilkom UI students (course textbook: Elaine Rich, *Automata, Computability and Complexity*).

v1 scope (see `MD_FILES/ROADMAP.md`): DFSM and NDFSM (with ε), simulation with traces, NDFSM → DFSM, minimization, equivalence with witness strings, regex → NDFSM, FSM → regex (state elimination), practice questions with feedback, and guides.

The site has three sections that share one editor and one engine:

- **Sandbox** — free building, simulation, conversions, "compare with" a regex or a machine.
- **Soal** (questions) — build to a spec; get structure checks, a verdict, and wrong-string lists.
- **Panduan** (guides) — Indonesian guides on design patterns; examples open in the editor.

**Out of scope until the human says otherwise:** PDAs, Turing machines, grammars, AI features, accounts, a backend server, classrooms, payments, analytics that track individuals.

## 2. Non-negotiable principles

1. **Code is a cost.** Every line must earn its place. Prefer deleting, fixing and simplifying over adding. Do not add a feature, abstraction or dependency that the current task does not need.
2. **Correctness first in the engine.** A wrong answer from the engine destroys trust. Engine changes need tests that prove them.
3. **Fast on cheap phones.** Assume a mid-range Android phone on mobile data. Respect the performance budgets in section 7.
4. **No account, no tracking.** Everything works in the browser and saves on the device. No cookies, no third-party trackers, no fingerprinting.
5. **Indonesian first.** Every user-facing string goes through i18n. Default locale `id`, second locale `en`.
6. **The engine never produces sentences.** It returns data and message keys with parameters. The UI turns keys into text.
7. **Teach patterns, not homework answers.** Never add content that solves current Fasilkom UI homework.
8. **Open source, AGPL-3.0.** Never copy code from JFLAP (its license forbids charging for derived work). Reading and writing the `.jff` file format is allowed.
9. **Zero running cost.** v1 is a static site: no backend, no database, no paid service, no API key. Everything must run on free tiers (Cloudflare static hosting, GitHub Actions for a public repo). Never add a dependency or service that needs payment, a credit card, or a server. If a task seems to need one, stop and ask the human.
10. **Small, swappable pieces.** Prefer small libraries over large all-in-one frameworks or runtimes. Keep the core simple and in one place; split it only when measurements show a need.

These principles follow the Lichess philosophy: free forever with no ads or tracking, open source with a share-alike license, code treated as a cost, extreme efficiency, light and fast frontend, and a community that can contribute (questions and guides are plain files added by pull request).

## 3. Decided stack

Change these only when the human approves it in this file first.

| Area | Choice |
| --- | --- |
| Engine | Rust (stable), Cargo workspace, no `unsafe` |
| Engine → browser | `wasm-bindgen` + `wasm-pack`, `serde` / `serde-wasm-bindgen`; generate TypeScript types from Rust types (for example with `tsify`) so both sides stay in sync |
| Frontend | TypeScript (strict) + Svelte 5 + SvelteKit with `adapter-static` (prerender guide and question pages for SEO) |
| Engine execution | Inside a dedicated Web Worker, never on the main thread |
| Diagram rendering | SVG (no canvas library) |
| Auto layout | `elkjs`, lazy-loaded, run in a worker |
| Local storage | IndexedDB through a small wrapper (for example `idb`) |
| i18n | Compile-time, tree-shaken messages (for example Paraglide JS) or a small typed dictionary; no heavy runtime i18n library |
| Guides | Markdown compiled at build time (for example `mdsvex`) |
| Offline | PWA with a service worker (for example `@vite-pwa/sveltekit`) |
| Tests | Rust: `cargo test`, `proptest`, `wasm-bindgen-test`. Web: Vitest, Playwright, axe-core |
| Quality | `rustfmt`, `clippy -D warnings`, ESLint, Prettier, `svelte-check` |
| CI | GitHub Actions |
| Hosting | Cloudflare static assets (Workers or Pages), free tier. Not Vercel Hobby. |

## 4. Repository layout

```
/
├── CLAUDE.md, README.md, LICENSE (AGPL-3.0), CONTRIBUTING.md
├── MD_FILES/        private planning notes (ROADMAP.md, COMPETITORS.md, LIGHTHOUSE1.md); git-ignored, never public
├── REFERENCES/      private textbooks and course files; git-ignored, never public
├── docs/            ARCHITECTURE.md, glossary.md, notation.md, decisions/ (ADRs)
├── crates/
│   ├── engine-core/ pure Rust: model, algorithms, traces, tests, benches
│   └── engine-wasm/ thin wasm-bindgen layer over engine-core
├── web/             SvelteKit app
│   ├── src/lib/engine/   worker + typed client for the WASM engine
│   ├── src/lib/editor/   diagram, table and formal-definition views
│   ├── src/lib/i18n/     messages (id, en)
│   ├── src/routes/       sandbox, soal, panduan
│   └── static/
├── content/
│   ├── questions/   one YAML file per question
│   └── guides/      one Markdown file per guide (id, optional en)
└── tools/           dev-only scripts (for example differential-test fixture generation)
```

`engine-native` (a trusted server-side grader) comes later. Keep `engine-core` free of browser and OS code so it can compile to native without changes.

## 5. Engine rules

- **Data model:** symbols are interned into small integers (a symbol can be multi-character, e.g. `num`); states are integer IDs. Names and canvas positions belong to the UI document, not the engine.
- **One serialized format:** machines are versioned JSON (`"schemaVersion": 1`). Never break old files; write migrations instead.
- **Validation returns a list of errors**, each with a message key and parameters (e.g. `dfsm.missing_transition { state, symbol }`). Never panic on user input.
- **Every run has a budget:** max steps, max configurations, max branches. On overflow return `Stopped { reason, partial_trace }`. Never loop forever.
- **Every algorithm returns a step trace,** not only a result. A step names what changed (states, transitions, table cells) and a message key with parameters.
- **Coarse API:** one WASM call per user action (e.g. `simulate(machine, input, budget)`), never per state or per step.
- **Determinism:** same input, same output, same order. Sort collections where order is visible.
- **Notation:** the engine is notation-neutral. Rich vs Sipser labels live only in the UI and message files (see `docs/notation.md`).
- **Algorithm choice:** when the textbook uses a specific method (for example a table-filling minimization), the step trace must follow that method so students recognize it. If unsure which method the course uses, ask the human.

## 6. Frontend rules

**UX sources of truth:** `docs/ux/` (wireframes, design system, editor interactions, feedback copy). Build screens to match them. If a spec is missing or unclear, ask the human; do not invent a new layout. Use only the design tokens in `web/src/lib/styles/tokens.css`, never raw color or size values in components.

- First run: an empty canvas shows a short "Coba contoh" list and an optional one-minute tour, never a long tutorial.
- Feedback tone: calm and specific, per `docs/ux/feedback-copy.md`. Never show a bare "SALAH" or red error wall.
- Touch targets are at least 44 × 44 px.

- The UI never imports the WASM module directly; it talks to the engine worker through `src/lib/engine/`.
- One machine document, three synced views (diagram, transition table, formal definition).
- Every edit is a command object, so undo/redo works for everything.
- Autosave to IndexedDB after edits (debounced). Show a clear "Tersimpan di perangkat ini" status.
- Share links hold the compressed machine in the URL fragment (`#`). The server never stores user machines.
- Touch support is required: tap to add a state, drag between states to add a transition, long-press for a menu. Desktop gets keyboard shortcuts.
- Accessibility: every control is keyboard reachable with a visible focus ring and an accessible name. The table view is the accessible alternative to the diagram.
- No user-facing string in components. Use message keys. Every new key needs `id` and `en` values.
- **Do not invent Indonesian terminology.** Use `docs/glossary.md`. If a term is missing, add it with the marker `TODO(review)` and tell the human.

## 7. Performance budgets (CI must enforce these)

Measured with Lighthouse CI, mobile preset, on the production build.

| Page | Performance | Accessibility | Best Practices | SEO |
| --- | --- | --- | --- | --- |
| Guide and question list pages | ≥ 95 | ≥ 95 | ≥ 95 | ≥ 95 |
| Sandbox / editor page | ≥ 90 | ≥ 95 | ≥ 95 | ≥ 90 |

Lab metrics targets: LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms.

Size budgets (gzip): initial JS for any route ≤ 170 KB; engine `.wasm` ≤ 250 KB; `elkjs` loaded only when auto layout is used. Build with `opt-level = "z"`, LTO, and `wasm-opt -Oz`.

Rules that keep the budgets:
- Guide pages ship close to zero JavaScript unless they embed an editor.
- Load the engine worker after first render, not before.
- Self-host fonts with `font-display: swap`, subset to Latin, at most two weights; system fonts are fine.
- No layout shift: reserve space for the editor canvas and images.
- If a change makes a budget fail, fix the change. Do not raise the budget without the human's approval.

## 8. Security and privacy

- No secrets in the repo. No API keys are needed in v1.
- Serve a strict Content Security Policy through a `_headers` file. WebAssembly needs `'wasm-unsafe-eval'` in `script-src`; allow nothing else beyond `'self'`.
- Never log or transmit machine contents or any user data. If analytics are added later, they must be cookie-less and aggregate only, and the human must approve.
- Treat imported files (`.jff`, JSON, share links) as untrusted: validate size and structure before use; fuzz the parsers.

## 9. Testing standards

- **Engine:** tests first. Every algorithm has unit tests for textbook examples and `proptest` properties, for example:
  - `minimize(d)` is equivalent to `d` and has no more states;
  - `determinize(n)` is equivalent to `n`;
  - `regex → NDFSM → regex` gives an equivalent regex;
  - a witness string returned by `equivalent(a, b)` is really accepted by exactly one machine.
- **Differential tests:** compare results against fixtures generated by the Python `automata` package (`tools/`, dev-only).
- Run engine tests on both the native target and WASM (`wasm-bindgen-test`).
- **Web:** Vitest for logic; Playwright for user flows (build a DFSM, simulate, solve a question, share link round-trip); axe checks in Playwright.
- A bug fix starts with a failing test that reproduces it.

## 10. How to work in this repo

1. The human names one task from `MD_FILES/ROADMAP.md` (for example "do E3"). Work only on that task.
2. **Plan first.** Read the relevant code, then state the plan, the files you will touch and the tests you will write. Wait for approval on anything that changes a decision in this file.
3. Write tests first, then code. Keep the change small.
4. Run all checks before you finish:
   - `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`
   - `wasm-pack test --node crates/engine-wasm` (or the repo's equivalent script)
   - in `web/`: `pnpm lint && pnpm check && pnpm test && pnpm build`
   - Lighthouse CI and Playwright when UI changes
5. One task = one branch = one pull request, with Conventional Commit messages (`feat(engine): …`, `fix(editor): …`).
6. In the same PR, tick the task in `MD_FILES/ROADMAP.md` and update docs if behavior changed.
7. Record any significant decision as a short ADR in `docs/decisions/`.

**Ask the human instead of guessing** when: a textbook method or notation is unclear; an Indonesian term is missing; a task needs a new dependency; a budget would be raised; scope seems to grow beyond the task.

**Never:** add dependencies without saying why and what they cost; disable a test or lint rule to make CI pass; commit generated build output; add features not in the current task.

## 11. Definition of done

- Acceptance criteria in `MD_FILES/ROADMAP.md` are met.
- Tests cover the change; all checks and CI pass.
- Budgets hold.
- New strings exist in `id` and `en`.
- Docs and `MD_FILES/ROADMAP.md` are updated.
- The diff is small enough for the human to review in one sitting.