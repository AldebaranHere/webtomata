# Plan — Milestone 0: clean up, then grammar additions, then the PDA

> Owner: planner. Approved by the human on 2026-11-01 (outline A to D). The human approves each task, or its design, before it becomes `todo`.
> `todo` means ready: every field is written and the human approved it. Several tasks can be `todo` at the same time. The worker does one task at a time: the one that the human names in the start prompt ("Do task T-xxx"). The worker sets it to `in-progress` in the first commit of its own PR and to `done` in the last. The planner does not open a pull request only to change a status.
> The blank task template is in `PLAN-TEMPLATE.md`.

**Suggested order of the `todo` tasks** (the human decides): T-018 (start marker), T-016 (phone layout), T-002 (from 2026-11-04), T-050 (CI fast path for docs-only changes), T-005 (from 2026-11-12). T-016 and T-018 need the Playwright browsers in WSL.

Status legend: `proposed` | `todo` | `in-progress` | `blocked` | `done` | `rejected`

## Order of work

- **A. Clean up** (this plan, T-001 to T-005 and P-001, then T-010 to T-013).
- **B. Grammar additions** (T-020 to T-022): a multi-string test for grammars, JFLAP grammar import and export, right-linear grammar to FA.
- **C. The PDA** (T-030 to T-035): model, simulation, `.jff`, editor, CFG to PDA (LL), CFG to PDA (LR).
- **E. Turing machines** (T-040 to T-048): one tape, `.jff`, editor, k tapes, macro notation. They follow the PDA and the owner names each step.
- **D. Launch work** (G4, G5, L3, L4, the beta) runs alongside. It needs the owner's phone and students. See `MD_FILES/ROADMAP.md`.

Rules for every task (from `CLAUDE.md` and `AGENTS.md`): tests first, with a deliberate break of each new rule; every user-facing string in `id` and `en`; new Indonesian terms in `docs/glossary.md` marked `TODO(review)`; a new screen needs a wireframe the owner has approved; no new dependency without a decision entry; never weaken a test or raise a budget; the PR goes to `staging` and the owner merges it.

---

## Task T-001 — Add a `typecheck` script

**Status:** done
**Commit:** `1d5690e`
**PR:** #108
**Owner:** worker
**Branch:** `task/T-001-typecheck-alias`

**Goal:** `pnpm --filter web typecheck` must work from a clean checkout. It does not exist today: `web/package.json` has only `check`, which already runs `svelte-kit sync` first. The handoff and the old plan template named a script that was never there. (The Linux-only tests in `tools/install-browser-deps.test.mjs`, which are skipped on Windows, were already proven by the CI run of PR 107: 105 tool tests passed, 0 skipped.)

**Scope (in):**
- Add `"typecheck": "pnpm run check"` to `web/package.json`.
- Add `"typecheck": "pnpm --filter web typecheck"` to the root `package.json`.

**Non-goals (out):**
- No change to the `check` script (it works and CI uses it).
- No change to workflows, `AGENTS.md`, or any `.svelte`/`.ts` file. The planner edits `AGENTS.md`.
- No change to `tools/install-browser-deps.*`.

**Files expected to touch:**
- `web/package.json`
- `package.json`

**Design reference:** none (no UI).

**Acceptance criteria:**
- AC1: After `web/.svelte-kit` is removed, `pnpm --filter web typecheck` exits 0 and prints `svelte-check found 0 errors and 0 warnings`.
- AC2: `pnpm typecheck` at the repository root does the same.
- AC3: `pnpm check` still passes, unchanged.
- AC4: The PR is opened to `staging` from `task/T-001-typecheck-alias`. Title: `chore(web): add a typecheck script`. The description follows Google's CL style (problem, why, what is left out, checks) and the repository's PR template, with no attribution lines. The worker does not merge.
- AC5: Every required check of the PR is green (`rust` and `web`), and `REPORT.md` names the CI run.

**Verification:**
```
Remove-Item -Recurse -Force web/.svelte-kit
pnpm --filter web typecheck
pnpm typecheck
pnpm check
pnpm lint
pnpm format:check
```
(Git Bash: `rm -rf web/.svelte-kit`.)
Expected: the two typecheck commands and `pnpm check` end with `svelte-check found 0 errors and 0 warnings`; `pnpm lint` prints nothing and exits 0; `pnpm format:check` prints `All matched files use Prettier code style!` and `cargo fmt --check` prints nothing. Paste the real output into `REPORT.md`.

**Rollback:** `git revert <sha>`; no data migration.

**Depends on:** none

**Notes for worker:** There is no failing test to write first, because this task adds a script and no behavior. Say so in the PR description. Remember that `web/.svelte-kit` is git-ignored, so removing it is safe.

---

## Task T-002 — Remove the stale `tokio` audit ignore

**Status:** todo (not before 2026-11-04)
**Owner:** worker
**Branch:** `task/T-002-tokio-audit`

**Goal:** `.cargo/audit.toml` ignores RUSTSEC-2026-0384 "until 2026-11-04". The lock file has had `tokio 1.54.1` (the fixed version) since commit 2d0dba6 on 2026-10-25, so the ignore is probably stale. Remove it and prove that `cargo audit` is green without it.

**Scope (in):**
- Remove the `ignore` line and its comment from `.cargo/audit.toml`.
- If `cargo audit` then reports something else, stop and report. Do not add a new ignore.

**Non-goals (out):**
- No other dependency update. No change to `pnpm-workspace.yaml` or the `deepmerge` advisory.

**Files expected to touch:**
- `.cargo/audit.toml`
- `Cargo.lock` only if `cargo audit` or `cargo tree` proves that tokio is not at 1.54.1 or newer. In that case run `cargo update -p tokio --precise 1.54.1` and say so.

**Design reference:** none.

**Acceptance criteria:**
- AC1: `cargo tree -i tokio` shows tokio 1.54.1 or newer.
- AC2: `cargo audit` exits 0 with no ignore.
- AC3: `cargo test` and `pnpm test:wasm` pass.

**Verification:**
```
cargo tree -i tokio
cargo audit
cargo test
pnpm test:wasm
```
Expected: version 1.54.1 or newer; `cargo audit` exits 0; all tests pass.

**Rollback:** `git revert <sha>`.

**Depends on:** T-001 accepted; not before 2026-11-04.

**Notes for worker:** Mark `MD_FILES/ROADMAP.md` as the owner's private file: do not edit or commit it. Tell the planner in `REPORT.md` that the dated chore is done.

---

## Task T-003 — Replace the four HW05 CNF presets with five original ones

**Status:** done
**Commit:** `d938e2a`
**PR:** #110
**Owner:** worker
**Branch:** `task/T-003-original-cnf-presets`

**Goal:** `web/src/lib/grammar/presets.ts` has four presets titled "CNF 01/03/04/05 (HW05 Fasilkom UI)", and three Rust tests are named after HW05. The About page promises that content is never copied from course homework. Replace them with five grammars that the planner designed, each showing a different part of the six CNF phases, and test them against the language they must keep.

**Scope (in):** the five grammars below (terminals are lower-case letters; variables are capitals).

| Id | Grammar | Language (the test oracle) | What it shows |
|---|---|---|---|
| `CNF_ORDER` | `S → a \| A B`, `A → a`, `B → B b` | `{a}` | Phase 4: remove unproductive first (`B` and `S → A B`), then `A` is unreachable. Final grammar: `S → a`. |
| `CNF_NULLABLE` | `S → A B C`, `A → a A \| ε`, `B → b B \| A`, `C → c \| ε` | `a* b* a* (c or empty)` | Phase 2 with several nullable variables, a nullable start symbol, and the unit rule `B → A`. |
| `CNF_START_LONG` | `S → x S y y \| z` | `xⁿ z y²ⁿ`, n ≥ 0 | Phase 1 (start symbol on the right), phase 5, and a rule of length 4 in phase 6. |
| `CNF_UNIT_CHAIN` | `S → A`, `A → B`, `B → C \| b b`, `C → c C \| c` | `{bb} ∪ c⁺` | Phase 3 (unit chain). Then `A` and `B` are unreachable (phase 4b). Expected rules: `S → T_b T_b \| T_c C \| c`, `C → T_c C \| c`, `T_b → b`, `T_c → c` (names may differ). |
| `CNF_SHARED_TAIL` | `S → a B C D \| b B C D`, `B → x`, `C → y`, `D → z` | `{axyz, bxyz}` | A shared tail in phase 6. |

- Replace the three Rust tests named `*_from_fasilkom_hw05` in `crates/engine-core/tests/grammar.rs` with one test group per new preset.
- Keep the other four presets (`CFG_PAL`, `CFG_PAREN`, `CFG_ANBN`, `CFG_EQ`) unchanged.

**Non-goals (out):**
- No change to the CNF algorithm. If a test shows a bug, stop and report it as a `blocked` entry with the failing input.
- No shape assertion for `CNF_SHARED_TAIL` (the owner has not yet decided whether helper variables should be shared). Test only the properties in AC2.
- No move of preset text into the i18n files (see T-013).

**Files expected to touch:**
- `web/src/lib/grammar/presets.ts`
- `crates/engine-core/tests/grammar.rs`
- a web unit test only if one already reads the old preset ids (search first)

**Design reference:** none (data only).

**Acceptance criteria:**
- AC1: The four old presets are gone. The five new ones exist with the ids above and titles in Indonesian that do not name any course, homework or Fasilkom.
- AC2: For each new preset, a Rust test checks that (a) the final grammar is valid CNF (every rule is `A → B C` or `A → a`, and `S → ε` appears only if the start symbol is on no right side), and (b) for every string over the grammar's terminals up to length 8, the CYK parser on the final grammar agrees with the language predicate in the table.
- AC3: `CNF_ORDER` ends as exactly `S → a`. `CNF_UNIT_CHAIN` ends with no `A` or `B` and with the rules shown above (compare the structure, not the names).
- AC4: No preset text, test name or comment contains "HW05", "Fasilkom" or "homework" in the new code.
- AC5: In the PR description, the worker states that it compared the five grammars with the HW05 grammars in `REFERENCES` and that none is equal to one of them or a renaming of one. Do not paste or copy the course grammars.
- AC6: A deliberate break is shown for `CNF_ORDER` (swap phase 4a and 4b: the test fails) and for `CNF_UNIT_CHAIN` (skip phase 4b: the test fails). Paste the failing output, then restore the code.

**Verification:**
```
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test -p engine-core --test grammar
pnpm --filter web test
pnpm check
pnpm lint
pnpm format:check
pnpm check:strings
pnpm check:tokens
```
Expected: all pass; the new tests are listed by name in the `cargo test` output; no occurrence of `hw05` (case-insensitive) in `crates/` or `web/src/lib/grammar/`.

**Rollback:** `git revert <sha>`; presets are plain data and no one has saved them (user grammars are stored separately).

**Depends on:** T-001 accepted.

**Notes for worker:** Write the tests first and watch them fail against an empty preset list. The planner worked out the table by hand: any difference between the table and the engine is a finding, either in the table or in the engine. Report it; do not "fix" the table or the engine silently.

---

## Task T-004 — Glossary entries and ADRs for the language and grammar engines

**Status:** done
**Commit:** `9d46f2f`
**PR:** #116
**Owner:** worker
**Branch:** `task/T-004-adr-glossary-grammar-language`

**Goal:** The formal-language enumeration (PR 104) and the CFG/CNF/CYK workstation (PR 105) added 119 Indonesian messages and two engines, with no ADR and no glossary entries. Write them from the code and the PR descriptions. This is documentation only.

**Scope (in):**
- `docs/decisions/0031-language-enumeration.md` and `docs/decisions/0032-grammar-cnf-cyk.md`, in the format of `0029` (Status, Context, Decision, Consequences). State only what the code does: the parser, the budgets (for example the 50,000-check budget of the enumeration), the six CNF phases and their order, the pair reuse in phase 6, the CYK table, the limits against combinatorial blowup.
- In `docs/glossary.md`, one paragraph "Added in the grammar and language workstations (`TODO(review)`)" that lists every new Indonesian term used in the `grammar.*` and `language.*` messages, with the English term.

**Non-goals (out):**
- No code change. No new decision: where the code shows an unclear choice, write "the code does X; the reason is not recorded" and tell the planner.
- No change to existing ADRs.

**Files expected to touch:**
- `docs/decisions/0031-language-enumeration.md` (new)
- `docs/decisions/0032-grammar-cnf-cyk.md` (new)
- `docs/glossary.md`

**Design reference:** none.

**Acceptance criteria:**
- AC1: Both ADRs exist and every number they quote (budgets, limits) can be found in the code; the file and line are given in `REPORT.md`.
- AC2: Every `grammar.*` and `language.*` message in `web/src/lib/i18n/id.ts` that contains a term not yet in the glossary is listed in the glossary paragraph.
- AC3: The worker lists the unclear choices in `REPORT.md` for the planner.

**Verification:**
```
pnpm format:check
pnpm check:strings
```
Expected: both pass. Paste the output into `REPORT.md`.

**Rollback:** `git revert <sha>`.

**Depends on:** T-003 accepted (so that the ADR names the new presets).

**Notes for worker:** The planner reviews the ADRs against the code. Do not invent reasons.

---

## Task T-005 — Remove the `wrangler` and `miniflare` age-rule exclusions

**Status:** todo (not before 2026-11-12; the owner decided on 2026-11-02 to keep `wrangler` 4.155.0 until then)
**Owner:** worker
**Branch:** `task/T-005-remove-age-exclusions`

**Goal:** PR 103 let `wrangler@4.155.0` (published 2026-10-28 20:28 UTC) and `miniflare@5.20261023.2-beta` (2026-10-28 20:19 UTC) skip the two-week `minimumReleaseAge` rule in `pnpm-workspace.yaml`. Both are 14 days old on 2026-11-11. Remove the two exclusions, so that the rule applies to every package again.

**Scope (in):**
- Delete the `minimumReleaseAgeExclude` block (the two entries) from `pnpm-workspace.yaml`.

**Non-goals (out):**
- No version change of `wrangler` or `miniflare`. If a newer `wrangler` exists, do nothing about it.
- No change to the upload retry loop of PR 103.

**Files expected to touch:**
- `pnpm-workspace.yaml`

**Design reference:** none.

**Acceptance criteria:**
- AC1: `pnpm install --frozen-lockfile` succeeds with the exclusions removed (the age rule now accepts both versions).
- AC2: `pnpm check:workflows` and `pnpm build` pass.
- AC3: In the PR's CI run, the preview upload step succeeds and the bot comment shows a preview URL.
- AC4: If the install fails because a package is still too young, stop and report the package and its date. Do not add a new exclusion.

**Verification:**
```
pnpm install --frozen-lockfile
pnpm check:workflows
pnpm build
```
Expected: all exit 0. Paste the real output into `REPORT.md`, and name the CI job that did the preview upload.

**Rollback:** `git revert <sha>`.

**Depends on:** none; not before 2026-11-12.

**Notes for worker:** This is a dependency rule, so stop and ask if anything is unclear (see "Decisions the worker never makes alone" in `AGENTS.md`).

---

## Task T-014 — CNF phase 6 follows the course method (no shared helper variables by default)

**Status:** done
**Commit:** `d4aec74`
**PR:** #112
**Owner:** worker
**Branch:** `task/T-014-cnf-course-method`

**Goal:** The course slide ("Eliminating Long RHS") turns `A → N1 N2 … Nn` (n > 2) into `A → N1 M2`, `M2 → N2 M3`, …, with `n − 2` new variables for each rule and no sharing between rules. Since commit a82bf0e, our phase 6 reuses a helper variable when the same pair appears in another rule, so a student who works by hand gets a different grammar. Make the course method the default and keep the sharing behind an option, off by default. The owner wants both versions in the UI (planner task P-002 and T-015); this task changes the engine only.

**Scope (in):**
- In `crates/engine-core/src/grammar/cnf.rs`, add an option `share_helpers: bool` (default `false`) to the CNF transformation. With `false`, every long rule gets its own `n − 2` helper variables. With `true`, behave as today.
- Pass the option through the WASM API and the TypeScript types (`crates/engine-wasm`, `web/src/lib/engine/protocol.ts`, `handlers.ts`). Default `false`. Do not add a control to the page.
- Name helper variables in the same way as today.

**Non-goals (out):**
- No UI control, no change to the other five phases, no change to the order of the phases.
- No change to which phase reuses an existing `A → a` rule for a terminal (the slide says `Ta` may be replaced by `A`). Report in `REPORT.md` what the code does today; the planner decides later.

**Files expected to touch:**
- `crates/engine-core/src/grammar/cnf.rs`
- `crates/engine-core/src/api.rs`, `crates/engine-wasm/src/lib.rs`
- `crates/engine-core/tests/grammar.rs`
- `web/src/lib/engine/protocol.ts`, `web/src/lib/engine/handlers.ts` (and the generated types, by `pnpm build:types`)
- the unit test of the handlers, if it checks the arguments

**Design reference:** none (engine only).

**Acceptance criteria:**
- AC1: With the default, `CNF_START_LONG` (`S → x S y y | z`) makes separate helper variables for `S0` and `S`. With `share_helpers: true`, they share them (the behavior of today).
- AC2: With the default, `CNF_SHARED_TAIL` (`S → a B C D | b B C D`) has two separate helper chains. With `true`, the tail is shared. Both versions are valid CNF and accept the same language (checked by CYK for all strings up to length 8).
- AC3: A test written from the slide example `A → B C D E` gives exactly `A → B M1`, `M1 → C M2`, `M2 → D E` (names of the helpers may differ; compare the structure).
- AC4: The existing grammar tests still pass, and a deliberate break (always share) fails the AC1 test.
- AC5: The web page still works without a new control (it passes the default).

**Verification:**
```
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test -p engine-core --test grammar
pnpm build:wasm
pnpm test:wasm
pnpm --filter web test
pnpm check
pnpm lint
pnpm format:check
```
Expected: all pass. Paste the real output.

**Rollback:** `git revert <sha>`; the option defaults to the course method, and no saved data stores it.

**Depends on:** T-003 accepted.

**Notes for worker:** The planner read the owner's slide deck on CFG normal forms (in `REFERENCES/PACIL-TBA/`, the pages on mixed and on long right-hand sides). Read them too and say in `REPORT.md` if the code differs from them anywhere else.

---

## Task T-018 — Start state marker: a large hollow triangle, like JFLAP

**Status:** done
**Commit:** `987b2e8`
**PR:** #120
**Owner:** worker
**Branch:** `task/T-018-start-marker-triangle`

**Goal:** The owner wants the start state to look as in JFLAP: a large hollow triangle that touches the state, with the label "mulai" kept beside it (approved on 2026-11-02, "triangle with label"). Today the marker is a short arrow (40 long, with an arrowhead). The marker is drawn by one geometry function, so the editor, the guide embeds, the comparison player and the SVG and PNG export change together.

**Scope (in):**
- `web/src/lib/editor/diagram/geometry.ts`: replace the arrow by a triangle. Constants: length 28, width 36. `StartShape.path` becomes the closed triangle (`M tip L corner L corner Z`). `head` is the tip, on the rim (distance `RADIUS` from the center). `tail` is the middle of the base, at distance `RADIUS + 28`. The label is placed beyond `tail` by the same label rule as today. `bounds` includes the three vertices and the label box.
- `web/src/lib/editor/diagram/DiagramDrawing.svelte`: draw the marker as a closed shape with fill `--color-surface`, stroke 1.5 `--color-neutral-ink`, round joins, and **no arrowhead**.
- `web/src/lib/share/image.ts`: the SVG and PNG export draw the same triangle, with the same fill and stroke as the exported state circles.
- Unit tests (`geometry.test.ts`, `image.test.ts`) and one e2e check (see AC7).

**Non-goals (out):**
- No change to the angle rules (the marker still keeps to the left, and moves only when the left is busy), to the label text (`diagram.start`), to the state circle, to the accepting circle, to the edges, or to any token.
- No new color, no new message, no new interaction (the marker is not selectable and has no hit area today; keep it so).
- If a message or a guide says "arrow" for the start marker (search `id.ts`, `en.ts`, the tour and `content/`), **report it** in `REPORT.md`. Do not change the text.

**Files expected to touch:**
- `web/src/lib/editor/diagram/geometry.ts`, `geometry.test.ts`
- `web/src/lib/editor/diagram/DiagramDrawing.svelte`
- `web/src/lib/share/image.ts`, `image.test.ts`
- one e2e spec that already draws a machine with a start state (find it with `grep -rl "start" web/e2e`)

**Design reference:**
- `design/screens/start-state-marker.md` and `design/screens/start-state-marker.svg` (the approved picture and the numbers)
- `docs/ux/editor-interactions.md`: the "Start" row and "Angle of the start arrow and of self-loops"

**Acceptance criteria:**
- AC1: With one state and no other busy angle, the tip is at distance 32 from the center on the left (180°). The base is 28 further out, perpendicular to the axis, and 36 wide (18 on each side). A unit test checks the exact coordinates.
- AC2: For every angle that the rule can pick (the 24 multiples of 15°), the tip is on the rim, the base center is at `RADIUS + 28`, the vertices are symmetric about the axis, and the label box touches neither the triangle (grown by 2) nor the state circle. A unit test loops over the 24 angles.
- AC3: The marker is a closed shape in the page with fill `--color-surface`, stroke 1.5 `--color-neutral-ink`, and no `marker-end`. The circle of an accepting start state does not change.
- AC4: `bounds` contains the three vertices and the label box. The existing tests of the camera, the first view and "no edge to the canvas" still pass without a change of their expected values, or the change is explained in `REPORT.md`.
- AC5: The SVG export holds a closed filled path for the start marker, with no arrowhead marker on it, and the PNG export (which renders that SVG) shows it. `image.test.ts` checks the SVG text.
- AC6: `pnpm check:tokens`, `pnpm check:contrast` and `pnpm check:strings` pass without a change of their data (no new color, no new text).
- AC7: One e2e test draws a machine with a start state, finds the marker, and runs axe with no violation, on the laptop and the phone project.
- AC8: A deliberate break is shown: move the tip 8 off the rim and AC1 fails; then restore it.

**Verification (Mode B form shown; in Mode A drop the bridge):**
```
pnpm --filter web exec vitest run src/lib/editor/diagram/geometry.test.ts src/lib/share/image.test.ts
pnpm check
pnpm lint
pnpm format:check
pnpm check:tokens
pnpm check:contrast
pnpm check:strings
pnpm build
pnpm size
pnpm --filter web exec playwright test --project=desktop --project=phone <the spec of AC7>
pnpm test:e2e
```
Expected: all pass. Run the new e2e test 5 times. Paste the real output into `REPORT.md`.

**Rollback:** `git revert <sha>`; no saved data holds the marker.

**Depends on:** T-004 accepted. The Playwright browsers must be installed in WSL (`ls ~/.cache/ms-playwright` is not empty; the owner does step 7 of the setup). If they are not, set the task to `blocked` and say so.

**Notes for worker:** Read the picture and the numbers first. The geometry function is the only place that draws the marker, so do not add a second drawing path. Look at the existing start-arrow assertions in `geometry.test.ts` and change them from the arrow to the triangle in the same commit as the code.

---

## Task T-016 — Phone layout of the grammar and the language workstations

**Status:** in-progress
**Owner:** worker
**Branch:** `task/T-016-workstation-phone-layout`

**Goal:** On a phone, both workstations stack three areas as small boxes with their own scroll bars (owner's phone test, 2026-11-02). Make them usable: below 900 px, show **one area at a time** with a tab strip, and let the page scroll as a whole. The laptop layout does not change.

**Scope (in):**
- `GrammarWorkstation.svelte` and `LanguageWorkstation.svelte`: a phone mode below **900 px for both** (the language workstation uses 1024 px today). A tab strip under the mode bar: grammar has `Pustaka`, `Editor`, `CNF`, `CYK`; language has `Pustaka`, `Editor`, `Hasil`. Use the tab pattern of the FSM panel tabs (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, arrow keys), and a shared small component if both screens need it. The strip is sticky.
- In phone mode: no inner scroll boxes, `height: auto`, the page scrolls. Only the CYK table scrolls sideways in its own box.
- Choosing or creating an item in `Pustaka` selects it and moves to `Editor`; the Editor header shows its name.
- Grammar CNF tab: the stepper header (six round buttons, previous, counter, next) is sticky under the tab strip; 44 px tap areas. Grammar CYK tab: the field and the button stack to the full width.
- Language Editor tab: the formula box first, then the toolbar (wrapping, 44 px buttons). Language Hasil tab: the three settings in one compact row (a three-column grid), then the results at once.
- The shortcut button "Ubah ke CNF" (English: "Convert to CNF") at the end of the grammar Editor tab, in the phone layout only: full width, at least 44 px high, primary style; it shows the CNF tab (the owner wants it, 2026-11-02).
- New texts in `id` and `en`: the tab names and the shortcut.

**Non-goals (out):**
- No change to the laptop layout, the splitters, the engine, the saved data, the switcher, or the CNF and enumeration logic.
- No new color or token. No change to the preset texts or the rule chips (task T-013).
- No saving of the chosen tab between visits.

**Files expected to touch:**
- `web/src/lib/grammar/GrammarWorkstation.svelte`, `GrammarCnfStepper.svelte`, `GrammarCykTester.svelte`
- `web/src/lib/language/LanguageWorkstation.svelte`
- a shared tab-strip component under `web/src/lib/components/` (only if both screens use it)
- `web/src/lib/i18n/id.ts`, `en.ts`
- new e2e specs for the phone layouts (for example `web/e2e/grammar-phone.spec.ts` and `web/e2e/language-phone.spec.ts`) and, for WebKit, a spec under `web/e2e/cross/`

**Design reference:**
- `design/screens/workstation-phone-layout.md` and `.svg` (the proposal and the picture)
- `design/screens/grammar-workstation.md` and `language-workstation.md` (what exists)

**Acceptance criteria** (tests use the phone project at 360×780 and 390×844):
- AC1: Each workstation shows a tab strip with the right tabs, and exactly one area is visible. Tapping a tab shows its area and hides the others (`aria-selected` and `hidden` follow).
- AC2: In phone mode no element other than the CYK table box has a vertical scroll of its own (`overflow-y` auto or scroll with `scrollHeight` greater than `clientHeight`). The page itself scrolls when the content is long.
- AC3: Grammar, CNF tab: the title of the current phase and the first chips are visible without scrolling. After scrolling down the step card, the stepper header is still visible (a bounding-box test).
- AC4: Language, Hasil tab: the first result row is visible without scrolling.
- AC5: Language, Editor tab: the formula box (4 rows) is above the toolbar and fully visible.
- AC6: Every tab, button, chip and round button in phone mode is at least 44×44 CSS px (a test measures them).
- AC7: Tapping a preset selects it, moves to `Editor`, and the header shows its name.
- AC8: The arrow keys move between tabs. Axe reports no violation in each tab. The same flows pass in the WebKit phone project.
- AC9: The laptop layout is unchanged: at 1280×800 the three columns and the splitters are there, and the existing grammar and language tests pass.
- AC10: New texts exist in `id` and `en`, and `pnpm check:strings`, `check:tokens` and `check:contrast` pass without a change of their data.
- AC11: A deliberate break is shown: remove the sticky position of the stepper header, AC3 fails; then restore it.
- AC12: In the grammar Editor tab of the phone layout, the button "Ubah ke CNF" is at the end of the content, full width and at least 44 px high. Tapping it shows the CNF tab. The button is not in the laptop layout.

**Verification (Mode B form shown; in Mode A drop the bridge):**
```
pnpm check
pnpm lint
pnpm format:check
pnpm check:strings
pnpm check:tokens
pnpm check:contrast
pnpm --filter web exec vitest run
pnpm build
pnpm size
pnpm --filter web exec playwright test --project=phone <the two new specs> --repeat-each=5
pnpm test:e2e
pnpm test:e2e:cross
```
Expected: all pass. Paste the real output into `REPORT.md`.

**Rollback:** `git revert <sha>`; no saved data changes.

**Depends on:** the owner's approval of the design file. The Playwright browsers (Chromium and WebKit) must be installed in WSL; if not, set the task to `blocked`.

**Notes for worker:** Build the phone mode with CSS and one `$state` for the active tab, so that the laptop layout keeps working unchanged. Keep both workstations on the same breakpoint. The owner tests on a real phone before the PR is merged (task G4 of the roadmap): say in `REPORT.md` where to find the preview.

---

## Task T-050 — A fast path in CI for pull requests that change only documents

**Status:** todo (the owner approves this spec by merging the PR that adds it; this changes workflows, so stop and ask if anything is unclear)
**Owner:** worker
**Branch:** `task/T-050-ci-docs-only-fast-path`

**Goal:** Every pull request runs the whole CI (about 6 to 7 minutes, plus CodeQL, audit, fuzz and a preview deploy), even when it changes only documents. Make a documents-only change pass the **required** checks (`rust` and `web`) in about a minute, without weakening any guard and without a way to hide a code change as a document. The decision is made **inside the workflow**, not at its trigger: a workflow that is stopped by `paths-ignore` never reports the required checks, and the pull request then waits for ever.

**Scope (in):**
1. `tools/docs-only.mjs` (new): reads a list of changed paths separated by NUL bytes from standard input and prints `true` only if the list is not empty and **every** path is in the allowlist below. Anything else, any error and any odd path print `false`. It is a small pure function with unit tests.
   - **Allowlist, exactly:** a path under `docs/`, `design/` or `.antigravity/`; or one of these files in the root: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSE`.
   - **Never in the allowlist:** `content/` (the guides and questions are compiled into the site), `.github/`, `tools/`, `web/`, `crates/`, `.cargo/`, lock files, any config file, and any nested Markdown file such as `web/src/README.md`.
2. `tools/ci-gate.mjs` (new): decides the result of the gate from the results of the jobs. It takes the `needs` results and the value of `docs_only` and exits with 0 or 1:
   - the result of the `scope` job is not `success` → fail;
   - any job failed or was cancelled → fail;
   - `docs_only` is `true` → the heavy jobs may be `skipped`;
   - `docs_only` is not `true` → every heavy job must be `success` (a `skipped` heavy job is a **failure**).
3. `.github/workflows/ci.yml`:
   - a new first job `scope` (with `timeout-minutes`, read-only permissions, the runner pinned like the others, and the actions pinned to a full commit as the guard rails require). It checks out with the history it needs and runs `git diff --name-only -z <base> <head>` into `tools/docs-only.mjs`. For a `pull_request` the range is the base commit to the head commit of the event; for a `push` it is `before` to `sha` of the event. If the range cannot be built (no `before`, a new branch, a failed diff, a shallow clone) the output is `false`. For a push to `main` the output is always `false`: production always gets the full CI. File names are untrusted: never put them into a shell command line; read them as data.
   - the heavy jobs (`rust`, `checks`, `e2e`, `lighthouse`, `cross-browser`) get `needs: scope` (kept together with their existing `needs`) and `if: needs.scope.outputs.docs_only != 'true'`.
   - the gate job `web` keeps `if: always()`, gets `scope` in its `needs`, and calls `tools/ci-gate.mjs`. The gate must still run even when jobs are skipped. Keep `rust` as a required check by itself: a job that is skipped by its own `if` counts as passed for a required check.
4. The workflows that are **not** required checks (`audit.yml`, `codeql.yml`, `fuzz.yml`, and the preview part of `deploy.yml` on a pull request) get `paths-ignore` on `pull_request` with the **same list** as the allowlist (a workflow with `paths-ignore` still runs when any changed file is outside the list). Do not change the `push` trigger of `deploy.yml`.
5. `tools/check-workflows.mjs` and its test: new rules, so the guard rails keep the fast path honest: the `scope` job exists and has a timeout; every heavy job needs `scope` and has the `if`; the gate has `if: always()` and needs `scope`; the `paths-ignore` lists of the other workflows are **equal** to the allowlist in `tools/docs-only.mjs` (one list, checked in two places); no workflow uses `pull_request_target`.
6. `docs/decisions/0033-docs-only-fast-path-in-ci.md`: the decision, why it is inside the workflow and not at the trigger, the allowlist and why each entry is safe, the fail-safe rules, the threat model (a code change dressed as a document; a crafted file name; a skipped gate), and what is never skipped (`main`, `.github/`, `content/`, `web/`, `crates/`, `tools/`).

**Non-goals (out):**
- No change to the list of required checks in the repository settings, to permissions, to secrets, to caches, or to the deploy job that holds the Cloudflare token.
- No `paths-ignore` on `ci.yml`. No third-party action for path filters (no new action: use git and our own script). No merge queue.
- No change of what a full CI run does.

**Files expected to touch:**
- `tools/docs-only.mjs`, `tools/docs-only.test.mjs`, `tools/ci-gate.mjs`, `tools/ci-gate.test.mjs` (new)
- `tools/check-workflows.mjs`, `tools/check-workflows.test.mjs`
- `.github/workflows/ci.yml`, `audit.yml`, `codeql.yml`, `fuzz.yml`, `deploy.yml`
- `docs/decisions/0033-docs-only-fast-path-in-ci.md` (new)

**Design reference:** none (no UI). Read `MD_FILES`-free facts only: `docs/decisions/0027-ci-time-limits-and-faster-ci.md` and the existing guard rails in `tools/check-workflows.mjs`.

**Acceptance criteria:**
- AC1: `docs-only` tests: a list of only allowed paths gives `true`; one path outside the list gives `false`; an empty list gives `false`; and each of these gives `false`: `content/guides/x.md`, `web/src/README.md`, `.github/ISSUE_TEMPLATE/x.md`, `tools/x.mjs`, `docsx/a.md`, `docs/../web/src/a.ts`, `./docs/a.md`, `README.md.js`, a path with a newline or a space in it, and a path that is empty.
- AC2: `ci-gate` tests cover every row of the table in scope item 2, and a missing or odd input gives a failure.
- AC3: `check-workflows` tests fail when a heavy job loses `needs: scope` or its `if`, when the gate loses `if: always()`, when the lists of the other workflows differ from the allowlist, and when `pull_request_target` appears.
- AC4: Two deliberate breaks are shown and restored: put `content/` into the allowlist (AC1 fails), and make the gate accept a skipped heavy job when `docs_only` is not `true` (AC2 fails).
- AC5: In the CI of this PR (it changes `.github/**`, so it is **not** docs-only) every job runs and `rust` and `web` pass. Say so in `REPORT.md`.
- AC6: `pnpm test:tools` and `pnpm check:workflows` pass, and `pnpm check:workflows` also passes on the old workflows when the new rules are turned off (the rules are new; nothing else changed).

**Verification (Mode B form shown; in Mode A drop the bridge):**
```
pnpm test:tools
pnpm check:workflows
pnpm format:check
pnpm lint
printf 'docs/a.md\0README.md\0' | node tools/docs-only.mjs
printf 'docs/a.md\0web/src/a.ts\0' | node tools/docs-only.mjs
```
Expected: the tests pass; the two last commands print `true` and `false`. Paste the real output.

**Proof after the merge (the planner does this, not the worker):** the next documents-only pull request must show the `scope` job with `docs_only` true, the heavy jobs skipped, `rust` and `web` reported, the PR mergeable, and a total time under two minutes. A pull request that changes one document and one file in `web/` must run everything. If either fails, the planner reverts.

**Rollback:** `git revert <sha>` restores the CI that always runs everything.

**Depends on:** none.

**Notes for worker:** This is a security-relevant change. The danger is a code change that is treated as a document, and a file name that is treated as a command. Keep the allowlist short and exact, deny by default, and read the changed paths only as data. If GitHub does not treat a job skipped by `if` as a passed required check, stop and write a `blocked` entry with the evidence; do not add a workaround.

---

## Planner task P-001 — As-built spec of the grammar workstation, the language workstation and the switcher

**Status:** done (PR 117, merged on 2026-11-02; the phone layout became task T-016)
**Owner:** planner

Write `design/screens/grammar-workstation.md`, `design/screens/language-workstation.md` and `design/screens/workstation-switcher.md` from the screenshots and the code, and add them to `docs/ux/wireframes.md`. No redesign of the laptop layouts. The owner approves each. T-010 to T-012 wait for this.

**Added on 2026-11-02, after the owner's phone test:** the two workstations are not usable on a phone. Both stack their three areas as small boxes with their own scroll bars, so a student sees about one item of the library, one row of the grammar, or only the heading of the CNF phase; in the language workstation the results are below the settings and off the screen. P-001 therefore also proposes a phone layout for both (the proposal is in `design/screens/workstation-phone-layout.md`: one area at a time with a tab strip at the top, like the panel tabs of the FSM editor). The owner approves it before T-016.

## Planner task P-002 — Wireframe of the CNF "versi kuliah / versi ringkas" switch

**Status:** proposed (after P-001)
**Owner:** planner

The owner's idea (2026-11-02): the CNF conversion shows a verbose version that follows the course (no sharing) and a minimized version, with a toggle. The planner draws it and the owner approves it before T-015. Open points for the owner at that time: is "minimized" only shared helper variables, or also reuse of an existing `A → a` rule for a terminal (the slide mentions it)? Are the two versions shown one at a time, or side by side? **Found by the report of T-004:** phase 5 always reuses one `T_c` variable for each terminal across the whole grammar, even when `share_helpers` is false. That is the idea of the slide's note ("Ta can take A instead") only in part, so it matters for what "minimized" means.

---

## Backlog (`proposed`, not dispatchable until the planner specifies the missing fields)

**A. Clean up (after P-001 is approved)**
- **T-010** e2e and axe tests for the grammar workstation (build a grammar, run the six phases, test a string with CYK; laptop and phone).
- **T-011** e2e and axe tests for the language workstation and the workstation switcher (keyboard, 44 px targets).
- **T-012** A test and, if needed, a fix for the panel drag handle on a phone (the `pointer-events` change in PR 105 has no test).
- **T-016** The phone layout of the grammar and the language workstations: specified in its own task block above, `proposed` until the owner approves the design.
- **T-015** The UI switch between the course version and the minimized version of the CNF conversion (needs P-002 approved, and T-014 done).
- **T-013** Check whether preset titles and descriptions of the grammar and language workstations belong in the i18n files (they are plain Indonesian text in `presets.ts`), and move them if so. Also make the rule chips readable (`S → T_aST_b` has no spaces).
- **T-019** CYK input limits: the parser stops at 100 characters (`CykParser::MAX_INPUT_LEN`) but the API accepts up to 256 (`api.rs`), so a string of 101 to 256 characters reaches the parser and fails with a different message. Use one constant and one message (found by the report of T-004).
- **T-017** Make the two local-reference tests (`web/src/lib/share/files.wasm.test.ts` and `open-file.wasm.test.ts`) tolerate other machine types. They read the top level of `REFERENCES/JFF-FILES` and assume every `.jff` there is a finite automaton, so one Turing machine file at the top level made the pre-push hook fail on 2026-11-02 (0 finite automata found). They should keep only files whose type is `fa`, and skip when there are none.

**B. Grammar additions** (a wireframe the owner approves comes first for T-020)
- **T-020** Multi-string test for grammars, like the FSM test list, using the CYK parser.
- **T-021** JFLAP grammar files (`<type>grammar</type>`): import and export. Original fixtures only. The course grammar files in `REFERENCES/` must never become fixtures.
- **T-022** (optional) Right-linear grammar to FA, using the FSM engine.

**C. The PDA** (each step has its own ADR; a wireframe the owner approves comes first for T-033)
- **T-030** PDA data model, JSON schema and validation. **Before it is dispatched, the planner and the owner decide three things**, from the two JFLAP conversions that the owner saved in `REFERENCES/JFF-FILES/CFG-EXAMPLE/`: (1) JFLAP writes whole strings in `pop` and `push` (for example `pop="bSa"`), so the model must allow a string and not one symbol; (2) JFLAP's own output starts with a bottom marker `Z` and pops it at the end, while the autograder notes say the stack starts empty and `Z` is ignored; (3) the acceptance mode (final state, empty stack, input used up).
- **T-031** PDA simulation with a stack trace and budgets.
- **T-032** PDA `.jff` import and export (`<type>pda</type>`).
- **T-033** PDA editor.
- **T-034** CFG to PDA, top-down (the "LL" item of JFLAP), with a step trace. Test against the owner's JFLAP result (`pda_cfg_anbn_LL.jff`): compare the structure (states, transitions), not the names or positions. The worker writes its own small fixture; `REFERENCES/` stays out of git.
- **T-035** CFG to PDA, bottom-up (the "LR" item of JFLAP), with a step trace. Same method with `pda_cfg_anbn_LR.jff`.

**E. Turing machines** (after C; the owner names each step; each has an ADR, differential tests on the owner's `.jff` files, and an approved wireframe before any editor)
- **T-040** TM, one tape: data model, JSON schema, validation.
- **T-041** TM, one tape: simulation with a tape trace and budgets, in two modes (recognizer: a halt state accepts, no transition rejects; function: the head ends on the first output symbol).
- **T-042** TM `.jff` import and export (`<type>turing</type>`; `read`, `write`, `move`).
- **T-043** TM editor (one tape), with the same patterns as the FSM editor. A wireframe the owner approves comes first.
- **T-044** TM with k tapes: model, simulation, `.jff`. The owner has two two-tape samples in `REFERENCES/JFF-FILES/`. In them the file has a `<tapes>` element, and every `<read>`, `<write>` and `<move>` carries a `tape="n"` attribute, so one transition lists all tapes. The worker writes its own small fixtures (`REFERENCES/` stays out of git).
- **T-045** k-tape TM editor. A wireframe the owner approves comes first.
- **T-046** Macro notation: the model, and the expansion of a macro diagram to a standard TM (the exercise of homework 9, part C). The target is the course notation (the owner's figures show a start arrow, `L` and `R` blocks, scanning blocks with a set of symbols, write blocks, `H`, and arrows labeled with a symbol or a set). **JFLAP has a "Turing Machine with Building Blocks" mode (the owner's screenshot shows extra tools).** The owner's sample made in that mode shows the file format: `<type>turingbb</type>`, every state is a `<block>` with a `<tag>` (here `Machine0` to `Machine8`), and the transitions are written as in a plain TM. In that sample each block is only a tagged placeholder, so it does not show where the inner machine of a block is stored, and JFLAP's blocks (sub-machines) may differ from the course notation. Before this task: the owner saves one more `.jff` in which a block holds a real small machine (if JFLAP allows it); the planner writes the model and an ADR; the owner approves them. The result opens as a new machine, like a minimized machine, with an option to save it. Examples in the repository must be original.
- **T-047** Macro editor, with a "Macro to TM" button (scenario 2 of the owner, 2026-11-02): the editor shows the TM version of the macro and offers to save it. A wireframe the owner approves comes first.
- **T-048** TM to macro, "folding" (scenario 1 of the owner, 2026-11-02; JFLAP has no such feature): a button in the TM editor shows the TM in macro form and offers to save it. The idea is to recognize the building blocks of the course notation (move, write, scan to a symbol of a set) inside a TM and replace each by a block; what cannot be recognized stays as a plain sub-machine. Needs an ADR for the method. **Correctness test:** the expansion of the folded macro accepts and rejects the same strings as the original TM, for every string up to a given length, and gives the same tape result in function mode. A research task: it starts only after T-046 and T-047, with the owner's examples of the blocks of the course.

**D. Launch** — G4, G5, L3, L4, U5a and the beta: see `MD_FILES/ROADMAP.md`.
