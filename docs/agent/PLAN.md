# Plan — Milestone 0: clean up, then grammar additions, then the PDA

> Owner: planner. Approved by the human on 2026-11-01 (outline A to D). The human approves each task, or its design, before it becomes `todo`.
> `todo` means ready: every field is written and the human approved it. Several tasks can be `todo` at the same time. The worker does one task at a time: the one that the human names in the start prompt ("Do task T-xxx"). The worker sets it to `in-progress` in the first commit of its own PR and to `done` in the last. The planner does not open a pull request only to change a status.
> The blank task template is in `PLAN-TEMPLATE.md`.

**Suggested order of the `todo` tasks** (the human decides): T-018 (start marker), T-016 (phone layout), T-023 (open the CNF result as a new grammar; after T-016 is merged), then T-026 and T-027 (parser-readable CNF helper names, and `λ` as the empty string; both after T-023 is merged), T-002 (from 2026-11-04), T-050 (CI fast path for docs-only changes), T-005 (from 2026-11-12). T-016 and T-018 need the Playwright browsers in WSL. Written on 2026-11-04 and `todo`: T-019 (one CYK length limit), T-017 (local-reference tests), T-025 (landmarks and tab panels), T-013 (preset text in `id`/`en`, readable rule chips). T-013 and T-025 touch the same two components: do them one after the other. Written on 2026-11-04 after those four were merged and `todo`: T-024 (rule rows with 44 px targets on touch screens), then T-010 (grammar flow e2e; needs T-024 merged), then T-011 (language and switcher e2e). All three touch or test the same two components: one at a time. Written on 2026-11-05: T-029 (`todo`: the CYK tester must space the symbols of a rule). T-060 (CNF phases in the homework order, after T-029 is merged) is `todo` since the owner approved `design/screens/cnf-stepper-homework-order.md`; T-060 is merged (PR 147). Written on 2026-11-05 after it: T-015 (`todo`: the "versi panjang / versi ringkas" toggle). Written on 2026-11-05 after T-015 merged: T-030, then T-031 (`todo`, the PDA engine: model and validation, then simulation; one after the other, they touch the same engine files). T-032 is `todo` since 2026-11-05 (T-031 merged); T-034 to T-038 are `proposed` drafts; the full specs are written when the one before is merged.

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

**Status:** done
**Commit:** `9dcad9d`
**PR:** #134
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

**Status:** done
**Commit:** `b0ec336`
**PR:** #121
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

## Task T-023 — Open the CNF result as a new grammar

**Status:** done (branch `task/T-023-open-cnf-as-grammar`)
**Owner:** worker
**Branch:** `task/T-023-open-cnf-as-grammar`

**Goal:** The FSM panels end with "Buka sebagai mesin baru" (`convert.open_result`, in `ConversionPanel.svelte` and `CompilePlayer.svelte`). The grammar workstation has nothing like it: a student can read the six CNF phases but cannot keep the result. Add the same idea: on the last step (the CNF result) a button "Buka sebagai tata bahasa baru" adds the result to the library as a new custom grammar and shows it in the Editor. The original grammar does not change.

**Scope (in):**
- `web/src/lib/grammar/grammar-text.ts` (new): `grammarToText(grammar: Grammar): string`. One line per head, in the order of first appearance, the start symbol first: `A -> X Y | a`. **Write one space between every two symbols**, so that a variable followed by a digit terminal (`A 1`) and a variable named `A1` stay different when the editor reads the text back. Write an empty body the way `matrixRowsToGrammarText` and the legend of the editor do (`λ`; check both before you choose). Write variable names as they are (`S_0`, `T_a`, `X1`).
- `web/src/lib/grammar/GrammarCnfStepper.svelte`: a new optional prop `onopen`. When it is given and the current step is the last one, show a primary button under the step card (the place of the `end` row in the FSM panel). Text key `grammar.open_cnf_as_new`. On a phone it is full width and at least 44 px high.
- `web/src/lib/grammar/GrammarWorkstation.svelte`: the handler. Title `<name of the open grammar> (CNF)`; if that title exists, `(CNF 2)`, `(CNF 3)`, and so on. Save it as a custom grammar (`saveCustomGrammars`), select it (`selectCustom`; on a phone this shows the Editor tab). The feedback is the new entry in the library and its name in the Editor header; **add no new message element** (if you think one is needed, stop and ask).
- A small helper `nextCustomId(existing)` that returns the first `G<n>` that is not used, and use it in `createNewCustomGrammar` too. Today that function uses `customGrammars.length + 1`, so after you delete `G1` and keep `G2` the next new grammar gets the id `G2` again (two entries with one id). This task adds more custom entries, so fix it here, with a test.
- Strings in `id` and `en`: `grammar.open_cnf_as_new` = "Buka sebagai tata bahasa baru" / "Open as a new grammar".

**Non-goals (out):**
- No change to the engine, to the CNF phases, to the CYK tab, or to the original grammar.
- No button on steps 1 to 5 (the owner may ask for it later).
- No file export (that is T-021) and no change to the stored format of custom grammars.
- When P-002 and T-015 add a second version of the CNF, this button will open the version on screen. That is not part of this task.

**Files expected to touch:**
- `web/src/lib/grammar/grammar-text.ts`, `grammar-text.test.ts`, `grammar-text.wasm.test.ts` (follow the pattern of the other `*.wasm.test.ts` files)
- `web/src/lib/grammar/GrammarCnfStepper.svelte`, `GrammarWorkstation.svelte`
- `web/src/lib/i18n/id.ts`, `en.ts`
- `web/e2e/grammar-phone.spec.ts` or a new `web/e2e/grammar-open-cnf.spec.ts` (laptop and phone), and `web/e2e/cross/workstation-phone.spec.ts` for WebKit

**Design reference:**
- The FSM panel: `web/src/lib/editor/ConversionPanel.svelte` (the `end` row with `convert.open_result` and "Tutup") and `design/screens/workstation-phone-layout.md` (the CNF tab).

**Acceptance criteria:**
- AC1: `grammarToText` gives the exact expected text for three grammars written by hand: one with an empty rule, one with a start symbol `S_0` and helpers `T_a`, `X1`, and one with a two-digit helper `X10` next to a digit terminal. A unit test compares the strings.
- AC2: Round trip. For every preset in `GRAMMAR_PRESETS`, and for the CNF result of each (both with and without shared helpers), `parseGrammar(grammarToText(g))` has the same start symbol and the same set of (head, body) rules as `g`. The test also runs at least 200 small grammars from a seeded generator. Use the test tools that the repo already has; add no dependency.
- AC3: The button shows on step 6 of the CNF trace and on no other step (e2e, laptop and phone).
- AC4: Tapping it adds the entry "`<name>` (CNF)" to the custom list of the library, selects it, shows its rules in the Editor, and shows its name in the Editor header. On a phone the Editor tab is active. The original entry still has its old text. Tapping again on the same result makes "(CNF 2)".
- AC5: The new entry is already in CNF: running the CNF pipeline on it gives a final grammar equal (as a set of rules) to itself. If this does not hold, do not hide it: report it in `REPORT.md` as an engine finding.
- AC6: After a reload the new entry is still in the library (it uses the existing storage).
- AC7: `nextCustomId` never returns an id in use (a unit test with `G1` deleted and `G2` kept).
- AC8: The button is at least 44 px high on a phone and full width. Axe reports no violation in the CNF tab at step 6, on the laptop and the phone projects and on the WebKit phone project.
- AC9: `pnpm check:strings`, `check:tokens` and `check:contrast` pass without a change of their data. The two new strings exist in `id` and `en`.
- AC10: A deliberate break is shown: join the symbols without spaces in `grammarToText`; AC1 and AC2 fail; then restore it.

**Verification (Mode B form shown; in Mode A drop the bridge):**
```
pnpm --filter web exec vitest run src/lib/grammar
pnpm check
pnpm lint
pnpm format:check
pnpm check:strings
pnpm check:tokens
pnpm check:contrast
pnpm build
pnpm size
pnpm --filter web exec playwright test --project=desktop --project=phone <the new or changed e2e spec> --repeat-each=10
pnpm test:e2e
pnpm test:e2e:cross
```
Expected: all pass. Run the new e2e tests 10 times (they use local storage). Paste the real output into `REPORT.md`.

**Rollback:** `git revert <sha>`. Custom grammars that were already saved stay valid: they are plain text.

**Depends on:** T-016 done and merged (it changes the same two components).

**Notes for worker:** Look at how the FSM panel places "Buka sebagai mesin baru" and copy the pattern, not the code. The sticky stepper header of T-016 must keep working. Do not touch the CNF engine: this task reads `cnfTrace.finalGrammar` only.

---

## Task T-026 — CNF helper variables that the grammar parser can read back

**Status:** done
**Commit:** `959dd6a`
**Owner:** worker
**Branch:** `task/T-026-readable-cnf-helper-names`

**Goal:** CNF phase 5 names the helper variable of a terminal `c` as `T_c` (`cnf.rs`, `phase5_isolate_terminals`). For a letter or a digit this is fine (`T_a`, `T_0`). For a terminal such as `(` or `+` the name is `T_(`, which the grammar parser cannot read: it reads `T_` and then the terminal `(`. So the CNF result that the student sees is not the same grammar as the text that T-023 stores when the student opens the result as a new grammar. Make every helper name readable by the parser, so that the text and the grammar always agree.

**Scope (in):**
- `crates/engine-core/src/grammar/cnf.rs`, phase 5: if the terminal is an ASCII letter or digit, keep the name `T_<c>` (no visible change for existing grammars). Otherwise use `T_p<n>`, where `n` is 1, 2, 3 in the order in which the engine first needs a helper for such a terminal (the order is fixed by the sort of the rules, so the result is the same every time). Keep `fresh_variable_name` as the guard against a name that already exists. A name must match what `parser.rs` reads as one variable: an uppercase letter, `_`, then letters or digits.
- The step trace must still say which terminal each helper stands for (the rule `T_p1 -> (` shows it). If the current message parameters do not, add a parameter; do not put a sentence in the engine.
- Rust tests first: (a) `T_a`, `T_0` names are unchanged for the existing presets (the CNF results of all presets except `CFG_PAREN` are equal to what they are today); (b) `CFG_PAREN` gives `T_p1` and `T_p2` (or the names your rule gives) and no name with a non-alphanumeric character; (c) a `proptest` property: for random grammars over letters, digits and the characters `( ) + * , ;`, every variable of `finalGrammar` is read back as exactly one variable when you write the rules with `grammarToText`-style spacing and parse them again, and the rule set is equal; (d) a grammar that already has a variable `T_p1` still gets a fresh name.
- `web/src/lib/grammar/grammar-text.wasm.test.ts` (from T-023): the two tests that T-023 marked `it.fails` with the comment "known until T-026" become normal passing tests (the `CFG_PAREN` round trip and its CNF idempotence). Remove the "engine finding" wording.
- The Phase 5 description text in `id.ts` and `en.ts` (key for "Menggantikan terminal ... T_a → a") may need one more example for a symbol. Change it only if it would now be wrong; any new Indonesian wording is marked `TODO(review)` in `docs/glossary.md`.

**Non-goals (out):**
- No other CNF phase, no `S0`/`X_n` names, no parser change (that is T-027), no change to the CYK tab or the stepper layout.
- Do not change the name of any helper that is already readable.

**Files:** `cnf.rs`, the Rust tests in `crates/engine-core/tests/grammar.rs`, `grammar-text.wasm.test.ts`, maybe `id.ts`/`en.ts`, `docs/agent/REPORT.md`.

**Verification:**
```
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
wasm-pack test --node crates/engine-wasm
pnpm build:wasm && pnpm --filter web exec vitest run
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings
pnpm build && pnpm size
pnpm test:e2e
```
Expected: all pass, and the `.wasm` stays within the budget in `AGENTS.md`/`CLAUDE.md` section 7. Do a deliberate break: make phase 5 use `T_{c}` for every terminal again; test (b) and the `grammar-text.wasm.test.ts` round trip for `CFG_PAREN` must fail. Paste the real output into `REPORT.md`.

**Rollback:** `git revert <sha>`. Saved machines and grammars are plain text and stay valid.

**Depends on:** T-023 done and merged.

**Notes for worker:** The textbook (Rich) only needs a new variable for each terminal, so the exact name is free; keep `T_a` for letters so that students still recognize it. Do not decide a different naming scheme alone: if `T_p<n>` has a problem, stop and ask.

---

## Task T-027 — The grammar parser reads `λ` as the empty string

**Status:** done
**Owner:** worker
**Branch:** `task/T-027-parser-lambda-empty`

**Goal:** The Editor legend says that `ε`, `λ` and `^` all mean the empty string, and the presets use `λ`. But `parse_rhs_symbols` in `crates/engine-core/src/grammar/parser.rs` accepts `ε`, `^`, `\lambda`, `\epsilon`, `lambda` and `epsilon`, not the character `λ` (U+03BB). So `S -> a S b | λ` gives a rule with the terminal `λ`, not an empty rule. Make the parser accept `λ`.

**Scope (in):**
- `parser.rs`: add `trimmed == "λ"` to the empty-body check. Rust tests first: `S -> a S b | λ` gives a rule with an empty body and none with the terminal `λ`; the same for `ε` and `^`; `λ` inside a longer body (`a λ`) keeps today's behavior (say in the test what that is).
- Check every preset that contains `λ` (`GRAMMAR_PRESETS`, and `presets.ts`): its CNF result may change, because the rule was a terminal before. For each preset whose result changes, show the old and the new result in `REPORT.md` and say which one is the correct one by the textbook meaning. Update the expectations of the tests that pinned the old result, and say so in the PR.
- Add a wasm test: every preset parses; no preset body contains the terminal `λ` after parsing.

**Non-goals (out):**
- Do not change `grammarToText` (it keeps writing `ε`), the legend, or the CNF phases.

**Files:** `parser.rs`, `crates/engine-core/tests/grammar.rs`, a wasm test in `web/src/lib/grammar/`, `docs/agent/REPORT.md`.

**Verification:** as in T-026, plus `pnpm test:e2e` and `pnpm test:e2e:cross`. Do a deliberate break: remove the new check; the new parser test must fail.

**Rollback:** `git revert <sha>`.

**Depends on:** T-023 done and merged (it settles which symbol the button writes).

**Notes for worker:** A grammar saved earlier with `λ` was read as a terminal; after this change it is read as empty. That is the meaning the legend promises, so it is a fix, but say it in the PR description.

---

## Task T-050 — A fast path in CI for pull requests that change only documents

**Status:** done
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
4. The workflows that are **not** required checks and run on every pull request (`codeql.yml` and the preview part of `deploy.yml`) get `paths-ignore` on `pull_request` with the **same list** as the allowlist (a workflow with `paths-ignore` still runs when any changed file is outside the list). Do not change the `push` trigger of `deploy.yml`. `audit.yml` and `fuzz.yml` already run on a pull request only for their own `paths` (lock files; the engine and fuzz folders), so they never run for a documents-only change: leave them as they are. *(Corrected on 2026-11-04: the first version of this item said that all four get `paths-ignore`; that was the planner's mistake, found by the worker. The guard rail now requires, for each of the four, either a `paths-ignore` equal to the allowlist or a positive `paths` list with no allowlisted entry.)*
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

## Task T-019 — One limit and one translated message for the length of a CYK string

**Status:** done
**Commit:** `ee4b47e`
**PR:** #135
**Owner:** worker
**Branch:** `task/T-019-cyk-input-limit`

**Goal:** The CYK tester has three different limits and three different ways to fail. `CykParser::MAX_INPUT_LEN` is 100 **characters** (`crates/engine-core/src/grammar/cyk.rs`). The API check in `cyk_parse` (`crates/engine-core/src/api.rs`, a literal `256`) calls `too_long`, which compares `text.len()`, the number of **bytes**, although its label says "input characters". So: a word of 101 to 256 bytes passes the API and fails in the parser with an Indonesian **sentence** (`api.cyk_failed` with that sentence as `detail`); a longer word fails in the API with `machine.limit_exceeded`, whose text says "the machine in this file is too big", which is wrong here; and `GrammarCykTester.svelte` shows `params.detail` or, when there is none, the **raw key**. A student sees an Indonesian sentence in the English interface, or the text `machine.limit_exceeded`. Make it one limit (100 characters) and one message that the UI translates.

**Scope (in):**
- `crates/engine-core/src/api.rs`, `cyk_parse`: check `input_word.chars().count()` against `CykParser::MAX_INPUT_LEN` (no literal `256`). When it is too long, return a message with the new key `grammar.cyk_input_too_long` and the parameters `limit` (100) and `length` (the number of characters). Keep the parser's own check in `CykParser::parse` for native callers; through the API it can no longer be reached. The engine produces no sentence.
- `web/src/lib/grammar/GrammarCykTester.svelte`: show a known engine message as text through the message files, the way the editor does (`web/src/lib/editor/interaction/editor.ts` line 148 uses `Object.hasOwn(messages, error.key)`; copy the pattern, not the code). For a key that is not in the message files, keep showing what it shows today. Do not change the other errors of this tester (see the finding below).
- Strings in `id` and `en`: `grammar.cyk_input_too_long` = "String terlalu panjang untuk diuji ({length} karakter; paling banyak {limit})." / "The string is too long to test ({length} characters; at most {limit}).". Wording is the planner's; if the worker thinks it reads badly, say so in `REPORT.md`. No new Indonesian term.
- Rust tests first (`crates/engine-core/tests/`): (a) 100 characters give no limit message; (b) 101 characters of `a` give the key `grammar.cyk_input_too_long` with `limit` 100 and `length` 101; (c) 101 characters of `λ` (202 bytes, under the old 256) also give it; (d) 60 characters of `λ` (120 bytes, over 100 bytes) give **no** limit message: the limit counts characters, not bytes; (e) the same message for 300 and for 5000 characters.
- A web test (Vitest or Playwright, the worker chooses the smaller one that proves it): with the interface in `id` and in `en`, a 101-character word shows the translated sentence, not a key and not an engine sentence.

**Non-goals (out):**
- No change to the limit of 100, to the parser's algorithm, to the 8192-character limit of the grammar text, or to any other error of the grammar tester.
- The `too_long` helper still counts bytes for its other callers; only the CYK word check changes.

**Finding, not in scope:** the other errors of the grammar workstation have the same fault. `GrammarError` has `Display` with Indonesian sentences, and `api.invalid_grammar` and `api.cyk_failed` pass such a sentence as `detail`, which the UI shows as it is (also in English). This breaks principle 6 of `CLAUDE.md` (the engine never produces sentences). It is a larger task: backlog item **T-028**.

**Files expected to touch:** `crates/engine-core/src/api.rs`, `crates/engine-core/tests/api.rs` (or the grammar tests), `web/src/lib/grammar/GrammarCykTester.svelte`, `web/src/lib/i18n/id.ts`, `web/src/lib/i18n/en.ts`, one web test, `docs/agent/REPORT.md`.

**Design reference:** none (no new screen; the error appears where it appears today).

**Acceptance criteria:**
- AC1: the five Rust tests above pass, and the literal `256` is gone from `cyk_parse`.
- AC2: in `id` and in `en` a 101-character word shows the translated sentence with the numbers 101 and 100.
- AC3: a word of 100 characters is tested as before.
- AC4: `check:strings` passes; the new key exists in both files.
- AC5: deliberate break: put the `256` and the byte count back; tests (c) and (d) fail. Show it, then restore.

**Verification (Mode A; in Mode B wrap each in the bridge):**
```
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
wasm-pack test --node crates/engine-wasm
pnpm build:wasm && pnpm --filter web exec vitest run
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings
pnpm build && pnpm size
pnpm test:e2e
```
Expected: all pass; the `.wasm` stays within the budget. Paste the real output into `REPORT.md`.

**Rollback:** `git revert <sha>`.

**Depends on:** none.

**Notes for worker:** Write the Rust tests first and show (b) failing before you change `api.rs`. The wording of the sentence is the only thing here that is not code: do not invent other text.

---

## Task T-017 — The two local-reference tests keep only finite automata

**Status:** done
**Commit:** `aba03fe`
**PR:** #136
**Owner:** worker
**Branch:** `task/T-017-local-reference-tests`

**Goal:** `web/src/lib/share/files.wasm.test.ts` and `web/src/lib/share/open-file.wasm.test.ts` read the top level of `REFERENCES/JFF-FILES` and assume that the folder holds finite automata: each ends with `expect(finite).toBeGreaterThan(0)`. On 2026-11-02 one Turing machine file at the top level made the pre-push hook fail ("0 finite automata found"). The folder is private and changes with the owner's course files, so the tests must not depend on what it holds. Today the top level has no `.jff` file (only sub-folders), so both tests are skipped; the fault is waiting for the next file the owner saves there. Since 2026-11-04 the worker's clone has a copy of `REFERENCES/`, so the hook there reads it.

**Scope (in):**
- One small helper, for the two tests, that lists the `.jff` files of the top level of the folder and keeps only those whose `<type>` is `fa` (read the type from the text; do not depend on the engine's answer to decide what to keep). It returns an empty list when the folder is absent. Put it in a test-only file (for example `web/src/lib/share/local-jff.ts`, not imported by the app).
- Both tests use it: `describe.skipIf(list.length === 0)`, and no `expect(finite).toBeGreaterThan(0)`. The part that checks that a file of another type is named `jff.unsupported_type` stays, but it reads the other files of the folder and passes when there are none.
- A unit test of the helper with a temporary folder (`mkdtemp`) and small original files written by the test: (a) a folder with only a Turing machine file gives an empty list, so the local tests skip; (b) one `fa` file and one `turing` file give exactly the `fa` file; (c) a missing folder gives an empty list; (d) a file that is not `.jff` and a sub-folder are ignored; (e) a damaged file with no `<type>` is ignored, no throw. The files of the test are written by the test; nothing from `REFERENCES/` is copied into the repository.

**Non-goals (out):**
- Do not touch, move or copy anything in `REFERENCES/` (worker rule 11 in `AGENTS.md`). Do not add course files as fixtures. Do not change the other tests of those two files.

**Files expected to touch:** `web/src/lib/share/files.wasm.test.ts`, `web/src/lib/share/open-file.wasm.test.ts`, the new helper and its test, `docs/agent/REPORT.md`.

**Design reference:** none.

**Acceptance criteria:**
- AC1: the five unit tests above pass.
- AC2: with the folder as it is today (no `.jff` at the top level) both local tests are skipped, not failed.
- AC3: deliberate break: make the helper keep every `.jff` again; test (b) fails. Show it, then restore.
- AC4: the pre-push hook passes in the worker's clone.

**Verification:**
```
pnpm --filter web exec vitest run src/lib/share
pnpm build:wasm && pnpm --filter web exec vitest run
pnpm check && pnpm lint && pnpm format:check
```
Expected: all pass. Paste the real output into `REPORT.md`, with the "skipped" count of the two local tests.

**Rollback:** `git revert <sha>`.

**Depends on:** none.

**Notes for worker:** You cannot test against a Turing machine file in the real folder (it is read-only to you). The temporary folder in the test is the proof.

---

## Task T-025 — Landmarks on a laptop, tab panels on a phone

**Status:** done
**Commit:** `1e26263`
**PR:** #139
**Owner:** worker
**Branch:** `task/T-025-workstation-landmarks`

**Goal:** Before T-016 the three columns of the grammar and the language workstations were an `aside` and two `section` elements with a label, so a screen reader found three landmarks. T-016 made them `div role="tabpanel"` with `aria-labelledby` at every width. Above 900 px the tab strip is hidden, so a screen-reader user finds tab panels that belong to no tab list. Give each width the right roles: landmarks on a laptop, tab panels on a phone.

**Scope (in):**
- `web/src/lib/grammar/GrammarWorkstation.svelte` and `web/src/lib/language/LanguageWorkstation.svelte`: one reactive "phone layout" state from `window.matchMedia('(max-width: 900px)')`, read after mount, updated on change (follow the `matchMedia` use in `web/src/lib/editor/SidePanel.svelte`). It uses the **same** boundary as the CSS and as `WorkstationPhoneTabs.svelte`; read both so that exactly one width is not wrong.
- While it is true (phone): the columns keep `role="tabpanel"` and `aria-labelledby` as today.
- While it is false (laptop): no `role="tabpanel"` and no `aria-labelledby` on the three columns. The library column is a complementary landmark (`role="complementary"` or an `aside`) with its name; the editor column and the results column are region landmarks (`role="region"` or a `section`) with their names. Keep the existing `aria-label` texts (they are already in `id` and `en`).
- The inner CNF and CYK panels of the grammar results column (`grammar-pane-cnf`, `grammar-pane-cyk`) have a visible tab strip of their own on a laptop; leave them as they are.
- Before the first read (prerender and first paint) use the laptop roles. A phone gets the tab panel roles right after mount.
- No new string, no visual change, no new token.
- One small e2e test that T-013 left out (its AC2 was only checked by hand): in each workstation, switch the interface to English and see that a preset in the library shows its English title (for example "Palindromes {a, b}" and "Finite Set {ab, bc}"), then create a new grammar and see that its title is "Grammar G1" and stays so after switching back to Indonesian. Put it in the same spec files as the other new tests.

**Non-goals (out):**
- No change to the layout, to the tab strip, to the splitters, to the CSS breakpoint, or to the keyboard behavior. No change to the other workstation components.

**Files expected to touch:** the two workstation components, `web/e2e/grammar-phone.spec.ts`, `web/e2e/language-phone.spec.ts` (or one new spec), `web/e2e/cross/workstation-phone.spec.ts`, `docs/agent/REPORT.md`.

**Design reference:** `design/screens/workstation-phone-layout.md` (the tab strip). No new design.

**Acceptance criteria:**
- AC1: at 1280 × 800, in each workstation: no element has `role="tabpanel"` among the three columns; there is exactly one complementary landmark and two region landmarks, each with its accessible name; the tab strip is not visible.
- AC2: at 390 × 844: the tab strip is visible; the shown column has `role="tabpanel"` and its `aria-labelledby` points to its tab; no column is a landmark.
- AC3: the roles change when the window is resized across 900 px, without a reload (the test calls `setViewportSize` twice, once on each side of the boundary, and also at 900 and 901).
- AC4: axe reports no violation at both widths, on every tab of the phone layout, on Chromium and on WebKit phone.
- AC5: deliberate break: leave the roles of the phone on at every width; AC1 fails. Show it, then restore.

**Verification:**
```
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens
pnpm build && pnpm size
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-phone.spec.ts e2e/language-phone.spec.ts --repeat-each=5
pnpm --filter web exec playwright test --project=firefox --project=webkit-phone e2e/cross/workstation-phone.spec.ts
```
Expected: all pass. The area specs are those of the two workstations (`grep -l -i "grammar\|language" web/e2e/*.spec.ts`); run them once too. Do not run the full suite locally (see `AGENTS.md`, verification tiers); CI runs it. Paste the real output into `REPORT.md`, and name the specs you ran.

**Rollback:** `git revert <sha>`.

**Depends on:** none (T-016 is merged).

**Notes for worker:** The risk is the boundary: a width where the CSS shows the tabs but the roles are the laptop roles, or the reverse. Test 900 and 901 on purpose. Do not rely on `window.innerWidth` if the CSS media query counts the scrollbar differently; read `matchMedia`.

---

## Task T-013 — Preset text in `id` and `en`, and readable rule chips

**Status:** done
**Commit:** `ba5ff97`
**PR:** #137
**Owner:** worker
**Branch:** `task/T-013-preset-text-and-rule-chips`

**Goal:** Two small faults in the grammar and language workstations. (1) The preset titles and descriptions are Indonesian only: `web/src/lib/grammar/presets.ts` has `title` and `description` in Indonesian; `web/src/lib/language/presets.ts` has `name` in Indonesian and `descriptionId`/`descriptionEn`. So with the interface in English a student reads Indonesian titles, which breaks principle 5 of `CLAUDE.md` (every user-facing string in `id` and `en`). Also the default title of a new custom grammar, `Tata Bahasa ${id}`, is written in `GrammarWorkstation.svelte`. (2) The rule chips of the CNF stepper join the symbols without spaces (`formatRule` in `GrammarCnfStepper.svelte`), so a rule reads `S → T_aST_b`, which a student cannot read as `S → T_a S T_b`.

**Scope (in):**
- Presets: follow the pattern that `language/presets.ts` already uses (a field for each language, chosen with `getLocale()`), not a new mechanism. Grammar presets: `title` becomes `titleId` and `titleEn`, `description` becomes `descriptionId` and `descriptionEn`. Language presets: `name` becomes `nameId` and `nameEn`. Update every place that reads them (search for `.title`, `.description` and `.name` of a preset; the e2e tests select cards by title, so check `web/e2e`). The Indonesian text does not change, so with the default locale nothing changes on screen. The English text is written by the worker, in plain words; names that are only a formula may be equal in both fields. Phase names: "Fase 4" is "Phase 4".
- A unit test for each preset file: every preset has a non-empty `Id` and `En` field for each text, and the `En` text is not equal to the `Id` text unless the text has no letters other than math symbols.
- The default title of a new custom grammar: a message key (`grammar.default_custom_title`, with the parameter `id`) in `id` and `en`, used when the grammar is created. The stored title is then the user's text and does not change when the locale changes. Titles of the form `<name> (CNF)` of T-023 keep working.
- Rule chips: one pure function, for example `formatRuleDisplay(rule)` next to `grammarToText` in `web/src/lib/grammar/grammar-text.ts`, that returns `head → ` and the body with one space between every two symbols, and `λ` for an empty body (the same symbol the chip shows today). The stepper uses it. This is only the text on the chip; no key, no rule and no engine data changes.
- New Indonesian wording: only the new key above; mark nothing in the glossary unless a new term appears.

**Non-goals (out):**
- No change to the Indonesian text of the presets, to the preset grammars or formulas, to the CNF phases, or to the math display (`GrammarMathDisplay`). No new preset. No change to the stored format of custom grammars.

**Files expected to touch:** `web/src/lib/grammar/presets.ts`, `web/src/lib/language/presets.ts`, their tests, `web/src/lib/grammar/grammar-text.ts` and its test, `GrammarCnfStepper.svelte`, `GrammarWorkstation.svelte`, `LanguageWorkstation.svelte`, `id.ts`, `en.ts`, the e2e specs that select a preset by title, `docs/agent/REPORT.md`.

**Design reference:** none (same layout).

**Acceptance criteria:**
- AC1: the unit tests for the presets pass; each preset of both files has the four (grammar) or three (language) text fields in both languages.
- AC2: with the interface in `en` the library of each workstation shows English titles and descriptions; in `id` it shows exactly what it shows today.
- AC3: `formatRuleDisplay` gives `S → T_a S T_b` for the rule `S → T_a S T_b`, `S → λ` for an empty body, and one space between every two symbols for a body of one, two and three symbols; the stepper chips use it.
- AC4: a new custom grammar gets the title from the key, in the locale of the moment.
- AC5: the e2e tests that select a preset by title still pass.
- AC6: `check:strings` passes.
- AC7: deliberate break: join the chip symbols without spaces again; AC3 fails. Show it, then restore.

**Verification:**
```
pnpm --filter web exec vitest run src/lib/grammar src/lib/language
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings
pnpm build && pnpm size
pnpm test:e2e
```
Expected: all pass. Paste the real output into `REPORT.md`.

**Rollback:** `git revert <sha>`. Custom grammars that were saved keep their titles: they are plain text.

**Depends on:** none (T-023 is merged; it uses the `<name> (CNF)` title).

**Notes for worker:** Search first (`grep -rn "\.title\|\.description\|\.name" web/src/lib/grammar web/src/lib/language web/e2e`) so that no reader of the old field is left. Do not do T-013 and T-025 in one branch: both touch the two workstation components.

---

## Task T-024 — Rule rows with 44 px targets on touch screens

**Status:** done
**Commit:** `9cbc226`
**PR:** #141
**Owner:** worker
**Branch:** `task/T-024-rule-rows-touch`

**Goal:** On a phone the controls of the rule matrix are too small for a finger (left-hand box 64 × 26 px, alternative box 45 × 22 px, "+" 24 × 24 px, symbol buttons about 20 px tall, "+ Tambah Baris" about 28 px tall), which breaks the 44 px rule of `CLAUDE.md`. Also, a row can be deleted only by a right-click (`oncontextmenu`), which a finger cannot do on iOS. The owner approved the design on 2026-11-04: option B (alternatives flow in one line, like the textbook), for every touch screen and every width up to 900 px, and a delete button that deletes without asking.

**Scope (in):**
- `web/src/lib/grammar/GrammarWorkstation.svelte` only (markup and CSS). The touch layout is one CSS media query, `@media (max-width: 900px), (pointer: coarse)`. No new JavaScript state. The 900 px is the same boundary as the phone tabs; do not write a second one.
- Markup: add a delete button to each row, in a new last cell. It is `type="button"`, shows `×`, has the accessible name `t('grammar.matrix_delete_row')` (the key exists; check `en.ts` has it) and calls `deleteRow(idx)`. Outside the touch layout it is `display: none`, so the laptop does not change.
- Touch layout, as in `design/screens/grammar-rule-rows-phone.md` (option B) and `.svg`: each row is a card. Header line: the left-hand box (72 px wide, at least `--target-min` tall), the arrow, and the delete button (`--target-min` square) at the right end. Under it, the alternatives flow in one wrapping line with `|` between them; each alternative box is at least 64 px wide and `--target-min` tall (the inline `width` style stays; a `min-width` wins over it). The "+" button is `--target-min` square. The symbol buttons are `--target-min` square and wrap to a second line when needed. "+ Tambah Baris" is full width and at least `--target-min` tall.
- Use the token `--target-min` (it is 44 px; `SidePanel.svelte` already uses it), never a raw `44px` (`check:tokens`).
- The three column headers are hidden **visually** on the touch layout (the visually-hidden pattern, not `display: none`), so a screen reader still hears them. Turning `tr` and `td` into grid items loses the table semantics in some engines: give the table, `thead`/`tbody`, rows, header cells and cells explicit ARIA roles (`table`, `rowgroup`, `row`, `columnheader`, `cell`) so they keep them. Test it (AC5).
- Focus after the button deletes a row: move focus to the first alternative of the row that now has the same index, or of the previous row if the deleted one was last (reuse `focusCell`). The right-click menu path keeps its present behavior.
- No new string.

**Non-goals (out):**
- No change on a laptop (no touch, wider than 900 px). No change to the right-click menu, to the `Backspace`-on-empty removal of an alternative, to the symbols, to `--text-base` or any other token. No handling of the soft keyboard covering the symbol bar (the owner's phone test will tell). No change to the CNF or CYK panes.

**Files expected to touch:** `GrammarWorkstation.svelte`, new `web/e2e/grammar-rule-rows-touch.spec.ts`, `web/e2e/cross/workstation-phone.spec.ts` (one new test), `docs/agent/REPORT.md`.

**Design reference:** `design/screens/grammar-rule-rows-phone.md` and `grammar-rule-rows-phone.svg` (approved, option B).

**Acceptance criteria:**
- AC1: at 390 × 844 on the `phone` project, for a grammar with three rows and several alternatives per row, every one of these measures at least 44 px in the stated direction (bounding boxes): the left-hand boxes (height), every alternative box (height) and at least 64 px wide, every "+" (both), every delete button (both), every symbol button of the active row (both), "+ Tambah Baris" (height).
- AC2: a tap on the delete button removes that row; the grammar and the notation card update; deleting the only row leaves one empty row `S` (what `deleteRow` does today); focus moves as written above.
- AC3: at 1280 × 800 on the `desktop` project (no touch) the delete button is not visible, the column headers are visible, and every existing grammar spec passes without a change.
- AC4: a touch screen wider than 900 px gets the touch layout. Try `test.use({ hasTouch: true, isMobile: true, viewport: { width: 1024, height: 768 } })` and first assert in the test that `matchMedia('(pointer: coarse)').matches` is true. If Playwright cannot make it true, say so in `REPORT.md`, keep the assertion for the 390 px case, and the owner checks a tablet; do not fake it.
- AC5: on the touch layout `getByRole('table')` exists; it has one `row` for the header and one per rule; it has three `columnheader`s; axe reports no violation at 390 × 844 and at 1280 × 800, with a row focused (symbol bar showing).
- AC6: one cross-browser test on `webkit-phone` and `firefox`: the alternative box and the delete button are at least 44 px tall (grid on a `tr` behaves differently in each engine).
- AC7: deliberate breaks, each shown failing, then restored: remove the `min-height` of the alternative boxes (AC1 fails); hide the delete button on the touch layout (AC2 fails); remove the explicit roles (AC5 fails, if the engine drops the semantics; if it does not, say so in the report and keep the roles anyway).

**Verification:**
```
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens
pnpm build && pnpm size
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-rule-rows-touch.spec.ts --repeat-each=5
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-phone.spec.ts e2e/grammar-open-cnf.spec.ts e2e/grammar-cyk-limit.spec.ts
pnpm --filter web exec playwright test --project=firefox --project=webkit-phone e2e/cross/workstation-phone.spec.ts
```
Expected: all pass. Do not run the full suite locally (see `AGENTS.md`, verification tiers); CI runs it. Paste the real output into `REPORT.md`, and name the specs you ran.

**Rollback:** `git revert <sha>`.

**Depends on:** none (T-016, T-025 and T-013 are merged).

**Notes for worker:** After the merge the owner tests it on a real phone. In the report say which rows you checked by hand in a browser at 390 px. The risk is the table: read AC5 before you write the CSS, and run the semantics test early. If iOS zooms the page when an input is focused (an input under 16 px does), say so in the report; do not change the token.

---

## Task T-010 — End-to-end tests for the grammar workstation flow

**Status:** done
**Commit:** `ccafc05`
**PR:** #142
**Owner:** worker
**Branch:** `task/T-010-grammar-flow-e2e`

**Goal:** The existing grammar specs test the layout, the targets, the landmarks, the locale, "open the CNF result" and the CYK length limit. Nothing tests what a student does: type a grammar into the matrix, walk through the six CNF phases, and test strings with CYK. Add those tests, with axe, so that later changes (T-024, T-015, T-028) cannot break the flow without a failing test.

**Scope (in):**
- New `web/e2e/grammar-flow.spec.ts`. Tests only. Use the helpers in `fixtures.ts`, `touch.ts` and the way `grammar-phone.spec.ts` opens the workstation.
- **Matrix editing (laptop):** create a new grammar; type `A B` in the first alternative of `S`, press space, and see a second alternative box with focus; type `a`; press `|` and see a third; `Backspace` on an empty box removes it and focuses the previous one; the symbol bar inserts `ε` at the cursor; an empty box is removed when focus leaves it; `+ Tambah Baris` adds a row and focuses it; the right-click menu deletes a row; a grammar the parser rejects shows the red banner (`role="alert"`) and a valid one hides it.
- **Matrix editing (phone):** the same on the `phone` project with taps, the tab strip, and the delete button of T-024 instead of the right-click.
- **Six phases:** for a grammar that needs every phase (it has a useless symbol, a nullable symbol, a unit rule, a mixed rule and a long rule), step through phases 1 to 6 with "Selanjutnya", back with "Sebelumnya", and jump with the six numbered buttons. At each phase check the counter, the phase title, the removed and added rule chips (text and counts) and the rule count after the phase. After phase 6 every rule is `A → B C` or `A → a` (no `ε` except for the start symbol if the language has the empty string, no unit rule). **Derive the expected chips by hand from Rich's method, before you run the test, and write the derivation in `REPORT.md`.** If the engine disagrees with your derivation, stop and report it: engine correctness comes first; do not change the expectation to match.
- **CYK:** for the grammar of the previous test (or a smaller one): an accepted string, a rejected string, and the empty string on a grammar whose language has it (the chip shows `ε`); the verdict title and sentence; the example chips fill the field; the top cell of the CYK table is highlighted exactly when the string is accepted. Expected verdicts come from the language of the grammar, derived by hand.
- **English:** one test with the interface in English: tab names, stepper buttons, and a CYK verdict show English text.
- **axe** at 1280 × 800 and at 390 × 844 (every tab on the phone): matrix with an error banner; CNF tab at a middle phase; CYK tab with an accepted and with a rejected verdict; the "Definisi & Format Penulisan" card expanded.

**Non-goals (out):**
- No change to any component, string or style. If a test shows a bug, do not fix it here: stop and report it in `REPORT.md` with the steps; the planner decides. Do not weaken or skip the test. (A fix of one line that the test exposes, such as a missing `aria-label`, may be made if the report names it.)
- No new CYK length tests (T-019 has them), no layout tests (T-016, T-025), no "open the CNF result" tests (T-023).

**Files expected to touch:** `web/e2e/grammar-flow.spec.ts`, `docs/agent/REPORT.md`.

**Design reference:** `design/screens/grammar-workstation.md` (as built) and `grammar-rule-rows-phone.md` (T-024).

**Acceptance criteria:**
- AC1: each behavior listed above has at least one test that passes on the `desktop` project, and the phone ones on the `phone` project.
- AC2: the six-phase test checks the chips of every phase against the hand derivation in the report.
- AC3: axe reports no violation in every state listed.
- AC4: the new spec passes 5 times in a row on both projects (`--repeat-each=5`); no `waitForTimeout` (wait for the state, not for time).
- AC5: deliberate breaks, each shown failing, then restored: in `GrammarWorkstation.svelte` make the `Backspace` handler do nothing (the matrix test fails); in `GrammarCnfStepper.svelte` make "Selanjutnya" skip one phase (the phase test fails); in `GrammarCykTester.svelte` invert the highlight condition of the top cell (the CYK test fails).

**Verification:**
```
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings
pnpm build
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-flow.spec.ts --repeat-each=5
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-phone.spec.ts e2e/grammar-open-cnf.spec.ts e2e/grammar-cyk-limit.spec.ts
```
Expected: all pass. Do not run the full suite locally. Paste the real output into `REPORT.md`, and name the specs you ran.

**Rollback:** `git revert <sha>`.

**Depends on:** T-024 done and merged (the phone tests use the delete button and the touch layout).

**Notes for worker:** A known thing: the rule matrix drops an empty cell when it loses focus, and a row never means `ε` by itself (`design/screens/grammar-workstation.md`). Write tests for that, not against it.

---

## Task T-011 — End-to-end tests for the language workstation and the mode switcher

**Status:** done
**Commit:** `e0c793d`
**PR:** #143
**Owner:** worker
**Branch:** `task/T-011-language-and-switcher-e2e`

**Goal:** The language workstation and the mode switcher are used by every other grammar and language spec to get to a screen, but nothing tests their own behavior: the enumeration in proper order, its settings, the copy button, the formula errors, and the switcher's keyboard and persistence. Add those tests, with axe.

**Scope (in):**
- New `web/e2e/language-flow.spec.ts` and `web/e2e/switcher.spec.ts`. Tests only.
- **Enumeration:** choose a preset and check the first strings against the proper order (shortest first, then alphabetical) that you derive by hand from the formula; type a formula of your own (read the legend in the workstation for the notation) and see the alphabet badge and the list; "Panjang Min" starts the list at that length; "Jumlah String" limits the count; "Format String Kosong" switches the empty string between `^` and `ε` in the list; a finite language with fewer strings than N shows all of them and no error; "Salin Semua" puts the list in the clipboard (grant the permission on Chromium; skip the clipboard assertion on WebKit and Firefox with a stated reason) and is disabled when there is no result; a wrong formula shows the red banner (`role="alert"`) and no list; the symbol toolbar inserts at the cursor and keeps focus in the formula box.
- **Phone:** the enumeration flow on the `phone` project through the tab strip, and the 44 px targets of the toolbar, the settings and the copy button.
- **Switcher:** the trigger has `aria-haspopup="listbox"` and `aria-expanded`; Enter or Space opens it and focus goes to the selected item; ArrowDown and ArrowUp move through the enabled items and wrap; the two disabled items (PDA, Turing machine) are never focused and a click on them does nothing; Escape closes and returns focus to the trigger; a pointer press outside closes it; choosing an item closes it, returns focus to the trigger, and loads that workstation, with `?mode=` in the address and `webtomata_sandbox_mode` in `localStorage`; after a reload the mode stays. Read how the address and `localStorage` rank against each other and what a wrong `?mode=` value does; test what the code does, and write it in `REPORT.md`. If it looks wrong, report it; do not change it.
- Items at least 44 px high; the trigger fits in one row at 360 px wide (the as-built spec says so).
- **axe** at 1280 × 800 and 390 × 844: the language workstation with results, with an error banner, and with the switcher open.

**Non-goals (out):**
- No change to any component, string or style (same rule as T-010: report a bug, do not fix it, do not weaken the test). No test of the FSM editor. No layout tests (T-016, T-025).

**Files expected to touch:** `web/e2e/language-flow.spec.ts`, `web/e2e/switcher.spec.ts`, `docs/agent/REPORT.md`.

**Design reference:** `design/screens/language-workstation.md` and `workstation-switcher.md` (as built).

**Acceptance criteria:**
- AC1: every behavior listed has a test that passes on the `desktop` project (the phone ones on `phone`).
- AC2: the proper-order checks use strings derived by hand, written in the report next to the formulas; none is read back from the page.
- AC3: axe reports no violation in every state listed.
- AC4: both specs pass 5 times in a row on both projects; no `waitForTimeout`.
- AC5: deliberate breaks, each shown failing, then restored: make ArrowDown not wrap in `WorkstationSwitcher.svelte` (the wrap test fails); make the enumeration sort by something other than length first (the order test fails); remove the `disabled` handling of one item (the disabled test fails).

**Verification:**
```
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings
pnpm build
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/language-flow.spec.ts e2e/switcher.spec.ts --repeat-each=5
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/language-phone.spec.ts e2e/shell.spec.ts
```
Expected: all pass. Do not run the full suite locally. Paste the real output into `REPORT.md`, and name the specs you ran.

**Rollback:** `git revert <sha>`.

**Depends on:** none. (Do it after T-010: both are e2e only, but one branch at a time.)

**Notes for worker:** The enumeration runs in the engine worker with a budget of 50,000 checks; wait for the list to appear, not for a time.

---

## Task T-029 — The CYK tester must space the symbols of a rule

**Status:** done
**Commit:** `1665a38`
**PR:** #145
**Owner:** worker
**Branch:** `task/T-029-cyk-text-spacing`

**Goal:** `GrammarCykTester.svelte` builds the grammar text for the engine with its own code that joins the symbols of a rule body with no space (`.join('')`). A rule `S → T_a T_b` becomes `S -> T_aT_b`, which the parser reads as one symbol, so CYK answers "the grammar must be in CNF". The planner reproduced it on 2026-11-05 through the engine: `S -> T_aT_b` fails and `S -> T_a T_b` is accepted (found by the worker in T-010). It breaks the main flow: convert to CNF, open the result as a grammar (T-023), test a string; every CNF result that has a helper variable `T_a` fails in CYK.

**Scope (in):**
- `web/src/lib/grammar/GrammarCykTester.svelte`: delete the local `grammarText` builder and use `grammarToText(grammar)` from `grammar-text.ts` (one space between symbols, `ε` for an empty body, start symbol first). Keep the empty-state behavior that depends on `grammarText` (line 85 today).
- One new e2e test in `web/e2e/grammar-flow.spec.ts` (add it; do not change the existing tests): open the preset `CNF_UNIT_CHAIN` (`S → A`, `A → B`, `B → C | b b`, `C → c C | c`; language `{bb} ∪ c⁺`), open its CNF result as a new grammar (see `grammar-open-cnf.spec.ts` for the selectors), go to the CYK tab and test `bb` (accepted), `c` (accepted), `ccc` (accepted), `b` (rejected), `bc` (rejected). The helper variables are `T_b` and `T_c` (names may differ), which is why it failed.

**Non-goals (out):**
- No change to the engine, to the parser, to the CYK length limit (T-019) or to any message. Do not change `grammarToText`.

**Files expected to touch:** `GrammarCykTester.svelte`, `web/e2e/grammar-flow.spec.ts`, `docs/agent/REPORT.md`.

**Design reference:** none.

**Acceptance criteria:**
- AC1: the new test passes; the existing grammar specs pass unchanged.
- AC2: deliberate break: put the `.join('')` builder back; the new test fails with the "CNF" error. Show it, then restore.
- AC3: the CYK tab of a grammar typed by hand (no helper variables) behaves as before (the T-010 tests prove it).

**Verification:**
```
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings
pnpm build
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-flow.spec.ts --repeat-each=5
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-phone.spec.ts e2e/grammar-open-cnf.spec.ts e2e/grammar-cyk-limit.spec.ts
```
Expected: all pass. Do not run the full suite locally. Paste the real output into `REPORT.md`, and name the specs you ran.

**Rollback:** `git revert <sha>`.

**Depends on:** none (T-010 and T-023 are merged).

**Notes for worker:** Before you change anything, write the new test and see it fail with the CNF error, so you know it tests the bug.

---

## Task T-060 — CNF phases in the homework order, with message keys

**Status:** done
**Owner:** worker
**Branch:** `task/T-060-cnf-homework-order`

**Goal:** The six phases of the CNF stepper follow the six stages of the course homework: (1) unreachable rules, (2) non-productive rules, (3) ε-rules, (4) unit rules, (5) mixed rules, (6) long right-hand sides. Today they are: start symbol, ε-rules, unit rules, useless symbols, terminals, long rules. Also, the engine returns Indonesian sentences for the phase names and descriptions; they become message keys, translated in the UI.

**Scope (in):**
- `crates/engine-core/src/grammar/cnf.rs`: new phase order as in the design table. Phase 1 removes unreachable variables and their rules; phase 2 removes non-productive variables and every rule that uses them, **and the variables that this removal made unreachable** (the trace says so; for the four grammars of the 2026 homework this changes nothing); phase 3 is the existing ε-removal followed by the course slides' "returning ε" step: if the start symbol is nullable, add a new start symbol `S₀` with `S₀ → S | ε` (whether or not `S` is on a right-hand side), and show the note; the old phase 1 (`S₀ → S` whenever `S` is on a right-hand side) is removed; phases 4, 5 and 6 are the existing unit, mixed and long-rule phases, unchanged in behavior and in the rules they report. The `share_helpers` option stays as it is (T-015 uses it).
- The step result carries `phase_key` (a message key, for example `grammar.cnf.phase_unreachable`) and no `phase_name` or `description` text. A parameter list is allowed if a phase needs one. Regenerate the TypeScript types.
- `web/src/lib/grammar/GrammarCnfStepper.svelte`: show `t(key + '.title')` and `t(key + '.desc')`, and the new note of phase 3 (a key too) when `S₀` was added. Use the existing visual design; no new layout.
- `id.ts` and `en.ts`: the six titles and descriptions and the note, from the design table (Indonesian terms new to the glossary go in `docs/glossary.md` with `TODO(review)`).
- Engine tests: the existing CNF tests that name the old order are changed to the new order, each with a hand-derived expectation (see below). Add a test for each of: phase 2 removing a variable that becomes unreachable; `S₀` when the start symbol is nullable and is on a right-hand side; `S₀` when it is nullable and on no right-hand side; no `S₀` when it is not nullable, also when it is on a right-hand side.
- `web/e2e/grammar-flow.spec.ts` (T-010) and `grammar-open-cnf.spec.ts`: update the phase titles, chips and rule counts of the six-phase test to the new order with a new hand derivation (the same test grammar). Other e2e specs that read phase titles: `grep -rn "Isolasi Simbol Awal\|Tak Berguna\|phaseName" web`.
- The CNF presets in `presets.ts` keep their grammars. If a preset's description names a phase number, update it (T-013 text; `Id` and `En`).

**Non-goals (out):**
- No toggle (T-015). No change to the CYK, to the parser, to `GrammarError` sentences (T-028), or to the six round buttons and chip styles. No change to the final CNF grammars except `S₀`: it is now added when the start symbol is nullable, and no longer when it is only on a right-hand side (state each case in the report where a final grammar changes).

**Files expected to touch:** `cnf.rs` and its tests, `crates/engine-core/tests/*` that read phases, generated TypeScript types, `GrammarCnfStepper.svelte`, `id.ts`, `en.ts`, `docs/glossary.md`, `grammar-flow.spec.ts`, `grammar-open-cnf.spec.ts`, `docs/agent/REPORT.md`.

**Design reference:** `design/screens/cnf-stepper-homework-order.md` and `.svg`.

**Acceptance criteria:**
- AC1: for the grammar of the T-010 flow test and for two more that the worker chooses (one with a variable that becomes unreachable only after phase 2, one where the empty string is not in the language), the six phase results equal the worker's hand derivation from the homework text, written in `REPORT.md` before the tests run. If the engine disagrees, stop and report.
- AC2: the final grammar is in CNF and generates the same language as the original, checked by the existing property test (`proptest`) on random grammars, if there is one (if not, add one).
- AC3: no Indonesian sentence remains in `cnf.rs` (`grep -n '"[A-Z][a-z]* ' crates/engine-core/src/grammar/cnf.rs` shows none outside tests and comments); `check:strings` passes; both locales show their own titles.
- AC4: deliberate breaks, each shown failing, then restored: swap phases 1 and 2 in the engine (a test fails); always add `S₀`, or never (the `S₀` tests fail); remove one key from `en.ts` (a test or `check:strings` fails).
- AC5: the T-010 test, updated, passes 5 times on both projects.

**Verification:**
```
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
pnpm build:wasm
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings
pnpm build && pnpm size
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-flow.spec.ts e2e/grammar-open-cnf.spec.ts --repeat-each=5
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-phone.spec.ts e2e/grammar-cyk-limit.spec.ts
```
Expected: all pass. Do not run the full suite locally. Paste the real output into `REPORT.md`, and name the specs you ran. The wasm size must stay under 250 KB gzip.

**Rollback:** `git revert <sha>`. Saved grammars are plain text and do not depend on the phases.

**Depends on:** T-029 done and merged (both touch the grammar flow tests); the owner's approval of the wireframe.

**Notes for worker:** Ask the planner if a stage of the homework text is unclear; do not guess. This changes what a student reports for homework, so the hand derivation matters more than the code.

---

## Task T-015 — Toggle "versi panjang / versi ringkas" in the CNF stepper

**Status:** done
**Owner:** worker
**Branch:** `task/T-015-cnf-version-toggle`

**Goal:** A segmented control in the stepper header switches the CNF conversion between two versions. *Versi panjang* (default) is today's behavior. *Versi ringkas* reuses what exists: in phase 5 a terminal `a` uses an existing variable `A` whose only rule is `A → a` instead of a new `T_a`; in phase 6 identical helper variables are shared between rules. Both versions end in a CNF grammar for the same language. The six phases and their order stay as in T-060. See `design/screens/cnf-stepper-homework-order.md` (the owner approved it, and chose the names "versi panjang" and "versi ringkas").

**What "versi ringkas" means (decided by the planner from the course slide "Tₐ can take A instead"; the owner can veto):**
- Phase 5: for a terminal `a`, if some variable `A` has exactly one rule in the grammar and that rule is `A → a`, then every mixed rule uses `A` for `a` and no `T_a` is created. If several variables qualify, take the first by name order. A variable with more rules (for example `A → a | b`) must not be reused: it would change the language. The start symbol is allowed.
- Phase 6: helper variables for the same pair of symbols are shared between rules (the existing `share_helpers` behavior).
- Versi panjang changes nothing: one `T_a → a` per terminal for the whole grammar (as today), and one chain of helpers per long rule.

**Scope (in):**
- `crates/engine-core/src/grammar/cnf.rs`, `api.rs`, `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts` and `protocol.ts`: rename the option `share_helpers` / `shareHelpers` to `short_version` / `shortVersion` along the whole chain (one flag, default false), and add the phase-5 reuse to it. Phase 6 keeps its current sharing code under the renamed flag. Update every existing caller and test (`grep -rn "share_helpers\|shareHelpers"`).
- Notes, as keys with no parameters: in the short version, phase 5 sets `note_key = "grammar.cnf.phase_mixed.note_short"` only if at least one terminal reused an existing variable, and phase 6 sets `"grammar.cnf.phase_long.note_short"` only if at least one helper variable was shared (used by two or more rules). The stepper already renders `note_key` (T-060). If nothing was reused or shared, no note: the two versions then give the same trace.
- `GrammarWorkstation.svelte`: a state `cnfVersion: 'long' | 'short'` (default `'long'`), read from `localStorage` key `webtomata.grammar.cnf_version` in the existing `onMount` block (any other stored value means `'long'`; every read and write in try/catch) and written when it changes. `runPipeline` passes `cnfVersion === 'short'` to `engine.transformToCnf`. Changing the version runs the pipeline again. Pass `version` and `onversionchange` to the stepper. Not stored in the share link or in saved grammars.
- Keep the phase: the stepper must stay mounted and keep `currentStepIdx` while the trace is recomputed (do not set `cnfTrace` to null on success; check that `isTransforming` does not unmount the stepper). Ignore a stale result: if the student toggles twice quickly, only the answer of the last call may set `cnfTrace` (a call counter is enough).
- `GrammarCnfStepper.svelte`: the control from the wireframe, placed above the six round buttons. It is a `role="radiogroup"` with `aria-label` from a key, holding two `role="radio"` buttons with `aria-checked`. Roving tabindex: Tab enters the checked radio; ArrowLeft/ArrowRight (and Up/Down) move and select; Space/Enter select. Each half is at least `var(--target-min)` high. On the touch layout (`@media (max-width: 900px), (pointer: coarse)`) the control is as wide as the column. Use only existing tokens; the checked half uses the same blue as the active round button; focus ring visible.
- "Buka sebagai tata bahasa baru" (T-023) opens the final grammar of the version on screen. The CYK tester also tests the final grammar of the version on screen. No other change to them.
- `id.ts` and `en.ts`: `grammar.cnf.version.aria` (id "Versi konversi CNF", en "CNF conversion version"), `grammar.cnf.version.long` ("Versi panjang" / "Long version"), `grammar.cnf.version.short` ("Versi ringkas" / "Short version"), and the two note keys: id phase 5 "Versi ringkas: terminal yang sudah punya variabel dengan satu aturan A → a memakai variabel itu, tanpa T_a baru."; id phase 6 "Versi ringkas: variabel pembantu yang sama dipakai bersama oleh beberapa aturan."; and the English equivalents. Add "versi panjang" and "versi ringkas" to `docs/glossary.md` with `TODO(review)`.
- Tests, with hand derivations (below), e2e and axe.

**Non-goals (out):**
- No side-by-side view, no per-phase toggle, no change to the six phases, their order, their titles or `S₀`. No change to variable names in the long version. No new storage mechanism (a plain `localStorage` convenience is enough). No change to CYK, to the parser or to `GrammarError` sentences (T-028).

**Files expected to touch:** `cnf.rs` and its tests, `api.rs`, `crates/engine-core/tests/grammar.rs`, `crates/engine-wasm/src/lib.rs`, `handlers.ts`, `protocol.ts`, any test that passes the old flag (`grep`), `GrammarWorkstation.svelte`, `GrammarCnfStepper.svelte`, `id.ts`, `en.ts`, `docs/glossary.md`, new `web/e2e/grammar-cnf-version.spec.ts`, `docs/agent/REPORT.md`.

**Design reference:** `design/screens/cnf-stepper-homework-order.md` and `.svg` (toggle, section "The toggle").

**Hand derivations the planner has done (the worker redoes them in `REPORT.md` before running any test; if the engine disagrees, stop and report):**
- *Grammar R1:* `S -> x B y | z B y | z B | x` and `B -> x`. Language `{x, xxy, zxy, zx}`. Phases 1 to 4 change nothing. Phase 5, long: 8 rules (three rewritten mixed rules of `S` using `T_x`, `T_y`, `T_z`, plus `S → x`, `B → x`, and three helpers); removed 3, added 6. Phase 5, short: `x` reuses `B` (its only rule is `B → x`), so only `T_y` and `T_z` are created: 7 rules; removed 3, added 5; the phase-5 note is present. Phase 6, long: two rules have length 3 and get their own helper each: 10 rules; removed 2, added 4. Phase 6, short: the pair `(B, T_y)` is shared by both rules, so one helper: 8 rules; removed 2, added 3; the phase-6 note is present. Both final grammars are in CNF and accept exactly `{x, xxy, zxy, zx}` (CYK oracle on all strings over `{x,y,z}` up to length 6).
- *Grammar R2 (must not reuse):* `S -> a C` and `C -> c | a`. `C` has two rules, so `a` needs its own `T_a` in the short version too; no phase-5 note. The short and long finals both accept exactly `{ac, aa}` (a wrong reuse of `C` for `a` would also accept `cc` and `ca`).
- *Grammar R3a (the T-010 flow grammar):* phases 1 to 5 are identical in both versions. In phase 6, long has 17 rules (removed 2, added 4, no note); short has 16 (removed 2, added 3, phase-6 note), because `S₀` and `S` end in the same pair `(S, T_b)` and share one helper. *(Corrected on 2026-11-05: the first version of this spec wrongly called the two traces identical; the worker found it.)*
- *Grammar R3b (nothing to reuse or share):* `S -> a S b | c`. Both versions give the same six phases and no notes: phase 5 removes 1 and adds 3 (4 rules), phase 6 removes 1 and adds 2 (5 rules). Language `a^n c b^n`.
- *Extra test the review asked for:* the phase-5 tie rule. `S -> a P Q`, `P -> a`, `Q -> a`: short must give `S → P P Q` (first by name), never `S → Q P Q`.

**Acceptance criteria:**
- AC1: R1, R2 and R3 match the derivations above in both versions (rule counts, removed and added, notes), and the language oracle passes for each final grammar.
- AC2: a `proptest` property on random grammars: the short final grammar is in CNF and equivalent to the long final grammar (same strings up to a small length, by CYK), and has no more rules than the long one.
- AC3: the toggle: default is "Versi panjang"; choosing "Versi ringkas" on phase 4 of R1 keeps the stepper on phase 4 and changes the rule counts of phases 5 and 6 as above; choosing it back restores the long counts; arrow keys move and select; after a reload the choice is kept; a stored value `"x"` gives the long version. Works in `id` and `en`.
- AC4: touch targets of the two halves are at least 44 px high on desktop and phone; on the phone the control is as wide as the column; axe has zero violations with the control visible; no horizontal scroll at 375 px.
- AC5: toggling twice quickly ends on the version of the second click (a test that clicks twice without waiting).
- AC6: deliberate breaks, each shown failing, then restored: reuse a variable with more than one rule (R2 fails); never share in phase 6 (R1 short counts fail); do not forward the flag from `GrammarWorkstation` (the toggle test fails); remove one new key from `en.ts` (a test or `check:strings` fails).
- AC7: `wasm` stays under 250 KB gzip and the initial JS under 170 KB (`pnpm size`).

**Verification:**
```
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
pnpm build:wasm
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-cnf-version.spec.ts --repeat-each=10
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/grammar-flow.spec.ts e2e/grammar-open-cnf.spec.ts e2e/grammar-phone.spec.ts e2e/grammar-cyk-limit.spec.ts
pnpm --filter web exec playwright test --project=firefox --project=webkit-phone e2e/cross/workstation-phone.spec.ts (add one toggle test there: tap the control on the phone layout and check the phase and the rule count)
```
Expected: all pass. Do not run the full suite locally. Paste real output into `REPORT.md` and name the specs you ran. The new spec is repeated 10 times because it uses storage and a quick double click.

**Rollback:** `git revert <sha>`. The stored key is harmless if unused.

**Depends on:** T-060 done and merged (done, PR 147).

**Notes for worker:** The flag rename is mechanical but touches many tests; do it in its own commit so the diff is easy to read. The reuse rule is about the grammar *at the start of phase 5*, after phases 1 to 4. If a stage of the course method is unclear, ask the planner; do not guess.

---

## Task T-030 — PDA data model, JSON, validation and the determinism check

**Status:** done
**Owner:** worker
**Branch:** `task/T-030-pda-model`

**Goal:** The engine gets a pushdown automaton (PDA) as plain data, in the notation of the course slides (Slide12 and Slide13, the same as Rich): a transition `((q1, c, γ1), (q2, γ2))` reads `c` (or nothing), pops the string `γ1` from the top of the stack, and pushes the string `γ2`. The machine is non-deterministic by default (NDPDA); a deterministic PDA (DPDA) is the special case where no two transitions compete. This task adds the model, the versioned JSON file, the validation, and a function that lists the competing transitions. It does not run the machine (T-031), read `.jff` (T-032), or draw it (T-033). See ADR 0034 (written in this task) and `docs/agent/DECISIONS.md` (2026-11-05, PDA decisions).

**Decisions already made (do not reopen; ask the planner if one looks wrong):**
- **Stack and acceptance** (Slide12): the stack starts **empty**; the engine adds no bottom marker (JFLAP adds one, but the course grader is built without it; a machine pushes its own marker if it wants one). A run accepts when it reaches a configuration `(q, ε, ε)` with `q` accepting: input used up, stack empty, accepting state. There is only this acceptance rule; no setting for "final state only".
- **Strings, top first.** `pop` and `push` are lists of stack symbols. The first element is the top of the stack. Popping `[a, b]` needs `a` on top and `b` under it; pushing `[a, S, b]` leaves `a` on top. A transition with `pop = []` does **not** check the stack and does **not** mean "empty stack" (Slide12 says so explicitly).
- **Symbols have names.** Both alphabets use the existing `Alphabet` (names of up to 32 characters, interned as `SymbolId`), so the stack alphabet can hold `Z0`, `S0`, `T_a`. Reuse `Alphabet` and `SymbolId` for both alphabets; no new id type (a transition names its fields `read`, `pop` and `push`, so the two are not mixed).
- **Declared kind.** `kind` is `"dpda"` or `"ndpda"`, like `dfsm` and `ndfsm` for the FSM. For a `dpda`, competing transitions are errors; for an `ndpda` they are fine.
- **The end marker `$` is an ordinary input symbol.** The homework languages end with `$` and the machine must read it. The engine has no special handling.

**Scope (in):**
- `crates/engine-core/src/pda.rs` (one file for the model, the JSON and the validation; split only if it passes about 600 lines): `Pda { kind, input: Alphabet, stack: Alphabet, states, start, accepting, transitions }`, `PdaKind { Dpda, Ndpda }`, `PdaTransition { from, read: Option<SymbolId>, pop: Vec<SymbolId>, push: Vec<SymbolId>, to }`. `Pda::new` checks every reference and every limit, then sorts the states, the accepting states and the transitions (by `from`, `read` with ε first, `pop`, `push`, `to`) so that equal machines are equal values. Limits: reuse `MAX_STATES`, `MAX_SYMBOLS`, `MAX_TRANSITIONS`; add `MAX_PDA_STRING = 64` for the length of one `pop` or `push` list. Use `limit_exceeded` messages as the FSM does.
- JSON, `"schemaVersion": 1`, input untrusted (size limit `MAX_JSON_BYTES`, `deny_unknown_fields`, nothing panics, a future schema version gives a clear message, same pattern as `json.rs`):
  `{"schemaVersion":1,"kind":"ndpda","inputAlphabet":["a","b"],"stackAlphabet":["a","b"],"states":[0,1],"start":0,"accepting":[1],"transitions":[{"from":0,"read":"a","pop":[],"push":["a"],"to":0}]}`
  `read` is `null` for ε; `pop` and `push` are arrays of stack symbol names, top first. `Pda::from_json` and `Pda::to_json`; writing then reading gives the same machine.
- `validate_pda(&Pda) -> Vec<Issue>` (reuse `Issue` and `Severity`, fixed order, capped at `MAX_ISSUES`): errors `pda.no_start_state`; warnings `pda.no_accepting_state`, `pda.unreachable_state` (reachable by the transition graph alone, ignoring the stack), `pda.duplicate_transition`, and `pda.pop_never_pushed { from, symbol }` (a transition pops a stack symbol that no transition ever pushes, so it can never fire because the stack starts empty; this is what happens with a machine written for JFLAP's bottom marker `Z`). For `kind = dpda` only: error `pda.competing_transitions { from, first, second }` for every competing pair, and error `pda.accepting_state_free_move { state }` for a transition out of an accepting state that reads nothing **and** pops nothing (Slide12, DPDA rule 2).
- `determinism(&Pda) -> Vec<Competition>`, where `Competition { from, first, second }` holds two indices into the sorted transition list. Two different transitions of the same state **compete** iff (their `read` symbols are equal, or at least one of them is ε) **and** (one `pop` list is a prefix of the other, an empty list being a prefix of every list). This is the course's definition: a transition that pops nothing competes with the others "assuming an empty stack", and a transition that reads nothing competes "assuming the input is used up". An empty list means deterministic.
- API (`api.rs`): `load_pda(json)`, `validate_pda(json)`, `pda_determinism(json)`, each returning the same JSON envelope as the FSM functions. The same three in `crates/engine-wasm/src/lib.rs`, in `web/src/lib/engine/handlers.ts` and `protocol.ts`, typed, with the TypeScript types generated by `ts-rs` (`Pda`, `PdaTransition`, `Competition`) in `ts.rs`.
- Message keys: every new key (`pda.*`) gets an `id` and an `en` text if the repo has a test that requires it for engine keys (check how `machine.unknown_state` is covered with `grep`; follow the same rule). Indonesian: the slides keep "stack", "push" and "pop" in English inside Indonesian sentences; do the same and add the terms to `docs/glossary.md` with `TODO(review)`.
- `docs/decisions/0034-pda-data-model.md` (the decisions above and why) and a short PDA section in `docs/notation.md`: the formal form `((q1, c, γ1), (q2, γ2))`, the diagram label `c / γ1 / γ2`, "leftmost is the top".
- Tests, written first, with the hand derivations below.

**Non-goals (out):**
- No simulation (T-031), no `.jff` (T-032), no editor or any UI (T-033), no conversion (T-034 to T-037).
- No conversion from an NDPDA to a DPDA: it does not exist in general (some context-free languages have no DPDA). The engine only reports whether a machine is deterministic and which transitions compete.
- No bottom marker, no acceptance setting, no multi-stack PDA.
- Do not add sample machines that solve the languages of the current homework (HW06: `aⁱbʲcᵏdᵐ$`, `3#a(w) = 4#b(w)`, `aⁱbʲ$ : i ≤ j ≤ 2i`, and so on). Use only the machines below.

**Files expected to touch:** `crates/engine-core/src/pda.rs` (new), `lib.rs`, `api.rs`, `ts.rs`, `crates/engine-core/tests/pda_json.rs` and `pda_validate.rs` (new), `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts`, `protocol.ts`, the generated types, `id.ts` and `en.ts` (only if needed), `docs/glossary.md`, `docs/notation.md`, `docs/decisions/0034-pda-data-model.md`, `docs/agent/REPORT.md`.

**Design reference:** none (no screen). Slides: `REFERENCES/PACIL-TBA/REGU-GENAP-2526/Slide12 PDA1_2201.pdf`, pages 16 to 24 (read them; the folder is private, so quote nothing from it in a commit).

**Hand derivations the planner has done (the worker redoes them in `REPORT.md` before the tests run; if the engine disagrees, stop and report):**
- *M1, a DPDA for `aⁿbⁿ` (n ≥ 0).* Input alphabet `a, b`; stack alphabet `a`; states `0` (start, accepting) and `1` (accepting); transitions `(0, a, [] → [a], 0)`, `(0, b, [a] → [], 1)`, `(1, b, [a] → [], 1)`. `determinism` is empty. `validate` as `dpda` has no issue.
- *M2, an NDPDA for `wwᴿ` over `{a, b}`.* Input `a, b`; stack `a, b`; states `0` (start) and `1` (accepting); transitions `(0, a, [] → [a], 0)`, `(0, b, [] → [b], 0)`, `(0, ε, [] → [], 1)`, `(1, a, [a] → [], 1)`, `(1, b, [b] → [], 1)`. `determinism` lists exactly two competing pairs, both at state `0`, both with the ε-transition (it competes with the `a`-push and with the `b`-push; the two pushes do not compete, and the two pops at state `1` do not compete). Declared `dpda`, `validate` gives two `pda.competing_transitions` errors; declared `ndpda`, none.
- *Prefix rule.* At one state, `(a, pop [a])` and `(a, pop [a, b])` compete (same read, `[a]` is a prefix of `[a, b]`); `(a, pop [a])` and `(a, pop [b])` do not; `(a, pop [a])` and `(b, pop [a])` do not; `(ε, pop [a])` and `(b, pop [a, b])` do.
- *Accepting state, free move.* A machine whose accepting state `1` has `(1, ε, [] → [x], 1)`: as `dpda`, one error `pda.accepting_state_free_move`; with `(1, ε, [x] → [], 1)` instead (it pops), no error.
- *JFLAP bottom marker.* A machine with `(0, ε, [Z] → [S, Z], 1)` and no transition that pushes `Z`: one warning `pda.pop_never_pushed` with symbol `Z`.

**Acceptance criteria:**
- AC1: the JSON of M1 and M2 round-trips; a file with an unknown field, a missing field, `schemaVersion: 2`, an unknown stack symbol, a `pop` of 65 symbols, or a size over the limit gives a message key and never panics.
- AC2: M1, M2 and the prefix, free-move and bottom-marker cases above give exactly the results written above.
- AC3: `proptest` on random small PDAs: `to_json` then `from_json` is the identity; `determinism` is symmetric (the pair `(i, j)` appears once, with `i < j`) and its result does not depend on the order in which the transitions were given.
- AC4: deliberate breaks, each shown failing, then restored: compare only the `read` symbols (ignore the pop prefix); treat an ε read as not competing; test the pop prefix in one direction only; drop the accepting-state rule.
- AC5: `wasm` stays under 250 KB gzip and the initial JS of every route under 170 KB (`pnpm size`).

**Verification:**
```
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
pnpm build:wasm
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
```
Expected: all pass. No e2e (no UI). Paste real output into `REPORT.md`.

**Rollback:** `git revert <sha>`. Nothing reads the new code yet.

**Depends on:** none.

**Notes for worker:** One new file for the model, the JSON and the validation: keep it simple and in one place. Reuse what the FSM has (`Alphabet`, `Issue`, the limit messages, the JSON pattern). If a decision above looks wrong to you, stop and ask the planner.

---

## Task T-031 — PDA simulation: breadth-first, stack trace, peak configurations

**Status:** done
**Owner:** worker
**Branch:** `task/T-031-pda-simulation`

**Goal:** Run a PDA on an input string, as in the course: breadth-first over configurations `(state, remaining input, stack)`, with a step budget, a trace of one computation, and the largest number of configurations that were alive at the same time. The homework grades a machine "by how low a level of non-determinism it performs, counted by the simulator as the largest number of contents in the BFS queue"; the number this task returns is our version of that count. See ADR 0035.

**Scope (in):**
- `crates/engine-core/src/pda_simulate.rs`: `simulate_pda(&Pda, &[SymbolId], PdaBudget) -> Result<PdaSimulation, Message>`. An error message (not a result) for an input symbol outside the input alphabet or a missing start state (`pda.sim.no_start_state`, `pda.sim.unknown_symbol`).
- **Semantics (Slide12):** a configuration is `(q, i, stack)`, `i` the number of symbols read, the stack kept top first. The start is `(start, 0, [])`. A transition `(q, c, γ1 → γ2, r)` applies to `(q, i, s)` iff `c` is ε or equals `input[i]`, and `γ1` is a prefix of `s`; the result is `(r, i + (c ≠ ε), γ2 ++ s[len(γ1)..])`. The run accepts iff some reachable configuration is `(q, len(input), [])` with `q` accepting. Pop of `[]` fires on any stack (not only an empty one).
- **Breadth-first by levels:** level 0 is the start; level `k + 1` holds every configuration reached by applying one transition to a configuration of level `k`, in a fixed order (parent order, then transition order). A configuration that was already seen at an earlier or the same level is dropped (so a loop that changes nothing ends; a loop that grows the stack is stopped by the budget). The run stops at the first level that contains an accepting configuration.
- `peak_configurations`: the largest number of configurations held by one level (after dropping repeats). A DPDA gives 1 for every input. The result also has `explored` (all configurations created). State in the ADR that the count may differ from the server grader's own count, which the planner has not seen.
- Budget `PdaBudget { max_steps (levels, default 10 000), max_configurations (all created, default 20 000), max_stack (symbols on one stack, default 500) }`, camelCase JSON, `deny_unknown_fields`; add `StopReason::MaxStack` and its TypeScript type. The defaults must keep the worst case near 20 MB of memory (20 000 configurations of 500 symbols of 2 bytes): measure it and write the number in the report; change a default only with the planner's approval. On overflow the result is `Stopped { reason, partial_trace, peak_configurations, explored }`, never a loop or a panic.
- **The trace shows one computation.** A step is `{ position, symbol (the symbol read, or null), transition (index into the sorted transition list, or null for the first step), state, stack (top first), message }`. For an accepted run it is the path from the start to the first accepting configuration found. For a rejected run it is the path to the **best** final configuration (a configuration from which no transition leads to a new configuration): rank configurations by how many of the three conditions hold (input used up, accepting state, stack empty), then by larger `position`, then by earlier creation; the last step's message says what failed, in this order of priority: `pda.sim.input_left { left }`, `pda.sim.not_accepting_state`, `pda.sim.stack_not_empty { depth }`. For a stopped run it is the path to the best configuration so far. Other message keys: `pda.sim.start`, `pda.sim.move`, `pda.sim.accepted`.
- API (`api.rs`, wasm, `handlers.ts`, `protocol.ts`, types by `ts-rs`): `simulate_pda(machine_json, input, budget_json)` returning the same envelope as `simulate`. The input is tokenized by the input alphabet (`Alphabet::tokenize`).
- `id` and `en` texts for the new keys under the same rule as T-030; glossary terms with `TODO(review)`; `docs/decisions/0035-pda-simulation.md`.
- Tests, written first, with the hand derivations below.

**Non-goals (out):**
- No UI, no `.jff`, no step-by-step playback controls (T-033 and T-038). No NDPDA to DPDA conversion. No second acceptance mode. No change to the FSM simulator except the new `StopReason`.

**Files expected to touch:** `pda_simulate.rs` (new), `stop.rs`, `lib.rs`, `api.rs`, `ts.rs`, `crates/engine-core/tests/pda_simulate.rs` (new), `crates/engine-wasm/src/lib.rs`, `handlers.ts`, `protocol.ts`, the generated types, `id.ts`, `en.ts`, `docs/glossary.md`, `docs/decisions/0035-pda-simulation.md`, `docs/agent/REPORT.md`.

**Design reference:** none (no screen). Slides: Slide12, pages 3 to 6 and 16 to 19.

**Hand derivations the planner has done (the worker redoes them in `REPORT.md` before the tests run; machines M1 and M2 are those of T-030):**
- *M1 (`aⁿbⁿ`):* `ε` accepted (state `0` is accepting, the stack is empty); `ab` and `aabb` accepted; `a` rejected, last message `stack_not_empty` (depth 1: after `a` the configuration is `(0, 1, [a])`); `aab` rejected, `stack_not_empty` (state `1`, stack `[a]`); `b` rejected, `input_left` (left 1; nothing can fire on the first configuration); `abb` rejected, `input_left` (left 1: the best configuration is `(1, 2, [])`). `peak_configurations` is 1 for all of them.
- *M2 (`wwᴿ`), input `aa`:* level 0 `{(0,0,[])}`; level 1 `{(0,1,[a]), (1,0,[])}`; level 2 `{(0,2,[a,a]), (1,1,[a])}` (the configuration `(1,0,[])` has no move); level 3 reaches `(1,2,[])`, which is accepting. Accepted; `peak_configurations` = 2; the trace has 4 steps: `(0,0,[])`, `(0,1,[a])`, `(1,1,[a])`, `(1,2,[])`, using the transitions `a`-push, ε, `a`-pop.
- *M2, input `ab`:* level 1 `{(0,1,[a]), (1,0,[])}`; level 2 `{(0,2,[b,a]), (1,1,[a])}`; level 3 `{(1,2,[b,a])}` (from `(1,1,[a])` the symbol `b` cannot pop `b`); no accepting configuration and no further move. Rejected; the trace ends at `(1,2,[b,a])` with `stack_not_empty { depth: 2 }`; `peak_configurations` = 2 (levels hold 1, 2, 2, 1).
- *Loops:* a machine with `(0, ε, [] → [], 0)` and no accepting state, input `ε`: finishes, rejected, one step (the repeat is dropped). A machine with `(0, ε, [] → [x], 0)`: with `maxStack: 5` the result is `Stopped(MaxStack)`; with `maxSteps: 3` `Stopped(MaxSteps)`; with `maxConfigurations: 3` `Stopped(MaxConfigurations)`; each has a non-empty `partialTrace`.

**Acceptance criteria:**
- AC1: M1, M2 and the loop cases give exactly the results above (verdict, last message, trace length, `peak_configurations`).
- AC2: `proptest`: for random `w` over `{a, b}` up to length 10, M2 accepts iff `w = wᴿ` and `|w|` is even; M1 accepts iff `w = aⁿbⁿ`; every returned trace is a legal computation (each step applies the transition it names; the first step is the start; an accepted trace ends in an accepting configuration).
- AC3: determinism of the output: the same machine and input give the same trace and the same numbers on every run.
- AC4: deliberate breaks, each shown failing, then restored: treat `pop = []` as "stack empty" (M2 fails); drop the repeated-configuration check (the no-change loop does not end); count the peak before dropping repeats (a test on a machine with a repeat fails); accept at the first accepting state regardless of the stack (`a` is wrongly accepted).
- AC5: `wasm` under 250 KB gzip, initial JS under 170 KB (`pnpm size`); the memory estimate of the default budget is in the report.

**Verification:**
```
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
pnpm build:wasm
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
```
Expected: all pass. Paste real output into `REPORT.md`.

**Rollback:** `git revert <sha>`.

**Depends on:** T-030 done and merged.

**Notes for worker:** The order inside a level must be fixed (parent order, then the sorted transition order) or the traces change between runs. If the planner's derivation and the engine disagree, stop and report.

---

## Task T-032 — PDA `.jff` import and export

**Status:** in-progress
**Owner:** worker
**Branch:** `task/T-032-pda-jff`

**Goal:** Read and write JFLAP files with `<type>pda</type>`, next to the finite-automaton code in `jff.rs`. A student can then bring a PDA from JFLAP into WebTomata and take one back, as with FSMs. This is engine only: no screen, no file picker (T-033 wires the editor).

**What a JFLAP PDA file looks like (checked on six real files by the planner; the files are private, so the worker builds its own fixtures):**
- `<structure><type>pda</type><automaton>` with `<state id name>` (`<x>`, `<y>`, `<initial/>`, `<final/>`) and `<transition>` elements in the order `<from>`, `<to>`, `<read>`, `<pop>`, `<push>`. An empty or self-closed `<read/>`, `<pop/>` or `<push/>` is ε or an empty list. There are comments (`<!--The list of states.-->`) and `&#13;` after the lines; both must be accepted.
- `<read>` has zero or one character in every file. `<pop>` and `<push>` have zero to seven characters. JFLAP reads a `<pop>` or `<push>` text **one character per stack symbol**, the first character on top: `pop="Z0"` pops `Z` and then `0`; `push="AAAAAZ0"` pushes seven symbols and leaves `A` on top. This is the same order as our `pop` and `push` lists (T-030).
- The file has no alphabet, no acceptance setting and no "deterministic" mark. JFLAP puts its own bottom-of-stack symbol on the stack when it runs; the course grader does not (Slide12), and neither do we.
- Homework machines start with a transition `ε, [] → Z0` and finish by popping `Z0`; machines that JFLAP made itself from a grammar (the "LL" and "LR" conversions) pop a `Z` that nothing pushes first.

**Decisions (the planner made them from the above; do not reopen, ask if one looks wrong):**
1. **Import.** Each character of a `<pop>` or `<push>` text is one stack symbol, first character on top. The input alphabet is the sorted set of characters that appear in `<read>`; the stack alphabet is the sorted set of characters that appear in `<pop>` and `<push>` (sorted by character, like the FSM import). The machine's `kind` is always `ndpda` (the file does not say; the editor lets the student switch to `dpda`). Each of `<from>`, `<to>`, `<read>`, `<pop>`, `<push>` must be present (empty is allowed); a missing one gives `jff.invalid_structure` with the element name, as in the FSM import.
2. **A `<read>` of more than one character is refused** with a new message key `jff.pda_read_not_single { label, from, to }`. (The FSM import expands such a label into a chain of states, because JFLAP reads FA labels one character at a time. For a PDA the planner does not know what JFLAP does, and no real file has it, so we do not guess. This can be relaxed later.)
3. **No bottom marker is added or removed.** A machine written for JFLAP's marker imports as it is; T-030's `pda.pop_never_pushed` warning tells the student, and the machine will not accept in our simulator. This is the course's own rule (Slide12). State it in the ADR and add a test (below).
4. **Export** writes the same shape that JFLAP writes (`<from>`, `<to>`, `<read>`, `<pop>`, `<push>` in this order; `<read/>`, `<pop/>`, `<push/>` for ε and empty lists; `<initial/>`, `<final/>`; names and positions from the layout, as `to_jff` does). If an input symbol or a stack symbol has more than one character, export fails with the existing key `jff.symbol_not_single_character { symbol }` (JFLAP cannot hold it). This also means a PDA produced by the conversions of T-034 and T-035 cannot be exported when the grammar has variables like `S0`; say so in the ADR. Symbols that no transition uses are not written; `kind` is not written.
5. **Same safety rules as the FSM code:** `MAX_JFF_BYTES`, DTDs refused, the node limit, and every problem comes back as a message, never a panic.
6. **One file.** Add the PDA code to `jff.rs` and share the helpers (`child`, `children`, `number`, `coordinate`, the state reader, `escape`, `xml_char`) instead of copying them; split the file only if it passes about 600 lines. The FSM behavior does not change.

**Scope (in):**
- `parse_pda_jff(xml) -> Result<PdaJff, Message>` and `to_pda_jff(&Pda, &[JffState]) -> Result<String, Message>`, with `PdaJff { pda, states }` (TypeScript `PdaJff`, the machine typed as `Pda` like `Jff` types its machine as `Machine`). A file with another `<type>` gives `jff.unsupported_type { type }`; the FSM `parse_jff` already gives that message for a `pda` file, and the editor (T-033) uses it to pick the right importer.
- API: `import_pda_jff(xml)` and `export_pda_jff(pda_json, layout_json)`, same envelope as `import_jff` and `export_jff`; the same two in `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts` and `protocol.ts`, typed.
- Message keys: the new `jff.pda_read_not_single` gets `id` and `en` texts under the same rule as the other `jff.*` keys (check how they are covered with `grep`). No new Indonesian terms are expected; if one is, add it to `docs/glossary.md` with `TODO(review)`.
- `docs/decisions/0036-pda-jff.md` (the decisions above) and one line in the place of the docs that describes the `.jff` support.
- Tests, written first, with the fixtures and derivations below.

**Non-goals (out):**
- No UI, no file picker, no drag and drop (T-033). No Turing machine `.jff`. No emulation of JFLAP's bottom marker, no acceptance setting. No chain expansion of long `<read>` labels. No change to the FSM import or export except sharing helpers.
- Do not copy any text from the files in `REFERENCES/` into a commit: they are private, and the three homework machines are a student's own answers. If you have them, you may open one to see the shape of a file; write your own fixtures.

**Files expected to touch:** `crates/engine-core/src/jff.rs`, `lib.rs`, `api.rs`, `ts.rs`, `crates/engine-core/tests/pda_jff.rs` (new), `crates/engine-wasm/src/lib.rs`, `handlers.ts`, `protocol.ts`, `handlers.test.ts`, the generated types, `id.ts` and `en.ts` (for the new key), `docs/decisions/0036-pda-jff.md`, the docs line, `docs/agent/REPORT.md`.

**Design reference:** none (no screen). Slides: Slide12, pages 16 to 19 and 23 (the note on JFLAP).

**Fixtures and hand derivations (the planner derived them; the worker redoes them in `REPORT.md` before any test runs; if the engine disagrees, stop and report):**
- *F1, a homework-style file for `aⁿbⁿ`.* States `0` (initial), `1`, `2`, `3` (final). Transitions, as `from → to, read, pop, push`: `0→1, ε, "", "Z0"`; `1→1, a, "", "A"`; `1→2, b, "A", ""`; `2→2, b, "A", ""`; `1→3, ε, "Z0", ""`; `2→3, ε, "Z0", ""`. Write it in JFLAP's layout, with comments, with `&#13;` after the lines, and with `<pop/>` and `<push/>` self-closed. Import gives: input alphabet `["a","b"]`, stack alphabet `["0","A","Z"]` (sorted by character), `kind` `ndpda`, six transitions; `0→1` pushes `[Z, 0]` (`Z` on top). `validate_pda` gives no issue. Simulation (T-031): `ε`, `ab` and `aabb` are accepted; `a`, `aab`, `abb` and `b` are rejected.
- *F2, a file as JFLAP converts a grammar (the "LL" shape).* States `0` (initial), `1`, `2` (final); transitions `0→1, ε, "Z", "SZ"`; `1→1, ε, "S", "aSb"`; `1→1, ε, "S", "ab"`; `1→1, a, "a", ""`; `1→1, b, "b", ""`; `1→2, ε, "Z", ""`. Import works; `validate_pda` gives five warnings `pda.pop_never_pushed`, one for each `(from, symbol)` pair: `(0, Z)`, `(1, S)`, `(1, a)`, `(1, b)`, `(1, Z)`. With an empty stack at the start no transition can ever fire (each one pops something that only a transition that cannot fire pushes), so no symbol is ever pushed; T-030 reports each pair once. Simulation of `aabb` is **rejected** at the first configuration (`input_left`, 4 symbols), which documents the course rule that the grader has no bottom marker.
- *Export of M1 and M2 of T-030* (give them state names and positions): `import_pda_jff(export_pda_jff(m))` equals `m` except `kind` (becomes `ndpda`) and the alphabets (only symbols that some transition uses, sorted by character); a second export gives the identical text. M2's ε-guess transition is written as `<read/><pop/><push/>`.
- *Pop and push order:* a transition with `pop = [a, b]` is written `<pop>ab</pop>`; `push = [a, S, b]` is written `<push>aSb</push>`; reading them back gives the same lists. A swapped order must fail a test.
- *Errors:* a file with `<type>fa</type>` gives `jff.unsupported_type` (`type: "fa"`); a `<read>ab</read>` gives `jff.pda_read_not_single` (`label: "ab"`); a transition without `<pop>` gives `jff.invalid_structure` (`element: "pop"`); two `<initial/>` states give `jff.multiple_initial_states`; a DTD, bytes over the limit, and malformed XML give the same messages as the FSM import. Export of a machine with the stack symbol `Z0`, or the input symbol `num`, gives `jff.symbol_not_single_character` with that symbol.

**Acceptance criteria:**
- AC1: F1 and F2 give exactly the results above (alphabets, transition lists, issues, accept and reject).
- AC2: the export and round-trip results above hold, including the stable second export.
- AC3: `proptest` on random PDAs whose symbols are single characters: `export` then `import` then `export` gives identical text, and the re-imported machine has the same transitions (by symbol names) as the original.
- AC4: the error cases above give exactly those message keys and parameters, and nothing panics on random bytes (`proptest` with arbitrary strings fed to `parse_pda_jff`).
- AC5: deliberate breaks, each shown failing, then restored: read `<pop>` and `<push>` with the last character on top (F1 and the order test fail); write `<push>` before `<pop>` or swap their text (the round trip fails); allow a multi-character stack symbol in export (the error test fails); drop the DTD refusal (its test fails); do not sort the alphabets (the alphabet order assertion fails).
- AC6: `wasm` stays under 250 KB gzip and the initial JS under 170 KB (`pnpm size`); report the wasm size before and after.

**Verification:**
```
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
pnpm build:wasm
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
```
Expected: all pass. No e2e (no UI). Paste real output into `REPORT.md`.

**Rollback:** `git revert <sha>`. Nothing reads the new code yet.

**Depends on:** T-030 and T-031 done and merged (both are).

**Notes for worker:** Share the helpers with the FSM code, do not copy them. Quote constants and message keys from the code in your summary, not from memory. If a derivation above disagrees with the engine, stop and report.

---

## Task T-034 — CFG to PDA, top-down (draft)

**Status:** proposed (the full spec is written after T-032 is merged)
**Owner:** worker
**Branch:** `task/T-034-cfg-to-pda-topdown`

**Goal:** The slides' `CFGtoPDAtopdown` (Slide13, page 4), with a step trace: states `p` and `q` (`p` start, `q` accepting), the stack alphabet is the variables and the terminals, and `Δ` holds `((p, ε, ε), (q, S))`, `((q, ε, X), (q, γ1…γn))` for every rule `X → γ1…γn` (an ε-rule pushes nothing), and `((q, c, c), (q, ε))` for every terminal `c`. Engine only: `cfg_to_pda_topdown(grammar_text, budget)` returning the PDA and a trace; the state names `p` and `q` come back as plain data for the UI document. The step trace has one step for the first transition, one for each rule and one for each terminal.

**Draft test plan:** equivalence by simulation, not by structure: for the grammar `S → aSb | ab` (the owner's `cfg_anbn.jff`) and two more small grammars (one with an ε-rule, one with two variables), every string over the alphabet up to length 8 is accepted by the PDA (T-031) iff the grammar generates it (the existing CNF and CYK code, with the empty string handled). The owner's JFLAP conversion (`pda_cfg_anbn_LL.jff`) differs in bookkeeping (it uses JFLAP's bottom marker `Z`), so it is **not** compared structure for structure.

**Depends on:** T-030, T-031.

---

## Task T-035 — CFG to PDA, bottom-up (draft)

**Status:** proposed (after T-034)
**Owner:** worker
**Branch:** `task/T-035-cfg-to-pda-bottomup`

**Goal:** The slides' `CFGtoPDAbottomup` (Slide13, page 8): one state `p`, a second accepting state `q`; shift `((p, c, ε), (p, c))` for every terminal; reduce `((p, ε, (γ1…γn)ᴿ), (p, X))` for every rule `X → γ1…γn` (the right-hand side reversed, because the top of the stack is `γn`); and `((p, ε, S), (q, ε))`. Same shape and tests as T-034. Note for the full spec: an ε-rule gives `((p, ε, ε), (p, X))`, which can push forever; the budget of T-031 stops it, and the test with an ε-rule uses short inputs and a small budget.

**Depends on:** T-034.

---

## Task T-036 — PDA to restricted normal form, with a trace (draft)

**Status:** proposed (the full spec is written after T-035 is merged)
**Owner:** worker
**Branch:** `task/T-036-pda-to-rnf`

**Goal:** The slides' conversion to restricted normal form (Slide13, pages 13 to 19): a new start state `s'` that only pushes `#`; a single accepting state `a` reached from every old accepting state by `((qk, ε, #), (a, ε))`; every transition pops exactly one symbol (a multi-pop `γ1…γn` becomes `n` single-pop transitions through `n − 1` new states; a transition that pops nothing becomes one transition for every symbol of `Γ ∪ {#}`, popping that symbol and pushing it back). Engine only, one step per rewritten transition. Test: the slides' own example, a PDA for `wcwᴿ` (`w ∈ {a, b}*`): three non-pop transitions from `s` become nine single-pop transitions (Slide13, page 19); the result accepts the same strings as the original (T-031).

**Depends on:** T-031.

---

## Task T-037 — PDA in restricted normal form to CFG (draft)

**Status:** proposed (after T-036)
**Owner:** worker
**Branch:** `task/T-037-pda-to-cfg`

**Goal:** The slides' `PDAtoCFG` (Slide13, pages 20 to 27): one variable `<q, A, p>` for every pair of states and stack symbol, `S → <s, #, a>`, `<w, ε, w> → ε`, and the rules of steps S4 (A) and (B). The slides' own example (`wcwᴿ`) is the oracle: the algorithm produces 76 rules, and 16 remain after removing the unreachable and non-productive ones (T-060's phases 1 and 2 do that cleanup). The variable names must be readable by the grammar parser (the T-026 lesson); the full spec fixes them. A property test chains T-034 → T-036 → T-037: for small grammars, the grammar that comes back generates the same strings (CYK up to length 6).

**Depends on:** T-036.

---

## Task T-038 — Conversions and simulation panel for the PDA (draft)

**Status:** proposed (after P-004 is approved and T-033, T-034, T-035, T-037 are merged)
**Owner:** worker

**Goal:** In the PDA editor, a panel that plays the simulation of T-031 (stack drawn, one step at a time, the peak number shown) and shows the traces of T-034 to T-037. A wireframe the owner approves comes first (planner task P-005, to be written after P-004).

**Depends on:** P-004, T-033, T-034, T-035, T-037.

---

## Planner task P-004 — Wireframe of the PDA editor

**Status:** to do (after T-032 is merged, so the wireframe can rely on real machine data)
**Owner:** planner

Draw `design/screens/pda-editor.md` and `.svg`: the diagram with the label `c / γ1 / γ2` (Rich's notation and the slides'; JFLAP shows `c, γ1; γ2`, which we do not use), a transition table with the same three columns, the formal definition, the "deterministic or not" badge with the list of competing pairs, and the panel tabs of the FSM editor. The owner approves it before T-033.

---

## Planner task P-003 — Wireframe of the grammar rule rows on a phone

**Status:** done (approved by the owner on 2026-11-04, option B; it became task T-024)
**Owner:** planner

`design/screens/grammar-rule-rows-phone.md` and `.svg`.

## Planner task P-001 — As-built spec of the grammar workstation, the language workstation and the switcher

**Status:** done (PR 117, merged on 2026-11-02; the phone layout became task T-016)
**Owner:** planner

Write `design/screens/grammar-workstation.md`, `design/screens/language-workstation.md` and `design/screens/workstation-switcher.md` from the screenshots and the code, and add them to `docs/ux/wireframes.md`. No redesign of the laptop layouts. The owner approves each. T-010 to T-012 wait for this.

**Added on 2026-11-02, after the owner's phone test:** the two workstations are not usable on a phone. Both stack their three areas as small boxes with their own scroll bars, so a student sees about one item of the library, one row of the grammar, or only the heading of the CNF phase; in the language workstation the results are below the settings and off the screen. P-001 therefore also proposes a phone layout for both (the proposal is in `design/screens/workstation-phone-layout.md`: one area at a time with a tab strip at the top, like the panel tabs of the FSM editor). The owner approves it before T-016.

## Planner task P-002 — Wireframe of the CNF "versi panjang / versi ringkas" switch

**Status:** drawn on 2026-11-05 in `design/screens/cnf-stepper-homework-order.md` and `.svg`, and approved by the owner the same day (the stage order and the start-symbol rule were settled from the course slides). It also changes the phase order (the owner agreed on 2026-11-05: follow the homework). Tasks: T-060 (order and message keys), then T-015 (the toggle).
**Owner:** planner

**Owner's answers (2026-11-04):** the long version is the default; a toggle switches to a "minimized" version with reused rules (one version at a time, not side by side). The engine's six phases follow the course's homework text for CNF (report the grammar after each stage: unreachable rules, non-productive rules, epsilon rules, unit rules, mixed rules, long right-hand sides). Still to draw and ask: where the toggle sits (in the stepper header is the planner's pick), and what exactly "minimized" does (shared helper variables only, or also reuse of an existing `A → a` rule; see the note below).

The owner's idea (2026-11-02): the CNF conversion shows a verbose version that follows the course (no sharing) and a minimized version, with a toggle. The planner draws it and the owner approves it before T-015. Open points for the owner at that time: is "minimized" only shared helper variables, or also reuse of an existing `A → a` rule for a terminal (the slide mentions it)? Are the two versions shown one at a time, or side by side? **Found by the report of T-004:** phase 5 always reuses one `T_c` variable for each terminal across the whole grammar, even when `share_helpers` is false. That is the idea of the slide's note ("Ta can take A instead") only in part, so it matters for what "minimized" means.

---

## Backlog (`proposed`, not dispatchable until the planner specifies the missing fields)

**A. Clean up (P-001 is done)**
- **T-010** e2e and axe tests for the grammar workstation flow: specified in its own task block above (`todo`, after T-024).
- **T-011** e2e and axe tests for the language workstation and the switcher: specified in its own task block above (`todo`).
- **T-012** `rejected` on 2026-11-04: the panel drag handle already has seven tests with real touch events in `web/e2e/editor-panel-height.spec.ts` (drag up and down, limits, tap, keys, 44 px, no page scroll). Reopen it only if the owner sees a failing handle on a real phone; a WebKit run would need a real iPhone.
- **T-016** The phone layout of the grammar and the language workstations: done (PR 121).
- **T-015** The UI switch between the long version and the short version of the CNF conversion: specified in its own block above (`todo`; T-060 is merged).
- **T-060** CNF phases in the homework order, with message keys: specified in its own block above (`done`).
- **T-013** Preset text in `id` and `en`, and readable rule chips: specified in its own task block above (`todo`).
- **T-024** Bigger touch areas for the rule boxes of the grammar Editor on a phone: specified in its own task block above (`todo`; the owner approved the design on 2026-11-04).
- **T-025** Landmarks on a laptop, tab panels on a phone: specified in its own task block above (`todo`).
- **T-019** One limit and one translated message for the length of a CYK string: specified in its own task block above (`todo`).
- **T-017** The two local-reference tests keep only finite automata: specified in its own task block above (`todo`).
- **T-028** The grammar engine's errors carry Indonesian sentences. `GrammarError` has `Display` with Indonesian text, and `api.invalid_grammar` and `api.cyk_failed` pass it as `detail`, which the grammar UI shows as it is, also in English; for a key without `detail` it shows the raw key. This breaks principle 6 of `CLAUDE.md`. Make the parser, the CNF transformer and CYK return typed errors with a message key and parameters, and translate them in the UI. Larger than T-019 (found while specifying T-019); needs its own spec and a test for every error.
- **T-029** The CYK tester joins rule symbols with no space, so every CNF result with a helper variable fails in CYK: specified in its own block above (`todo`; found by the worker in T-010 and reproduced by the planner).

**B. Grammar additions** (a wireframe the owner approves comes first for T-020)
- **T-020** Multi-string test for grammars, like the FSM test list, using the CYK parser.
- **T-021** JFLAP grammar files (`<type>grammar</type>`): import and export. Original fixtures only. The course grammar files in `REFERENCES/` must never become fixtures.
- **T-022** (optional) Right-linear grammar to FA, using the FSM engine.

**C. The PDA** (each step has its own ADR; a wireframe the owner approves comes first for T-033)
Decided by the owner on 2026-11-04 (see `DECISIONS.md`): the notation is Rich's and the slides' (not Sipser's); the PDA is non-deterministic as well as deterministic (the course homework uses both); every run has a step budget, like the FSM engine, and ends as "stopped" with the partial trace.
- **T-030** PDA data model, JSON, validation and the determinism check: specified in its own block above (`todo`). The three questions are settled from the slides (2026-11-05): the stack starts empty, one acceptance rule (input used up, stack empty, accepting state), `pop` and `push` are lists of named symbols, top first.
- **T-031** PDA simulation, breadth-first, with a stack trace, budgets and the peak number of configurations: specified in its own block above (`todo`; after T-030).
- **T-032** PDA `.jff` import and export: specified in its own block above (`todo`; T-030 and T-031 are merged).
- **T-033** PDA editor: after P-004 (wireframe) is approved and T-032 is merged.
- **T-034** CFG to PDA, top-down (slides, `CFGtoPDAtopdown`): draft above (`proposed`). Tested by language equivalence, not by structure against JFLAP's file.
- **T-035** CFG to PDA, bottom-up (slides, shift and reduce): draft above (`proposed`).
- **T-036** PDA to restricted normal form, with a trace: draft above (`proposed`).
- **T-037** PDA in restricted normal form to CFG: draft above (`proposed`). The slides' example `wcwᴿ` is the oracle (76 rules, 16 after cleanup).
- **T-038** Conversions and simulation panel for the PDA: draft above (`proposed`; after P-004, P-005 and T-033).
- **P-004** Wireframe of the PDA editor: planner task above (after T-032).

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
