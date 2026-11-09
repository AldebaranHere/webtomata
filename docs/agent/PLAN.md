# Plan — Milestone 0: clean up, then grammar additions, then the PDA

> Owner: planner. Approved by the human on 2026-11-01 (outline A to D). The human approves each task, or its design, before it becomes `todo`.
> `todo` means ready: every field is written and the human approved it. Several tasks can be `todo` at the same time. The worker does one task at a time: the one that the human names in the start prompt ("Do task T-xxx"). The worker sets it to `in-progress` in the first commit of its own PR and to `done` in the last. The planner does not open a pull request only to change a status.
> The blank task template is in `PLAN-TEMPLATE.md`.

**Suggested order of the `todo` tasks** (the human decides): T-018 (start marker), T-016 (phone layout), T-023 (open the CNF result as a new grammar; after T-016 is merged), then T-026 and T-027 (parser-readable CNF helper names, and `λ` as the empty string; both after T-023 is merged), T-002 (from 2026-11-04), T-050 (CI fast path for docs-only changes), T-005 (from 2026-11-12). T-016 and T-018 need the Playwright browsers in WSL. Written on 2026-11-04 and `todo`: T-019 (one CYK length limit), T-017 (local-reference tests), T-025 (landmarks and tab panels), T-013 (preset text in `id`/`en`, readable rule chips). T-013 and T-025 touch the same two components: do them one after the other. Written on 2026-11-04 after those four were merged and `todo`: T-024 (rule rows with 44 px targets on touch screens), then T-010 (grammar flow e2e; needs T-024 merged), then T-011 (language and switcher e2e). All three touch or test the same two components: one at a time. Written on 2026-11-05: T-029 (`todo`: the CYK tester must space the symbols of a rule). T-060 (CNF phases in the homework order, after T-029 is merged) is `todo` since the owner approved `design/screens/cnf-stepper-homework-order.md`; T-060 is merged (PR 147). Written on 2026-11-05 after it: T-015 (`todo`: the "versi panjang / versi ringkas" toggle). Written on 2026-11-05 after T-015 merged: T-030, then T-031 (`todo`, the PDA engine: model and validation, then simulation; one after the other, they touch the same engine files). T-032 is `todo` since 2026-11-05 (T-031 merged) T-034 (done) and T-035 (`todo`, T-034 merged); T-036 and T-037 are merged (PRs 161 and 163); P-004 (the PDA editor wireframe) is approved; T-033 is merged (PR 165); T-039, T-049 and T-053 are merged (PRs 167, 169 and 173); T-054 and T-055 are merged (PRs 176 and 178); T-056 is merged (PR 180); T-057 is `todo` since 2026-11-08 (T-051 and T-052 are `proposed` drafts that follow it); T-038 is a `proposed` draft; the full specs are written when the one before is merged.

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

| Id                | Grammar                                                   | Language (the test oracle) | What it shows                                                                                                                                                              |
| ----------------- | --------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CNF_ORDER`       | `S → a \| A B`, `A → a`, `B → B b`                        | `{a}`                      | Phase 4: remove unproductive first (`B` and `S → A B`), then `A` is unreachable. Final grammar: `S → a`.                                                                   |
| `CNF_NULLABLE`    | `S → A B C`, `A → a A \| ε`, `B → b B \| A`, `C → c \| ε` | `a* b* a* (c or empty)`    | Phase 2 with several nullable variables, a nullable start symbol, and the unit rule `B → A`.                                                                               |
| `CNF_START_LONG`  | `S → x S y y \| z`                                        | `xⁿ z y²ⁿ`, n ≥ 0          | Phase 1 (start symbol on the right), phase 5, and a rule of length 4 in phase 6.                                                                                           |
| `CNF_UNIT_CHAIN`  | `S → A`, `A → B`, `B → C \| b b`, `C → c C \| c`          | `{bb} ∪ c⁺`                | Phase 3 (unit chain). Then `A` and `B` are unreachable (phase 4b). Expected rules: `S → T_b T_b \| T_c C \| c`, `C → T_c C \| c`, `T_b → b`, `T_c → c` (names may differ). |
| `CNF_SHARED_TAIL` | `S → a B C D \| b B C D`, `B → x`, `C → y`, `D → z`       | `{axyz, bxyz}`             | A shared tail in phase 6.                                                                                                                                                  |

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
4. The workflows that are **not** required checks and run on every pull request (`codeql.yml` and the preview part of `deploy.yml`) get `paths-ignore` on `pull_request` with the **same list** as the allowlist (a workflow with `paths-ignore` still runs when any changed file is outside the list). Do not change the `push` trigger of `deploy.yml`. `audit.yml` and `fuzz.yml` already run on a pull request only for their own `paths` (lock files; the engine and fuzz folders), so they never run for a documents-only change: leave them as they are. _(Corrected on 2026-11-04: the first version of this item said that all four get `paths-ignore`; that was the planner's mistake, found by the worker. The guard rail now requires, for each of the four, either a `paths-ignore` equal to the allowlist or a positive `paths` list with no allowlisted entry.)_
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

**Goal:** A segmented control in the stepper header switches the CNF conversion between two versions. _Versi panjang_ (default) is today's behavior. _Versi ringkas_ reuses what exists: in phase 5 a terminal `a` uses an existing variable `A` whose only rule is `A → a` instead of a new `T_a`; in phase 6 identical helper variables are shared between rules. Both versions end in a CNF grammar for the same language. The six phases and their order stay as in T-060. See `design/screens/cnf-stepper-homework-order.md` (the owner approved it, and chose the names "versi panjang" and "versi ringkas").

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

- _Grammar R1:_ `S -> x B y | z B y | z B | x` and `B -> x`. Language `{x, xxy, zxy, zx}`. Phases 1 to 4 change nothing. Phase 5, long: 8 rules (three rewritten mixed rules of `S` using `T_x`, `T_y`, `T_z`, plus `S → x`, `B → x`, and three helpers); removed 3, added 6. Phase 5, short: `x` reuses `B` (its only rule is `B → x`), so only `T_y` and `T_z` are created: 7 rules; removed 3, added 5; the phase-5 note is present. Phase 6, long: two rules have length 3 and get their own helper each: 10 rules; removed 2, added 4. Phase 6, short: the pair `(B, T_y)` is shared by both rules, so one helper: 8 rules; removed 2, added 3; the phase-6 note is present. Both final grammars are in CNF and accept exactly `{x, xxy, zxy, zx}` (CYK oracle on all strings over `{x,y,z}` up to length 6).
- _Grammar R2 (must not reuse):_ `S -> a C` and `C -> c | a`. `C` has two rules, so `a` needs its own `T_a` in the short version too; no phase-5 note. The short and long finals both accept exactly `{ac, aa}` (a wrong reuse of `C` for `a` would also accept `cc` and `ca`).
- _Grammar R3a (the T-010 flow grammar):_ phases 1 to 5 are identical in both versions. In phase 6, long has 17 rules (removed 2, added 4, no note); short has 16 (removed 2, added 3, phase-6 note), because `S₀` and `S` end in the same pair `(S, T_b)` and share one helper. _(Corrected on 2026-11-05: the first version of this spec wrongly called the two traces identical; the worker found it.)_
- _Grammar R3b (nothing to reuse or share):_ `S -> a S b | c`. Both versions give the same six phases and no notes: phase 5 removes 1 and adds 3 (4 rules), phase 6 removes 1 and adds 2 (5 rules). Language `a^n c b^n`.
- _Extra test the review asked for:_ the phase-5 tie rule. `S -> a P Q`, `P -> a`, `Q -> a`: short must give `S → P P Q` (first by name), never `S → Q P Q`.

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

**Notes for worker:** The flag rename is mechanical but touches many tests; do it in its own commit so the diff is easy to read. The reuse rule is about the grammar _at the start of phase 5_, after phases 1 to 4. If a stage of the course method is unclear, ask the planner; do not guess.

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

- _M1, a DPDA for `aⁿbⁿ` (n ≥ 0)._ Input alphabet `a, b`; stack alphabet `a`; states `0` (start, accepting) and `1` (accepting); transitions `(0, a, [] → [a], 0)`, `(0, b, [a] → [], 1)`, `(1, b, [a] → [], 1)`. `determinism` is empty. `validate` as `dpda` has no issue.
- _M2, an NDPDA for `wwᴿ` over `{a, b}`._ Input `a, b`; stack `a, b`; states `0` (start) and `1` (accepting); transitions `(0, a, [] → [a], 0)`, `(0, b, [] → [b], 0)`, `(0, ε, [] → [], 1)`, `(1, a, [a] → [], 1)`, `(1, b, [b] → [], 1)`. `determinism` lists exactly two competing pairs, both at state `0`, both with the ε-transition (it competes with the `a`-push and with the `b`-push; the two pushes do not compete, and the two pops at state `1` do not compete). Declared `dpda`, `validate` gives two `pda.competing_transitions` errors; declared `ndpda`, none.
- _Prefix rule._ At one state, `(a, pop [a])` and `(a, pop [a, b])` compete (same read, `[a]` is a prefix of `[a, b]`); `(a, pop [a])` and `(a, pop [b])` do not; `(a, pop [a])` and `(b, pop [a])` do not; `(ε, pop [a])` and `(b, pop [a, b])` do.
- _Accepting state, free move._ A machine whose accepting state `1` has `(1, ε, [] → [x], 1)`: as `dpda`, one error `pda.accepting_state_free_move`; with `(1, ε, [x] → [], 1)` instead (it pops), no error.
- _JFLAP bottom marker._ A machine with `(0, ε, [Z] → [S, Z], 1)` and no transition that pushes `Z`: one warning `pda.pop_never_pushed` with symbol `Z`.

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

- _M1 (`aⁿbⁿ`):_ `ε` accepted (state `0` is accepting, the stack is empty); `ab` and `aabb` accepted; `a` rejected, last message `stack_not_empty` (depth 1: after `a` the configuration is `(0, 1, [a])`); `aab` rejected, `stack_not_empty` (state `1`, stack `[a]`); `b` rejected, `input_left` (left 1; nothing can fire on the first configuration); `abb` rejected, `input_left` (left 1: the best configuration is `(1, 2, [])`). `peak_configurations` is 1 for all of them.
- _M2 (`wwᴿ`), input `aa`:_ level 0 `{(0,0,[])}`; level 1 `{(0,1,[a]), (1,0,[])}`; level 2 `{(0,2,[a,a]), (1,1,[a])}` (the configuration `(1,0,[])` has no move); level 3 reaches `(1,2,[])`, which is accepting. Accepted; `peak_configurations` = 2; the trace has 4 steps: `(0,0,[])`, `(0,1,[a])`, `(1,1,[a])`, `(1,2,[])`, using the transitions `a`-push, ε, `a`-pop.
- _M2, input `ab`:_ level 1 `{(0,1,[a]), (1,0,[])}`; level 2 `{(0,2,[b,a]), (1,1,[a])}`; level 3 `{(1,2,[b,a])}` (from `(1,1,[a])` the symbol `b` cannot pop `b`); no accepting configuration and no further move. Rejected; the trace ends at `(1,2,[b,a])` with `stack_not_empty { depth: 2 }`; `peak_configurations` = 2 (levels hold 1, 2, 2, 1).
- _Loops:_ a machine with `(0, ε, [] → [], 0)` and no accepting state, input `ε`: finishes, rejected, one step (the repeat is dropped). A machine with `(0, ε, [] → [x], 0)`: with `maxStack: 5` the result is `Stopped(MaxStack)`; with `maxSteps: 3` `Stopped(MaxSteps)`; with `maxConfigurations: 3` `Stopped(MaxConfigurations)`; each has a non-empty `partialTrace`.

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

**Status:** done
**Commit:** `cd1327f`
**PR:** #155
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

- _F1, a homework-style file for `aⁿbⁿ`._ States `0` (initial), `1`, `2`, `3` (final). Transitions, as `from → to, read, pop, push`: `0→1, ε, "", "Z0"`; `1→1, a, "", "A"`; `1→2, b, "A", ""`; `2→2, b, "A", ""`; `1→3, ε, "Z0", ""`; `2→3, ε, "Z0", ""`. Write it in JFLAP's layout, with comments, with `&#13;` after the lines, and with `<pop/>` and `<push/>` self-closed. Import gives: input alphabet `["a","b"]`, stack alphabet `["0","A","Z"]` (sorted by character), `kind` `ndpda`, six transitions; `0→1` pushes `[Z, 0]` (`Z` on top). `validate_pda` gives no issue. Simulation (T-031): `ε`, `ab` and `aabb` are accepted; `a`, `aab`, `abb` and `b` are rejected.
- _F2, a file as JFLAP converts a grammar (the "LL" shape)._ States `0` (initial), `1`, `2` (final); transitions `0→1, ε, "Z", "SZ"`; `1→1, ε, "S", "aSb"`; `1→1, ε, "S", "ab"`; `1→1, a, "a", ""`; `1→1, b, "b", ""`; `1→2, ε, "Z", ""`. Import works; `validate_pda` gives five warnings `pda.pop_never_pushed`, one for each `(from, symbol)` pair: `(0, Z)`, `(1, S)`, `(1, a)`, `(1, b)`, `(1, Z)`. With an empty stack at the start no transition can ever fire (each one pops something that only a transition that cannot fire pushes), so no symbol is ever pushed; T-030 reports each pair once. Simulation of `aabb` is **rejected** at the first configuration (`input_left`, 4 symbols), which documents the course rule that the grader has no bottom marker.
- _Export of M1 and M2 of T-030_ (give them state names and positions): `import_pda_jff(export_pda_jff(m))` equals `m` except `kind` (becomes `ndpda`) and the alphabets (only symbols that some transition uses, sorted by character); a second export gives the identical text. M2's ε-guess transition is written as `<read/><pop/><push/>`.
- _Pop and push order:_ a transition with `pop = [a, b]` is written `<pop>ab</pop>`; `push = [a, S, b]` is written `<push>aSb</push>`; reading them back gives the same lists. A swapped order must fail a test.
- _Errors:_ a file with `<type>fa</type>` gives `jff.unsupported_type` (`type: "fa"`); a `<read>ab</read>` gives `jff.pda_read_not_single` (`label: "ab"`); a transition without `<pop>` gives `jff.invalid_structure` (`element: "pop"`); two `<initial/>` states give `jff.multiple_initial_states`; a DTD, bytes over the limit, and malformed XML give the same messages as the FSM import. Export of a machine with the stack symbol `Z0`, or the input symbol `num`, gives `jff.symbol_not_single_character` with that symbol.

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

## Task T-034 — CFG to PDA, top-down

**Status:** done
**Commit:** `e6cefdd`
**PR:** #157
**Owner:** worker
**Branch:** `task/T-034-cfg-to-pda-topdown`

**Goal:** The slides' `CFGtoPDAtopdown` (Slide13, page 4), with a step trace. From a context-free grammar the engine builds a PDA with two states, `p` (start) and `q` (accepting), that accepts the same strings. The student sees the PDA and one trace step for every transition that the algorithm adds. Engine only: no screen (T-033 is the editor, T-038 the panel).

**The algorithm (Slide13, page 4; the rule order below is the order of the trace):**

1. `((p, ε, ε), (q, S))`: from `p` to `q`, read nothing, pop nothing, push the start variable.
2. For every rule `X → γ1…γn`: `((q, ε, X), (q, γ1…γn))`: pop `X`, push the right-hand side with `γ1` on top. An ε-rule (`n = 0`) pushes nothing. This matches our `push` order (top first, T-030): `push = [γ1, …, γn]`.
3. For every terminal `c`: `((q, c, c), (q, ε))`: read `c`, pop `c`, push nothing.

The PDA accepts when the input is used up, the stack is empty and the state is `q` (T-030, T-031). The stack starts empty: step 1 puts `S` on it.

**Decisions (the planner made them from the slides and the code; do not reopen, ask if one looks wrong):**

1. **Input.** The grammar text is parsed with the existing `GrammarParser` (same 8192-character limit and the same `api.invalid_grammar` message as `transform_to_cnf`). A grammar that has an ε-rule, a unit rule, a long right-hand side or unreachable variables is **not** normalized first: the algorithm works on any CFG, and the point of the trace is that the student sees their own rules.
2. **Alphabets.** The input alphabet is the sorted terminals of the grammar (`Grammar::terminals`, each one a one-character name). The stack alphabet is every variable (`Grammar::variables`, so the start variable is in it even when it has no rule) and every terminal, as names, **sorted by name** (byte order, so `S` before `a`). A variable name can have several characters (`S0`, `T_a`, `<Expr>`): the stack alphabet allows that.
3. **States.** `p` is `StateId(0)` and `q` is `StateId(1)`. The result carries the names as plain data: `states: [{ id: 0, name: "p" }, { id: 1, name: "q" }]`. `start` is `p`, `accepting` is `[q]`, `kind` is always `ndpda` (a conversion result is not asked to be deterministic).
4. **Name clash is refused.** The parser accepts a bracketed variable such as `<a>` or `[a]`; its name `a` is then also a terminal name, and one stack symbol cannot be both. If a variable name equals a terminal, return `pda.cfg.symbol_clash { symbol }` (the symbol is the name). No other check is needed: a name that the stack alphabet cannot hold (whitespace, `ε`) comes back as the `machine.invalid_symbol` message of `Alphabet::new`, a rule body longer than `MAX_PDA_STRING` (64) as the `machine.limit_exceeded` message of `Pda::new` (`what: "pda_string"`, `limit: 64`). Do not add new keys for these.
5. **Duplicate rules are merged.** `S -> a | a` is one rule: two identical transitions would give `pda.duplicate_transition` (T-030). A rule is a duplicate when its head and its body are equal to those of an earlier rule; the first one stays and gets the trace step. This is the only change to the student's rule list.
6. **No budget.** The construction has one step for the first transition, one for each distinct rule and one for each terminal: it is linear and cannot loop. The API takes only the grammar text. (A grammar that makes the _simulation_ loop, such as `S -> S a | b`, is a matter for T-031's budget; see F4.)
7. **Trace.** `steps: Vec<CfgPdaStep>`, in the order above (first transition; rules in grammar order, after merging duplicates; terminals sorted by character). Each step has the new `transition` in the wire form `PdaTransition` (names, as in `Pda` JSON: `from`, `read`, `pop`, `push`, `to`) and a `message` with a key and parameters; the engine writes no sentences. Keys: `cfg_pda.top_down.start` (no parameters), `cfg_pda.top_down.rule { rule }` where `rule` is the production as `Production`'s `Display` gives it (`S -> aSb`, `S -> ε`), and `cfg_pda.top_down.terminal { symbol }`. The final `pda` has the transitions in the sorted order that `Pda::new` gives them, so steps and transitions are matched by value, not by index.

**Scope (in):**

- New `crates/engine-core/src/cfg_pda.rs` (a new file; do not grow `pda.rs`): `cfg_to_pda_topdown(&Grammar) -> Result<CfgToPda, Message>` with `CfgToPda { pda: Pda, states: Vec<StateName>, steps: Vec<CfgPdaStep> }`. `StateName { id, name }` is new and small (the editor will fold it into its document; do not reuse `JffState`, which carries canvas positions). Export the types to TypeScript like the other results (`ts.rs`).
- API: `cfg_to_pda_topdown(grammar_text)` in `api.rs` (same envelope as `transform_to_cnf`; a parse failure is `api.invalid_grammar`), the same in `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts` and `protocol.ts`, typed, with a handler test like the one for `transform_to_cnf`.
- Message keys `cfg_pda.top_down.start`, `.rule`, `.terminal` and `pda.cfg.symbol_clash` get `id` and `en` texts, under the same coverage rule as the other `pda.*` and `grammar.*` keys (use `grep` to see how those are covered, and what `pnpm check:strings` demands). Indonesian terms come from `docs/glossary.md` (stack, rule, variable, terminal); if one is missing, add it with `TODO(review)` and say so in the report.
- `docs/decisions/0037-cfg-to-pda-topdown.md` (decisions 1 to 7, and the note that a PDA from a grammar with multi-character variables cannot be exported to JFLAP: `jff.symbol_not_single_character`, T-032) and one line in the docs where the engine's conversions are listed.
- Tests, written first, from the fixtures below.

**Non-goals (out):**

- No UI, no panel, no button (T-033, T-038). No bottom-up conversion (T-035), no PDA to grammar (T-036, T-037). No normalization of the grammar first. No structure comparison with JFLAP's own conversion (`pda_cfg_anbn_LL.jff` uses JFLAP's bottom marker `Z`, which we do not have). No minimizing or tidying of the resulting PDA. No new budget type.
- Do not copy text from `REFERENCES/` into a commit.

**Files expected to touch:** `crates/engine-core/src/cfg_pda.rs` (new), `lib.rs`, `api.rs`, `ts.rs`, `crates/engine-core/tests/cfg_pda.rs` (new), `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts`, `protocol.ts`, `handlers.test.ts`, the generated types, `id.ts` and `en.ts`, `docs/decisions/0037-cfg-to-pda-topdown.md`, the docs line, `docs/agent/REPORT.md`.

**Design reference:** none (no screen). Slides: Slide13, page 4.

**Fixtures and hand derivations (the planner derived them; the worker redoes them in `REPORT.md` before any test runs; if the engine disagrees, stop and report):**

- _F1, `S -> aSb | ab` (the language `aⁿbⁿ`, `n ≥ 1`)._ Input alphabet `["a","b"]`; stack alphabet `["S","a","b"]`. `states` `[p, q]`, `start` `p`, `accepting` `[q]`, `kind` `ndpda`. Five steps and five transitions, as `from → to, read, pop, push`:
  1. `p → q, ε, [], [S]` (start)
  2. `q → q, ε, [S], [a, S, b]` (rule `S -> aSb`)
  3. `q → q, ε, [S], [a, b]` (rule `S -> ab`)
  4. `q → q, a, [a], []` (terminal `a`)
  5. `q → q, b, [b], []` (terminal `b`)

  The messages are `start`, `rule { rule: "S -> aSb" }`, `rule { rule: "S -> ab" }`, `terminal { symbol: "a" }`, `terminal { symbol: "b" }`. `validate_pda` gives no issue. A run of `aabb` by hand: `(p, aabb, [])`, transition 1 gives `(q, aabb, [S])`; the accepting path is: rule 2 gives `[a, S, b]`, read `a` gives `[S, b]`, rule 3 gives `[a, b, b]`, read `a` gives `[b, b]`, read `b` gives `[b]`, read `b` gives `[]` with the input used up in `q`: **accepted**. Rejected: `ε` (the stack is `[S]` after step 1, never empty with the input used up), `a`, `b`, `aab`, `abb`, `ba`. `pda_determinism` reports one competition: transitions 2 and 3 (same state, both read ε, equal pops).

- _F2, `S -> aSb | ε`._ Three rules → one start, two rules, two terminals: five steps. The ε-rule is `q → q, ε, [S], []` and its message is `rule { rule: "S -> ε" }`. The language is `aⁿbⁿ`, `n ≥ 0`: **`ε` is accepted** (by hand: `[S]`, then the ε-rule empties the stack in `q` with the input used up).
- _F3, two variables: `S -> AB`, `A -> aA | a`, `B -> bB | b` (the language `aⁱbʲ`, `i, j ≥ 1`)._ Input alphabet `["a","b"]`; stack alphabet `["A","B","S","a","b"]`. Eight transitions: start, five rules (`S -> AB` pushes `[A, B]`; `A -> aA` pushes `[a, A]`; `A -> a` pushes `[a]`; `B -> bB` pushes `[b, B]`; `B -> b` pushes `[b]`), two terminals. `A` is on top of `B`, so the `a`s are read first.
- _F4, left recursion: `S -> S a | b` (the language `b aⁿ`)._ The conversion is fine (one start, two rules, two terminals: five transitions; `S -> S a` pushes `[S, a]`). The simulator, for the input `ab` and the budget `{ maxSteps: 10000, maxConfigurations: 20000, maxStack: 20 }`, gives `Stopped` with reason `max_stack` (the `S` branch grows by one symbol at each level, and the `b` branch dies on the first symbol); the input `baa` is accepted. This documents that top-down parsing with a left-recursive grammar needs the budget.
- _F5, other cases._ `S -> a | a` gives three transitions (start, one rule, one terminal) and three steps: the duplicate is merged. A grammar whose start variable has no rule cannot be written in the text format; the parser's own error stands. `S -> a<a>` (variable `a` and terminal `a`) gives `pda.cfg.symbol_clash { symbol: "a" }`. A rule with a right-hand side of 65 symbols gives `machine.limit_exceeded` with `what: "pda_string"`. A variable named `S0` (`S0 -> aS0b | ab`) works: the stack alphabet is `["S0","a","b"]`, the rule transition pushes `[a, S0, b]`, and `export_pda_jff` of the result gives `jff.symbol_not_single_character { symbol: "S0" }`. For F1 the export works, and importing it again gives the same transitions by name.
- _Equivalence by simulation (the main test)._ For F1, F2, F3: every string over `{a, b}` of length 0 to 8 (511 strings) is accepted by the PDA (T-031, default budget) iff it is in the language. Two oracles, which must agree with each other and with the PDA: (a) a short hand-written predicate for each language (`aⁿbⁿ`, `n ≥ 1`; `aⁿbⁿ`, `n ≥ 0`; `a⁺b⁺`); (b) the existing code: `CnfTransformer::transform` on the grammar, then `CykParser::parse` on the final grammar (it handles `ε`). A test that the two oracles agree on all 511 strings comes first, so a wrong oracle is found before it can hide a wrong PDA.

**Acceptance criteria:**

- AC1: F1 to F5 give exactly the alphabets, states, transitions, steps, messages and issues above.
- AC2: the equivalence test for F1, F2, F3 passes with both oracles, and the F4 budget case gives `Stopped` / `max_stack`.
- AC3: `proptest`: for random small grammars (one to three variables out of `S`, `A`, `B`, one to four rules each, bodies of zero to three symbols from `{a, b, S, A, B}`), the conversion either succeeds or gives one of the messages of decision 4; when it succeeds, `validate_pda` has no issue **other than** `pda.pop_never_pushed` (it can appear for a variable or terminal that only an unreachable rule pushes), the number of steps equals `1 + distinct rules + terminals`, and the PDA accepts every string up to length 5 that the CNF and CYK oracle accepts and rejects every one that it rejects (when the simulation says `Stopped` for a left-recursive case, skip that string and count the skips; the test fails if more than half are skipped).
- AC4: the error cases in F5 give exactly those keys and parameters; nothing panics on arbitrary text (`proptest` with arbitrary strings fed to the API function).
- AC5: deliberate breaks, each shown failing, then restored: push the right-hand side reversed (F1 and the equivalence test fail); drop the ε-rule transition (F2 fails: `ε` is rejected); do not add the terminal transitions (everything is rejected); make `p` accepting too (the F1 `ε` rejection fails); keep duplicate rules (the F5 duplicate test fails); do not sort the stack alphabet (the F1 order assertion fails).
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

**Depends on:** T-030 and T-031 (merged), T-032 (merged; used only by the F5 export test).

**Notes for worker:** The equivalence test is the contract: it is what makes the conversion trustworthy, so write it first and look at it fail on a broken conversion before you write the conversion. Quote constants and message keys from the code in your summary, not from memory. If a derivation above disagrees with the engine, stop and report.

---

## Task T-035 — CFG to PDA, bottom-up

**Status:** done
**Commit:** `b446940`
**PR:** #159
**Owner:** worker
**Branch:** `task/T-035-cfg-to-pda-bottomup`

**Goal:** The slides' `CFGtoPDAbottomup` (Slide13, page 8), with a step trace, next to the top-down conversion of T-034. From a context-free grammar the engine builds a PDA that accepts the same strings by shift and reduce: it reads input symbols onto the stack, and whenever the top of the stack holds the right-hand side of a rule, it replaces that by the left-hand side. Engine only: no screen (T-033 is the editor, T-038 the panel).

**The algorithm (Slide13, page 8; the order below is the order of the trace):**

1. Shift, for every terminal `c`: `((p, c, ε), (p, c))`: from `p` to `p`, read `c`, pop nothing, push `c`.
2. Reduce, for every rule `X → γ1…γn`: `((p, ε, (γ1…γn)ᴿ), (p, X))`: pop `γn`, …, `γ1` (the stack is read top first, and the top is `γn`, the symbol that was put on the stack last), push `X`. So `pop = [γn, …, γ1]` and `push = [X]`. An ε-rule pops nothing: `pop = []`, `push = [X]`.
3. Accept: `((p, ε, S), (q, ε))`: from `p` to `q`, read nothing, pop `S`, push nothing.

The PDA accepts when the input is used up, the stack is empty and the state is `q` (T-030, T-031). The stack starts empty. The only way to reach `q` is step 3, which leaves the stack empty only if `S` was alone on the stack.

**Decisions (the planner made them from the slides and the code; do not reopen, ask if one looks wrong):**

1. **Same inputs, alphabets, states and errors as T-034.** The grammar is parsed with `GrammarParser` (8192 characters, `api.invalid_grammar`) and not normalized first. Input alphabet: the sorted terminals. Stack alphabet: all variables and terminals, one list sorted by name (byte order). `p` is `StateId(0)` (start), `q` is `StateId(1)` (accepting), `kind` is `ndpda`, `states` is `[{ id: 0, name: "p" }, { id: 1, name: "q" }]`. A variable that has the same name as a terminal gives `pda.cfg.symbol_clash { symbol }`. A body longer than `MAX_PDA_STRING` gives the `machine.limit_exceeded` message. Duplicate rules are merged, the first one stays. No new message keys for these.
2. **Share the code with T-034, do not copy it.** Both conversions build the same alphabets, run the same name-clash check, merge duplicates the same way and return the same `CfgToPda` type (with `CfgPdaStep` and `StateName`). Put the second conversion in `cfg_pda.rs` and move what they share into private helpers in that file; split the file only if it passes about 400 lines. T-034's behavior, tests and results do not change (its tests must pass unchanged).
3. **Trace.** `steps: Vec<CfgPdaStep>` in this order: one shift step for each terminal (sorted by character), one reduce step for each distinct rule (grammar order), and the accept step last. Each step has the new `transition` in wire form (names) and a message. Keys: `cfg_pda.bottom_up.shift { symbol }`, `cfg_pda.bottom_up.reduce { rule }` (`rule` is the production as `Production`'s `Display` gives it, `S -> aSb`, `S -> ε`) and `cfg_pda.bottom_up.accept` (no parameters). Steps and the sorted transitions of the PDA are matched by value, as in T-034.
4. **No budget in the conversion.** It is linear: `terminals + distinct rules + 1` steps. The loops belong to the simulation: see the next decision.
5. **When the simulation can loop.** A reduce for a rule with a non-empty body never makes the stack deeper than the number of shifts so far (it pops at least one symbol and pushes one), so for a grammar **without ε-rules** the simulation of any input is finite: it ends `Finished`, never `Stopped`. An ε-rule gives a reduce that pops nothing and pushes `X`, which can happen at every level, so with an ε-rule the stack can grow without end, and a string that is **not** in the language is usually `Stopped` (reason `max_stack` or `max_configurations`), not `Finished` with `accepted: false`; a string that **is** in the language is still found (the search is breadth-first). Say this in the ADR. The engine does nothing about it (the budget of T-031 is the answer); the UI of T-038 will explain a `Stopped` result.

**Scope (in):**

- In `crates/engine-core/src/cfg_pda.rs`: `cfg_to_pda_bottomup(&Grammar) -> Result<CfgToPda, Message>` and the shared helpers; T-034's function keeps its name and signature. Types are the existing ones, so no new TypeScript type is expected (check that the generated types do not change).
- API: `cfg_to_pda_bottomup(grammar_text)` in `api.rs` (same envelope as `cfg_to_pda_topdown`), and the same in `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts` and `protocol.ts`, typed, with a handler test like the one for `cfg_to_pda_topdown`.
- Message keys `cfg_pda.bottom_up.shift`, `.reduce`, `.accept` get `id` and `en` texts under the same coverage rule as the top-down keys. Indonesian terms from `docs/glossary.md` (shift and reduce: check how the glossary and the slides name them; if a term is missing, add it with `TODO(review)` and say so in the report; do not invent one).
- `docs/decisions/0038-cfg-to-pda-bottomup.md` (decisions 1 to 5; the note on ε-rules and `Stopped`; the note that grammars with multi-character variables cannot be exported to JFLAP, as in ADR 0037) and one line in the docs where the conversions are listed.
- Tests, written first, from the fixtures below.

**Non-goals (out):**

- No UI, no panel (T-033, T-038). No change to T-034's results. No LR table, no lookahead, no deterministic parser. No normalization of the grammar. No new budget type. No tidying of the result PDA. No structure comparison with JFLAP's `pda_cfg_anbn_LR.jff` (it uses JFLAP's bottom marker `Z`).
- Do not copy text from `REFERENCES/` into a commit.

**Files expected to touch:** `crates/engine-core/src/cfg_pda.rs`, `lib.rs`, `api.rs`, `crates/engine-core/tests/cfg_pda_bottomup.rs` (new; T-034's test file stays as it is, and the two may share nothing but the grammar texts), `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts`, `protocol.ts`, `handlers.test.ts`, `id.ts` and `en.ts`, `docs/decisions/0038-cfg-to-pda-bottomup.md`, `docs/ARCHITECTURE.md` (the conversion list), `docs/agent/REPORT.md`.

**Design reference:** none (no screen). Slides: Slide13, page 8.

**Fixtures and hand derivations (the planner derived them; the worker redoes them in `REPORT.md` before any test runs; if the engine disagrees, stop and report):**

- _F1, `S -> aSb | ab`._ Input alphabet `["a","b"]`; stack alphabet `["S","a","b"]`; five transitions, five steps, as `from → to, read, pop, push`:
  1. `p → p, a, [], [a]` (shift `a`)
  2. `p → p, b, [], [b]` (shift `b`)
  3. `p → p, ε, [b, S, a], [S]` (reduce `S -> aSb`: the top is `b`, then `S`, then `a`)
  4. `p → p, ε, [b, a], [S]` (reduce `S -> ab`)
  5. `p → q, ε, [S], []` (accept)

  Messages: `shift { symbol: "a" }`, `shift { symbol: "b" }`, `reduce { rule: "S -> aSb" }`, `reduce { rule: "S -> ab" }`, `accept`. `validate_pda` gives no issue (every popped symbol is pushed by a transition that can fire). By hand, `aabb`: shift `a` gives `[a]`; shift `a` gives `[a, a]`; shift `b` gives `[b, a, a]`; reduce `S -> ab` pops `b`, `a` and pushes `S`: `[S, a]`; shift `b` gives `[b, S, a]`; reduce `S -> aSb` gives `[S]`; accept gives `[]` in `q` with the input used up: **accepted**. `ab` is accepted in four moves (shift, shift, reduce 4, accept). Rejected: `ε`, `a`, `b`, `aab`, `abb`, `ba` (all `Finished`, none `Stopped`: the grammar has no ε-rule).

- _F2, an ε-rule: `S -> aSb | ε`._ Three transitions for terminals and rules plus the accept: shifts `a`, `b`; reduce `S -> aSb` as in F1 (`pop [b, S, a]`, `push [S]`); reduce `S -> ε` as `p → p, ε, [], [S]` (message `reduce { rule: "S -> ε" }`); accept: five steps. By hand, `ε` is accepted: reduce `S -> ε` gives `[S]`, accept gives `[]`. `ab`: shift `a` `[a]`; reduce `S -> ε` `[S, a]`; shift `b` `[b, S, a]`; reduce `S -> aSb` `[S]`; accept: **accepted**. The language is `aⁿbⁿ`, `n ≥ 0`.
- _F3, two variables: `S -> AB`, `A -> aA | a`, `B -> bB | b` (`a⁺b⁺`)._ Eight transitions: shifts `a`, `b`; reduces `S -> AB` (`pop [B, A]`, `push [S]`), `A -> aA` (`pop [A, a]`, `push [A]`), `A -> a` (`pop [a]`, `push [A]`), `B -> bB` (`pop [B, b]`, `push [B]`), `B -> b` (`pop [b]`, `push [B]`); accept. By hand, `ab`: shift `a` `[a]`; reduce `A -> a` `[A]`; shift `b` `[b, A]`; reduce `B -> b` `[B, A]`; reduce `S -> AB` `[S]`; accept: **accepted**. No ε-rule, so every simulation is `Finished`.
- _F4, cases for the errors, as in T-034._ `S -> a | a` gives three steps (one shift, one reduce, the accept) and three transitions: the duplicate is merged. `S -> a<a>` gives `pda.cfg.symbol_clash { symbol: "a" }`. A body of 65 symbols gives `machine.limit_exceeded` with `what: "pda_string"`. A variable `S0` works: the stack alphabet is `["S0","a","b"]`, the reduce of `S0 -> aS0b` pops `[b, S0, a]`, and `export_pda_jff` gives `jff.symbol_not_single_character { symbol: "S0" }`. The F1 PDA exports, and importing it again gives the same transitions by name.
- _F5, ε-rules and the budget (decision 5)._ For F2, with the budget `{ maxSteps: 200, maxConfigurations: 20000, maxStack: 12 }`, every string over `{a, b}` of length 0 to 4 (31 strings): a string in `aⁿbⁿ` is `Finished` and accepted; a string that is not in it is either `Finished` with `accepted: false` or `Stopped`, **never accepted**. The planner expects most of the rejected ones to be `Stopped`; the worker counts both kinds and reports the numbers. If a string of the language is `Stopped` under this budget, do not raise the budget silently: report the string and the numbers.
- _Equivalence by simulation (the main test)._ For F1 and F3 (no ε-rule): every string over `{a, b}` of length 0 to 8 (511 strings) is accepted by the PDA (T-031, default budget, and the result is always `Finished`) iff it is in the language. Three oracles that must all agree: (a) the hand predicate (`aⁿbⁿ`, `n ≥ 1`; `a⁺b⁺`); (b) the CNF + CYK code, as in T-034; (c) the top-down PDA of T-034 for the same grammar. A test that oracles (a) and (b) agree comes first (T-034's test file has such a test; write your own for these two languages, do not import from it).

**Acceptance criteria:**

- AC1: F1 to F4 give exactly the alphabets, states, transitions, steps, messages and issues above; T-034's tests pass unchanged.
- AC2: the 511-string equivalence tests pass for F1 and F3 against all three oracles, with every result `Finished`; F5 holds.
- AC3: two `proptest`s on random small grammars (one to three variables out of `S`, `A`, `B`, one to four rules each, symbols from `{a, b, S, A, B}`):
  (i) **without ε-rules** (bodies of one to three symbols): the conversion succeeds or gives one of the three messages of decision 1; when it succeeds, the number of steps is `terminals + distinct rules + 1`, `validate_pda` gives no issue other than `pda.pop_never_pushed`, and for every string up to length 5 the simulation is `Finished` (never `Stopped`) and its answer equals the CYK answer on the CNF form;
  (ii) **with ε-rules allowed** (bodies of zero to three symbols): for every string up to length 4, if the simulation is `Finished` its answer equals the CYK answer; if it is `Stopped`, skip the string; and **no string that CYK rejects is ever accepted by the PDA**. There is no "skipped" threshold in (ii), so the test cannot be flaky.
- AC4: the error cases in F4 give exactly those keys and parameters; nothing panics on arbitrary text fed to the API function (`proptest`).
- AC5: deliberate breaks, each shown failing, then restored: do not reverse the reduce pop list (F1 and the equivalence test fail); do not add the accept transition (everything is rejected); make `p` accepting too (`ε` is accepted for F1: the F1 rejection list fails); shifts push nothing (everything fails); keep duplicate rules (the duplicate test fails); change the accept transition to pop nothing (`q` is then reached with an empty stack at the start, so `ε` is accepted: the F1 rejection list fails); stack alphabet not sorted (the order assertion fails); in (ii) of AC3, accept every string when the simulation is `Stopped` (the proptest fails: show a counterexample).
- AC6: `wasm` stays under 250 KB gzip and the initial JS under 170 KB (`pnpm size`); report the wasm size before and after.

**Verification:**

```
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
pnpm build:wasm
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
```

Run the two proptests of AC3 with `PROPTEST_CASES=1000` three times in a row and paste the three result lines (T-034 showed that 50 cases hide flaky tests). No e2e (no UI). Paste real output into `REPORT.md`.

**Rollback:** `git revert <sha>`. Nothing reads the new code yet.

**Depends on:** T-034 (merged), T-031 and T-032 (merged; T-032 is used only by the F4 export test).

**Notes for worker:** The reduce pop list is reversed and top first: `S -> aSb` pops `[b, S, a]`. Getting this backwards is the likeliest bug, and F1 and F3 catch it. The refactor of the shared helpers must not change a single result of T-034: run its tests first, and again after. No `unwrap` or `expect` in non-test code. Quote names, keys and numbers from the code in your summary, not from memory. If a derivation above disagrees with the engine, stop and report.

---

## Task T-036 — PDA to restricted normal form, with a trace

**Status:** done
**Commit:** `bb7993d`
**Owner:** worker
**Branch:** `task/T-036-pda-to-rnf`

**Goal:** The slides' conversion of a PDA to **restricted normal form** (RNF; Slide13, pages 13 to 19), with a step trace. This is the first half of "PDA to CFG": T-037 turns an RNF machine into a grammar. A student sees the new start state, the new single accepting state, and every transition that is split or expanded so that each one pops exactly one symbol. Engine only: no screen (T-033 is the editor, T-038 the panel).

**What RNF is (Slide13, page 14):** a PDA is in RNF iff (1) its start state `s'` only pushes the bottom marker `#` and moves to the state where the computation starts; (2) it has one accepting state `a`, and every transition into `a` reads nothing and pops `#`; (3) every transition except the one from `s'` pops exactly one symbol.

**The algorithm (Slide13, pages 15 to 17), for a PDA `M = (K, Σ, Γ, Δ, s, A)`:**

1. `Γ' = Γ ∪ {#}`, `A' = {a}`, `K' = K ∪ {s', a}` (new states), `Δ' = Δ` at first.
2. Add `((s', ε, ε), (s, #))`.
3. For every `qk ∈ A`, add `((qk, ε, #), (a, ε))`.
4. **PRNF-4, multi-pop.** Replace each transition `((q1, c, γ1…γn), (q2, γP))` with `n ≥ 2` by `n` single-pop transitions through `n − 1` new states `v1, …, v(n−1)`: `((q1, ε, γ1), (v1, ε))`, `((v1, ε, γ2), (v2, ε))`, …, `((v(n−1), c, γn), (q2, γP))`. The input symbol `c` is read by the **last** one (as on the slide); the first `n − 1` read nothing.
5. **PRNF-5, pop nothing.** Replace each transition `((q1, c, ε), (q2, γ))` by one transition for every `Γ0 ∈ Γ'`: `((q1, c, Γ0), (q2, γ Γ0))` (it pops `Γ0` and pushes `γ` with `Γ0` underneath again; page 19: `((s, a, #), (s, a#))`). The transition added in step 2 is not touched (it is the one exception).
   Transitions that already pop one symbol stay as they are.

**In our model** (T-030): `pop` and `push` are lists, top first. So `γ Γ0` is the list `push ++ [Γ0]` (the pushed symbols first, `Γ0` after them), and `pop = [γ1, …, γn]` is popped one symbol at a time from the front. The acceptance rule of T-030 (input used up, stack empty, accepting state) fits RNF: the machine reaches `a` only by popping `#`, the last symbol, so the stack is empty there.

**Decisions (the planner made them from the slides and the code; do not reopen, ask if one looks wrong):**

1. **Input.** `pda_to_rnf(pda_json)` takes a PDA in the JSON of T-030 (as `load_pda` does) and converts it as it is, whether `validate_pda` has warnings or not. A PDA without a start state gives `pda.rnf.no_start_state`. A PDA whose stack alphabet already has the symbol `#` gives `pda.rnf.marker_clash { symbol: "#" }` (the slides assume `# ∉ Γ`).
2. **Symbols.** The input alphabet and its symbol ids do not change. The stack alphabet is the old one with `"#"` **appended** at the end (not sorted), so every old stack symbol keeps its id. Expansions (step 5) go over `Γ'` in id order, so `#` comes last. A stack alphabet that is already full (`MAX_SYMBOLS`) gives the `machine.limit_exceeded` message of `Alphabet::new` (`what: "symbols"`).
3. **New states.** Ids: with `m` the largest state id of `M`, `s' = m + 1`, `a = m + 2`, and the split states `m + 3`, `m + 4`, … in the order in which they are created (step 4, below). Use checked arithmetic: an overflow of `u32` gives `machine.limit_exceeded` (`what: "states"`). The result returns the new states with suggested names as plain data: `new_states: [{ id, name }]`, named `s'`, `a`, then `v1`, `v2`, … (numbered across the whole machine, not per transition, so names never repeat; the UI may rename them if they clash with its own). The names of the old states belong to the UI document and are not returned.
4. **Order (and so the trace).** (a) step 2; (b) step 3, one for each accepting state of `M` in ascending state id; (c) step 4, going through the transitions of `M` in the order that `Pda::new` sorts them, only the ones with `pop.len() ≥ 2`; (d) step 5, again in that order, only the ones with `pop.len() == 0`. Single-pop transitions are copied without a step. The `transitions` of the result `Pda` are sorted by `Pda::new`, so steps and transitions are matched by value, not by index.
5. **Result.** `kind` is `ndpda`, `start` is `s'`, `accepting` is `[a]`. The result is a plain `Pda` (T-030), so `validate_pda`, `simulate_pda` and the JFLAP export (T-032) work on it.
6. **Limits.** There is no budget (the construction is finite); the machine limits of `Pda::new` apply (`MAX_STATES`, `MAX_TRANSITIONS`, `MAX_PDA_STRING`) and come back as its `machine.limit_exceeded` message. Do not add a new limit.
7. **Trace.** `steps: Vec<RnfStep>`, where `RnfStep { removed: Option<PdaTransition>, added: Vec<PdaTransition>, message }` (transitions in wire form, as names for stack and input symbols and numbers for states). Step 2: `removed: None`, one added, key `pda.rnf.start`. Step 3: `removed: None`, one added, key `pda.rnf.accept { state }` (`state` is the old accepting state id). Step 4: `removed` is the original, `added` has the `n` new ones in order, key `pda.rnf.split { from, to, pops }` (`from` and `to` are the state ids of the original, `pops` is `n`). Step 5: `removed` is the original, `added` has one transition for each symbol of `Γ'` in id order, key `pda.rnf.expand { from, to }`. The engine writes no sentences.

**Scope (in):**

- New `crates/engine-core/src/pda_rnf.rs`: `pda_to_rnf(&Pda) -> Result<RnfResult, Message>` with `RnfResult { pda: Pda, new_states: Vec<StateName>, steps: Vec<RnfStep> }`. Reuse `StateName` from `cfg_pda.rs` (move it to `pda.rs` if the dependency would otherwise point the wrong way; the exported TypeScript type keeps its name). TypeScript types for `RnfResult` and `RnfStep` are exported like the other results (`ts.rs`).
- API: `pda_to_rnf(pda_json)` in `api.rs` (same envelope as `load_pda`), the same in `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts` and `protocol.ts`, typed, with a handler test like the one for `cfg_to_pda_topdown`.
- Message keys `pda.rnf.start`, `.accept`, `.split`, `.expand`, `pda.rnf.no_start_state` and `pda.rnf.marker_clash` get `id` and `en` texts under the same coverage rule as the `cfg_pda.*` keys. Use the slides' own term "restricted normal form (RNF)" and the glossary's words (stack, state, transition); the glossary has no entry for them yet, so add the ones you need to `docs/glossary.md` with `TODO(review)` and say so in the report. Do not invent Indonesian terms.
- `docs/decisions/0039-pda-to-rnf.md` (decisions 1 to 7 and the reading of the slide that the first `n − 1` split transitions read nothing) and one line in `docs/ARCHITECTURE.md`.
- Tests, written first, from the fixtures below.

**Non-goals (out):**

- No RNF to grammar (T-037). No UI (T-033, T-038). No simplifying of the result (for example dropping `#`-expansions that can never fire): the student sees the algorithm as the slides give it. No check "is this PDA already in RNF" (T-037 decides whether it needs one). No conversion from the acceptance modes of other textbooks. No new budget type.
- Do not copy text from `REFERENCES/` into a commit.

**Files expected to touch:** `crates/engine-core/src/pda_rnf.rs` (new), `lib.rs`, `api.rs`, `ts.rs`, `crates/engine-core/tests/pda_rnf.rs` (new), `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts`, `protocol.ts`, `handlers.test.ts`, the generated types, `id.ts` and `en.ts`, `docs/glossary.md`, `docs/decisions/0039-pda-to-rnf.md`, `docs/ARCHITECTURE.md`, `docs/agent/REPORT.md`, and `cfg_pda.rs` only if `StateName` moves.

**Design reference:** none (no screen). Slides: Slide13, pages 13 to 19.

**Fixtures and hand derivations (the planner derived them; the worker redoes them in `REPORT.md` before any test runs; if the engine disagrees, stop and report):**

- _F1, the slides' example: `wcwᴿ`, `w ∈ {a, b}*`._ `M`: states `0` (start, `s`) and `1` (`f`, accepting); input alphabet `["a","b","c"]`; stack alphabet `["a","b"]`; transitions as `from → to, read, pop, push`: `0→0, a, [], [a]`; `0→0, b, [], [b]`; `0→1, c, [], []`; `1→1, a, [a], []`; `1→1, b, [b], []`. (It pushes `w`, so `w` is on the stack with its last symbol on top; after `c` it pops `wᴿ`.) The conversion gives: `s' = 2`, `a = 3`, `new_states` `[{2, "s'"}, {3, "a"}]`, stack alphabet `["a","b","#"]`, `kind` `ndpda`, `start` `2`, `accepting` `[3]`, and **13 transitions**: `2→0, ε, [], [#]`; `1→3, ε, [#], []`; the two single-pop ones kept (`1→1, a, [a], []` and `1→1, b, [b], []`); and nine expanded ones, for each `Γ0` in `a, b, #`: `0→0, a, [Γ0], [a, Γ0]`; `0→0, b, [Γ0], [b, Γ0]`; `0→1, c, [Γ0], [Γ0]`. The trace has **5 steps** in this order: `start`, `accept { state: 1 }`, then three `expand` steps for the transitions `0→0 a`, `0→0 b`, `0→1 c` (each `removed` is the original, each `added` has 3 transitions in the order `a, b, #`; for example the first has `[a],[a,a]`, `[b],[a,b]`, `[#],[a,#]`). There is no `split` step. This is the slide's "three non-pop transitions become nine" (page 19). `validate_pda` of the result gives no issue. Language: for the 3280 strings over `{a, b, c}` of length 0 to 7, `M'` accepts a string iff `M` does iff it is `w c wᴿ`; by hand, `c` is accepted by `M'`: `(2, c, [])`, `2→0` gives `(0, c, [#])`, `0→1` reading `c` with `#` on top gives `(1, ε, [#])`, `1→3` gives `(3, ε, [])`: accepted. `ab` and `cc` are rejected.
- _F2, multi-pop: `aⁿbⁿ`, `n ≥ 1`, by popping two symbols at a time._ `M`: states `0` (start), `1` (accepting); input alphabet `["a","b"]`; stack alphabet `["A"]`; transitions: `0→0, a, [], [A, A]`; `0→1, b, [A, A], []`; `1→1, b, [A, A], []`. (Each `a` pushes two `A`s, each `b` pops two.) The conversion gives: `s' = 2`, `a = 3`, `new_states` `[{2,"s'"}, {3,"a"}, {4,"v1"}, {5,"v2"}]`, stack alphabet `["A","#"]`, and **8 transitions**: `2→0, ε, [], [#]`; `1→3, ε, [#], []`; the expansion of `0→0, a` for `Γ0 = A` and `Γ0 = #`: `0→0, a, [A], [A, A, A]` and `0→0, a, [#], [A, A, #]`; the split of `0→1, b, [A, A], []` through `v1 = 4`: `0→4, ε, [A], []` and `4→1, b, [A], []`; the split of `1→1, b, [A, A], []` through `v2 = 5`: `1→5, ε, [A], []` and `5→1, b, [A], []`. **Five steps:** `start`, `accept { state: 1 }`, `split { from: 0, to: 1, pops: 2 }`, `split { from: 1, to: 1, pops: 2 }`, `expand { from: 0, to: 0 }` (step 4 comes before step 5, and the splits go in the sorted order of the transitions). By hand, `aabb` is accepted: `2→0` `[#]`; read `a` with `#` on top gives `[A, A, #]`; read `a` with `A` on top gives `[A, A, A, A, #]`; `0→4` pops `A`, then `4→1` reads `b` and pops `A`: `[A, A, #]`; `1→5` and `5→1` read `b` and pop two `A`: `[#]`; `1→3` pops `#`: `[]` in `3`: **accepted**. `ab` is accepted; `ε`, `a`, `b`, `aab`, `abb` are rejected. Language: all 511 strings over `{a, b}` of length 0 to 8: `M'` accepts iff `M` does iff the string is `aⁿbⁿ`, `n ≥ 1`.
- _F3, a split of three, with a symbol read: shape only._ `M`: states `0` (start), `1` (accepting); input alphabet `["a"]`; stack alphabet `["W","X","Y","Z"]`; one transition `0→1, a, [X, Y, Z], [W]`. Result: `s' = 2`, `a = 3`, `v1 = 4`, `v2 = 5`, stack alphabet `["W","X","Y","Z","#"]`, five transitions: `2→0, ε, [], [#]`; `1→3, ε, [#], []`; `0→4, ε, [X], []`; `4→5, ε, [Y], []`; `5→1, a, [Z], [W]` (the `a` is read by the last one). Three steps: `start`, `accept { state: 1 }`, `split { from: 0, to: 1, pops: 3 }`. This pins the slide's reading (the input symbol on the last transition) and the order of the pops.
- _F4, small cases._ A PDA with **no accepting state**: no `accept` step, `accepting` is still `[a]`, and the result accepts nothing (the language is empty; every string is `Finished` and rejected). A PDA with **two accepting states** `1` and `2`: two `accept` steps, in the order `1`, `2`, with the transitions `1→a` and `2→a`. A transition `0→0, ε, [], []` (pops and pushes nothing): expanded into `|Γ'|` transitions `0→0, ε, [Γ0], [Γ0]`. A PDA whose start state has incoming transitions is converted like any other (`s'` is new and has none).
- _F5, errors._ No start state: `pda.rnf.no_start_state`. A stack alphabet that contains `#`: `pda.rnf.marker_clash { symbol: "#" }`. A stack alphabet of 256 symbols (`MAX_SYMBOLS`): `machine.limit_exceeded` with `what: "symbols"`, `limit: 256`. More new states than `MAX_STATES` allows: build `M` with one state and 32 different transitions that each pop 64 symbols (`MAX_PDA_STRING`; make them differ by their push), which needs `32 × 63 + 3 = 2019` new and old states, and expect `machine.limit_exceeded` with `what: "states"`, `limit: 2000` (check the exact message the code gives and quote it). Ids near the top of `u32` (a start state with id `4294967295`) give `machine.limit_exceeded` for states and no panic.
- _RNF shape (a helper in the test file, used by every conversion test):_ the result has exactly one accepting state `a`; the start state `s'` has exactly one transition, `read: ε`, `pop: []`, `push: [#]`; every transition into `a` reads ε and pops exactly `[#]` and pushes nothing; every other transition (not from `s'`) pops exactly one symbol; and `#` is pushed only by the transition from `s'` and the `#`-expansions. T-037 will want this check in the engine; for now it lives in the tests.

**Acceptance criteria:**

- AC1: F1 to F5 give exactly the states, alphabets, transitions, steps, messages and errors above.
- AC2: language equivalence by simulation: F1 over 3280 strings, F2 over 511 strings, `M'` against `M` (T-031, default budget, every result `Finished`) and against the hand predicates (`w c wᴿ`; `aⁿbⁿ`, `n ≥ 1`).
- AC3: `proptest` on random small PDAs (one to three states, input alphabet `{a, b}`, stack alphabet `{A, B}`, one to five transitions with pops and pushes of zero to three symbols, a random set of accepting states, a random start state): the result satisfies the RNF shape; the number of steps is `1 + accepting states + multi-pop transitions + non-pop transitions`; the number of transitions is `1 + accepting states + single-pop transitions + the sum of the pop lengths of the multi-pop transitions + (non-pop transitions × |Γ'|)`; and for every string over `{a, b}` up to length 4, simulate `M` with `{ maxSteps: 60, maxConfigurations: 5000, maxStack: 12 }` and `M'` with `{ maxSteps: 240, maxConfigurations: 20000, maxStack: 14 }`: if both are `Finished`, their answers are equal; if `M` is `Finished` and accepted, `M'` is not `Finished` and rejected; if `M'` is `Finished` and accepted, `M` is not `Finished` and rejected. There is no threshold on how many strings are skipped, so the test cannot be flaky; the exhaustive tests of AC2 are what shows that the conversion is not vacuous.
- AC4: nothing panics on arbitrary text fed to the API function (`proptest`), and on random PDAs with ids near the top of `u32`.
- AC5: deliberate breaks, each shown failing, then restored: pop the split transitions in the wrong order (F3 and F2 fail); read the symbol in the **first** split transition instead of the last (F3 fails; report whether the language tests also fail, they should not, and say what that shows); in step 5 push `Γ0 γ` instead of `γ Γ0` (F1 and the language tests fail); omit `#` from the expansion (F1 fails: 11 transitions, and the language tests fail on strings that need `#`); make the accept transition pop nothing (F1 fails; `c` is then rejected because `#` stays on the stack, so the language tests fail too); accept in `s'` as well (make `s'` accepting: the RNF shape test fails); do not append `#` last but sort the stack alphabet (F1 fails on the alphabet order); give split states ids in the wrong order (F2 fails on the ids and the trace).
- AC6: `wasm` stays under 250 KB gzip and the initial JS under 170 KB (`pnpm size`); report the wasm size before and after.

**Verification:**

```
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
pnpm build:wasm
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
```

Run the AC3 proptest with `PROPTEST_CASES=1000` three times in a row and paste the three result lines. No e2e (no UI). Paste real output into `REPORT.md`.

**Rollback:** `git revert <sha>`. Nothing reads the new code yet.

**Depends on:** T-030 and T-031 (merged). T-034 and T-035 are independent of this task; `StateName` comes from T-034 (merged).

**Notes for worker:** Three easy mistakes: (1) the split reads the input symbol on the **last** transition, not the first; (2) in the expansion the old stack symbol goes **under** the pushed ones (`push ++ [Γ0]`, top first); (3) `#` is appended last in the stack alphabet and goes last in the expansion. The language tests are the contract: write them first and look at them fail on a broken conversion. No `unwrap` or `expect` in non-test code. Quote names, keys and numbers from the code in your summary, not from memory; your REPORT.md, not your chat summary, is the record. If a derivation above disagrees with the engine, stop and report.

---

## Task T-037 — PDA in restricted normal form to CFG, with a trace

**Status:** done
**Owner:** worker
**Branch:** `task/T-037-pda-to-cfg`

**Goal:** The slides' `PDAtoCFG` (Slide13, pages 20 to 22): one variable for every triple (state, stack symbol, state), the start rule `S → <s,#,a>`, the rules `<q,ε,q> → ε`, and the rules of step S4 (A) for transitions that push nothing and (B) for transitions that push `n ≥ 1` symbols. Input is a PDA in restricted normal form (T-036 makes one); output is a grammar (T-034's `Grammar`), plus the step trace. Engine only: no screen (T-033 is the editor, T-038 the panel). The slides' own example (`wcwᴿ`, pages 23 to 27) is the oracle.

**The algorithm (Slide13, pages 21 and 22), for an RNF machine `M = (K, Σ, Γ, Δ, s', {a})`:**
1. The terminals are `Σ`.
2. `S → <s,#,a>`, where `s` is the state that the only transition of `s'` goes to, `#` is the symbol that transition pushes, and `a` is the accepting state.
3. For every state `q ≠ s'`: `<q,ε,q> → ε`.
4. **S4 (A), a transition `((q, c, γ), (r, ε))` that pushes nothing:** for every state `w ≠ s'`: `<q,γ,w> → c <r,ε,w>`. (`c` may be ε: then the body is only `<r,ε,w>`.) That is `k − 1` rules, with `k = |K|`.
5. **S4 (B), a transition `((q, c, γ), (r, γ1 … γn))` with `n ≥ 1`:** for every tuple of states `v1, …, vn ≠ s'`: `<q,γ,vn> → c <r,γ1,v1> <v1,γ2,v2> … <v(n−1),γn,vn>`. That is `(k − 1)ⁿ` rules. In our model (T-030) `push` is a list with the **top first**, so `γ1` is `push[0]`, exactly as on the slide (page 25: the transition `((s,a,b),(s,ab))` gives `<s,b,v2> → a <s,a,v1> <v1,b,v2>`).
6. The transition of `s'` gives no rule (only the start rule of step 2).

**Page 27 note:** the slide says 16 rules remain after cleanup, but its list shows 15 and the planner's own count of the 76 rules gives 15 (see F1). The list is the oracle, not the number.

**Decisions (the planner made them from the slides and the code; do not reopen, ask if one looks wrong):**
1. **Input.** `pda_to_cfg(pda_json)` takes a PDA in the JSON of T-030 and must be in RNF, checked in this order (the first failure is returned):
   (a) no start state: `pda_cfg.no_start_state`;
   (b) the start state `s'` must have exactly one transition, with `read: ε`, `pop: []` and `push` of exactly one symbol (the marker `#`); no transition goes into `s'`; and `s'` is not accepting: otherwise `pda_cfg.bad_start { state }` (`state` is the id of the start state);
   (c) exactly one accepting state `a`: otherwise `pda_cfg.not_one_accepting { count }`;
   (d) every transition into `a` reads ε, pops exactly `[#]` and pushes nothing: otherwise `pda_cfg.bad_accept { from }` (the first such transition, in the sorted order of `Pda::new`);
   (e) every transition not from `s'` pops exactly one symbol: otherwise `pda_cfg.not_single_pop { from, to }` (the first, in the same order);
   (f) every input symbol is **one character** that the grammar text can hold; otherwise `pda_cfg.terminal_not_readable { symbol }` (the first, in alphabet order). `Grammar` terminals are one `char`, and the grammar parser reads an ASCII uppercase letter, `<`, `[`, a space or other white space, `|`, `\`, `ε`, `λ` and `^` as something else than a terminal (the T-026 lesson: what the student sees must be what the parser reads back). These are rejected; every other single character is a terminal.
   `validate_pda` warnings do not matter. The check "is in RNF" stays inside this function (a helper `rnf_shape_error`, private; T-038 may export it later).
2. **Names.** The start symbol is `S`. Every other variable is `V_{q}g{k}p{p}`: `q` and `p` are the state ids in decimal, and `k` is the **id of the stack symbol** in decimal, or the letter `e` for ε. Examples: `V_0g2p3`, `V_1gep1`. The grammar parser reads exactly this shape (an uppercase letter, `_`, then letters and digits), reads it back as one name, and no name can equal `S`. The slide's `<q,γ,p>` is not usable: the parser reads `<…>` as a bracket, but the text writer of the web app (`grammarToText`) prints a name as it is, so `0,a,3` would come back as terminals. The engine knows no state names (they belong to the UI document), so the names use ids; the UI shows the slide's form from `variables` (decision 6).
3. **Rules and order.** The grammar's rules are the concatenation of the steps, in this order: (1) the start rule; (2) one block with the rules `<q,ε,q> → ε` for `q ≠ s'` in ascending state id; (3) one block for each transition that does not start at `s'`, in the order that `Pda::new` sorts the transitions. Inside a block of case (A) the rules go by `w` ascending; inside a block of case (B) by the tuple `(v1, …, vn)` ascending with `v1` the slowest and `vn` the fastest. `K` is all states of the PDA except `s'` (also the ones that no transition reaches, as the slide does). The terminal comes first in the body, as `Symbol::Terminal(c)`; when `read` is ε there is no terminal. The start symbol of the grammar is `S`. No rule appears twice (a transition and a tuple determine the rule).
4. **No cleanup.** The result is the grammar as the slides give it (76 rules for `wcwᴿ`); removing unreachable and non-productive rules is the job of the CNF phases (T-060). Do not simplify.
5. **Size limit.** The rule count grows as `(k − 1)ⁿ`. Before building any rule, compute the number of rules with checked `u64` arithmetic (`1 + (k − 1) + the sum over transitions not from s' of (k − 1)^max(n, 1)`, using `checked_pow` and `checked_add`); if it overflows or exceeds a new constant `MAX_PDA_CFG_RULES = 20_000`, return `machine.limit_exceeded { what: "rules", limit: 20000 }` (the helper `limit_exceeded` in `fsm.rs`). The check comes after the checks of decision 1. (T-036's review found that a limit checked after the work is no limit.)
6. **Result.** `PdaToCfg { grammar: Grammar, variables: Vec<CfgVariable>, steps: Vec<PdaCfgStep> }`. `CfgVariable { name: String, from: StateId, stack: Option<String>, to: StateId }` is one entry for each variable `V_…` that is the head of a rule or is in a body; `stack` is the stack symbol's **name** (`None` for ε). They are sorted by `(from, stack id with ε last, to)`. `PdaCfgStep { added: Vec<Production>, message: Message }`; keys: `pda_cfg.start` (no params; one rule), `pda_cfg.empty { count }` (the block of decision 3 (2); `count = k − 1`), `pda_cfg.push_none { from, to }` (case A) and `pda_cfg.push { from, to, pushes }` (case B; `pushes` is `n`). `from` and `to` are the state ids of the transition. The engine writes no sentences. The number of steps is `2 + (number of transitions not from s')`.

**Scope (in):**
- New `crates/engine-core/src/pda_cfg.rs`: `pda_to_cfg(&Pda) -> Result<PdaToCfg, Message>`, `MAX_PDA_CFG_RULES`, and the types above. TypeScript types for `PdaToCfg`, `CfgVariable` and `PdaCfgStep` are exported like the other results (`ts.rs`).
- API: `pda_to_cfg(pda_json)` in `api.rs` (same envelope as `pda_to_rnf`), the same as `pdaToCfg` in `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts` and `protocol.ts`, typed, with a handler test like the one for `pdaToRnf`.
- Message keys `pda_cfg.start`, `.empty`, `.push_none`, `.push`, `.no_start_state`, `.bad_start`, `.not_one_accepting`, `.bad_accept`, `.not_single_pop` and `.terminal_not_readable` get `id` and `en` texts under the same coverage rule as the `cfg_pda.*` and `pda.rnf.*` keys. Use the slides' words and the glossary's (stack, state, transition, grammar, variable); add what is missing to `docs/glossary.md` with `TODO(review)` and say so in the report. Do not invent Indonesian terms.
- `docs/decisions/0040-pda-to-cfg.md` (decisions 1 to 6, the reason for the names, and the 15-versus-16 note) and one line in `docs/ARCHITECTURE.md`.
- Tests, written first, from the fixtures below.

**Non-goals (out):**
- No UI (T-033, T-038). No cleanup or normalization of the result. No conversion of a PDA that is not in RNF (the caller uses `pda_to_rnf` first). No display name `<q,γ,p>` (T-038 builds it from `variables` and the state names). No new budget type: only the constant of decision 5. No change to `Grammar`, the parser or the CNF code.
- Do not copy text from `REFERENCES/` into a commit.

**Files expected to touch:** `crates/engine-core/src/pda_cfg.rs` (new), `lib.rs`, `api.rs`, `ts.rs`, `crates/engine-core/tests/pda_cfg.rs` (new), `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts`, `protocol.ts`, `handlers.test.ts`, the generated types, `id.ts` and `en.ts`, `docs/glossary.md`, `docs/decisions/0040-pda-to-cfg.md`, `docs/ARCHITECTURE.md`, `docs/agent/REPORT.md`.

**Design reference:** none (no screen). Slides: Slide13, pages 20 to 29.

**Fixtures and hand derivations (the planner derived them and checked the counts with a script; the worker redoes them in `REPORT.md` before any test runs; if the engine disagrees, stop and report):**

- *F1, the slides' example `wcwᴿ`.* The input is the result of `pda_to_rnf` on F1 of T-036 (build it in the test with `pda_to_rnf`, do not copy the JSON): states `0` (`s`), `1` (`f`), `2` (`s'`), `3` (`a`); stack alphabet `["a","b","#"]` (ids 0, 1, 2); input alphabet `["a","b","c"]`; 13 transitions, 12 of them not from `s'`. So `K = {0, 1, 3}`, `k − 1 = 3`, the marker is `#` (id 2). Expected: **76 rules** (1 + 3 + 9 + 54 + 9: the start rule, the three ε rules, nine rules for the three transitions that push nothing, fifty-four for the six double pushes, nine for the three single pushes) and **14 steps**. The steps in order: `start`; `empty { count: 3 }`; then the 12 transitions in sorted order: `0→0` reading `a` with pop `[a]`, `[b]`, `[#]` (each `push { from: 0, to: 0, pushes: 2 }`, 9 rules); the same for reading `b` (9 rules each); `0→1` reading `c` with pop `[a]`, `[b]`, `[#]` (each `push { from: 0, to: 1, pushes: 1 }`, 3 rules); then `1→3` reading ε with pop `[#]` (`push_none { from: 1, to: 3 }`, 3 rules), `1→1` reading `a` with pop `[a]` and `1→1` reading `b` with pop `[b]` (each `push_none { from: 1, to: 1 }`, 3 rules). The start rule is `S → V_0g2p3`. The ε block is `V_0gep0 → ε`, `V_1gep1 → ε`, `V_3gep3 → ε`. The first rules of some blocks, to pin the order and the push order: the first transition (`0→0, a, [a], [a, a]`) gives, for `(v1, v2)` = `(0,0)`, `(0,1)`, `(0,3)`, `(1,0)`, …: `V_0g0p0 → a V_0g0p0 V_0g0p0`, `V_0g0p1 → a V_0g0p0 V_0g0p1`, `V_0g0p3 → a V_0g0p0 V_0g0p3`, `V_0g0p0 → a V_0g0p1 V_1g0p0`, …; the third transition (`0→0, a, [#], [a, #]`) starts `V_0g2p0 → a V_0g0p0 V_0g2p0`; the first single push (`0→1, c, [a], [a]`) gives `V_0g0p0 → c V_1g0p0`, `V_0g0p1 → c V_1g0p1`, `V_0g0p3 → c V_1g0p3`; the accept transition (`1→3, ε, [#], []`) gives `V_1g2p0 → V_3gep0` (no terminal), `V_1g2p1 → V_3gep1`, `V_1g2p3 → V_3gep3`; the transition `1→1, a, [a], []` gives `V_1g0p0 → a V_1gep0`, …. **After removing the rules that are not reachable from `S` or not productive** (the test computes both with its own small helper, independent of the CNF code), exactly these **15 rules** remain (in the order of the grammar): `S → V_0g2p3`; `V_1gep1 → ε`; `V_3gep3 → ε`; `V_0g0p1 → a V_0g0p1 V_1g0p1`; `V_0g0p1 → b V_0g1p1 V_1g0p1`; `V_0g0p1 → c V_1g0p1`; `V_0g1p1 → a V_0g0p1 V_1g1p1`; `V_0g1p1 → b V_0g1p1 V_1g1p1`; `V_0g1p1 → c V_1g1p1`; `V_0g2p3 → a V_0g0p1 V_1g2p3`; `V_0g2p3 → b V_0g1p1 V_1g2p3`; `V_0g2p3 → c V_1g2p3`; `V_1g0p1 → a V_1gep1`; `V_1g1p1 → b V_1gep1`; `V_1g2p3 → V_3gep3`. In the slide's names (`s = 0`, `f = 1`, `a = 3`) these are the rules [1] to [10] and [14] to [18] of page 27. By hand, `abcba` is derived: `S ⇒ V_0g2p3 ⇒ a V_0g0p1 V_1g2p3 ⇒ a b V_0g1p1 V_1g0p1 V_1g2p3 ⇒ a b c V_1g1p1 V_1g0p1 V_1g2p3 ⇒ a b c b V_1gep1 V_1g0p1 V_1g2p3 ⇒ a b c b V_1g0p1 V_1g2p3 ⇒ a b c b a V_1gep1 V_1g2p3 ⇒ a b c b a V_1g2p3 ⇒ a b c b a V_3gep3 ⇒ abcba`; and `c` by `S ⇒ V_0g2p3 ⇒ c V_1g2p3 ⇒ c V_3gep3 ⇒ c`. `variables`: its first entry is `{ name: "V_0g0p0", from: 0, stack: "a", to: 0 }`, and the set of names equals the set of `V_…` names in the rules. Language: for the 3280 strings over `{a, b, c}` of length 0 to 7, the grammar (after `CnfTransformer::transform` and `CykParser::parse`) accepts a string iff it is `w c wᴿ` with `w ∈ {a, b}*`.
- *F2, a machine with split states: the result of `pda_to_rnf` on F2 of T-036 (`aⁿbⁿ`, `n ≥ 1`).* States `0`, `1`, `2` (`s'`), `3` (`a`), `4` (`v1`), `5` (`v2`); stack alphabet `["A","#"]`; `K = {0, 1, 3, 4, 5}`, `k − 1 = 5`. Seven transitions are not from `s'`: two pushes of three symbols (`0→0, a, [A], [A,A,A]` and `0→0, a, [#], [A,A,#]`), and five that push nothing (`1→3`, `0→4`, `4→1`, `1→5`, `5→1`). Expected: **281 rules** (1 + 5 + 5 × 5 + 2 × 125) and **9 steps**; the two long pushes give `5³ = 125` rules each (a step with `pushes: 3`), the `push_none` steps give 5. Language: all 511 strings over `{a, b}` of length 0 to 8: accepted iff `aⁿbⁿ`, `n ≥ 1`.
- *F3, the smallest machine: `{ε}`.* States `0` (`s'`), `1` (`s`), `2` (`a`); input alphabet `["a"]`; stack alphabet `["#"]`; transitions `0→1, ε, [], [#]` and `1→2, ε, [#], []`. `K = {1, 2}`. Expected, in this order, exactly these **5 rules** and **3 steps** (`start`, `empty { count: 2 }`, `push_none { from: 1, to: 2 }`): `S → V_1g0p2`; `V_1gep1 → ε`; `V_2gep2 → ε`; `V_1g0p1 → V_2gep1`; `V_1g0p2 → V_2gep2`. By hand, `S ⇒ V_1g0p2 ⇒ V_2gep2 ⇒ ε`; the language is `{ε}` (check with CNF and CYK for `ε`, `a`, `aa`). This also shows a start rule whose `s` and `a` differ and a machine where most variables are not productive.
- *F4, input errors (one test each, with the exact key and parameters).* No start state: `pda_cfg.no_start_state`. The start state with two transitions; with a transition that reads a symbol; with a transition that pushes two symbols; with a transition into it; and accepting: each `pda_cfg.bad_start { state }`. No accepting state and two accepting states: `pda_cfg.not_one_accepting { count: 0 }` and `{ count: 2 }`. A transition into `a` that reads a symbol; one that pops `[A]` instead of the marker; one that pushes a symbol: each `pda_cfg.bad_accept { from }`. A transition that pops nothing and one that pops two symbols (not from `s'`): `pda_cfg.not_single_pop { from, to }`. An input symbol `ab`, `A`, `<`, a space, `ε` and `^`: each `pda_cfg.terminal_not_readable { symbol }`. A grammar-readable symbol such as `a`, `0`, `+` or `(` is accepted. The order of the checks is pinned by one PDA that has two faults (for example no marker pop and a bad terminal: the earlier one is returned).
- *F5, the size limit.* An RNF machine with `s'` and 29 more states (so `k − 1 = 29`; the extra states need no transitions) and one transition `s → s` that reads `a`, pops `[#]` and pushes four symbols: `29⁴ = 707281 > 20000`, so `machine.limit_exceeded { what: "rules", limit: 20000 }`, and the call returns in under 50 ms (the test checks the time, as the T-036 fix did). A machine with 2 states besides `s'` and a transition that pushes 64 symbols (`MAX_PDA_STRING`): `2⁶⁴` overflows `u64`, and the same message comes back. A machine just under the limit passes: with `k − 1 = 3` the transition `s → s` that pushes 9 symbols gives `3⁹ = 19683` rules plus the others, which is at most 20000 (the test computes the exact total and asserts the call succeeds; choose the machine so that the total is at most 20000). State ids near the top of `u32` (for example `4294967295` as a state, and `s'` = `4294967294`) give names like `V_4294967295g0p4294967295` and no panic.
- *Grammar-text round trip (a helper in the test file):* write the grammar in the canonical text form (one line per head, start symbol first, one space between all symbols, `ε` for an empty body, as `grammarToText` does in the web app), parse it with `GrammarParser::parse`, and compare: the parsed grammar has the same start, the same rules in the same multiset. Used on F1, F2 and F3 (this is what stops names that the parser cannot read).

**Acceptance criteria:**
- AC1: F1 to F5 give exactly the rules, counts, steps, messages, `variables` and errors above.
- AC2: language equivalence by CYK: F1 over 3280 strings, F2 over 511 strings, F3 over `ε`, `a`, `aa`, against the hand predicates; every string up to length 7 (F1), 8 (F2). Use `CnfTransformer::transform` (final grammar) and `CykParser::parse`. First check by a small test what `CnfTransformer` does with a grammar whose language is empty, and pin that in a test; then the helper `derives(grammar, w)` treats exactly that outcome as "not derived" and every other error as a test failure.
- AC3: two `proptest`s with `PROPTEST_CASES=1000`, three runs in a row (paste the three result lines).
  (a) *Random PDAs through RNF.* Generate small PDAs as in T-036's AC3 (one to three states, input `{a, b}`, stack `{A, B}`, one to five transitions with pops and pushes of zero to three symbols, random accepting set, random start), convert with `pda_to_rnf` and then `pda_to_cfg`. Do not skip any case. Check: the number of rules is `1 + (k − 1) + Σ over transitions not from s' of (k − 1)^max(n, 1)`, where `n` is the length of the push; the number of steps is `2 +` the number of those transitions; every rule head is `S` or a `V_…` name that `variables` lists; the grammar-text round trip holds; and for every string over `{a, b}` up to length 4: simulate the RNF machine with `{ maxSteps: 240, maxConfigurations: 20000, maxStack: 14 }`; if the result is `Finished`, the grammar derives the string iff the machine accepts it. No threshold on skipped strings; F1 and F2 show that the test is not vacuous.
  (b) *The chain T-034 → T-036 → T-037.* Generate small grammars (variables `S` and `A`; one to four rules; a body of zero to three symbols over `S`, `A`, `a`, `b`), convert with `cfg_to_pda_topdown`, then `pda_to_rnf`, then `pda_to_cfg`: for every string over `{a, b}` up to length 5, the new grammar derives it iff the original grammar does (both through CNF and CYK, with the helper of AC2). Measure the time of the 1000-case run; if it takes more than about a minute in a debug build, say so in the report and shrink the grammar generator (bodies of at most two symbols) before you lower the number of cases.
- AC4: nothing panics on arbitrary text fed to the API function (`proptest`), and on random PDAs that are not in RNF (the result is `Ok` or one of the messages of decision 1), including state ids near the top of `u32`.
- AC5: deliberate breaks, each shown failing, then restored: put `<v1,γ2,v2>` before `<r,γ1,v1>` in the body (F1 and F2 fail); reverse the `push` list when reading it (F1 fails, and the language tests fail); leave out the ε block (F1 fails; language tests fail); build `S → <s,#,s>` instead of `<s,#,a>` (F1 fails; language fails); in case A write `<r,γ,w>` instead of `<r,ε,w>` (F1 fails); let `w` and the `v` tuples range over all states including `s'` (F1 fails: 108 is not 76; report whether the language tests also fail, they should not, and say what that shows); enumerate the tuples with `v1` as the fastest index (the order of the F1 rules fails); remove the size check (the F5 timing test fails); remove the check of decision 1 (b) (its error test fails); name a variable without the `V_` prefix, for example `V0g2p3` (the round-trip test fails, because the parser reads it as `V0` and then terminals).
- AC6: `wasm` stays under 250 KB gzip and the initial JS under 170 KB (`pnpm size`); report the wasm size before and after.

**Verification:**
```
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
pnpm build:wasm
pnpm check && pnpm lint && pnpm format:check && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
```
Run both AC3 proptests with `PROPTEST_CASES=1000` three times in a row and paste the result lines. No e2e (no UI). Paste real output into `REPORT.md`.

**Rollback:** `git revert <sha>`. Nothing reads the new code yet.

**Depends on:** T-036 (merged), T-034 (merged, for the chain test), and the CNF and CYK code (T-060, merged).

**Notes for worker:** Four easy mistakes: (1) the pushed symbols are `γ1 … γn` with `γ1 = push[0]` on top, and the chain of the body is `<r,γ1,v1> <v1,γ2,v2> … <v(n−1),γn,vn>`, with the head `<q,γ,vn>` (the last state, not the first); (2) case A reads `<r,ε,w>` with ε as the stack symbol, written `e` in the name; (3) every range of states excludes `s'` but includes states that nothing reaches; (4) the names must come back unchanged through the grammar parser, so no `<`, no commas, one `_` only. Check the size limit before you build any rule. No `unwrap` or `expect` in non-test code. The language tests are the contract: write them first and look at them fail on a broken conversion. Quote names, keys and numbers from the code in your summary, not from memory; your REPORT.md, not your chat summary, is the record. If a derivation above disagrees with the engine, stop and report.

---

## Task T-033 — PDA editor, part 1 of 5: the PDA document, its commands and its history

**Status:** done
**Owner:** worker
**Branch:** `task/T-033-pda-document`

**Goal:** The PDA editor (wireframe `design/screens/pda-editor.md`, approved by the owner on 2026-11-06) is built in five small tasks, one after the other: T-033 (this one: the data, no screen), T-039 (the diagram shows a PDA), T-049 (the editor shell: build a PDA on the canvas, the label form, the kind switch), T-051 (the Tabel and Definisi tabs, the determinism badge, the checks), T-052 (saved machines with a type chip, files, the three examples). This task adds what a PDA editor edits: a **PDA document** with its commands and an undo history, in TypeScript, next to the FSM document, with the conversion to and from the engine's `Pda`. Nothing on a screen changes. See `docs/agent/DECISIONS.md` (2026-11-06, the PDA editor architecture).

**Decisions already made (do not reopen; ask the planner if one looks wrong):**

- **A parallel document, not a union.** `MachineDocument` is used by about forty files (checks, conversions, regex, storage, tests); a union type would touch them all. The PDA gets its own `PdaDocument` and its own commands. The shared parts stay shared: `StateEntry`, `LIMITS`, `checkName`, `checkSymbol`, `checkTitle`, `isCoordinate`, `message`, `Result`, and the habit of freezing every document. The FSM document and commands do not change.
- **One history for both.** `history.ts` becomes generic over the document and the command: `createHistory` keeps its present signature and behavior for the FSM (every FSM test passes unchanged), and a new `createPdaHistory(initial, options)` is the same code bound to `applyPdaCommand` and `pdaDocumentsEqual`. Do it with a small internal `createGenericHistory(initial, { apply, equal, limit })`; no class, no new dependency.
- **The document uses names, the engine uses numbers.** A PDA document holds `inputAlphabet` and `stackAlphabet` as lists of names (in the order the user wrote them; the order gives the numbers of the symbols, as in `MachineDocument.alphabet`), and a transition holds names: `{ from, read: string | null, pop: string[], push: string[], to }` (`read: null` is ε; `pop` and `push` are top first, as in the engine). The list of transitions is sorted as the engine sorts them (from; read with ε first, then by the number of the input symbol; pop and push compared element by element by the number of the stack symbol, a shorter list that is a prefix first; to), so that the table, the diagram and the definition show the engine's order.
- **Kind** is `'dpda' | 'ndpda'`, default `'ndpda'`. Changing it is a command, one undo step; it never refuses.
- **Limits:** the engine's (`MAX_STATES` 2000, `MAX_SYMBOLS` 256 for each alphabet, `MAX_TRANSITIONS` 100 000, `MAX_PDA_STRING` 64 for the length of one `pop` or `push`), the symbol and name rules of the document (`checkSymbol`: not empty, not `ε`, no space or control character, 32 characters), and the document size limit. A refused command gives a message and changes nothing, exactly as the FSM commands do. New message keys: `pda_document.string_too_long { limit }`, `pda_document.unknown_symbol { symbol }`, `pda_document.duplicate_transition`, `pda_document.unsupported_version { version }`.
- **No bottom marker.** The stack starts empty; the document has no setting for it (decision of 2026-11-05).

**Scope (in):**

- `web/src/lib/editor/pda-document.ts` (about 400 lines; split only past 600): `PdaKind`, `PdaTransitionEntry`, `PdaDocument` (`schemaVersion: 1`, `title`, `kind`, `inputAlphabet`, `stackAlphabet`, `states`, `start`, `accepting`, `transitions`, `nextStateId`); `createPdaDocument()`; `pdaDocumentsEqual`; `serializePdaDocument` and `parsePdaDocument` / `parsePdaDocumentText` (untrusted input: validate every field and every limit, never throw, a future `schemaVersion` gives `pda_document.unsupported_version { version }`, as `parseDocument` does for the FSM); `comparePdaTransitions` (the engine's order); `toEnginePda(doc)` (names to numbers: the `Pda` of `engine/types.ts`, ready for `validatePda`, `pdaDeterminism`, `simulatePda`, `exportPdaJff`) and `fromEnginePda(pda, states)` (the other way, given the names and places; used by T-052 for `.jff`).
- `web/src/lib/editor/pda-commands.ts`: `PdaCommand` = `addState`, `removeState` (also removes every transition that uses it, and clears start and accepting), `moveState`, `renameState`, `setStart`, `setAccepting`, `addTransition { from, read, pop, push, to }`, `removeTransition` (same fields), `addInputSymbol`, `removeInputSymbol` (also removes the transitions that read it), `addStackSymbol`, `removeStackSymbol` (also removes the transitions that pop or push it), `setKind`, `setTitle`, `batch { commands }` (same limits as the FSM batch: 10 000 commands, depth 8; a batch is all or nothing). `applyPdaCommand(doc, command): ApplyResult` is pure; a command that changes nothing gives back the same document object; a command with the wrong fields is refused (the check is at run time, input is not trusted). `addTransition` never adds a symbol by itself: a transition that names a symbol that is not in its alphabet is refused with `pda_document.unknown_symbol` (the form of T-049 sends `addInputSymbol` and `addStackSymbol` in the same batch, as the FSM label field does).
- `web/src/lib/editor/history.ts`: generic as described above. `createPdaHistory` is exported from `history.ts` and `index.ts`.
- `web/src/lib/editor/pda-samples.ts`: the three example documents of the first run, as plain data (positions chosen by hand, and a title in Indonesian kept in the document as the FSM samples do): **aⁿbⁿ, n ≥ 1** (a `dpda`), **wcwᴿ** (a `dpda`) and **wwᴿ, even palindromes** (an `ndpda`). The machines are F1 to F3 below. They are the oracle for the engine tests.
- `docs/decisions/0041-pda-editor-document.md` (the decisions above and the plan of the five tasks) and one line in `docs/ARCHITECTURE.md`.
- `id` and `en` texts for the four `pda_document.*` keys, in the files that hold the `document.*` texts.
- Tests, written first.

**Non-goals (out):**

- No screen, no component, no route, no change to the FSM document, commands, checks, storage or tests (the generic history is the one shared file). No storage of PDA documents (T-052). No `.jff` file handling (T-052; `toEnginePda` and `fromEnginePda` are only the conversion). No simulation or conversion UI (T-038). No message texts for the UI (T-049 and T-051 add `pda_editor.*`).

**Fixtures (the oracle; derive them by hand first and write the derivation in `REPORT.md`):**

- *F1, aⁿbⁿ with n ≥ 1 (DPDA).* States `q0` (id 0, start), `q1` (id 1, accepting); input `["a","b"]`; stack `["A"]`; transitions in the engine's order: `q0 a/ε/A q0`, `q0 b/A/ε q1`, `q1 b/A/ε q1` (written `from read/pop/push to`; `ε` is an empty list). Check with the engine (`simulatePda` through the wasm test harness of `run.wasm.test.ts`): accepts `ab`, `aabb`, `aaabbb`; rejects ε (q0 is not accepting), `a`, `b`, `aab`, `abb`, `abab`, `ba`. By hand, `aabb`: `(q0,0,[]) → (q0,1,[A]) → (q0,2,[A,A]) → (q1,3,[A]) → (q1,4,[])`: accepted. `aab`: ends in `(q1,3,[A])`, the stack is not empty: rejected. `pdaDeterminism` returns no pair, and `validatePda` returns no error.
- *F2, wcwᴿ (DPDA).* States `q0` (start), `q1` (accepting); input `["a","b","c"]`; stack `["A","B"]`; transitions in the engine's order: `q0 a/ε/A q0`, `q0 b/ε/B q0`, `q0 c/ε/ε q1`, `q1 a/A/ε q1`, `q1 b/B/ε q1`. Accepts exactly the strings `w c wᴿ` with `w ∈ {a,b}*` (so `c`, `aca`, `abcba`); the test checks every string over `{a,b,c}` up to length 7 against that predicate. `pdaDeterminism` returns no pair.
- *F3, wwᴿ, even palindromes (NDPDA).* The same states; input `["a","b"]`; stack `["A","B"]`; transitions in the engine's order: `q0 ε/ε/ε q1`, `q0 a/ε/A q0`, `q0 b/ε/B q0`, `q1 a/A/ε q1`, `q1 b/B/ε q1` (the first one is `q0 ε/ε/ε q1`: it reads nothing, pops nothing, pushes nothing). Accepts exactly the even palindromes over `{a,b}`, ε included: every string up to length 8 is checked against the predicate. `pdaDeterminism` returns **exactly two pairs**: the first transition with `q0 a/ε/A q0`, and with `q0 b/ε/B q0` (the first reads nothing and pops nothing, so it competes with both; the two others read different symbols, so they do not compete with each other).
- *F4, the engine's order.* A document that holds the F3 transitions added in a scrambled order is equal (`pdaDocumentsEqual`) to the F3 document; and for 200 random documents, the order of `doc.transitions` is the order of the transitions of `loadPda` on the JSON of `toEnginePda(doc)` (so the two sorts agree; this stops the table and the definition from showing another order than the engine).
- *F5, limits and untrusted input.* A pop of 65 symbols: `pda_document.string_too_long { limit: 64 }`. A transition that names `Z` when the stack alphabet is `["A"]`: `pda_document.unknown_symbol { symbol: "Z" }`. The same transition twice: `pda_document.duplicate_transition` (a silent no-op would hide it; check how the FSM `addTransition` treats a duplicate and match it, and say which in the report). The symbol `ε` as a name: refused by `checkSymbol`. 2001 states and 257 symbols in one alphabet: refused. `parsePdaDocumentText` on `""`, `"null"`, `"[]"`, a 2 MiB text, a document with a transition that names a missing state, an alphabet with a duplicate, a `schemaVersion: 2`, an extra field: each gives an error and never throws.

**Acceptance criteria:**
- AC1: F1 to F3 are accepted and rejected as listed, through the engine; F3 has exactly two competing pairs; F1 and F2 have none.
- AC2: F4 holds (equal documents whatever the insertion order; the TypeScript sort is the engine's sort).
- AC3: F5: every refusal has the exact key and parameters above, and nothing throws.
- AC4: round trip: for 500 random valid documents, `parsePdaDocument(JSON.parse(serializePdaDocument(doc)))` is equal to `doc`; `fromEnginePda(toEnginePda(doc), doc.states)` is equal to `doc` apart from the title (state the exact rule in the test); and the engine accepts every `toEnginePda` result (`loadPda` gives `ok`).
- AC5: history: for random sequences of up to 40 commands (every command type), undo of the whole sequence gives back the initial document (the same object), redo gives back the last one, a command that is refused or changes nothing is not a step, and a `moveState` gesture with one `coalesce` key is one step. Use `fast-check` if the repo already has it (check `web/package.json`); if not, write a seeded random loop and do not add a dependency.
- AC6: the FSM tests pass unchanged (`history.test.ts`, `history.property.test.ts`, `commands.test.ts`, and every other editor test).
- AC7: deliberate breaks, each shown failing, then restored: sort `pop` lists by name instead of by symbol number (F4 fails); drop the "removes its transitions" rule of `removeState` (the round trip or the engine check fails); let `removeStackSymbol` leave the transitions that use it (the engine rejects the document); let `addTransition` accept an unknown symbol (F5 fails); make `createPdaHistory` use the FSM `applyCommand` (AC5 fails); let a batch apply half of its commands when one is refused (AC5 fails); remove the size check of `parsePdaDocument` (F5 fails).
- AC8: `pnpm size`: the initial JS of every route stays under 170 KB (no route imports the new code yet, so no bundle should grow; report the numbers before and after).

**Verification:**

```
pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
```

Run the history property test (AC5) with three different seeds and paste the results. No Rust change, so `cargo` is not needed unless a type changes. No e2e (no UI). Paste real output into `REPORT.md`.

**Rollback:** `git revert <sha>`. Nothing reads the new code yet, and the FSM path is unchanged.

**Depends on:** T-030, T-031 and T-032 (merged: the engine's `Pda`, `loadPda`, `validatePda`, `pdaDeterminism`, `simulatePda`, `exportPdaJff`).

**Notes for worker:** (1) Do the three hand derivations first and show a broken `toEnginePda` failing the tests before you trust them. (2) Read `document.ts`, `commands.ts`, `history.ts` and `commands.test.ts` before you write a line: the PDA code follows their patterns (frozen documents, run-time checks, a refused command changes nothing, a no-op returns the same object). Name in the ADR the FSM function you copied from. (3) Do not refactor the FSM files beyond the generic history; if a shared helper looks worth extracting, say so in the report and do not do it here. (4) The engine, not the document, decides what a valid machine is: the document only refuses what the engine would refuse by limits and names. A document with no start state or an unreachable state is valid; the checks (`validatePda`) report it. (5) No `any`, no `@ts-ignore`, no new dependency. (6) Your `REPORT.md`, not your chat summary, is the record.

---

## Task T-039 — PDA editor, part 2 of 5: the diagram shows a PDA

**Status:** done
**Commit:** `0df683e`
**Owner:** worker
**Branch:** `task/T-039-pda-diagram`

**Goal:** The drawing of a machine (`edgeGeometry`, `DiagramDrawing.svelte`) learns two things so that it can draw a PDA: an **input that is not tied to `MachineDocument`**, and a **label of several lines** (one line for each transition of an edge: `c / pop / push`). Nothing on a screen changes for an FSM: its drawing, its tests and its pictures stay exactly as they are. A PDA adapter turns a `PdaDocument` (T-033) into that input, with at most three lines on an edge and `+ n lagi` when there are more. No route, no editor, no new component: T-049 builds the editor on top of this. See `design/screens/pda-editor.md`, section 2, and ADR 0041.

**Decisions already made (do not reopen; ask the planner if one looks wrong):**

- **A neutral input.** `diagramGeometry(input: DiagramInput, options)` is the new core. `DiagramInput` is `{ states: readonly { id, name, x, y }[]; start: number | null; accepting: readonly number[]; edges: readonly DiagramEdgeInput[] }` and `DiagramEdgeInput` is `{ from: number; to: number; lines: readonly string[]; text?: string }` (`text` is the name that a screen reader reads, default `lines.join('; ')`). `edgeGeometry(doc: MachineDocument, options)` **stays, with the same signature**, and is `diagramGeometry(fsmDiagram(doc), options)`: no FSM caller (`EditorCanvas`, `DiagramView`, `ConversionCanvas`, `share/image.ts`) changes. `fsmDiagram(doc)` groups the transitions as `groupTransitions` does now (one edge for each pair, symbols in alphabet order with ε last, one line `a, b, ε`). Move that grouping into the adapter; do not copy it.
- **Several lines in a label.** `LabelShape` gains `lines: string[]` (an FSM label has exactly one, equal to `text`; for a PDA edge `text` is the accessible text, see above). The box of a label with `n` lines is `max chars of a line × 9.6 + 8` wide (`MONO_CHAR` and `LABEL_PADDING`, as now) and `LABEL_HEIGHT + LINE_PITCH × (n − 1)` high, with `LINE_PITCH = 18` (a new exported constant): 20, 38 and 56 px for one, two and three lines. `placeLabel` already places a box by its reach, so a taller box moves away from its line by itself: **a label grows away from the line** (upward for an edge to the right, outward for a loop), the nearest side stays `LABEL_GAP` (4) from the line or the apex. The line `i` (from 0) is drawn with its center at `box.y + LABEL_HEIGHT / 2 + LINE_PITCH × i`.
- **Drawing.** `DiagramDrawing.svelte` draws a label of one line exactly as now (the same text node, so the FSM markup and the existing tests do not change) and a label of several lines as one `<text class="label">` with one `<tspan>` for each line (`x = center.x`, `y` as above). The accessible name of an edge uses `label.text`.
- **The PDA adapter** is `web/src/lib/editor/diagram/pda-diagram.ts`: `pdaDiagram(doc: PdaDocument, more: (count: number) => string): DiagramInput` and `transitionLabel(doc, transition): string`. One edge for each pair (from, to), sorted by `from`, then `to`; the lines are the transitions of the pair **in `doc.transitions` order** (the engine's order). The label of one transition is `read / pop / push` with ` / ` between the three parts: `read` is the symbol or `ε`; `pop` and `push` are strings of stack symbols, leftmost is the top, empty is `ε`. **The stack alphabet decides the spacing for the whole document:** if every name in `doc.stackAlphabet` is one character, a string is written without spaces (`AB`); if any name is longer (`Z0`, `T_a`), every string is written with one space between symbols (`Z0 A`). (Count characters as `labelBox` does: code points.) **At most three lines on an edge:** with three transitions or fewer, one line each; with more, the first two transitions and a third line `more(n)` where `n = count − 2` (so four transitions show two lines and `+ 2 lagi`, five show two and `+ 3 lagi`). The sentence comes from the UI, never from the geometry: `more` is passed in (the UI will pass `(count) => t('pda_editor.edge_more', { count })`), and the key is added in this task: `pda_editor.edge_more { count }`, `id`: "+ {count} lagi", `en`: "+ {count} more". `text` of the edge (the accessible name) lists **all** the transitions joined by `; `, so nothing is hidden from a screen reader.
- **No change to the layout rules** (angles, curves, the start triangle, clearances) and no change to `layout.ts` (auto layout of a PDA is T-049's question). If a PDA label does not fit between two states that are too close, the student moves a state, as with an FSM label of three symbols (the existing rule in `geometry.test.ts`).
- **No new component** (T-049 adds the read-only and the editable PDA views). `share/image.ts` keeps working for an FSM and is not extended to a PDA here (T-052); it reads `label.text`, which is unchanged for an FSM.

**Scope (in):**

- `web/src/lib/editor/diagram/geometry.ts`: `DiagramInput`, `DiagramEdgeInput`, `diagramGeometry`, `fsmDiagram`, `LINE_PITCH`, `labelBox` for several lines (keep the existing signature working for one line), `LabelShape.lines`, `edgeGeometry` as a thin wrapper. Keep the file one file (it is 579 lines; split the adapter out only if it passes about 700).
- `web/src/lib/editor/diagram/pda-diagram.ts` (new): `pdaDiagram`, `transitionLabel`.
- `web/src/lib/editor/diagram/DiagramDrawing.svelte`: several lines.
- `web/src/lib/i18n/id.ts` and `en.ts`: `pda_editor.edge_more`.
- Tests, written first: `web/src/lib/editor/diagram/pda-diagram.test.ts` (new), new `describe` blocks in `geometry.test.ts` (do not edit an existing test), and a frozen baseline for the FSM (see AC1).
- `docs/decisions/0042-diagram-input-and-multiline-labels.md` (the decisions above, short).

**Non-goals (out):**

- No route, no editor, no `PdaDiagramView`, no canvas interaction, no label form, no `+ n lagi` button (T-049). No table or definition (T-051). No picture export of a PDA (T-052). No auto layout of a PDA. No change to any FSM file except `geometry.ts`, `DiagramDrawing.svelte` and the two i18n files.

**Fixtures (the oracle; derive the numbers by hand first and write the derivation in `REPORT.md`):**

- *F1, a straight edge with three lines.* Two states at `(0, 0)` and `(300, 0)`, one edge `0 → 1` whose lines are `ε / ε / ε`, `a / ε / A`, `b / ε / B`. The rim-to-rim middle is `(150, 0)`; the left of the direction of travel is `(0, −1)`; the longest line has 9 characters, so the box is `9 × 9.6 + 8 = 94.4` wide and `20 + 18 × 2 = 56` high; the center is `(150, −(4 + 28)) = (150, −32)`, so the box is `{ x: 102.8, y: −60, width: 94.4, height: 56 }` and its bottom (`y + height = −4`) is 4 above the line. The three line centers are at `y = −60 + 10 + 18 × i`: `−50`, `−32`, `−14`.
- *F2, a loop with three lines* (one state at `(200, 300)`, a loop whose lines are the same three). The label grows upward: the bottom side of the box is exactly `LABEL_GAP` above the apex of the loop (the existing one-line loop test gives the apex), and the box is 56 high.
- *F3, the samples through the adapter.* `pdaDiagram` of the three samples of T-033, with `more = (n) => "+ " + n + " lagi"`: **wwᴿ (F3 of T-033):** edges `0>0` with `a / ε / A` and `b / ε / B`; `0>1` with `ε / ε / ε`; `1>1` with `a / A / ε` and `b / B / ε`. **wcwᴿ:** `0>0` with `a / ε / A`, `b / ε / B`; `0>1` with `c / ε / ε`; `1>1` with `a / A / ε`, `b / B / ε`. **aⁿbⁿ:** `0>0` with `a / ε / A`; `0>1` with `b / A / ε`; `1>1` with `b / A / ε`. The edges come in the order `0>0`, `0>1`, `1>1` and the lines in the order of `doc.transitions`.
- *F4, more than three transitions.* An edge with 3 transitions has 3 lines. With 4: two lines and `+ 2 lagi`; with 5: two lines and `+ 3 lagi`; with 70: two lines and `+ 68 lagi`. In all cases `text` lists every transition, joined by `; `, in the document's order.
- *F5, the spacing of stack strings.* Stack alphabet `["A", "B"]`, a transition `a`, pop `["A"]`, push `["B", "A"]`: `a / A / BA`. Stack alphabet `["Z0", "A"]` and the transition `a`, pop `["Z0"]`, push `["A", "Z0"]`: `a / Z0 / A Z0`; and **in the same document** a transition with pop `["A"]` and push `["A", "A"]` is `a / A / A A` (the rule is for the whole alphabet, not for the transition). A pop of `[]` and a push of `[]` are `ε`; a read of `null` is `ε`. A stack alphabet with a name of two characters made of a surrogate pair (one code point) counts as one character.
- *F6, the property.* 300 random PDA documents on a grid with a spacing of **240** units (states at grid points, 1 to 5 transitions on each of about half of the pairs of neighbors, each transition with a read of one symbol or ε and pops and pushes of 0 to 2 symbols; labels of up to three lines, with `more` as above): no two labels overlap, no label covers a state, and the bounds hold every label (the property that `geometry.test.ts` already has for the FSM). The spacing 240 is a starting value: if a case fails, find the smallest spacing at which the property holds for every one of 300 seeds, record it in the report with the reason, and do **not** weaken the property or change a drawing rule. Also: the same document built with its transitions added in another order gives the same shapes (the order is the engine's).
- *F7, the FSM does not change.* Before you change `geometry.ts`, write a script that records `JSON.stringify(edgeGeometry(doc))` for every sample machine of `diagram/samples.ts` and for 300 random FSM documents (seeded) and commit it as a fixture (`diagram/__fixtures__/fsm-shapes.json`, or one hash for each machine if the file is big, and say which). After your change the same call must give the same text apart from the new `lines` field (the test removes `lines` before it compares).

**Acceptance criteria:**
- AC1: F7 holds, and every existing test passes unchanged (`geometry.test.ts`, the `share/image` tests, the editor tests); no existing test file is edited except to add a `describe`.
- AC2: F1 and F2 give exactly the numbers above.
- AC3: F3: exact edges and lines for the three samples.
- AC4: F4 and F5: exact text.
- AC5: F6 holds with the recorded spacing; the determinism check holds.
- AC6: a one-line label is drawn with the same markup as before (check the rendered `DiagramDrawing` for an FSM and for a one-line PDA edge: one text node, no `tspan`); a three-line label has three `tspan`s with the `y` values of F1. Use the repo's component test setup if it has one; if it has none, test the pure function that makes the line positions and say so (do not add a dependency).
- AC7: deliberate breaks, each shown failing, then restored: ignore the number of lines in the box height (F1 fails); put the lines in alphabet order instead of `doc.transitions` order (F3 fails); show three transitions plus `+ n lagi` instead of two (F4 fails); decide the stack spacing for each transition instead of the alphabet (F5 fails); sort the edges by `to` first (F3 fails); build `text` from the visible lines only (F4 fails); let the label grow toward the line instead of away from it (F1 or F2 fails); drop `lines` from the baseline comparison by mistake in `fsmDiagram` (F7 fails).
- AC8: `pnpm size`: the initial JS of every route stays under 170 KB; report the numbers before and after. The existing speed tests of `geometry.test.ts` (200 states and 421 edges; 600 random edges across 200 states) still pass.
- AC9: e2e: run the existing Playwright specs that draw a diagram (find them with `grep -l "diagram\|label\|edge" web/e2e`) on the laptop and the phone project, and paste the result. No new e2e (there is no screen).

**Verification:**

```
pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
pnpm --filter web exec playwright test <the specs of AC9>
```

Paste real output into `REPORT.md`, with the hand derivation of F1 and F2 first.

**Rollback:** `git revert <sha>`. The FSM path is unchanged (F7), and nothing else reads the new code yet.

**Depends on:** T-033 (merged).

**Notes for worker:** (1) Record the F7 baseline **first**, from the unchanged code, and commit it in its own commit. (2) `edgeGeometry` keeps its signature: do not touch its four callers. (3) The geometry is pure data and never produces a sentence: `more` comes from the caller. (4) Do not change an angle, a clearance or a curve rule; a PDA label that is wider than the room between two states is the student's to fix by moving a state (as the FSM geometry test already says). (5) No `any`, no `@ts-ignore`, no new dependency. (6) After editing any file with a script or `sed`, run `git diff` and look at it: PR 165 lost the last "r" of 45 lines in two docs because of an unquoted `sed` (`s/\r$//` became `s/r$//`). Edit with the edit tool, not with `sed`, and never rewrite `PLAN.md` or any doc wholesale. (7) Your `REPORT.md`, not your chat summary, is the record.

---

## Task T-049 — PDA editor, part 3 of 8: the interaction core works for two kinds of document

**Status:** done
**Commit:** `0b031e4`
**Owner:** worker
**Branch:** `task/T-049-editor-core`

**Goal:** The editor's brain, `createEditor` in `web/src/lib/editor/interaction/editor.ts` (711 lines: the document with its history, the selection, the tools, a drag, a transition that is being made, the open label box, the edge that is selected, the announcements), is written for `MachineDocument`. Everything in it that a PDA does the same way (states: add, move, rename, delete, start, accepting; the selection; edges as pairs of states; undo and redo) must work for a `PdaDocument` too, and the three things that differ (the text of an edge, how an edge is removed, how a label is committed) must come from the document type. This task makes that split. **It is a refactor with one addition:** the FSM editor behaves exactly as before (every existing test passes unchanged), and a `createPdaEditor(initial: PdaDocument)` exists and is tested. No component and no screen changes. The PDA editor is built in eight small tasks: T-033 and T-039 (merged), this one, T-053 (the canvas), T-054 (the label form), T-055 (the editor shell and the mode), T-051 (the panel: tabs, kind switch, badge, checks), T-052 (saved machines, files, examples). See `docs/agent/DECISIONS.md` (2026-11-06) and `design/screens/pda-editor.md`.

**Decisions already made (do not reopen; ask the planner if one looks wrong):**

- **One core, two thin kinds.** `createEditorCore<D extends StatesDocument, C>(initial: D, kind: EditorKind<D, C>)` holds everything that is shared. `createEditor(initial: MachineDocument): Editor` keeps its exact signature and returns the FSM editor with all its present methods, including `commitLabel(text, split?)`. `createPdaEditor(initial: PdaDocument): PdaEditor` is new. Do not copy `editor.ts`.
- **`StatesDocument`** is a small structural type in a new file `interaction/document-view.ts`: `{ readonly states: readonly StateEntry[]; readonly start: number | null; readonly accepting: readonly number[]; readonly transitions: readonly { readonly from: number; readonly to: number }[] }`. `MachineDocument` and `PdaDocument` already satisfy it. `menu.ts`, `placement.ts` and `selection.ts` take a `StatesDocument` (or the part they use) instead of `MachineDocument`; their tests are not edited.
- **The commands that are the same.** `addState`, `removeState`, `moveState`, `renameState`, `setStart`, `setAccepting`, `setTitle` and `batch` have the same shape in `Command` and `PdaCommand` (T-033 made them so). Define `StateCommand` (the first seven) once, in `document-view.ts`, so that the core builds them without knowing the document type; a test of types (`satisfies`) proves that both `Command` and `PdaCommand` accept every `StateCommand`.
- **`EditorKind<D, C>`** is what a document type supplies: `createHistory(initial: D): GenericHistory<D, C>` (`createHistory` and `createPdaHistory` from `history.ts`; the type `GenericHistory` is already exported), `equal(a: D, b: D): boolean` (`documentsEqual`, `pdaDocumentsEqual`), `edgeText(doc: D, from: number, to: number): string` (what a screen reader reads for an edge; `''` if there is none) and `removeEdge(doc: D, from: number, to: number): C[]` (the commands that remove every transition of the pair; `removeTransition` has other fields in a PDA). Nothing else. If you find that the core needs a fourth thing, stop and tell the planner.
- **The label.** The core no longer knows how a label is typed. It keeps `labeling` (`{ from, to, ask }`), `editEdge()`, `cancelLabel()` and what happens when a transition is finished (`finishLink` opens the label for the pair), and gains `commitEdge(commands: readonly C[]): Refusal | null`: it sends the commands as one `batch` (one undo step; a single command goes alone), closes the label box, and announces. With no commands it closes the box and makes no step. If the document refuses, the box stays open, the announcement is the refusal (as `commitLabel` does now), and the refusal is returned. After a successful send the announcement is `editor.edge_removed { from, to }` if the pair has no transition left, else `editor.edge_changed { from, to, symbols: edgeText(doc, from, to) }`. **The FSM's `commitLabel(text, split)` keeps the part that is FSM only** (parse the text, the question of a long part, `labelCommands`) **and ends by calling `commitEdge`**, so the tail of the code exists once. Its behavior, its returned values and its announcements do not change.
- **The text of a PDA edge** is `pdaEdgeText(doc, from, to)`, new, in `diagram/pda-diagram.ts`: the label of every transition of the pair (`transitionLabel`, the document-wide stack spacing of T-039), in `doc.transitions` order, joined by `; `. `pdaDiagram` uses it for the `text` of an edge, so the format exists once.
- **The PDA editor interface.** `PdaEditor` is the core interface for `PdaDocument` and `PdaCommand` (no `commitLabel`). `Editor` (the FSM one) stays exported under the same name with the same members; the generic core interface is `EditorCore<D, C>` and `EditorState<D>` is generic with `EditorState` (no argument) meaning the FSM one, so that no component changes in this task.
- **No new message key.** The announcements are the existing `editor.*` keys.

**Scope (in):**

- `web/src/lib/editor/interaction/document-view.ts` (new): `StatesDocument`, `StateCommand`, `EditorKind`.
- `web/src/lib/editor/interaction/editor.ts`: the core, `createEditor` as a thin FSM wrapper, `commitEdge`. Keep it one file if it stays under about 800 lines; if not, move `createPdaEditor` and the FSM kind to small files, never the shared logic.
- `web/src/lib/editor/interaction/pda-editor.ts` (new, about 40 lines): the PDA kind and `createPdaEditor`.
- `menu.ts`, `placement.ts`, `selection.ts`: parameter types only.
- `web/src/lib/editor/diagram/pda-diagram.ts`: `pdaEdgeText`.
- `docs/decisions/0043-editor-core-two-documents.md` (the decisions above, short).
- Tests, written first: `interaction/pda-editor.test.ts` (new, the fixtures below) and `interaction/pda-editor.property.test.ts` (new).

**Non-goals (out):**

- No component, no route, no `EditorCanvas`, `Editor.svelte` or `LabelField.svelte` change (T-053 to T-055). No PDA label form or label parsing (T-054). No change to the document types, commands, history or any FSM test. No new message key. No storage.

**Fixtures (the oracle; derive the numbers by hand first and write the derivation in `REPORT.md`). The document is `wwrSample()` of T-033: states `q0` (id 0, start), `q1` (id 1, accepting); transitions in order `q0 ε/ε/ε q1`, `q0 a/ε/A q0`, `q0 b/ε/B q0`, `q1 a/A/ε q1`, `q1 b/B/ε q1`; stack alphabet `["A","B"]`:**

- *F1, edges.* `selectEdge(0, 1)`: `state.edge = {0, 1}`, selection empty, announcement `editor.edge_selected { from: "q0", to: "q1", symbols: "ε / ε / ε" }`. `selectEdge(0, 0)`: symbols `"a / ε / A; b / ε / B"`. `selectEdge(1, 0)` (no such edge): nothing changes. `deleteEdge(0, 0)`: both transitions of the pair are removed in **one** undo step (the document has 3 transitions left: `q0 ε/ε/ε q1`, `q1 a/A/ε q1`, `q1 b/B/ε q1`), the announcement and the toast are `editor.edge_removed { from: "q0", to: "q0" }`, the selection is empty and the focus goes to state 0; one `undo()` gives back a document that is `===` the one before (the history keeps the object). `deleteEdge(0, 1)` leaves 4 transitions.
- *F2, deleting a state.* `deleteStates([1])`: the states are `[q0]`; `start` is 0; `accepting` is `[]`; the transitions are the two on `q0 a/ε/A q0` and `q0 b/ε/B q0` (every transition that touches state 1 is gone: `0>1` and the two on `1>1`); it is one undo step; one `undo()` restores the same object. The same call with the edge `(1, 1)` selected clears the selected edge.
- *F3, making a transition and committing it.* `startLink(0)`, `finishLink(1)`: `state.labeling = { from: 0, to: 1, ask: null }`. `commitEdge([addTransition 0, read "a", pop ["A"], push [], to 1])` returns `null`; `labeling` is `null`; the document has the new transition **after** `q0 ε/ε/ε q1` (read `a` sorts after ε); the announcement is `editor.edge_changed { from: "q0", to: "q1", symbols: "ε / ε / ε; a / A / ε" }`; it is one undo step. `commitEdge([])` returns `null`, closes the box and makes **no** step (the history's `canUndo` is as before). `commitEdge([addTransition 0, read "z", ...])` with a symbol that is not in the alphabet returns `{ key: "pda_document.unknown_symbol", params: { symbol: "z" } }`, the box stays open, the document is the same object, and the announcement is that refusal. `commitEdge` of the commands that remove the last transition of a pair announces `editor.edge_removed`.
- *F4, a drag.* `beginDrag(0, p)`, `dragTo(p + (40, 10), false)` several times, `endDrag()`: the state moved by (40, 10) in **one** undo step; while dragging, `state.preview` holds the new place and the document is unchanged; `cancelDrag()` leaves the document and the history as they were; `undo()` gives back the same object.
- *F5, the rest of the shared rules, once each on a PDA:* `addStateAt`, `toggleAccepting`, `toggleStart` (set, then cleared), `startRename` and `commitRename`, `setTitle` (announcement `editor.title_set`), `selectAll`, `nudge` and `seal`, `undo` and `redo` (announcements `editor.undone` and `editor.redone`), the order of `escape()` (rename, label, drag, link, marquee, selection or edge, tool), `dirty` (true after a change, false again after the undo of that change, and false again when an edit returns the document to a state that is equal to the first one: this uses `pdaDocumentsEqual`, not `===`).
- *F6, the property.* The existing `editor.property.test.ts` runs random actions on the FSM editor and checks the invariants. Write the same for the PDA editor: 300 seeded sequences of up to 60 actions (every method that changes something, with valid and invalid arguments, including `commitEdge` with a random valid or refused command); after each action: every id in the selection is a state; `state.edge` is `null` or a pair that has a transition; `state.labeling` is `null` or its two states exist; `state.link.from` exists; `state.doc` is the history's document; and at the end `undo()` until `canUndo` is false gives back the first document (`===`). Read the FSM test first and reuse its helpers where it allows; do not edit it.
- *F7, nothing changed for the FSM.* Every existing test passes unchanged, and `pnpm size` shows no route above its limit. A test of types proves that `createEditor`'s return value still has every member of the old `Editor` (for example `const e: Editor = createEditor(doc)` and a call of `commitLabel`).

**Acceptance criteria:**
- AC1: F1 to F5 give exactly the results above.
- AC2: F6 holds (three runs with different seed offsets).
- AC3: F7: all existing tests pass without any edit (list the test files you ran: `interaction/*.test.ts`, `Editor`-related tests, `history*.test.ts`, the whole `vitest run`), and `git diff` shows no change to an existing test file.
- AC4: the tail of the commit code exists once: `commitLabel` calls `commitEdge` (point to the lines in the report).
- AC5: deliberate breaks, each shown failing, then restored: let `deleteEdge` of a PDA remove only the first transition of the pair (F1 fails); let `commitEdge` leave the box open after a success (F3 fails); announce `edge_changed` when the pair is empty (F3 fails); build the symbols of `edge_selected` with `, ` instead of `; ` (F1 fails); compute `dirty` with `!==` instead of `equal` (F5 fails); make `createPdaEditor` use the FSM history (it must fail to compile or F1 to F4 fail; say which); let `removeState` leave the selected edge (F2 fails); let a refused `commitEdge` close the box (F3 fails); make `pdaEdgeText` sort the transitions by label (F1 fails).
- AC6: `pnpm size`: every route stays under 170 KB; report the numbers before and after (the FSM routes may grow by at most 1 KB gzip, because they now carry the adapter; say the exact figure).
- AC7: e2e: run the existing Playwright specs that drive the editor (find them with `grep -l "editor" web/e2e`), on the laptop and the phone project, and paste the result. There is no new e2e.

**Verification:**

```
pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
pnpm --filter web exec playwright test <the specs of AC7>
```

Paste real output into `REPORT.md`, with the hand derivation of F1 to F4 first.

**Rollback:** `git revert <sha>`. The FSM path is unchanged (F7), and nothing else reads the new code yet.

**Depends on:** T-033 and T-039 (merged).

**Notes for worker:** (1) Read `interaction/editor.ts`, `label.ts`, `menu.ts`, `placement.ts`, `selection.ts`, `keys.ts`, all the `interaction/*.test.ts` and `history.ts` before you write a line, and state your plan (the three methods of `EditorKind`, the types) in the restatement. (2) This is a refactor: do it in small steps, run the FSM tests after each one, and commit the generic core (with the FSM still passing) before you add the PDA editor. (3) Do not change an existing test, an announcement key, or the text of any message. (4) `EditorState` and `Editor` must keep working for the components as they are today; the generic names are new exports. (5) No `any`, no `@ts-ignore`, no new dependency. (6) Edit with the edit tool, not with `sed` or a script, and run `git diff` after every edit (PR 165 lost the last "r" of 45 doc lines to an unquoted `sed`). (7) Your `REPORT.md`, not your chat summary, is the record.

---

## Task T-053 — PDA editor, part 4 of 8: the canvas works for two kinds of document

**Status:** done
**Owner:** worker
**Branch:** `task/T-053-canvas-two-documents`

**Goal:** `EditorCanvas.svelte` (957 lines) is the pointer and keyboard layer of the editor. It already talks to the editor only through `editor` and `state`, but it is typed for the FSM (`Editor`, `EditorState`, `MachineDocument`), it draws with `edgeGeometry`, and it contains the label box (`LabelField`) with its FSM logic. This task makes it work for any `EditorCore<D, C>` (T-049): the drawing comes from a function that the page supplies, the box that opens on an edge is a **slot** (a snippet) that the page fills, and an edge whose label is cut (`+ n lagi`) gets a pointer target. **For the FSM nothing changes:** the same screen, the same behavior, the same tests. No PDA screen yet: the PDA editor shell is T-055, and the PDA label form is T-054. See `docs/agent/DECISIONS.md` (2026-11-06, the eight tasks), ADR 0043, and `design/screens/pda-editor.md`, sections 2 and 8.

**Decisions already made (do not reopen; ask the planner if one looks wrong):**

- **Generic component.** `EditorCanvas.svelte` declares `generics="D extends StatesDocument, C"`. Its props: `editor: EditorCore<D, C>`, `state: EditorState<D>`, `diagram: (doc: D) => DiagramInput` (new, required: the page says how its document is drawn; the FSM page passes `fsmDiagram`), `label?: Snippet<[LabelSlot]>` (new), `onmore?: (from: number, to: number) => void` (new), `menuLabels?: Partial<Record<MenuAction, MessageKey>>` (new), and the props it has now (`flags`, `active`, `taken`, `onlayout`). The canvas calls `diagramGeometry(diagram(shown), { startLabel })` where it now calls `edgeGeometry(shown, ...)`; `shown` is the document with the drag preview, typed `D`.
- **The label box is a slot.** `LabelSlot` is `{ x: number; y: number; from: number; to: number }`: the **screen** position where the box goes (the canvas still computes it from the edge's label, or from where the edge will be, as `labelAt` does now) and the pair. The canvas renders `{@render label?.(slot)}` while `view.labeling` is open and the position is known. **Everything FSM-specific that is in the canvas about the label moves out of it, unchanged, into a new `FsmLabelBox.svelte`:** the `LabelField`, the `labelProblem` text and its reset when the box closes, the `oncommit` / `oncancel` / `onleave` handlers that call `editor.commitLabel`, and the initial text (`labelOf(doc, from, to)`). `Editor.svelte` passes it as the snippet. The canvas must no longer import `LabelField`, `labelOf`, `Editor` (the FSM interface) or `MachineDocument`.
- **Menu text.** `ContextMenu.svelte` builds each item's text from `editor.menu.${action}`. With `menuLabels`, an action can use another key (the PDA editor will say "Ubah transisi" for `edit`, key `pda_editor.menu_edit`, added by T-054). Without it, the texts are exactly as now. `menuLabels` is passed from the canvas to the menu.
- **`+ n lagi` is an overflow line.** `DiagramEdgeInput` gains `overflow?: true` and `LabelShape` gains `overflow?: true`, **present only when true** (an FSM label has no such key, so the T-039 baseline `fsm-shapes.json` still compares equal after `lines` is removed; do not change that test). `pdaDiagram` sets `overflow: true` on an edge exactly when it replaced transitions by the `more(n)` line. `DiagramDrawing.svelte` draws the last line of an overflow label with the accent color and an underline (a class, no raw color; use the tokens) and, when `interactive`, a pointer target over it that calls `onmore(from, to)`. The target is the new pure function `overflowTarget(label: LabelShape): Box | null` in `geometry.ts`: `null` without overflow; otherwise a box as wide as the label box and **44 px high, centered on the last line** (`labelLineY(box, lines.length − 1)`), so the 44 px rule holds on touch; it sits above the edge's own label hit area. The target is **pointer only** (`aria-hidden="true"`, not in the Tab order): the keyboard way to the same information is the existing one (select the edge, `Enter` opens the label form of T-054, which lists every transition), and the table of T-051. `onmore` defaults to `editor.selectEdge(from, to)` in the canvas; T-055 passes a function that also opens the Tabel tab.
- **Nothing else moves.** The camera, the pointer and keyboard handling, the context menu logic, the zoom control, the rename field, the focus rules and the empty-canvas hint stay as they are. Do not split `EditorCanvas.svelte` further in this task.

**Scope (in):**

- `web/src/lib/editor/EditorCanvas.svelte`: generics, the new props, `diagramGeometry`, the label slot, the overflow target wiring.
- `web/src/lib/editor/FsmLabelBox.svelte` (new): the label code moved out of the canvas.
- `web/src/lib/editor/Editor.svelte`: passes `diagram={fsmDiagram}` and the `label` snippet that renders `FsmLabelBox` (the only change to this file).
- `web/src/lib/editor/ContextMenu.svelte`: the optional label keys.
- `web/src/lib/editor/diagram/geometry.ts`: `overflow` on `DiagramEdgeInput` and `LabelShape`, `overflowTarget`, and nothing else.
- `web/src/lib/editor/diagram/DiagramDrawing.svelte`: the overflow line and its target.
- `web/src/lib/editor/diagram/pda-diagram.ts`: sets `overflow`.
- Tests, written first: new `describe` blocks in `geometry.test.ts` and `diagram/pda-diagram.test.ts` (do not edit an existing test) for `overflowTarget` and `overflow`.
- `docs/decisions/0044-canvas-two-documents.md` (the decisions above, short).

**Non-goals (out):**

- No PDA screen, route, label form or panel (T-054, T-055, T-051). No new message key (the PDA keys come with their tasks). No change to the editor core, the documents, the commands or the history. No change to any existing test. No auto layout for a PDA. No visual change for the FSM.

**Fixtures (the oracle; derive the numbers by hand first and write the derivation in `REPORT.md`):**

- *F1, the overflow target.* A label box `{ x: 102.8, y: −60, width: 94.4, height: 56 }` with three lines and `overflow: true` (the F1 label of T-039): the last line's center is `labelLineY(box, 2) = −60 + 10 + 36 = −14`; the target is `{ x: 102.8, y: −36, width: 94.4, height: 44 }`. A label with two lines, box height 38, `overflow` true (not produced by the adapter, but the function must not assume three): last line center `box.y + 28`, target height 44, centered on it. A label without `overflow`: `null`. A label whose box is narrower than 44 (one character): the target is still the box width, and the test says what the FSM case would be (an FSM label never has overflow, so it is `null`).
- *F2, `pdaDiagram` and the flag.* An edge with 3 transitions: three lines, **no** `overflow` key (`'overflow' in edge` is `false`). With 4: two lines and the `more(2)` line, `overflow: true`. With 70: `overflow: true`. After `diagramGeometry`, the `LabelShape` has `overflow: true` exactly for those edges and no `overflow` key for the others; an FSM document through `edgeGeometry` has no `overflow` key on any label.
- *F3, nothing changed for the FSM.* The T-039 baseline test (`fsm-shapes.json`, compared after removing `lines`) passes **without any edit**; every existing test passes; `git diff` shows no edited existing test file.
- *F4, the canvas is generic.* `pnpm check` (svelte-check) passes with 0 errors. In addition, a type test file (a `.ts` file that svelte-check and `tsc` see) builds an `EditorCanvas`-props object for the PDA types (`EditorCore<PdaDocument, PdaCommand>`, `EditorState<PdaDocument>`, `diagram: (doc: PdaDocument) => DiagramInput`) and for the FSM types, with `satisfies`, so that a regression to FSM-only props is a compile error. Use `ComponentProps<typeof EditorCanvas>` if it works with a generic component; if it does not, say so in the report and use the props interface you export instead.
- *F5, the FSM label box keeps its behavior.* The existing Playwright specs that type a label (`editor-edges`, `editor-transitions`, `editor-flows`, `touch` ones) pass unchanged on the laptop and phone projects; they are the proof that `FsmLabelBox` is the old box. Also: the error text of a refused label disappears when the box closes (the `labelProblem` reset moved with the code; the existing spec covers it, name which one).

**Acceptance criteria:**
- AC1: F1 and F2 give exactly the values above.
- AC2: F3: the baseline passes, no existing test edited.
- AC3: F4: `pnpm check` is clean and the type test exists.
- AC4: the canvas no longer imports `LabelField`, `labelOf`, `Editor` (the FSM interface) or `MachineDocument`; `grep` output in the report.
- AC5: F5: the listed e2e specs pass on desktop and phone (paste the counts). Take the five screenshots that the existing specs do not cover **only if** a spec that types a label does not exist; otherwise none.
- AC6: deliberate breaks, each shown failing, then restored: make the overflow target 40 px high (F1 fails); center it on the label instead of on the last line (F1 fails); let `pdaDiagram` set `overflow` on every edge (F2 fails); let `overflowTarget` return a box for a label without overflow (F1 fails); let an FSM label get `overflow: false` instead of no key (F3 fails). For the component code that has no unit test (the slot, `FsmLabelBox`): make one deliberate break in `FsmLabelBox` (do not reset `labelProblem` when the box closes) and show which e2e spec catches it; if none does, say so and add the smallest e2e assertion.
- AC7: `pnpm size`: every route stays under 170 KB; the FSM routes may grow by at most 0.5 KB gzip; report before and after.
- AC8: the deepening pass of `AGENTS.md` is written in `REPORT.md` (new exports, duplicates, casts: the goal is zero).

**Verification:**

```
pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
pnpm --filter web exec playwright test <the specs of F5 and AC5, desktop and phone>
```

Run the quick loop while you work (one file or pattern) and the whole gate once before you push. Paste real output into `REPORT.md`, with the hand derivation of F1 first.

**Rollback:** `git revert <sha>`. The FSM path is unchanged (F3, F5), and nothing else reads the new props yet.

**Depends on:** T-049 (merged), T-039 (merged).

**Notes for worker:** (1) Read `EditorCanvas.svelte` (all 957 lines), `LabelField.svelte`, `ContextMenu.svelte`, `Editor.svelte` around its `EditorCanvas` use, `DiagramDrawing.svelte` and `diagram/geometry.ts` before you write a line, and state your plan in the restatement: which lines move to `FsmLabelBox`, what the slot gets, and the type of the generic props. (2) This is a refactor: move the label code, do not rewrite it. After the move, a diff of the moved lines against the old ones should show only changed names and imports. (3) Do not add a PDA label parser or form: T-054. Do not add a route: T-055. (4) Svelte 5 generic components and snippets: read how `Editor.svelte` already uses snippets before you choose a form. (5) No `any`, no `@ts-ignore`, no `as unknown as` (a cast needs one named helper and a comment). (6) Edit with the edit tool, not with `sed` or a script, and run `git diff` after every edit. (7) Your `REPORT.md`, not your chat summary, is the record.

---

## Task T-054 — PDA editor, part 5 of 8: the label form

**Status:** done
**Commit:** `fc7853a`
**Branch:** `task/T-054-pda-label-form`

**Goal:** The one new interaction of the PDA editor (`design/screens/pda-editor.md`, section 8): the form where the transitions of one edge are edited, with three fields for each transition (**Baca**, **Pop**, **Push**), instead of the FSM's single text box. This task builds (1) the logic, in plain TypeScript: how the text of the fields becomes symbols and strings of stack symbols, and how the difference from what the edge has becomes the commands for `commitEdge` (T-049); (2) the form as a component, `PdaLabelForm.svelte`, whose content does not know where it sits; and (3) a thin wrapper, `PdaLabelPopover.svelte`, that places it on the canvas as a popover through the label slot of T-053. **Nothing is wired to a screen:** the PDA editor shell, the mode and the phone placement of the form (a sheet in the panel area) are T-055. The form is therefore checked by logic tests, the type checker and a written checklist here, and by e2e in T-055 (listed below). See ADR 0043 and 0044.

**Decisions already made (do not reopen; ask the planner if one looks wrong):**

- **Rows.** The form has one row for each transition of the edge, in `doc.transitions` order (the order of the table and the diagram). Each row is three text fields and a **Hapus** button. Below the rows: **+ Transisi lain di antara {from} dan {to}**, the hint, and the buttons **Ketik ε**, **Batal** and **Simpan**. An edge that has no transition yet opens with one blank row. `Ketik ε` is in the form (as in `LabelField`), not in the dock: this replaces the dock button of the phone picture, so that one place serves laptop and phone.
- **A row as text.** `Row = { read: string; pop: string; push: string }`. `rowsOf(doc, from, to): Row[]` writes the transitions of the pair in the label format of T-039 (the same `transitionLabel` rules: `ε` for a missing read and for an empty string; stack symbols joined with no space when every name of the stack alphabet has one character, else with one space). A pair with no transition gives `[]` (the component shows one blank row).
- **The read field.** Trimmed. `''`, `ε` and `eps` mean ε (`null`). Otherwise it must be one symbol: if it contains whitespace, or if it has more than one character, is not in the input alphabet, and every name of the input alphabet has one character (an empty alphabet counts), the row is refused with `pda_editor.read_one_symbol { text }` ("Satu baris membaca satu simbol. Untuk ‘{text}’: buat dua baris, atau tambahkan ‘{text}’ ke alfabet input di tab Tabel."). **This replaces the FSM's `ask_split` question** that `pda-editor.md` section 8 mentions: a split would have to make several rows, and a question needs its own interface; the refusal says what to do, and a name of several characters is added once in the Tabel tab (T-051), after which the check no longer applies. The planner updated section 8 and logged the decision (`DECISIONS.md`, 2026-11-07). Anything else that `checkSymbol` refuses (for example a symbol longer than 32 characters) is refused by the document, not here.
- **The pop and push fields.** `''`, `ε` and `eps` are the empty string. Otherwise the text is cut into stack symbols by one rule: **if the text contains whitespace or a comma, each part between them is one symbol name** (so `Z0 A` is `Z0` and `A`); **otherwise, if every name of the stack alphabet has one character (an empty alphabet counts), each character (code point) is a symbol** (so `AB` is `A`, `B`); **otherwise the whole text is one symbol name**. `ε` inside a longer text is not special (the document refuses it as a name). The leftmost symbol is the top of the stack. The rule round-trips with the display of T-039: a string written as `AB` (single-character alphabet) or `Z0 A` (alphabet with a longer name) is read back as the same list.
- **Blank rows.** A row whose three fields are all `''` (after trim) is ignored: an untouched row of a new edge adds nothing (`Simpan` then closes the form without a step). A row with some fields typed and others empty is a transition: an empty field means ε. A row with `ε` in all three is the transition ε / ε / ε.
- **The commands.** `rowCommands(doc, from, to, rows): PdaCommand[] | Refusal`: first `addInputSymbol` for each new read symbol and `addStackSymbol` for each new stack symbol, in order of first appearance (rows top to bottom; within a row read, then pop, then push); then `addTransition` for each wanted transition that the pair does not have; then `removeTransition` for each transition of the pair that is not wanted. Rows that give the same transition count once. The result goes to `editor.commitEdge(commands)` (one undo step). Whatever the document refuses (a name that is not valid, a string longer than 64, too many transitions) comes back as the `Refusal` of `commitEdge`; the form shows it under the rows with `t(key, params)` and stays open. Do not copy the document's checks into the form.
- **The menu text.** `pdaMenuLabels = { edit: 'pda_editor.menu_edit' }` is exported from `pda-label.ts` for T-055 to pass to the canvas (`menuLabels`, T-053): the context-menu item that opens this form says "Ubah transisi".
- **Keys and focus.** `Enter` in any field sends (Simpan); `Esc` cancels; `Tab` moves field by field and row by row; `Ctrl+E` (`Cmd+E`) writes ε in the focused field; every key that the form handles stops there (the canvas must not see it), as in `LabelField`. The first field of the first row has the focus when the form opens and its text is selected. Leaving the form with the focus (to somewhere that is not in the form) sends it if the text changed and every row is acceptable, and cancels in every other case (the FSM rule, `onleave` of `FsmLabelBox`); the 400 ms rule of `LabelField` (a tap that opens the box can move the focus at once: take it back) applies too. Fields are 16 px or more and 44 px high.
- **Placement.** `PdaLabelPopover.svelte` places the form at the screen position of the label slot (`LabelSlot`, T-053), clamped inside the canvas as `LabelField` does (it opens at the label, never off the screen), and is as wide as its content needs up to the canvas width minus 8 px; if the canvas is narrower than the content, the fields shrink (the Push field first) and the buttons wrap. The phone placement (a sheet in the panel area) is T-055.
- **Accessibility.** The form is `role="dialog"` with an accessible name `pda_editor.form_title { from, to }`; each field has an accessible name that says the row and the field ("Baris 2, Pop"); each Hapus button names its row; the refusal text is in the `aria-describedby` of the fields (as in `LabelField`) and in a live region. No hover is needed.
- **Messages.** New keys in `id` and `en` (texts are `TODO(review)` until the feedback guide): `pda_editor.form_title { from, to }`, `pda_editor.col_read`, `pda_editor.col_pop`, `pda_editor.col_push`, `pda_editor.field_label { n, field }`, `pda_editor.row_delete { n }`, `pda_editor.add_row { from, to }`, `pda_editor.label_hint` ("Kiri = puncak stack. Pop ε tidak memeriksa stack."), `pda_editor.save`, `pda_editor.cancel`, `pda_editor.menu_edit`, `pda_editor.read_one_symbol { text }`. `editor.type_epsilon` is reused.

**Scope (in):**

- `web/src/lib/editor/pda-label.ts` (new): `Row`, `rowsOf`, `parseRows` (read and pop and push fields to transitions, or the refusal), `rowCommands`, `pdaMenuLabels`. Pure, no DOM. Export only what the components and the tests use.
- `web/src/lib/editor/PdaLabelForm.svelte` (new): the content, the keys, the leave rule, the refusal text; props `editor: PdaEditor`, `doc: PdaDocument`, `labeling: { from; to }`.
- `web/src/lib/editor/PdaLabelPopover.svelte` (new): the wrapper that places it from a `LabelSlot`.
- `web/src/lib/i18n/id.ts` and `en.ts`: the keys above.
- `docs/decisions/0045-pda-label-form.md` (the decisions above, short).
- Tests, written first: `web/src/lib/editor/pda-label.test.ts` (the fixtures below) and `pda-label.property.test.ts` (new).

**Non-goals (out):**

- No route, no shell, no phone sheet, no panel, no table (T-055, T-051). No change to the editor core, the canvas, the documents, the commands or any existing test. No new command type. No `ask_split` question. No slash syntax (`a/ε/A`): the three fields are the three parts.

**Fixtures (the oracle; derive them by hand first and write the derivation in `REPORT.md`; the document is `wwrSample()` of T-033 unless said otherwise: stack alphabet `["A","B"]`, input alphabet `["a","b"]`):**

- *F1, `rowsOf`.* Pair `(0, 0)`: `[{ read: "a", pop: "ε", push: "A" }, { read: "b", pop: "ε", push: "B" }]`. Pair `(0, 1)`: `[{ read: "ε", pop: "ε", push: "ε" }]`. Pair `(1, 0)` (no transition): `[]`. A document whose stack alphabet is `["Z0", "A"]` with a transition `a`, pop `["Z0"]`, push `["A", "Z0"]`: `{ read: "a", pop: "Z0", push: "A Z0" }`.
- *F2, the fields (stack alphabet `["A","B"]`, so one-character names).* Pop or push text → list: `"AB"` → `["A","B"]`; `"A B"` → `["A","B"]`; `"A, B"` → `["A","B"]`; `"ε"`, `"eps"`, `""`, `"  "` → `[]`; `"Z0 A"` → `["Z0","A"]` (a space makes names); `"Z0"` → `["Z","0"]` (no separator, one-character alphabet: characters); `"A😀"` → `["A","😀"]` (code points). With stack alphabet `["Z0","A"]`: `"Z0A"` → `["Z0A"]` (the alphabet has a longer name and there is no separator: one name); `"Z0 A"` → `["Z0","A"]`; `"AA"` → `["AA"]`. Read text (input alphabet `["a","b"]`): `"a"` → `"a"`; `" a "` → `"a"`; `""`, `"ε"`, `"eps"` → `null`; `"c"` → `"c"` (a new single character: accepted); `"ab"` → refusal `pda_editor.read_one_symbol { text: "ab" }`; `"a b"` → the same refusal with `text: "a b"`. With input alphabet `["a","num"]` (a longer name present): `"ab"` → `"ab"` (accepted as a new name); `"num"` → `"num"`.
- *F3, `rowCommands` on pair `(0, 0)`.* Rows unchanged (the two rows of F1): `[]`. Add a row `{ read: "c", pop: "A", push: "" }`: `[addInputSymbol "c", addTransition { from: 0, read: "c", pop: ["A"], push: [], to: 0 }]`. Change the second row to `{ read: "b", pop: "ε", push: "BB" }`: `[addTransition { read: "b", pop: [], push: ["B","B"] }, removeTransition { read: "b", pop: [], push: ["B"] }]` (additions first, removals last; no symbol is new). Remove both rows (`[]`): `[removeTransition × 2]`. A new pair `(1, 0)` with a blank row only (`[{ read: "", pop: "", push: "" }]`) and with `[]`: `[]`. The same transition in two rows: one `addTransition`. A row `{ read: "d", pop: "C", push: "C C" }` on a new pair: `[addInputSymbol "d", addStackSymbol "C", addTransition { read: "d", pop: ["C"], push: ["C","C"] }]` (the stack symbol `C` is added once).
- *F4, the commit through the editor.* With `createPdaEditor(wwrSample())`: `startLink(1)`, `finishLink(0)` (the pair `(1, 0)` has no transition yet), then `commitEdge(rowCommands(doc, 1, 0, [{ read: "a", pop: "A", push: "" }]))` returns `null`; the document has the transition `q1 a/A/ε q0` as one undo step; the announcement is `editor.edge_changed` with `symbols: "a / A / ε"`. A row `{ read: "a", pop: "", push: "A".repeat(65) }`: `commitEdge` returns the refusal `pda_document.string_too_long { limit: 64 }`, the document is the same object, the form would stay open. Boundary: a push of exactly 64 symbols is accepted; 63 and 65 (the triple the contract asks for).
- *F5, properties (seeded; 1000 cases each, and the larger run of the contract: run 10000 once and paste it).* (a) *Round trip:* for random valid PDA documents and every pair that has transitions, `parseRows(doc, rowsOf(doc, from, to))` gives back exactly the transitions of the pair, and `rowCommands` with those rows is `[]`. (b) *Never throws:* for random strings (including empty, whitespace, `ε`, surrogate pairs, lone surrogates, control characters, 5000-character strings) in each of the three fields, `parseRows` and `rowCommands` return a value and never throw. (c) *Applying:* for random rows on a random pair, applying the commands with `applyPdaCommand` as one batch either gives a document whose transitions for the pair equal the wanted set (ignoring blank rows), or a refusal, never a throw; and after a successful application, `rowCommands` with the same rows on the new document is `[]` (applying it again changes nothing).

**Acceptance criteria:**
- AC1: F1 to F4 give exactly the values above.
- AC2: F5 holds (1000 cases; the 10000-case run pasted).
- AC3: `pnpm check` is clean (0 errors) with the two components; the components are type-checked against `PdaEditor`, `PdaDocument` and `LabelSlot`.
- AC4: no existing test or file other than the two i18n files is changed.
- AC5: the checklist, each line answered with the file and line in `REPORT.md`: roles and names of the dialog, the fields and the buttons; the `aria-describedby` of the refusal; Enter, Esc, Tab order and `Ctrl+E`; the 400 ms rule; the leave rule; 44 px targets; 16 px text; no raw color or size (tokens only).
- AC6: deliberate breaks, each shown failing, then restored: read `Z0` as one name in a one-character alphabet (F2 fails); ignore the alphabet and always split into characters (F2 fails); put removals before additions (F3 fails); let blank rows through as ε / ε / ε transitions (F3 fails); forget to add a new stack symbol that appears only in a push (F3 or F5 fails); let `rowsOf` write stack strings with no space for an alphabet with a longer name (F1 fails); accept `ab` as a read symbol in a one-character alphabet (F2 fails); let `rowCommands` add a symbol twice when it is in two rows (F3 fails).
- AC7: the deepening pass of `AGENTS.md` in `REPORT.md`: the exports of `pda-label.ts` (each used by a component or a test), duplicated logic (the 400 ms rule and the leave rule are also in `LabelField`: say whether you shared them or why not), casts (the goal is zero).
- AC8: `pnpm size`: no route changes (nothing imports the new files yet); report before and after.

**What T-055's e2e must cover** (written here so it is not forgotten; this task does not run it): open the form by `Enter` on a selected edge, by double click on the label, by the menu item "Ubah transisi" and after making a transition; type three fields and send with `Enter` and with `Simpan`; `Tab` order; `Esc`; leaving by a click on the canvas sends a changed text and cancels an unchanged one; `Ketik ε` and `Ctrl+E`; a refused row shows its text and keeps the form open; add and delete rows; delete every row of an edge removes it; the phone sheet; axe on the open form.

**Verification:**

```
pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
```

Use the quick loop while you work (one file or pattern) and the whole gate once before you push. Paste real output into `REPORT.md`, with the hand derivations of F1 to F3 first.

**Rollback:** `git revert <sha>`. Nothing reads the new files yet.

**Depends on:** T-049 and T-053 (merged), T-033 and T-039 (merged).

**Notes for worker:** (1) Read `LabelField.svelte`, `FsmLabelBox.svelte`, `interaction/label.ts` (the FSM version of the same logic), `interaction/editor.ts` (`commitEdge`, `cancelLabel`), `pda-commands.ts`, `pda-document.ts` and `diagram/pda-diagram.ts` (`transitionLabel`, the stack separator) before you write a line, and state your plan in the restatement. (2) Do not copy the format rules: `rowsOf` must call the same function as the diagram (export what you need from `pda-diagram.ts` if it is not exported; do not write the rule twice). (3) The document, not the form, decides what is valid: do not add checks that the commands already make. (4) Svelte 5: read how `LabelField.svelte` handles focus, `tick()` and the settle rule before you choose a form. (5) No `any`, no `@ts-ignore`, no `as unknown as`. (6) Edit with the edit tool, not with `sed` or a script, run `git diff` after every edit, and follow rule 12 of `AGENTS.md` for shell commands. (7) Your `REPORT.md`, not your chat summary, is the record.

---

## Task T-055 — PDA editor, part 6 of 10: the editor frame is shared

**Status:** done
**Commit:** `f00699d`
**PR:** #178
**Owner:** worker
**Branch:** `task/T-055-editor-frame`

**Goal:** `Editor.svelte` (767 lines) draws the frame of the FSM editor and its contents together: the tool rail, the work column with its bar (title, count, save line, fit, undo and redo on a phone), the notices, the stage, the toast, and the side panel. The PDA editor needs the same frame with other contents, and its layout and phone rules (about 220 lines of CSS, the 40 rem breakpoint, the dock at the bottom of a phone) must not be copied. This task **extracts the frame** into `EditorFrame.svelte`, and the common parts of the bar into the frame, so that `Editor.svelte` keeps only what is FSM: its checks, runner, tester, tables, conversions, first run, library, share and help buttons. **It is a refactor and nothing else:** the FSM editor looks and behaves exactly as before, proven by pixel-identical screenshots and the existing tests. No PDA code. The PDA editor shell is T-057 (T-056 is its storage). See `docs/agent/DECISIONS.md` (2026-11-08), ADR 0043 and 0044.

**Decisions already made (do not reopen; ask the planner if one looks wrong):**

- **A frame with slots.** `EditorFrame.svelte` owns: the element `.editor` with its `data-ready` mark, the `ToolRail` (its props `tool`, `canUndo`, `canRedo`, `ontool`, `onundo`, `onredo`), the work column, the **bar** with the parts that every editor has (the title text, the count of states, the save line, the fit button, undo and redo for a phone), the `problem` line (`role="alert"`), the Transisi hint line, the `stage` that holds the canvas, the `Toast` (its props `toast`, `onundo`, `ondismiss`), the side panel place, and all the layout and phone CSS that belong to them. Everything that differs comes in through snippets or props: `actions` (the extra buttons of the bar: layout, help, share, the list of machines), `stage` (the canvas), `overlay` (the first-run card and the layout note), `covered` (the stage is hidden while a conversion canvas shows), `panel` (the side panel, optional: the PDA editor has none until T-051). The exact split of the bar is the worker's to propose in the restatement, within these rules: the DOM that the FSM editor renders stays **the same** (same elements, classes, roles, accessible names, order, `hidden` attributes), because the e2e specs and the pictures depend on it.
- **Tokens only.** The moved CSS keeps using the design tokens; nothing gets a raw color or size. No visual change.
- **Public behavior of `Editor.svelte` does not change**: its props, its exported `setTitle`, the `bind:this` use in `Sandbox` and `Soal`, and what `/sandbox` and `/soal/[id]` do.
- **No new dependency, no new message key, no change to any other component** (the canvas, the panel, the rail and the toast keep their own files). If a file other than `Editor.svelte` and the new frame needs a change, say why in the restatement.

**Scope (in):**

- `web/src/lib/editor/EditorFrame.svelte` (new) and `web/src/lib/editor/Editor.svelte` (smaller).
- The throwaway proof script (see F1), kept in `~/tmp`, not committed.
- `docs/decisions/0046-editor-frame.md` (the decisions above, short).
- Tests: no new unit test is expected (the code is markup and CSS); the proof is F1 to F3.

**Non-goals (out):**

- No PDA code, no route, no mode, no storage (T-056, T-057). No change to the FSM editor's behavior or look. No change to `SidePanel`, `ToolRail`, `HistoryButtons`, `SaveStatusLine`, `Toast`, `Announcer` or the canvas, except an import path if one moves (say so). No new test file unless the refactor needs one.

**Fixtures (the oracle; write the procedure down in `REPORT.md` before you change a file):**

- *F1, the pictures do not change.* Before you touch anything, on a clean `staging`, build and serve the site (`pnpm build`, the same preview server that Playwright uses) and, with a throwaway Playwright script, take full-page and editor-region screenshots (PNG, animations disabled, caret hidden, the same viewport, fonts loaded) on the **desktop** and **phone** projects of these eight states: (1) `/sandbox` empty with the first-run card; (2) `/sandbox` with the sample machine open and one state selected; (3) the same with the label box open on an edge (`Enter` on a selected edge); (4) the same with the Tabel tab of the panel open; (5) the same with the Konversi tab open at its list; (6) the same after a state was deleted, so that the toast shows; (7) `/soal/<an id from content/questions>` with its editor and the Umpan balik tab; (8) the context menu open on a state. Save the 16 PNGs. After the refactor, take them again. **Every pair must be pixel-identical** (compare the decoded pixels; zero differing pixels). If one differs, find out why and fix it; do not accept a difference, and do not change a threshold. Report the 16 results.
- *F2, the DOM does not change.* For the same states, save `document.querySelector('.editor').outerHTML` with the scoped class hashes removed (Svelte adds `svelte-<hash>` classes; strip them), before and after, and compare them: identical, except where the frame legitimately adds no wrapper element. If you must add or remove a wrapper element, list each one in `REPORT.md` and say which e2e selector it could affect; the e2e run (F3) is the check.
- *F3, nothing else changed.* Every existing test passes unchanged (`vitest run`, and the Playwright specs that drive the editor: `grep -l "editor" web/e2e` finds them) on the desktop and phone projects, plus the `axe` specs. No existing test file is edited. `pnpm size`: every route stays under 170 KB; the FSM routes may grow by at most 0.3 KB gzip.

**Acceptance criteria:**
- AC1: F1: 16 of 16 pairs pixel-identical.
- AC2: F2 holds, with the list of wrapper changes (ideally none).
- AC3: F3: all existing tests pass, no test file edited, size within the limits (report before and after).
- AC4: `Editor.svelte` is markedly shorter (report the line counts before and after), and no CSS rule that belongs to the frame is left in it (list the rules that moved).
- AC5: deliberate breaks, each shown failing, then restored: drop one moved CSS rule (for example the phone dock rule: F1 must show a difference on the phone project); change the order of the toast and the stage in the frame (F1 or F2 fails); drop the `data-ready` mark (an e2e spec fails: name it); drop the `role="alert"` of the problem line (an e2e or axe spec fails: name it, or say that none does and add the smallest assertion to an existing spec by adding a test, not by editing one).
- AC6: the deepening pass of `AGENTS.md` in `REPORT.md`: the props and snippets of `EditorFrame` (each used by `Editor.svelte` now or named for T-057), duplicated code (none expected), casts (zero).

**Verification:**

```
pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
pnpm --filter web exec playwright test <the editor specs and the axe specs, desktop and phone>
```

Follow rule 12 of `AGENTS.md` for every shell command (the Playwright runs are long: run them in the background, read their output, and do not poll more than twice without looking). Paste real output into `REPORT.md`.

**Rollback:** `git revert <sha>`. Nothing else reads the frame yet.

**Depends on:** T-053 (merged).

**Notes for worker:** (1) Read `Editor.svelte` in full, `ToolRail.svelte`, `HistoryButtons.svelte`, `SaveStatusLine.svelte`, `Toast.svelte`, `Announcer.svelte` and `SidePanel.svelte` before you write a line, and state your plan in the restatement: the props and snippets of the frame, which CSS moves, and how you will keep the DOM identical. (2) Svelte scopes CSS to the component that holds the element: a rule in the frame that targets an element rendered from a snippet of `Editor.svelte` needs care (use the frame's own wrapper classes, or move the rule to where the element is). The pictures are the judge. (3) Do the move in small steps and take the screenshots after each; commit when a step is pixel-identical. (4) No `any`, no `@ts-ignore`, no `as unknown as`. (5) Edit with the edit tool, not with `sed` or a script, and run `git diff` after every edit. (6) Your `REPORT.md`, not your chat summary, is the record.

---

## Task T-056 — PDA editor, part 7 of 10: saving a PDA on the device

**Status:** done
**PR:** #180
**Owner:** worker
**Branch:** `task/T-056-pda-storage`

**Goal:** A PDA document can be saved on the device after each change and opened again, with **no screen**. Today the storage (`createAutosave`, the record, `openLatest`, `listEntries`) knows only `MachineDocument`. This task teaches it the PDA without changing what it does for the FSM: one autosave queue for both documents (a codec says how a document becomes the text of the record), a PDA record in the **same store** as the machines with the shape that T-052 will list, a way to open the PDA of the last visit or make an empty one, and the guarantee that the FSM list and the FSM "last machine" rule never see a PDA record (the way they never see a question's record, `question-work.ts`). Everything is checked with a memory store and with stores that refuse. See `docs/agent/DECISIONS.md` (2026-11-08), ADR 0023 (saved machines), and `design/screens/pda-editor.md`, section 1.

**Decisions already made (do not reopen; ask the planner if one looks wrong):**

- **Same store, marked record.** A PDA record is a `SavedMachine`-like record in the same `MachineStore` and the same IndexedDB object store (no second database, no upgrade of the database). It has `recordVersion: 1`, **`type: 'pda'`** (new field; an FSM record has none, so every record already saved stays valid), `kind: 'dpda' | 'ndpda'`, the usual `title`, `createdAt`, `updatedAt`, `openedAt`, and `doc` = `serializePdaDocument(doc)`. Its id is `newId()`. No `titles`, `tests` or `progress`. The type of the record is a **union** (or another honest typing, proposed in your restatement): the code that reads an FSM record must not be able to treat a PDA record as one, and nothing is cast.
- **Kept apart for now.** `listEntries` (the list "Mesin saya"), `openLatest` and every other FSM storage function ignore records with `type: 'pda'`. T-052 lists both kinds; until then a PDA is not in the list. Existing FSM storage tests pass without any edit.
- **One autosave.** `createAutosave` keeps its name, its options and its behavior for the FSM (every call site and every existing autosave test unchanged) and gains what it needs to serve a PDA document: a codec for how a document becomes the text of the record and which `title` and `kind` the record copies. One queue, one retry rule, one order; do not write a second autosave. The `tests` and `progress` fields stay FSM-only (a PDA record has neither).
- **Opening.** `openLatestPda(store, now)` opens the PDA record with the biggest `openedAt` (ties by id, as the FSM does) and writes its new `openedAt` (a refused write does not stop it from opening); a record that cannot be read is skipped **and kept exactly as it is**; if none can be read or none exists, an empty NDPDA (`createPdaDocument()`) is saved as a new record (a store that refuses that write does not stop it from opening, as `openQuestionWork` does). It returns `{ record, doc, skipped }` as `openLatest` does. An error of `store.list()` propagates (the caller, `openStore()`, already falls back to memory).
- **Reading.** `readStoredPda(text)` never throws and has the reasons of `readStoredDocument`: `'corrupt'` (not JSON, not an object, no integer `schemaVersion`, longer than `LIMITS.documentBytes`, or refused by `parsePdaDocument`), `'newer'` (`schemaVersion` above 1), `'unsupported'` (a version below 1: there is no migration). The migration table for the PDA starts empty, like the FSM's.
- **Creating.** `createPdaMachine(store, doc, now)` makes and saves a record for a document (used for the empty one and later for T-052's examples and imports).
- **No UI, no route, no change to the PDA document, commands or history, and no new message key** (the save line and its texts are the FSM's and are reused by T-057).

**Scope (in):**

- `web/src/lib/storage/store.ts` (the record type), `autosave.ts` (the codec), `machines.ts` and `library.ts` (ignore PDA records), `index.ts` (exports).
- `web/src/lib/storage/pda-work.ts` (new): `readStoredPda`, `createPdaMachine`, `openLatestPda`, and the PDA codec for the autosave.
- `docs/decisions/0047-saving-a-pda.md` (the decisions above, short).
- Tests, written first: `web/src/lib/storage/pda-work.test.ts`, `autosave.pda.test.ts` and `pda-work.property.test.ts` (new files), with the fixtures below. A small helper for a store that refuses (in a test support file, not in a shipped module).

**Non-goals (out):**

- No list, no dialog, no row, no chip (T-052). No `.jff` or JSON file (T-052). No share link. No second database. No change to how FSM records are written, read, listed or opened, and no edit of an existing test. No sync, no account.

**Fixtures (the oracle; derive the values by hand first and write the derivation in `REPORT.md`; the document is `wwrSample()` of T-033 unless said otherwise; `now` is a fake clock):**

- *F1, a new record and a save.* `createPdaMachine(store, wwrSample(), () => 1000)` returns and stores `{ id: <new>, recordVersion: 1, type: 'pda', title: <title of the sample>, kind: 'ndpda', createdAt: 1000, updatedAt: 1000, openedAt: 1000, doc: serializePdaDocument(sample) }` (no `titles`, `tests` or `progress` key). An autosave on that record with the PDA codec and a `now` of 2000: `schedule(doc2)` where `doc2` is the sample with `setKind dpda` and a new title, then `flush()`: the stored record has `kind: 'dpda'`, the new `title`, `updatedAt: 2000`, `createdAt: 1000`, `openedAt: 1000`, `type: 'pda'`, and `doc` equal to `serializePdaDocument(doc2)`; `status()` is `'saved'`.
- *F2, the records keep to their own kind.* A store with an FSM record `A` (`openedAt: 5000`), a question record `soal:x` (`openedAt: 6000`), and two PDA records `P1` (`openedAt: 2000`) and `P2` (`openedAt: 3000`): `openLatestPda` returns `P2`, with `openedAt` rewritten to `now()` and nothing else changed; `P1`, `A` and `soal:x` are byte-identical in the store afterwards; `skipped` is `[]`. On the **same store**, the existing `openLatest` returns `A` (not a `P`), and `listEntries` returns only `A`.
- *F3, a record that cannot be read.* Store with `P1` (`openedAt: 9000`, `doc: "not json"`), `P2` (`openedAt: 8000`, a good document) and `P3` (`openedAt: 7000`, a good document with `"schemaVersion": 2`): `openLatestPda` returns `P2`, and `skipped` is `[{ id: P1, title: …, reason: 'corrupt' }]` (a record after the first readable one is not looked at). With only `P1` and `P3` (and a `P4` with `"schemaVersion": 0`, `openedAt: 6000`): no record can be read, so an empty NDPDA is saved as a new record; `skipped` lists `P1` (`'corrupt'`), `P3` (`'newer'`) and `P4` (`'unsupported'`) in that order; `P1`, `P3` and `P4` are byte-identical afterwards; the store has four PDA records. Text cases for `readStoredPda`: `""`, `"null"`, `"[]"`, `"{}"`, `{"schemaVersion":1.5}`, a document with a transition that names a missing state: each `'corrupt'`.
- *F4, a write that is refused (failure injection).* A store whose `put` throws on the calls that the test names. (a) An autosave on a PDA record whose first write is refused: after `schedule(docA)` and `flush()`, `status()` is `'failed'` and the store still holds the old text; then `flush()` again with no new `schedule` writes `docA` (`'saved'`); and `schedule(docB)` after a failure writes `docB`, never `docA` (the newest wins). (b) `openLatestPda` on a store whose `put` always throws: it still returns a document (the empty one) and a record, and the first `schedule` and `flush` then report `'failed'`. (c) `openLatestPda` on a store whose `list` throws: the error propagates.
- *F5, order and bursts.* With a fake timer and a delay of 10 ms: 50 calls of `schedule` in a burst give at most 2 writes, and the last stored document is the 50th. With a store whose first `put` finishes late and whose second finishes at once: the writes happen one after the other (the second starts after the first finished), so the stored text is never an older document than a later one.
- *F6, the size rule at the boundary.* A good PDA text padded with trailing spaces to exactly `LIMITS.documentBytes` characters reads as a document; to `documentBytes − 1`, the same; to `documentBytes + 1`: `'corrupt'`.
- *F7, properties (seeded; 1000 cases, and the larger run: 10000 once, pasted).* (a) For random valid PDA documents (draw state names, symbols and titles from an adversarial pool as well as ordinary ones: `,`, `a,b`, `eps`, quotes, backslash, surrogate pairs, a combining sequence, a 32-character name, a 100-character title), `readStoredPda(serializePdaDocument(doc))` equals `doc` (`pdaDocumentsEqual`). (b) The same document through a memory store with the autosave and then `openLatestPda` is equal. (c) `readStoredPda` never throws on random text (also lone surrogates, control characters, a 2 MB string).
- *F8, nothing changed for the FSM.* Every existing test in `storage/` and everywhere passes without an edit; no call site of `createAutosave` changes; `pnpm size` shows no route above its limit (the PDA code is not imported by any route yet).

**Acceptance criteria:**
- AC1: F1 to F7 give exactly the results above.
- AC2: F8: no existing test file is edited (`git diff` shows none), and the e2e specs of the saved machines on the three engines (`e2e/cross/storage.spec.ts`) pass on the engines that the CI runs (paste the counts; on a machine that has only Chromium, run it there and say so).
- AC3: the typing: no cast, no `any`, no `@ts-ignore`; say in `REPORT.md` how an FSM-only function is stopped from receiving a PDA record (the type, not a comment).
- AC4: one autosave queue: `git diff` shows no second copy of the loop, the retry rule or the timer.
- AC5: deliberate breaks, each shown failing, then restored: let `openLatestPda` take FSM records (F2 fails); let `openLatest` or `listEntries` take PDA records (F2 fails: the test is new, in your new file); sort by `createdAt` instead of `openedAt` (F2 fails); let a new empty PDA overwrite an unreadable record (F3 fails); drop the retry after a failure (F4a fails); let two writes run at once (F5 fails); change `> documentBytes` to `>= documentBytes` (F6 fails); drop `type: 'pda'` from the new record (F1 fails); do not copy `kind` into the record on a change (F1 fails).
- AC6: `pnpm size`: every route stays under 170 KB; report before and after (nothing should change).
- AC7: the deepening pass of `AGENTS.md` in `REPORT.md`: the new exports, the shape of the codec (each option used), duplicated logic, casts (zero), and the adversarial pool of F7.

**What T-057's e2e must cover for this task** (written here so it is not forgotten; this task does not run it): in the three engines, the first visit to the PDA mode saves an empty PDA as a record with `type: 'pda'`; a change is saved and there after a reload; a PDA record that cannot be read is skipped and kept; a refused write shows the warning and the next save clears it; a browser with no storage still lets the editor work, with the warning. The FSM list never shows the PDA record.

**Verification:**

```
pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
```

Use the quick loop while you work (one file or pattern) and the whole gate once before you push; follow rule 12 of `AGENTS.md` for every shell command. Paste real output into `REPORT.md`, with the hand derivations of F1 to F6 first.

**Rollback:** `git revert <sha>`. Nothing else reads the new code yet, and the FSM path is unchanged (F8).

**Depends on:** T-033 (merged: `serializePdaDocument`, `parsePdaDocumentText`, `createPdaDocument`), T-055 (merged, only for the order of the series).

**Notes for worker:** (1) Read `store.ts`, `autosave.ts` (all of it, and its three test files), `machines.ts`, `library.ts`, `library.svelte.ts`, `question-work.ts`, `migrate.ts`, `memory.ts`, `indexeddb.ts`, and `pda-document.ts` before you write a line, and state your plan in the restatement: the record type, the codec, and how each FSM function stops seeing PDA records. (2) The smallest change to the existing storage files wins; the proof is that no existing test needs an edit. (3) The document, not the storage, decides what a valid PDA is: `readStoredPda` calls `parsePdaDocument`. (4) No `any`, no `@ts-ignore`, no `as unknown as`. (5) Edit with the edit tool, not with `sed` or a script, run `git diff` after every edit, and follow rule 12 for shell commands. (6) Your `REPORT.md`, not your chat summary, is the record.

---

## Task T-057 — PDA editor, part 8 of 10: the editor shell and the mode

**Status:** done
**Commit:** `9e56718`
**Branch:** `task/T-057-pda-editor-shell`
**Fixes:** PR 183 (`task/T-057-fixes`), merged on 2026-11-08, after PR 182 was merged before its review fixes. It made E8 test the reveal of the label on a phone (it fails with `revealLabeling={false}`), made E4 check the four transitions, and kept focus inside the label form when a row is deleted (E3, 24 of 24).

**Goal:** A student can choose **Otomata Pushdown (PDA)** in the mode switcher and build a PDA on the canvas: add, move, rename and delete states, mark the start and accepting states, make transitions with the three-field form, undo and redo, zoom, and have everything saved on the device. This is the first screen of the PDA editor, put together from the parts that are already merged: `EditorFrame` (T-055), `EditorCanvas` with its label slot and `+ n lagi` (T-053), `PdaLabelForm` and `PdaLabelPopover` (T-054), `createPdaEditor` (T-049), `pdaDiagram` (T-039) and the saving of T-056. **No panel yet** (T-051): no tabs, no kind switch, no badge, no checks, no table. No list, files, examples or share link (T-052). No simulation (T-038). No auto layout (a label-aware layout is a separate proposed task: PDA labels need states about 410 units apart in the worst case). See `design/screens/pda-editor.md` sections 1, 2, 8 and 9, `docs/agent/DECISIONS.md` (2026-11-08), ADR 0043, 0044, 0046 and 0047.

**Decisions already made (do not reopen; ask the planner if one looks wrong):**

- **The mode.** `WorkstationMode` becomes `'fsm' | 'pda' | 'language' | 'grammar'`. In `WorkstationSwitcher.svelte` the item `pda` gets `mode: 'pda'` and loses `disabled` (no "Segera Hadir" badge on it; `tm` keeps both), and `activeLabel` has a case for it (`sandbox.mode_pda`). The address is `/sandbox?mode=pda` and the choice is kept in `localStorage` under the key that the other modes use (`webtomata_sandbox_mode`), exactly as `selectMode` does today.
- **One reader for the mode.** The same list of four names is now written in five places of `+page.svelte`. A small pure function `readMode(search: string, saved: string | null): WorkstationMode` (new file `web/src/lib/workstation-mode.ts`, with the type `WorkstationMode` and the list; the switcher and the page import the type) replaces them: a valid `mode` in the query wins; otherwise a valid saved value; otherwise `'fsm'`. Case counts (`PDA` is not valid). The page and the switcher keep behaving as before for the three old modes.
- **Loaded on demand.** The PDA mode is a component loaded by a dynamic `import()` when the mode is chosen, like `LanguageWorkstation` and `GrammarWorkstation`: `web/src/lib/editor/PdaWorkstation.svelte`. No existing route's first JavaScript may carry PDA code. While it loads, the page shows the same empty `.frame` with `aria-busy="true"` that the other modes show.
- **The PDA does not use the FSM `library`.** `PdaWorkstation` opens its own store (`openStore()`), then `openLatestPda(store, now)` (T-056), makes `createAutosave({ store, base: record, codec: pdaDocumentCodec })` and mounts `PdaEditor` in a `{#key}`. A store whose `list` throws after `openStore` succeeded falls back to a memory store with `persistent = false`, as `Library.start` does. The FSM `library`, its list, its notice and its toast are not touched. (The FSM `library.start` still runs when the page opens, as it does today when the mode is `language` or `grammar`; leave that as it is.)
- **The notice for unreadable records.** The page shows the existing notice ("N mesin tidak bisa dibuka. Datanya tidak dihapus.", keys `storage.skipped_*`) for the PDA records that `openLatestPda` skipped, while the PDA mode is active; in the PDA mode the FSM list's skipped records are not mentioned, and in the other modes the PDA's are not. `PdaWorkstation` reports `skipped` through a prop (`onopened(skipped)` or similar: the shape is yours to propose).
- **`PdaEditor.svelte`** (new, in `web/src/lib/editor/`; props `doc: PdaDocument`, `autosave?: PdaAutosave`, `persistent?: boolean`): it owns `createPdaEditor(doc)`, the snapshot subscription, and renders `EditorFrame` with `title` (the document's title or `editor.untitled`; read-only: renaming is T-052), `stateCount`, the save line (`hasAutosave`, `saveStatus`, `persistent`), `onfit` (`canvas.zoom('fit')`), the `problem` line (`unavailable` or `failed`, as `Editor.svelte` computes it), the same `hintLine` rule for the transition tool (`editor.hint_pick_source` / `editor.hint_pick_target`), the toast with Urungkan, and the announcement. The stage is `EditorCanvas` with `diagram` = `pdaDiagram` with `more` = `pda_editor.edge_more` (one function, made once, not on each render), `menuLabels={pdaMenuLabels}`, no `onlayout` (so no auto-layout entry anywhere), `onmore` left to the default (select the edge). No `panel` on a laptop. **It must not import the engine client**: nothing in it needs the worker yet.
- **The label form: popover on a laptop, sheet on a phone.** The canvas `label` snippet renders `PdaLabelPopover` on a laptop. On a phone (the frame's breakpoint, `max-width: 39.99rem`), it renders nothing, and the `panel` snippet of the frame renders an `<aside>` (the frame already orders an `aside` between the work column and the tool rail on a phone) that holds `PdaLabelForm`, only while an edge is being labeled. The choice of the two is **made when the form opens and kept until it closes** (a window that is resized while the form is open does not move it, because that would lose what the student typed). The sheet's height is that of its content, at most 60% of the editor's height, and it scrolls inside; it takes the focus on its first field as the popover does, and gives the focus back to the canvas when it closes. Its accessible name is the form's own (`pda_editor.form_title`). **The edge that is being labeled must stay in view above the sheet:** check it in the restatement against the canvas code, and if it can end up hidden, propose the smallest fix (for example, the canvas keeps the open edge's label inside the visible stage); do not leave it to chance, the phone spec below checks it.
- **Saving.** The wiring that `Editor.svelte` has between the editor and the autosave (the status for the save line; `schedule` on each new document, compared by reference as there; `flush` when the tab is hidden, on `pagehide` and when the editor is removed; the "leaving the page loses unsaved changes" guard) must not be written a second time. Move the part that is not FSM into one small shared function or runes module (proposed in the restatement, for example `web/src/lib/editor/autosave-binding.svelte.ts`), used by both editors. `Editor.svelte` changes only by the lines that move, and `scheduleTests`/`scheduleProgress` stay in `Editor.svelte`. If the change to `Editor.svelte` turns out to be more than a mechanical move, say so in the restatement and the planner decides between this and a copy that is named as debt.
- **Empty canvas.** An empty PDA canvas shows the hint that `EditorCanvas` already shows (`editor.hint_empty`); there is no first-run card, no "Coba contoh" and no tour here (T-052). No library button, no share button, no help button, no layout button in the bar.
- **Existing tests.** Exactly one existing spec changes, because the behavior it asserts changes on purpose: `e2e/switcher.spec.ts` (the disabled items are now one, not two; the item count is four enabled and one disabled, not three and two). Say in `REPORT.md` which lines. Any other existing test that fails is a bug in the change, not a test to edit.
- **No new message key is expected** (`pda_editor.*`, `sandbox.mode_pda`, `editor.*` and `storage.*` exist). If you need one, add it to `id` and `en` and say why.

**Scope (in):**

- `web/src/lib/workstation-mode.ts` (new) with its unit test; `web/src/lib/components/WorkstationSwitcher.svelte`; `web/src/routes/sandbox/+page.svelte` (the mode, the lazy import, the notice).
- `web/src/lib/editor/PdaWorkstation.svelte` and `web/src/lib/editor/PdaEditor.svelte` (new).
- The shared autosave wiring (new file) and the lines of `web/src/lib/editor/Editor.svelte` that move into it.
- `web/src/lib/editor/EditorCanvas.svelte` only if the open edge must be kept in view on a phone (say so in the restatement).
- `e2e/pda-editor.spec.ts` and `e2e/cross/pda-storage.spec.ts` (new), and the one edit of `e2e/switcher.spec.ts`. A helper in `e2e/cross/db.ts` may gain an optional parameter if the PDA specs need it; no existing behavior changes.
- `docs/decisions/0048-pda-editor-shell.md` (the decisions above, short).

**Non-goals (out):**

- No panel, tab, kind switch, badge, checks, table or definition (T-051). No list "Mesin saya" with PDAs, no `.jff` or JSON, no examples, no first-run card, no rename of the title, no share link (T-052). No simulation or conversion (T-038). No auto layout. No change to the FSM editor's look or behavior, to `EditorFrame`, to the editor core, to the PDA document, commands, label parsing or storage. No change to any existing test except the lines of `switcher.spec.ts` named above.

**Fixtures (the oracle; derive the values by hand first and write the derivation in `REPORT.md`):**

- *F1, `readMode(search, saved)` (a unit test).* `('?mode=pda', null)` → `'pda'`; `('?mode=pda', 'grammar')` → `'pda'` (the query wins); `('', 'pda')` → `'pda'`; `('?mode=xyz', 'pda')` → `'pda'` (an invalid query value falls back to the saved one); `('?mode=', 'language')` → `'language'`; `('', 'tm')` → `'fsm'`; `('', null)` → `'fsm'`; `('?mode=PDA', null)` → `'fsm'`; `('?mode=pda&mode=fsm', null)` → `'pda'` (the first one); `('?mode=fsm', 'pda')` → `'fsm'`; each of `fsm`, `language`, `grammar`, `pda` alone gives itself. A property over random strings for both arguments (including `?`, `&`, `=`, `%`, lone surrogates and a 1 MB string): it never throws and always returns one of the four.
- *F2, nothing changed for the FSM.* Every existing test passes (the one edit named above excepted); the FSM storage specs (`e2e/cross/storage.spec.ts`) pass unchanged, which is also the proof of the shared autosave wiring; `pnpm size` shows no route's first JavaScript grown by more than 0.5 KB gzip, and reports the size of the PDA chunk (loaded only when the mode is chosen).
- *E1, the switcher* (laptop and phone). The PDA item is an enabled option with no badge; the `tm` item is still disabled; choosing PDA changes the address to `?mode=pda`, stores `pda`, shows the PDA editor (`.editor` with the tool rail and the empty-canvas hint, no first-run card, no tab strip), and survives a reload; choosing "Mesin FSM" returns to the FSM editor with the same machine as before and removes the query.
- *E2, the label form opens four ways* (laptop): `Enter` on a selected edge; a double click on its label; the context-menu item "Ubah transisi" (and the item is not called "Ubah label"); and automatically after a transition is made with the Transisi tool. On a phone: the same three that exist on touch (selected edge + the menu by long press, and the automatic one) open the sheet, not the popover.
- *E3, typing and sending* (laptop): three fields, `Simpan` and `Enter` both send; the diagram label shows `a / ε / A`; `Tab` goes Baca → Pop → Push → Hapus → the add-row button → Batal → Simpan (the order that `PdaLabelForm` has; write the actual order in the report and assert it); `Esc` cancels and the document is unchanged; leaving the form by a click on the canvas sends a changed form and cancels an unchanged one; `Ketik ε` and `Ctrl+E` write `ε`; a refused row (a read field `ab` with a one-character input alphabet) shows its text and keeps the form open; add a row and delete a row; delete every row of an edge removes the edge and Urungkan brings it back (one undo step each).
- *E4, `+ n lagi`* (laptop): an edge with four transitions shows two lines and `+ 2 lagi`; pressing it selects that edge (the announcement says so), exactly once; in the Hapus tool, pressing it deletes the whole edge (a click anywhere on an edge's label does, `+ n lagi` included; decided on 2026-11-08, see `DECISIONS.md`), the toast offers Urungkan, and Urungkan restores all four transitions as one undo step.
- *E5, building `wwᴿ`* (laptop and phone): with the tools only (no keyboard shortcut for the structure), build the machine of `wwrSample()` (T-033; even palindromes, the one in `pda-editor.svg`: read its states, transitions, start and accepting state from the sample, do not invent them), set the start and the accepting state, undo everything with the undo button, redo it, and check that the saved record's `doc` parses to the sample's transitions (compare the set of transitions by state name, not the state ids).
- *E6, the work is not lost when the mode changes* (laptop): make a change in the PDA mode and, within the autosave delay, switch to "Mesin FSM" and back: the change is there (the editor flushes when it is removed).
- *E7, axe* (laptop and phone): no violations on the empty PDA editor, with the form open (popover and sheet), and with the context menu open.
- *E8, the phone sheet* (phone): opening the form replaces nothing on the canvas side (the popover is not in the DOM); the sheet is an `aside` below the stage and above the tool rail; its height is at most 60% of the editor's; the fields are 44 px high and at least 16 px in font size; the labeled edge's label box lies inside the visible stage rectangle while the sheet is open; closing the sheet gives the focus back to the canvas; rotating is not tested.
- *S1 to S6, the PDA storage on the engines that run `cross/` specs (desktop Chrome, Firefox, and the webkit phone)* in `e2e/cross/pda-storage.spec.ts`, built on `e2e/cross/db.ts` and the techniques of `storage.spec.ts`: (S1) the first visit to the PDA mode saves an empty PDA as a record with `type: 'pda'` and `kind: 'ndpda'`, and no FSM record is made by it that was not made before; (S2) a change is saved and there after a reload; (S3) a PDA record that cannot be read (`doc: "not json"`, and one with `schemaVersion: 2`) is skipped, the notice says so, and the record is byte-identical afterwards; (S4) a refused write (`IDBObjectStore.prototype.put` patched as in `storage.spec.ts`) shows the "Belum tersimpan" warning and the next save clears it; (S5) a browser with no storage (as `storage.spec.ts` simulates it) still lets the editor work, with the "Tidak tersimpan" warning; (S6) in the FSM mode, "Mesin saya" never lists the PDA record, and the FSM "last machine" is not the PDA.

**Acceptance criteria:**

- AC1: F1 gives exactly the values above (unit test).
- AC2: F2: no existing test edited except the lines of `switcher.spec.ts`; the FSM e2e specs that type labels, edit states, save and switch modes pass on the desktop and phone projects (paste the counts); `pnpm size` as in F2.
- AC3: E1 to E8 pass on the desktop and phone projects (E2 to E4 and E6 on desktop, E8 on phone, the others on both as marked) and S1 to S6 pass on every project that runs `cross/` specs (paste the counts). On a machine that lacks Firefox or WebKit, run what you can, say what you could not, and let CI run the rest.
- AC4: `PdaEditor` does not import the engine client or `MachineDocument`; `PdaWorkstation` does not import `library.svelte.ts` (`grep` output in the report). The shared autosave wiring exists once (`git diff` shows the lines moved, not copied).
- AC5: deliberate breaks, each shown failing, then restored: make `readMode` ignore the saved value (F1 fails); leave the PDA switcher item disabled (E1 fails); drop `menuLabels` (E2 fails on the item text); render the popover on a phone as well (E8 fails); drop the flush when the editor is removed (E6 fails); do not pass `persistent` to the frame (S5 fails); do not show the skipped notice (S3 fails); let the sheet's height be unlimited (E8 fails); let `PdaWorkstation` open the FSM store's `openLatest` (S1 or S6 fails).
- AC6: the deepening pass of `AGENTS.md` in `REPORT.md`: the props and snippets of `PdaEditor` (each used), duplicated code between `Editor.svelte` and `PdaEditor.svelte` (list what is left and why), casts (zero), and the size numbers.

**Verification:**

```
pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
pnpm --filter web exec playwright test pda-editor switcher storage pda-storage editor-edges editor-transitions editor-flows
```

Follow rule 12 of `AGENTS.md` for every shell command (the Playwright runs are long: run them in the background, read their output, and do not poll more than twice without looking). Paste real output into `REPORT.md`, with the hand derivations of F1 and E5 first.

**Rollback:** `git revert <sha>`. The FSM editor only changed by the lines that moved into the shared wiring, and the PDA mode is reachable only through the switcher item.

**Depends on:** T-056, T-055, T-054, T-053, T-049, T-039, T-033 (all merged).

**Notes for worker:** (1) Read `+page.svelte`, `WorkstationSwitcher.svelte`, `Editor.svelte` (all of it), `EditorFrame.svelte`, `EditorCanvas.svelte` (the props, `labelSlot`, `triggerMore`, the empty hint), `PdaLabelPopover.svelte`, `PdaLabelForm.svelte`, `pda-editor.ts`, `pda-label.ts`, `pda-diagram.ts`, `pda-work.ts`, `autosave.ts`, `e2e/switcher.spec.ts`, `e2e/cross/storage.spec.ts` and `e2e/cross/db.ts` before you write a line, and state your plan in the restatement: the props of `PdaEditor` and `PdaWorkstation`, how the notice reaches the page, the shape of the shared autosave wiring and the exact lines that move out of `Editor.svelte`, how the phone sheet gets the focus and how the open edge stays in view. (2) The popover and the sheet are the same `PdaLabelForm`; do not fork it. (3) Svelte 5 runes: a function that sets up `$effect` must run during component initialization; say how your shared wiring does. (4) A test that asserts the popover or the sheet by class name is fragile; use roles and accessible names (the form's name is `pda_editor.form_title`). (5) No `any`, no `@ts-ignore`, no `as unknown as`. (6) Edit with the edit tool, not with `sed` or a script, and run `git diff` after every edit. (7) Your `REPORT.md`, not your chat summary, is the record.

---

## Task T-051 — PDA editor, part 9 of 12: the panel: tabs, kind switch, checks (read-only table and definition)

**Status:** done
**Owner:** worker
**Branch:** `task/T-051-pda-panel`

**Goal:** The PDA editor gets its panel, as the FSM editor has one: on a laptop a column next to the canvas, on a phone a panel under it with the drag bar. It has two tabs, **Tabel** and **Definisi**. Above the content of both: the **DPDA | NDPDA** switch (one undo step) and the "Pemeriksaan" line (the checks of `validatePda`, asked of the engine in its worker a moment after each change, with a mark on the states that have a check). The Tabel tab here is a **read-only** table of the transitions (Dari, Baca, Pop, Push, Ke, in the engine's order); T-061 makes it editable, T-062 adds the determinism badge. The Definisi tab is the formal definition `M = (K, Σ, Γ, Δ, s, A)`. Pressing `+ n lagi` on the diagram (Pilih tool) selects that edge and opens the Tabel tab with the rows of the edge marked. This is the slice of `design/screens/pda-editor.md` sections 3, 4 (the switch), 6 (the reading part) and 7; the badge (5) and the editing of the table (6) are T-062 and T-061.

**Why three tasks and not one:** the panel as designed needs a shared checker, a shared tab panel, a shared kind switch, a table with three blocks and a badge with pairs; that is a diff nobody reviews in one sitting. T-051 is the frame and the reading; T-061 the editing of the table; T-062 the badge. T-052 comes last (it was "part 10 of 10"; the series has twelve tasks now; decision of 2026-11-08 in `DECISIONS.md`).

**Decisions already made (do not reopen; ask the planner if one looks wrong):**

- **The PDA mode loads the engine now.** The checks come from `engine.validatePda` (crates `engine-core`, `pda.rs`, T-030) through `#lib/engine/client.ts`, as `Editor.svelte` does for the FSM: the call is made after the first draw, in the worker, and the panel says "memeriksa…" until it answers. A failed engine shows the same `EngineNotice` with retry; the editor stays usable. This replaces "the PDA mode never loads the WASM" of `docs/decisions/0048-pda-editor-shell.md` (say so in the new ADR). No TypeScript port of any check or of `determinism`: the engine is the one source. **No change in `crates/`**: if a new engine function seems needed, stop and write a `blocked` entry.
- **One checker for both documents.** `createChecker` (`checker.ts`) is typed for `MachineDocument` and calls `checkItems(answer.value, doc)`. Make it work for any document `D` with the conversion of issues to items passed in (the FSM passes `checkItems`). Its behavior for the FSM must not change: `checker.test.ts` and `editor-checks.spec.ts` pass **without a single edited line**. The PDA gets `pdaCheckItems(issues, doc)` in a new `pda-checks.ts` (the keys of the Rust source map to message keys, like `CHECK_KEYS`; a unit test reads the keys from `pda.rs`, as the FSM's test does, so that a new engine key cannot be forgotten). `ChecksList.svelte` is reused as it is (`onselect(state)` focuses a state); for the checks whose params carry no state, `states` is empty and the row is not pressable, as now.
- **What a PDA check says** (Indonesian drafts, `TODO(review)` where a term is new; the worker writes `en` too; read `crates/engine-core/src/pda.rs` lines 380 to 480 for the params): `pda.no_start_state` reuses `check.no_start_state`; `pda.unreachable_state { state }` reuses `check.unreachable_state`; new keys `pda_check.no_accepting_state` ("Belum ada accepting state."), `pda_check.duplicate_transition { state }` (the same transition twice), `pda_check.pop_never_pushed { state, symbol }` ("Dari {state}, transisi mengambil simbol {symbol} dari stack, tetapi tidak ada transisi yang pernah menaruhnya."), `pda_check.competing_transitions { state, first, second }` (DPDA only; `first` and `second` are **row numbers of the table, 1-based**, i.e. the engine's index plus one: "Pada DPDA, transisi baris {first} dan {second} dari {state} bersaing."), `pda_check.accepting_state_free_move { state }` (DPDA only; word it from the rule in the Rust comment). The engine's `from` param is shown as the state's name; `first` and `second` are row numbers, not state ids (so `pdaCheckItems` must not treat them as states, which `checkItems` does for the names `state`, `from`, `to`).
- **The panel is `SidePanel`, with two tabs.** `SidePanel` takes `tabs` already; its snippets `simulation` and `conversion` are required by its type only. Make every snippet optional and render only the tabs in `tabs` (the FSM passes all of them, so nothing changes for it). The PDA passes `tabs=['table','definition']`; `readTab(storage, tabs)` falls back to the first, Tabel, for a saved value that the PDA panel does not have (`simulation`). No disabled tab, no empty tab. T-038 adds Simulasi first and Konversi last later.
- **The panel is always there in the PDA mode** (there is no first-run card until T-052). On a phone, the label form's sheet **replaces** the panel while it is open (design section 8): in the `panel` snippet of `PdaEditor`, the sheet when a label is being edited, the `SidePanel` otherwise. Nothing typed in the panel is lost by this (the panel has no draft state yet; T-061 must say what it does with its own).
- **The kind switch is `KindSwitch.svelte`, generalized.** It is typed for `'dfsm' | 'ndfsm'` and the keys `kind.dfsm`, `kind.ndfsm`. Give it optional props for the two options (value and label key) with the FSM ones as the default; the PDA passes `dpda` and `ndpda` (new keys `kind.dpda` "DPDA", `kind.ndpda` "NDPDA"). The label stays `kind.label`. The FSM switch must look and behave exactly as before (its e2e and unit tests pass unedited). The switch sends `{ type: 'setKind', kind }` as one undo step with an announcement; it never blocks: choosing DPDA for a machine with competing pairs only gives checks (errors) in the list.
- **The read-only table is a component and a pure function.** `pda-table.ts`: `pdaTableOf(doc)` returns the rows in `doc.transitions` order (which is the engine's order: `comparePdaTransitions`), each with the state names, `read` (`ε` for null), `pop` and `push` as text (leftmost on top; `ε` for the empty string; if every stack symbol has one character the symbols are joined without a space, else with a space: reuse the function that `pda-diagram.ts` uses for the lines of a label, do not write a second one), and the index. `PdaTableView.svelte` draws it as a real `<table>` with a `<caption>`/heading "Transisi (n)", the columns Dari, Baca, Pop, Push, Ke, and one row per transition; no editing, no buttons in the rows; an empty machine shows one calm line (`pda_editor.table_empty`). It is loaded on demand like `TableView` (a dynamic `import()` when the tab opens), so the route's first JavaScript does not grow. On a phone it scrolls sideways inside the panel with the first column fixed (the rule of the FSM table; copy its CSS idea, using only tokens).
- **The definition is a pure function and a component.** `pda-definition.ts`: `pdaDefinitionOf(doc)` and `pdaDefinitionText(doc)` (like `definition.ts`), `PdaDefinitionView.svelte` (like `DefinitionView.svelte`). Content as in the design, section 7: `M = (K, Σ, Γ, Δ, s, A)`, then `K`, `Σ`, `Γ`, `s`, `A` as sets in the document's order, then Δ as one line per transition, `((from, read, pop), (to, push))`, in `--font-mono`, followed by the line `pda_editor.definition_hint` ("Kiri = puncak stack. ε pada pop: tidak memeriksa stack."). An empty start shows `s = –` and an empty set `{}`; a copy button is not part of this task.
- **Marked rows.** `PdaEditor` keeps `marked: ReadonlySet<number>` (indices of rows; not in the document, not in the history). Pressing `+ n lagi` in the Pilih tool (the `onmore` prop of `EditorCanvas`) does three things in this order: select the edge (`editor.selectEdge(from, to)`, as now), open the Tabel tab (also on a phone, where it makes the panel visible if the drag bar had hidden it: use what the FSM does to show the panel), and set `marked` to the rows of that edge. A row in `marked` has the accent bar at its left (a token; the same bar T-062 uses for "Tunjukkan") and `aria-current="true"`. `marked` is cleared when the document changes or when another edge or a state is selected. **The Hapus tool does not call `onmore`**: its click deletes the edge (decision of 2026-11-08); E4 of T-057 stays green and is not edited.
- **States with a check get the mark on the diagram,** through the `flags` prop of `EditorCanvas` (`flagsOf(items)`, as `Editor.svelte` does). Nothing else changes in the drawing: **no dashed edges, no second selection stroke** (design section 2 and 5 asked for them; they need a change in the shared drawing and go to T-062 only if the planner says so; written in `DECISIONS.md`).
- **Message keys.** New keys, each in `id` and `en`: `kind.dpda`, `kind.ndpda`, `pda_check.*` (above), `pda_editor.col_from`, `pda_editor.col_to`, `pda_editor.table_title { count }`, `pda_editor.table_empty`, `pda_editor.definition_hint`, `pda_editor.panel_label` if the panel needs an accessible name. Existing keys reused: `panel.*` for the tab names, `check.*`, `kind.label`, `pda_editor.col_read`, `pda_editor.col_pop`, `pda_editor.col_push`. A term that is not in `docs/glossary.md` is added with `TODO(review)` and named in `REPORT.md`.
- **Size and budgets.** `pnpm size`: no route's first JavaScript grows by more than 0.5 KB gzip (the PDA chunk may grow; report its size before and after; the engine `.wasm` is unchanged, 245.5 KB gzip now, budget 250). If the PDA chunk with the panel loads the engine worker earlier than after the first draw, that is a defect.
- **The cross-engine storage specs** (`e2e/cross/pda-storage.spec.ts`, S1 to S6) must pass unedited on desktop, phone and webkit-phone. If a spec becomes flaky because the engine now loads in the PDA mode, say so in the report and fix it with `engineSettled` where the spec needs it; do not weaken an assertion.

**Scope (in):**

- `web/src/lib/editor/PdaEditor.svelte` (the panel snippet, the checker, `marked`, `flags`, `onmore`, the switch).
- `web/src/lib/editor/checker.ts` (generic) and its test only if the signature needs a new test case (the existing ones unedited); `web/src/lib/editor/Editor.svelte` only for passing `checkItems` to the checker.
- `web/src/lib/editor/pda-checks.ts`, `pda-table.ts`, `pda-definition.ts` (new, with unit tests), `PdaTableView.svelte`, `PdaDefinitionView.svelte` (new).
- `web/src/lib/editor/SidePanel.svelte` (optional snippets), `web/src/lib/editor/KindSwitch.svelte` (options), with unit or e2e tests for the new use and **no edit of an existing FSM test**.
- `web/src/lib/i18n/id.ts`, `en.ts`, `docs/glossary.md` (new keys and terms).
- `web/e2e/pda-panel.spec.ts` (new). `docs/decisions/0049-pda-panel.md` (short: the decisions above, and that it supersedes the "never loads the WASM" line of 0048).

**Non-goals (out):**

- Editing in the table, the alphabet chips, the state rows, `+ Tambah transisi` (T-061). The determinism badge, the list of competing pairs, "Tunjukkan", the note under the list (T-062). Dashed competing edges and a second selection stroke (T-062 if the planner decides). Simulation, conversions, the stack picture (T-038). "Mesin saya", `.jff` and JSON, examples, first-run card, renaming the title, share link (T-052). Any change in `crates/`, the PDA document, commands, label parsing, storage, `EditorFrame`, or the diagram geometry. No auto layout.

**Fixtures (the oracle; derive each value by hand first and write the derivation in `REPORT.md`):**

- **Machine F** (`kind: 'dpda'`): input alphabet `a, b`; stack alphabet `A`; states `q0` (id 0, start) and `q1` (id 1, accepting); transitions, in the engine's order: row 1 `(q0, a, ε → A, q0)`; row 2 `(q0, b, A → ε, q1)`; row 3 `(q1, b, A → ε, q1)`.
  - *F1, `pdaTableOf(F)`:* three rows: `q0 | a | ε | A | q0`, `q0 | b | A | ε | q1`, `q1 | b | A | ε | q1`. Add a stack symbol `Z0` to F's stack alphabet and a transition `(q1, ε, Z0 → A Z0, q1)`: the new row reads `q1 | ε | Z0 | A Z0 | q1` (a longer symbol name, so the symbols are joined with a space) and it is the **first** of the rows of q1 (ε reads come first).
  - *F2, `pdaDefinitionText(F)`:* `M = (K, Σ, Γ, Δ, s, A)`; `K = {q0, q1}`; `Σ = {a, b}`; `Γ = {A}`; `s = q0`; `A = {q1}`; and the three lines `((q0, a, ε), (q0, A))`, `((q0, b, A), (q1, ε))`, `((q1, b, A), (q1, ε))`. A document with no start shows `s = –`.
  - *F3, the checks of F as DPDA:* the engine returns no issue, so the panel says "lengkap" (use the same wording as the FSM's). **Verify this with the engine first** (a `cargo test` or the existing `pda-document.wasm.test.ts` style test); if it returns something, report it and use what it returns.
- **Machine G** = F with `kind: 'dpda'` and one more transition `(q0, ε, ε → ε, q1)`. In the engine's order the new transition is row 1 (read ε first), so F's rows become 2, 3, 4. It competes with the `a` row and with the `b` row of q0 (an ε read competes with every read, and an empty pop is a prefix of every pop), so the engine's `determinism` returns two pairs, `(row 1, row 2)` and `(row 1, row 3)`, as indices 0-based `(0, 1)` and `(0, 2)`.
  - *F4, `pdaCheckItems`:* for G as DPDA: two `error` items `pda_check.competing_transitions` with `state` q0 and row numbers `1, 2` and `1, 3`; as NDPDA: no such items (the engine only reports them for a DPDA). **Verify with the engine, as in F3.** A test also feeds `pdaCheckItems` an issue with an unknown key and gets `check.other` with the code, as the FSM does.
- *F5, the FSM is untouched:* `checker.test.ts`, `checks.test.ts`, `editor-checks.spec.ts`, `editor-panel*.spec.ts`, `editor-table.spec.ts`, `editor-run.spec.ts` and the kind-switch tests pass with no edited line (paste the counts).
- *E1, the panel* (laptop and phone): in the PDA mode the panel has two tabs, Tabel and Definisi, in this order, none disabled; Tabel is open the first time (also when the FSM mode had saved `simulation`); a tab remembered by the FSM mode and valid for both (`table`, `definition`) is kept; the arrow keys move between the tabs; on a phone the panel is under the canvas with its drag bar and the sheet replaces it while the label form is open and the panel comes back after Simpan or Batal.
- *E2, the kind switch* (laptop and phone): the default is NDPDA; choosing DPDA is one undo step and undo brings NDPDA back; the switch is a radio group with the arrow keys; it never blocks an edit; on G (build it with the tools) choosing DPDA makes the checks line show two errors and marks `q0` on the diagram, and choosing NDPDA clears them.
- *E3, the checks line* (laptop): an empty PDA shows "memeriksa…" and then the two checks that the engine reports for it (no start state; the accepting warning, as the engine says: derive which from `pda.rs`); building F makes it say "lengkap"; pressing a check focuses its state; a simulated engine failure shows the notice with retry, and the editor still takes edits (use the technique of `editor-checks.spec.ts`).
- *E4, the table and the diagram agree* (laptop and phone): build G with the tools; the Tabel tab shows four rows in the engine's order (the ε row first); make a label with the form on the diagram and the new row appears at its sorted place; undo removes it; on a phone the table scrolls sideways with the first column fixed (assert that its `scrollWidth` is larger than its `clientWidth` and the first column's x does not move after a scroll).
- *E5, `+ n lagi` opens the table* (laptop and phone): an edge with four transitions shows `+ 2 lagi`; pressing it in Pilih selects the edge, opens Tabel, marks the four rows of the edge (`aria-current="true"`, the accent bar), and selecting a state clears the marks; in Hapus, pressing it deletes the edge and **does not** open the panel.
- *E6, the definition* (laptop): the Definisi tab shows F2's text for F, and changes after an edit.
- *E7, axe* (laptop and phone): no violations with each tab open, with the checks list open, and with the sheet open.
- *E8, nothing slower* : the engine worker is requested after the first draw, not before (the technique of the FSM's engine specs), and `pnpm size` as above.

**Acceptance criteria:**

- AC1: F1 to F4 give exactly the values above (unit tests; F3 and F4 first checked against the engine, with the output in the report).
- AC2: F5: no existing test edited (paste the pass counts of the named specs on desktop and phone); `pda-storage.spec.ts` passes on desktop, phone and webkit-phone, and on Firefox if the machine has it (say so if it does not).
- AC3: E1 to E8 pass on the desktop and phone projects as marked (paste the counts).
- AC4: `pnpm size` as in the decisions (paste the numbers); no `crates/` file changed (`git diff --stat`).
- AC5: deliberate breaks, each shown failing **on the final code** with the failing line pasted, then restored: pass `tabs=['simulation','table','definition']` to the PDA panel (E1 fails); make `pdaTableOf` sort by the order of insertion instead of `doc.transitions` (F1 fails); treat `first` and `second` as state ids in `pdaCheckItems` (F4 fails); do not clear `marked` when the document changes (E5 fails); make Hapus call `onmore` (E5 fails); send `setKind` as two commands instead of one (E2 fails on undo); leave the `flags` prop out (E2 fails on the mark); call the engine before the first draw (E8 fails).
- AC6: the deepening pass of `AGENTS.md` in `REPORT.md`: the new props of `SidePanel`, `KindSwitch` and `createChecker` (each used by the FSM and the PDA), duplicated code between `Editor.svelte` and `PdaEditor.svelte` (list what is left and why), casts (zero), and the size numbers.

**Verification:**

```
pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
pnpm --filter web exec vitest run
pnpm build && pnpm size
pnpm --filter web exec playwright test pda-panel pda-editor pda-storage switcher editor-checks editor-panel editor-table editor-flows
```

Follow rule 12 of `AGENTS.md` for every shell command and the stuck rule for every wait. Paste real output into `REPORT.md`, with the hand derivations of F1 to F4 first.

**Rollback:** `git revert <sha>`. The FSM editor changes only by the optional props of `SidePanel` and `KindSwitch` and the generic checker, all with the FSM's tests unedited.

**Depends on:** T-057 (merged, with PR 183).

**Notes for worker:** (1) Read `PdaEditor.svelte`, `Editor.svelte` (all of it), `SidePanel.svelte`, `KindSwitch.svelte`, `ChecksList.svelte`, `checker.ts`, `checks.ts`, `panel-tab.ts`, `definition.ts`, `DefinitionView.svelte`, `TableView.svelte` (its CSS for the phone), `pda-diagram.ts` (the text of a label), `pda-document.ts`, `pda-commands.ts`, `crates/engine-core/src/pda.rs` (the checks and `determinism`), `docs/ux/editor-interactions.md` (the panel), and `e2e/editor-checks.spec.ts` before you restate. (2) The FSM's `chooseKind` and the table of the FSM show how a kind change is announced. (3) The indices of a competition are into the engine's transition list; `toEnginePda(doc)` keeps the document's order; write one test that proves `doc.transitions[i]` is the engine's `transitions[i]` for machine G before you rely on it. (4) The mark of a state on the diagram and the rows' accent bar use tokens only (`check:tokens`); if a token is missing, ask. (5) Do not start T-061 or T-062; they are `proposed` entries below.

---

## Task T-063 — Load the PDA messages only in the PDA mode

**Status:** done
**Commit:** `32a215d` (the move and ADR 0050; the tests are `0e3182e`, the report is the commit after this one)
**Owner:** worker
**Branch:** `task/T-063-lazy-pda-messages`

**Goal:** The 25 PDA message keys (`kind.dpda`, `kind.ndpda`, 13 older `pda_editor.*`, 5 newer `pda_editor.*`, 5 `pda_check.*`) leave the shared dictionary in `id.ts` and `en.ts`, which is in the first-load JS of every route, and move to a module that is loaded together with the PDA mode. The FSM pages, the home page, the guides and the questions get smaller; the PDA mode looks and reads exactly as it does now; and T-061, T-062 and T-052 can add their strings without growing any route. This pays back the exception of ADR 0049 (T-051 added 0.54 KB gzip to `sandbox.html`; see `docs/agent/DECISIONS.md`, 2026-11-09).

**Why now:** every PDA task adds strings, and each one grows the first load of every route, including `index.html`, which has no editor. A budget that every task eats a bit more of is not a budget. This is the small structural fix before T-061.

**Decisions (planner, 2026-11-09):**

- **One lazy module for both languages.** `web/src/lib/i18n/pda-messages.ts` exports `pdaId` and `pdaEn` and, as a side effect of being imported, registers them. The module is imported once, by `PdaWorkstation.svelte` (the chunk of the PDA mode), so it is evaluated before `PdaEditor` renders. It is not imported by any file of the FSM editor, the shared frame, the pages or the layout. No loading flag, no `await` in the editor, no flash of keys.
- **The key type does not change for callers.** `MessageKey` stays one union: `keyof typeof id | keyof typeof pdaId`, so `t('pda_editor.save')` still type-checks and a misspelled key is still a compile error. The second part is `import type` only (it is erased at build time and puts nothing in the first-load JS). `en` is typed `Record<keyof typeof id, string>` and `pdaEn` is typed `Record<keyof typeof pdaId, string>`.
- **`translate.ts` grows by two things, and nothing else:** `addMessages(locale, dictionary)`, which merges a dictionary into the table that `translate` reads, and a fallback: a key that is not (yet) registered gives the key itself as the text, never `undefined` and never an exception. A visible `pda_editor.save` on the page is a bug that a test and a person can see; a crash is not.
- **`addMessages` never changes `id` or `en`.** It writes into a separate table, and `translate` reads `MESSAGES[locale][key] ?? extra[locale][key] ?? key`. A merge into the `id` and `en` objects themselves would make U3 and the parity test of `i18n.test.ts` depend on the order of the test files, because Vitest runs with `isolate: false` and the objects are shared (amended on 2026-11-09).
- **Which keys move:** exactly the 25 listed in the Scope. A key that a file outside the PDA chunk uses (for example one that the sandbox page or "Mesin saya" shows) stays in `id.ts`. If you find that one of the 25 is used outside the PDA chunk, stop and write a `blocked` entry; do not move it and do not import `pda-messages.ts` from the shared code.
- **Key names do not change.** No renaming; this is a move.
- **The text of every message does not change.** Not one character in Indonesian or English.

**Scope (files):**

- New: `web/src/lib/i18n/pda-messages.ts`, `web/src/lib/i18n/pda-messages.test.ts`, `web/e2e/pda-messages.spec.ts`, `docs/decisions/0050-lazy-pda-messages.md`.
- Edit: `web/src/lib/i18n/id.ts` and `en.ts` (remove the 25 keys; `MessageKey` becomes the union), `web/src/lib/i18n/translate.ts` (`addMessages`, the fallback), `web/src/lib/editor/PdaWorkstation.svelte` (one `import './pda-messages.ts'` line), and `web/src/lib/editor/diagram/pda-diagram.test.ts` (one added line, `import '#lib/i18n/pda-messages.ts'`, because that test calls `translate` with a PDA key; no assertion changes), and `web/src/lib/editor/pda-checks.test.ts` (its two assertions `Object.hasOwn(id, textKey)` and `Object.hasOwn(en, textKey)` read the key in the shared dictionary or in `pdaId` / `pdaEn`, because five `pda_check.*` keys move; no other assertion changes; amended on 2026-11-09 after the worker checked the tests). `docs/agent/PLAN.md` (status).
- The 25 keys: `kind.dpda`, `kind.ndpda`; `pda_editor.edge_more`, `form_title`, `col_read`, `col_pop`, `col_push`, `field_label`, `row_delete`, `add_row`, `label_hint`, `save`, `cancel`, `menu_edit`, `read_one_symbol`; `pda_editor.col_from`, `col_to`, `table_title`, `table_empty`, `definition_hint`; `pda_check.no_accepting_state`, `duplicate_transition`, `pop_never_pushed`, `competing_transitions`, `accepting_state_free_move`.

**Non-goals:** no change to any text, key name, component or style; no lazy loading of the FSM, guide or question messages; no loading of one language only (the lazy module holds both; it is only in the PDA chunk); no change in `crates/`; no new dependency; no change to the 0.5 KB gate or the 170 KB budget.

**Tests (write them first; they must fail before the code):**

- *U1 to U6, `pda-messages.test.ts`* (new): (U1) `pdaId` and `pdaEn` have the same keys; (U2) no message is empty, and both use the same `{parameters}` (the checks of `i18n.test.ts`, repeated for this dictionary); (U3) none of the 25 keys is in `id` or `en` (the shared dictionary), and no key is in both; (U4) `translate('id', 'pda_editor.save')` gives `'pda_editor.save'` before the module is imported (the fallback; use `vi.resetModules()` and dynamic imports of `translate.ts` and then of `pda-messages.ts` in U4, U5 and U6, because Vitest runs with `isolate: false` and the registry would be shared between test files; do not add an export to `translate.ts` that only a test uses); (U5) after the import, `translate('id', 'pda_editor.save')` and `translate('en', 'pda_editor.save')` give the text of `pdaId` and `pdaEn`, with parameters filled (`pda_editor.table_title` with `{ count: 3 }`); (U6) `addMessages` for a locale does not remove the keys that were there (the base keys still translate after the import).
- *M1 to M3, `e2e/pda-messages.spec.ts`* (new, desktop and phone): (M1) open `/sandbox` (the FSM) and collect the body of every `.js` response until `.editor[data-ready]`; none of them contains the Indonesian text of `pda_editor.form_title` (the string "Transisi di antara") or of `pda_check.no_accepting_state`; (M2) open `/sandbox?mode=pda`, wait for the editor, and see the text of the Tabel tab ("Transisi (0)" and the Dari, Baca, Pop, Push and Ke headers) and the two kind buttons "DPDA" and "NDPDA"; no element of the page has a text that matches `/^(pda_editor|pda_check|kind)\.[a-z_]+$/` (a raw key); (M3) the same with `localStorage['webtomata.lang'] = 'en'` set by `addInitScript`: the English text of the table title, read from `en.ts` and written in the test as plain text (do not import the dictionary into the spec). Each assertion is unconditional (rule of `AGENTS.md`).
- *F5, nothing else moves:* `i18n.test.ts`, every FSM test and every PDA spec of T-053 to T-057 and T-051 (`pda-panel`, `pda-editor`, `pda-storage`, `pda-label`, `pda-diagram` unit) pass with no edit, except the one added import line in `pda-diagram.test.ts` and the two dictionary assertions of `pda-checks.test.ts` (see Scope). State both in the report.

**Acceptance criteria:**

- AC1: U1 to U6 and M1 to M3 pass; they fail before the change (paste the failures from the tests-first run).
- AC2: F5 above: paste the pass counts of `pda-panel`, `pda-editor`, `pda-storage`, `switcher`, `editor-checks` on desktop and phone, and of `pda-storage` on webkit-phone. The only edited existing tests are the one import line of `pda-diagram.test.ts` and the two dictionary assertions of `pda-checks.test.ts`.
- AC3: **Sizes, from a clean build of `origin/staging` and a build of the branch, same machine, the lines of `pnpm size` for the routes `index`, `sandbox`, `soal`, `panduan` and one question page, with the unrounded gzip bytes of the shared chunk that holds the dictionary (find it as T-051 did).** No route grows by more than 0.1 KB. `sandbox.html`, `soal.html` and `index.html` are expected to shrink; the report gives how much. If `sandbox.html` shrinks by less than 0.5 KB, stop and tell the planner why before you go on. Also give the size of the PDA chunk and of the lazy messages (raw and gzip) before and after.
- AC4: after `pnpm build`, none of the 21 Indonesian texts that belong only to the moved keys is in any file of `build/_app/immutable` except the PDA chunk that holds `pda-messages.ts`. Search for each text as a whole string literal (with its quotes), not as a substring. Four texts also belong to keys that stay (`pda_editor.cancel` = `soal.reset_cancel`, `pda_editor.col_from` = `convert.col_from`, `pda_editor.col_to` = `convert.col_to`, `pda_editor.table_empty` = `definition.no_transitions`): for those, name the key that keeps the text, and check that the texts of all 25 keys are in the PDA chunk. Show the command and its output (amended on 2026-11-09).
- AC5: **Five deliberate breaks, each run on the final code, each shown failing with the failing line and its file:line pasted (a break run before your last change does not count):** (B1) put `'pda_editor.save'` back into `id.ts` and `en.ts` (U3 fails); (B2) delete the `import './pda-messages.ts'` line of `PdaWorkstation.svelte` (M2 fails: raw keys on the page); (B3) remove the fallback of `translate` (`?? key`), so a missing key gives `undefined` (U4 fails); (B4) import `./pda-messages.ts` from `Editor.svelte` (M1 fails, and say what `pnpm size` shows); (B5) register only `pdaId` (M3 fails: the English page shows Indonesian or raw keys). Restore each, and paste the one line of `git diff` that is the break.
- AC6: `pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens`, Vitest, `pnpm build && pnpm size` pass. No change in `crates/` (`git diff --stat` shows none). The report says, for each of the 25 keys, that it is used only inside the PDA chunk (a table: key, files that use it).

**Verification:**

```
pnpm --filter web exec vitest run src/lib/i18n
pnpm build && pnpm size
pnpm --filter web exec playwright test pda-messages pda-panel pda-editor pda-storage switcher editor-checks --project=desktop
pnpm --filter web exec playwright test pda-messages pda-panel pda-editor pda-storage --project=phone
pnpm --filter web exec playwright test pda-storage --project=webkit-phone
```

Follow the rules of `AGENTS.md` for every shell command (the Playwright runs are long: run them as background tasks, apply the stuck rule).

**Rollback:** `git revert <sha>`. The keys come back to `id.ts` and `en.ts`; nothing else depends on the change.

**Depends on:** T-051 (merged). T-061, T-062 and T-052 depend on this task: their strings go into `pda-messages.ts`, and a task that adds a PDA string to `id.ts` or `en.ts` is refused in review.

**Notes for worker:**

- This is a move and a small change in `translate.ts`. If the diff grows past those, stop and ask.
- Read `docs/decisions/0049-pda-panel.md` and the 2026-11-09 entry in `docs/agent/DECISIONS.md` first; ADR 0050 says why the dictionary is split and how a later task adds a PDA string.
- A prerendered page must not break: `pnpm build` prerenders `/sandbox`; check that it still works and that the PDA mode loads from the client only.
- `check:strings` reads components, not the dictionary; it does not need to change.
- Another worker may be working in a different folder on a different task at the same time. If your PR is merged second and `docs/agent/REPORT.md` conflicts, rebase and keep your own report (decision of 2026-11-09).

---

## Task T-064 — Give the heavy property tests an explicit timeout

**Status:** done
**Owner:** worker
**Branch:** `task/T-064-property-test-timeouts`

**Goal:** `pnpm test:web` (and so the pre-push hook) no longer fails on a busy machine. Two heavy property tests sit at about 1.7 s alone and 4 to 5 s when the machine is loaded (two workers, a build and a Playwright run at the same time), against the default timeout of 5 s: `layout.test.ts` ("property: any machine of up to 40 states is placed inside the limits with no overlap") and `interaction/editor.property.test.ts` ("keep every rule after every step"). On 2026-11-09 both timed out in the push of T-063 and blocked it, although nothing was wrong. The fix is an explicit timeout on these tests, as `interaction/pda-editor.property.test.ts` already has (`15_000`), so a loaded machine does not turn a correct run into a red one.

**Decisions (planner, 2026-11-09):**

- **A per-test timeout of `15_000`, the same number as `pda-editor.property.test.ts`.** The third argument of `it(...)`, with a comment that says why (a property test of many seeds; it is slow on a loaded machine).
- **Not these:** no change of `vitest.config.ts` (a global timeout hides slow tests that are really broken); no fewer seeds or steps (that is less coverage for a flaky clock); no `skip`, no `retry` (a flaky test that is retried is a test that cannot be trusted); no `--no-verify`.
- **Other slow tests:** run the suite alone with `--reporter=verbose`, list every test that takes more than 1.5 s alone, and give each of them the same explicit timeout. Do not touch a test that takes less.

**Scope (files):** the two test files above and any other test file that the list shows (one `it` each); `docs/agent/PLAN.md` (status). Nothing else: no source file, no config, no hook.

**Non-goals:** no change to what the tests assert; no new test; no speed-up of the layout or the editor; no change of the pre-push hook.

**Acceptance criteria:**

- AC1 **Reproduce before you change anything.** With the machine loaded (start `nproc` copies of `yes > /dev/null` in the background, run `pnpm --filter web test`, stop them afterwards) show the two tests failing with `Test timed out in 5000ms`. If a first load does not reproduce it, raise the load until it does and say how much. If you cannot reproduce it at all, report the highest time of each test under the load you tried, and go on.
- AC2 **After the change, the same load, three runs in a row:** the suite passes each time; paste the time of the two tests in each run. Then run the suite once on a quiet machine and paste the totals (the time of the whole suite must not change by more than a second).
- AC3 The list of the tests over 1.5 s alone (the verbose output, trimmed to those lines) and which of them got a timeout.
- AC4 `git diff --stat` shows only test files and `PLAN.md`; each changed line is a timeout argument and a comment. `pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens`, Vitest and `pnpm build && pnpm size` pass (sizes are unchanged: no source file changes).

**Verification:**

```
pnpm --filter web exec vitest run --reporter=verbose
pnpm --filter web test
```

Follow the rules of `AGENTS.md` for every shell command. The loaded runs are long: run them as background tasks, apply the stuck rule, and stop the load processes when you are done (`pkill yes`; check with `pgrep yes`).

**Rollback:** `git revert <sha>`.

**Depends on:** nothing. It touches no file of the PDA editor, so it can run next to T-061.

**Notes for worker:** quote the lines that you changed from `git diff` in the report, not from memory. A bug fix starts with a failing test that shows the bug (here, AC1 is that failing run). Another worker is working on T-061 in a different folder at the same time, so the machine will be loaded: do the quiet-machine run (AC2, last part) when the owner says nothing else is running, or say that it was not quiet.

---

## Task T-069 — No wall-clock bound in a unit test

**Status:** todo
**Owner:** worker
**Branch:** `task/T-069-no-wall-clock-bounds`

**Goal:** No unit test fails because the machine is busy. T-064 gave the heavy property tests a longer timeout, but four tests do not time out: they assert a time. On 2026-11-09, under the same load as T-064's runs (`nproc` copies of `yes`), the planner's two whole-suite runs on the T-064 branch both failed in `geometry.test.ts` ("draws the worst case…", 1304 ms and 1983 ms against `toBeLessThan(1000)`), and one of five runs of that file alone failed two tests (the other one has `toBeLessThan(100)`). A longer timeout cannot help an assertion. The four tests exist to catch an accident (an algorithm that became quadratic, a parser that expands a bomb), so they must catch that, on any machine, in any load:

- `web/src/lib/editor/diagram/geometry.test.ts`: "draws 200 states and 421 edges between neighbors quickly (9 ms measured)" (`took < 100`) and "draws the worst case, 600 random edges across 200 states, in well under a second (96 ms measured)" (`took < 1000`);
- `web/src/lib/editor/history.property.test.ts`: the 2000-state test with 300 moves (`milliseconds < 1000`, "to catch an accident (a move that is O(n squared))");
- `web/src/lib/questions/load.test.ts`: "refuses anchors and aliases, which can be used to blow a file up" (`< 500` ms).

**Decisions (planner, 2026-11-09):**

- **No absolute millisecond bound under 5 s remains in a unit test** (a bound of 5 s or more may stay only as a backstop against a hang, and the test's own timeout does that already).
- **A time becomes a ratio, which a busy machine does not change.** For geometry and history: run the same function on an input of size n and on one of size 4n (n states for geometry, n states for history; choose sizes that make the small run take a few milliseconds), take the best of 3 runs for each (the best run is the one the load disturbed least), and assert that `time(4n) / time(n)` is under a bound. A linear algorithm gives about 4, a quadratic one about 16. Choose the bound from 20 measured runs on a quiet machine (the largest ratio you saw, times 3 as headroom, and at most 12 so that a quadratic algorithm still fails) and say how you chose it in a comment above the assertion. A reference time under 0.05 ms is rounded up to 0.05 ms so that a timer's noise cannot make a ratio of two tiny numbers.
- **The alias bomb is caught by its shape, not by a clock.** Use a bomb whose expansion would be far too large to finish (for example nine levels of nine aliases), assert that the parser refuses it with the message that it already gives, and rely on the test's explicit timeout (15 s) to catch an accident. If a bomb that big can run the process out of memory instead of timing out, say so before you write it: propose another structure check (for example that the loader refuses at the first anchor, before it reads the rest) and wait for the planner.
- **One small helper at most.** If the geometry and history tests share the same way of timing (best of 3, the floor, the ratio), put it in one test-only file under `web/src/lib/` and use it in both. No helper if it is used once. Not a dependency, not a library.
- **The tests keep their names' meaning.** Rename a test only where its name states a number of milliseconds that no longer exists ("(9 ms measured)", "(96 ms measured)"); say each rename in the report.

**Scope (files):** the four tests' files above, and the one helper if you need it; `docs/agent/PLAN.md` (status). No source file, no config.

**Non-goals:** no speed-up of `edgeGeometry`, the history or the loader; no change of any other test; no timeout on tests that do not have a time assertion; no change to the pre-push hook or `vitest.config.ts`; no benchmark framework.

**Acceptance criteria:**

- AC1 **Reproduce first.** Under the load of T-064 (`nproc` copies of `yes > /dev/null`, stopped afterwards), run the four tests, 5 runs each, and paste how many fail and the time that each measured. If one never fails in 5 runs, report its largest time, and still change it (the bound is wrong in principle).
- AC2 **After the change, the same load, 5 runs of the whole suite in a row: all green.** Paste the totals of each run and the ratio that each of the three ratio tests measured in it (add a `console.info` while you measure and take it out before you commit).
- AC3 **The bounds are justified:** for each ratio test, the 20 quiet ratios (min, median, max), the bound, and how you got it.
- AC4 **The tests still catch the accident. Show each failing on the final code, with the failing line and file:line pasted and the one line of `git diff` that is the break (a break run before your last change does not count):** (B1) in `edgeGeometry`, make every edge check every state once more (an accidental extra nested loop) and show the geometry ratio test fail; (B2) in the history's `execute`, copy the whole list of states once per call plus a nested pass over it (a quadratic move) and show the history ratio test fail; (B3) in the loader, expand aliases (or remove the refusal) and show the bomb test fail (by the timeout or by its structure check). Restore each source file; `git diff --stat` at the end shows only test files and `PLAN.md`.
- AC5 `pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens`, Vitest, `pnpm build && pnpm size` pass (sizes unchanged).

**Verification:**

```
pnpm --filter web exec vitest run src/lib/editor/diagram/geometry.test.ts src/lib/editor/history.property.test.ts src/lib/questions/load.test.ts
pnpm --filter web test
```

Follow the rules of `AGENTS.md` for every shell command; the loaded runs are long: background tasks, the stuck rule, and `pkill yes` and `pgrep yes` at the end.

**Rollback:** `git revert <sha>`.

**Depends on:** nothing. It touches none of the files of T-061, T-064 or T-062.

**Notes for worker:** quote the changed lines from `git diff`, not from memory. The planner will repeat the loaded runs on the branch, as for T-064. Another worker may be running tests in a different folder, so the machine will be busy: write down `uptime` at the start of every run.

---

## Task T-065 — Symbol names: refuse the ε words in the document, and the missing text of `document.duplicate_symbol` (draft)

**Status:** proposed
**Owner:** worker

**Goal:** Found by the worker of T-061 on 2026-11-09 with the real functions. (1) `checkSymbol` of the document (`document.ts`) refuses `ε`, an empty name and a name over 32 characters, but accepts the word `eps` as a symbol name, in an FSM and in a PDA, although `eps` means ε in the labels; a file or a share link can carry such a symbol. (2) `document.duplicate_symbol` has no text in `id.ts`, `en.ts` or `pda-messages.ts`, so the FSM table shows the raw key when a symbol is added twice. Decide with the planner whether the document refuses the ε words (a change in shared code, with FSM tests and a migration question for old files) and add the text of the missing key to the shared dictionary with a test that every refusal key of the commands has a text. Not before T-061 is merged.

**Depends on:** T-061.

---

## Task T-061 — PDA editor, part 10 of 12: editing in the Tabel tab

**Status:** done (2026-11-09; branch `task/T-061-pda-table-editing`, commits `f4f0c5f`…`5a0c6e0`, plus the fix of the docs-only hook test `a565f0b`. Sizes accepted once by the owner: `sandbox.html` 124.7 KB, `soal/*` 124.1 KB. See `docs/agent/REPORT.md`.)
**Owner:** worker
**Branch:** `task/T-061-pda-table-editing`

**Goal:** The Tabel tab of the PDA editor can do everything the canvas can (it is the accessible alternative to the diagram, `design/screens/pda-editor.md`, section 6). Three blocks under the head block of T-051: **Alfabet** (chips for Σ and Γ, a field to add a symbol, a button on each chip to remove it), **State** (a row for each state: the name, the start radio, the accepting checkbox, delete; and **+ State**) and **Transisi (n)** made editable (Dari, Baca, Pop, Push and Ke in every row; delete; **+ Tambah transisi**). Every edit is a command of the document, so undo, the diagram, the definition, the checks and the autosave all follow with no new code. The read-only table of T-051 is replaced by this one; the rows marked by `+ n lagi` keep working.

**Decisions (planner, 2026-11-09):**

- **A form, not a grid.** The FSM table is an arrow-key grid. The PDA table has free text fields (Pop, Push, names), where the arrows belong to the field, so it is a list of controls in the order of the page: `Tab` and `Shift+Tab` move, the arrows work inside a select, `Enter` sends a text field, `Esc` puts the old value back. No `data-row` and `data-col` grid, no `moveInGrid`.
- **The parser of the label form is the only parser.** A row is turned into a transition by `parseRows(doc, [row])` of `pda-label.ts` (T-054): the same typing rules as the label form (one symbol in Baca, `ε` or empty, `AB` or `A B` in Pop and Push, 64 symbols at most). Do not write a second parser; export what you need from `pda-label.ts` and say so in the report.
- **An edit of a row is one batch.** New input or stack symbols first (`addInputSymbol`, `addStackSymbol`), then `removeTransition` of the old row, then `addTransition` of the new one, as one `{ type: 'batch' }`, so one Urungkan puts back the row and the alphabet together. An edit that changes nothing sends nothing.
- **A row that would equal another row is refused, not merged.** If the edited transition is the same as another row of the table, nothing changes and the row shows `pda_editor.row_duplicate { n }` ("this transition is already in row n") under it. (`rowCommands` of the label form would merge it and the row would silently disappear.)
- **Rows are in the engine's order and an edited row can move.** After an edit that moves the row, the focus follows it: the same control of the row, at its new place (find the row by its fields after the command, wait for `tick()`, focus). Key the rows by their fields, not by their index, so that the DOM element is not reused for another transition. The announcement says the row number (`pda_editor.row_changed { n }`).
- **A new row is a draft until it is complete.** **+ Tambah transisi** adds a draft row at the bottom that is not in the document. Baca starts as `ε`, Pop and Push are empty. The draft is sent when Dari and Ke are both chosen, as one `addTransition`, or, when Pop or Push has a new stack symbol, as one `batch` with the `addStackSymbol` commands first (as a row edit does; Baca is a select of the input alphabet, so it never adds a symbol); then it becomes a real row in its place, the focus follows, and `pda_editor.row_added { n }` is announced. A draft with only one of the two chosen sends nothing. A draft can be removed with its delete button. A draft is not saved and is lost when the tab is closed. It stays while other things change in the document; if the state that its Dari or Ke names is removed, that select goes back to empty. (Replacing the whole document comes with T-052, which clears the table.)
- **Removing a symbol or a state takes the transitions that use it, with a toast.** `removeInputSymbol`, `removeStackSymbol` and `removeState` already do that in one step. The toast (with Urungkan) says how many transitions went: the existing key `table.symbol_removed { symbol, count }` for symbols and the new `pda_editor.state_removed { name, count }`. Count them before the command from the document (input: rows with that `read`; stack: rows with it in `pop` or `push`; state: rows with it in `from` or `to`), and check the count of the state with the real command before you write the test.
- **The words of the State block are the FSM's.** The start column is `table.start` and the accepting one `table.accepting`, with `table.start_toggle` and `table.accepting_toggle` for the names that a screen reader reads, `table.rename`, `table.add_state` and the announcements `editor.start_set`, `editor.accepting_on`, `editor.accepting_off`, `editor.renamed`. (The design says "mulai"; one site uses one word for one thing, so the FSM's wording wins. Log it in ADR 0051.) The start control is a radio group: choosing a state makes it the start state; to have none, delete the state or undo.
- **Symbols and rows reuse the FSM keys where the text fits:** `table.symbol_field`, `table.symbol_add`, `table.symbol_added`, `table.remove_symbol`, and from T-054 `pda_editor.field_label { n, field }`, `pda_editor.row_delete { n }`, `pda_editor.label_hint`, `pda_editor.col_*`. Every new key goes in `web/src/lib/i18n/pda-messages.ts` (both languages) and none in `id.ts` or `en.ts` (ADR 0050; a PDA string in the shared dictionary is refused in review). New keys: `pda_editor.alphabet_input` ("Alfabet input Σ"), `pda_editor.alphabet_stack` ("Alfabet stack Γ"), `pda_editor.add_transition` ("+ Tambah transisi"), `pda_editor.state_delete { name }` ("Hapus state {name}"), `pda_editor.state_removed { name, count }`, `pda_editor.row_duplicate { n }`, `pda_editor.row_added { n }`, `pda_editor.row_changed { n }`, `pda_editor.row_removed { n }`, `pda_editor.symbol_reserved` ("Nama simbol tidak boleh eps atau ε, dan tidak boleh berisi spasi atau koma." / "A symbol name cannot be eps or ε, and cannot contain spaces or commas.") and the text of `document.duplicate_symbol { symbol }` ("Simbol {symbol} sudah ada." / "Symbol {symbol} already exists."), which has no text in any dictionary today (the FSM table shows the raw key; that is T-065, not this task). Write the English too; add terms to `docs/glossary.md` only if you need a word that is not there (mark it `TODO(review)`).
- **No selection sync.** Focusing a row does not select its edge on the diagram (that is "Tunjukkan", T-062). The marked rows of T-051 are cleared by a change of the document as before.
- **Reserved names are refused by the table, before the command.** The document does not refuse the word `eps` as a symbol name (it refuses only `ε`, an empty name and a name over 32 characters), but `eps` means ε in the label form, and a name with a space or a comma cannot be typed in Pop or Push. So the Alfabet field refuses `eps` (and whatever other word `pda-label.ts` treats as ε: reuse its list, exporting it if needed), `ε`, and any name with whitespace or a comma, with the new key `pda_editor.symbol_reserved`, and sends nothing. The document itself is not changed (T-065).
- **Refusals** (`document.limit_exceeded`, `document.duplicate_symbol`, `pda_document.string_too_long`, `pda_document.unknown_symbol`, `document.duplicate_name`, `pda_editor.symbol_reserved` or whatever the document returns) are shown under the field or the row, in a calm sentence, with `aria-describedby` from the control and `aria-invalid` on it; the typed text stays in the field. A test shows that every refusal key that the table can show has a text in both languages.

**Scope (files):**

- Edit: `web/src/lib/editor/PdaTableView.svelte` (it keeps its name and stays the lazy-loaded entry, now composing the three blocks), `web/src/lib/editor/PdaEditor.svelte` (what the table snippet passes), `web/src/lib/editor/pda-label.ts` (at most one export, the list of the words that mean ε; no behavior change), `web/e2e/pda-panel.spec.ts` (the one assertion of E4 named under F-shared), `web/src/lib/i18n/pda-messages.ts`, `docs/agent/PLAN.md` (status).
- New: `PdaAlphabetBlock.svelte`, `PdaStatesBlock.svelte`, `PdaTransitionsBlock.svelte`, `pda-table-props.ts` (the type of the props, in its own file so that `PdaEditor.svelte` can name it without loading the component, as `table-props.ts` does for the FSM), `pda-table-edit.ts` and `pda-table-edit.test.ts` (the pure part: symbol use counts, the state placement with `freeSpot`, the batch for a row edit, the duplicate check, the draft rule), `web/e2e/pda-table-edit.spec.ts`, `docs/decisions/0051-pda-table-editing.md`.
- Props of the table view: `{ doc: PdaDocument; marked: ReadonlySet<number>; onapply: (command: PdaCommand, note?: { say?: …; toast?: boolean }) => Refusal | null }`, the same shape as `TableViewProps.onapply`, wired to `editor.apply`.

**Non-goals:** no determinism badge, pairs or "Tunjukkan" (T-062); no saved machines, files or examples (T-052); no arrow-key grid; no drag to reorder (the order is the engine's); no selection sync; no change to any FSM file (`TableView.svelte`, `table.ts`, `table-props.ts`, `Editor.svelte`, `SidePanel.svelte`, `KindSwitch.svelte`, `checker.ts`) and no change in `crates/`; no new dependency; no new string in `id.ts` or `en.ts`.

**Fixtures (derive them by hand first, then check each with the real functions and paste both):**

- *Machine F* (as in T-051): Σ {a, b}, Γ {A}, states q0 (id 0, start) and q1 (id 1, accepting), rows 1 `q0|a|ε|A|q0`, 2 `q0|b|A|ε|q1`, 3 `q1|b|A|ε|q1`.
- *Machine H* = F plus the transition `(q1, a, ε→A, q1)`: Σ {a, b}, rows 1 `q0|a|ε|A|q0`, 2 `q0|b|A|ε|q1`, 3 `q1|a|ε|A|q1`, 4 `q1|b|A|ε|q1`.
- **F1, the batch of an edit:** F, row 1, Push `A` becomes `AA`: `batch [ removeTransition(q0, a, [], [A], q0), addTransition(q0, a, [], [A, A], q0) ]`, no new symbol.
- **F2, a duplicate:** F, row 1 changed to Baca `b`, Pop `A`, Push empty, Ke `q1` is the same as row 2: no command, the refusal `pda_editor.row_duplicate` with `n` = 2.
- **F3, a new symbol:** F, row 3, Push `AB` (Γ has only one-character symbols, so `AB` is `A` then `B`): `batch [ addStackSymbol(B), removeTransition(q1, b, [A], [], q1), addTransition(q1, b, [A], [A, B], q1) ]`.
- **F4, the row that moves:** H, row 1, Dari `q0` becomes `q1`: the transition becomes `(q1, a, ε→A, q0)`. In the engine's order it goes between rows 2 and 3 of H, before `(q1, a, ε→A, q1)` (same from, read, pop and push; then `to` 0 before 1), so the table is `q0|b|A|ε|q1`, `q1|a|ε|A|q0`, `q1|a|ε|A|q1`, `q1|b|A|ε|q1`, and the edited row is now row 2. Check the order with `comparePdaTransitions`.
- **F5, the counts for the toast:** F, remove input symbol `b`: 2 transitions go (rows 2 and 3); remove stack symbol `A`: 3 go; remove state q0: say the real count after you run it. One Urungkan brings back the symbol (or the state) and the rows.
- **F6, the draft:** F, a draft with Dari `q0` only sends nothing; with Ke `q1` too it sends `addTransition(q0, null, [], [], q1)`, which in F's order is row 1 (ε before `a`), so the table is `q0|ε|ε|ε|q1`, then the three rows of F.

**Tests (write them first; they must fail before the code):**

- *U, `pda-table-edit.test.ts`:* F1 to F6 (the commands, the refusal, the counts, the new row index), the state placement (a new state never lands on another: use `freeSpot` of `interaction/placement.ts`; the FSM's `newStateCommand` is typed for the FSM document and is not touched), a row that changes nothing gives `null`, a row with a blank Dari or Ke is a draft.
- *R, refusal texts:* every refusal key that the table can show has a text in `id`, `en` or `pdaId`/`pdaEn` and the same parameters in both languages.
- *E1 to E8, `e2e/pda-table-edit.spec.ts`* (desktop and phone; all assertions unconditional): (E1) the Alfabet block: add input symbol `c` (chip appears), add `eps`, `a b` and `a,b` (each refused with `pda_editor.symbol_reserved`, nothing changes, the field keeps the text), remove `b` from F (rows 2 and 3 go, toast with the count of F5, Urungkan brings all back in one step); (E2) the State block: rename q1 (Enter sends, a name that is in use is refused under the field), choose another start state, toggle accepting, `+ State` adds q2 without overlapping, delete a state (toast with its count, Urungkan); (E3) F4 on H: the edited row moves to row 2 and the focus is on the Dari control of row 2 whose value is `q1`; (E4) a draft row: Dari alone sends nothing (the count in `Transisi (n)` stays), Ke sends it, the row is at its place and announced, and the same with the keyboard only (`Tab`, then the keys of a select); (E5) refusals: F2 shows `row_duplicate` under row 1 and the document is unchanged, 65 symbols in Push show the `string_too_long` text with `aria-invalid="true"` and the text stays in the field; (E6) F3 is one undo step (one Urungkan restores the row and the stack alphabet), and the same for F1; (E7) on the phone: every control of the three blocks is at least 44 px high, the text fields are at least 16 px, the table scrolls sideways with its first column fixed, and `axe` finds no violation on the Tabel tab of F and of H on desktop and phone; (E8) a marked row (`+ n lagi`) is still marked, and it is cleared by an edit.
- *F-shared, nothing else moves:* `pda-panel`, `pda-editor`, `pda-storage`, `pda-messages`, `switcher`, `editor-checks`, `editor-panel`, `editor-table` pass with no edit. **One edit is approved (2026-11-09, after the worker's check in a real browser):** in `pda-panel.spec.ts` E4, `expect(rows.nth(1)).toContainText('A')` (the Push cell) cannot hold once Push is a text field, because the value of a field is not text content. It becomes a check of the value of the Push field of row 2, for example `rows.nth(1).getByRole('textbox', { name: /Baris 2.*Push/ })` with `toHaveValue('A')`: the same intent, not weaker. If any other assertion of `pda-panel`, `pda-editor` or `pda-messages` fails on the new markup, tell the planner before you edit it. Keep `tr`, `caption`, `th.from`, `.wrap`, `aria-current`, the column headers and the heading `Transisi (n)` as they are (E4, E5 and M2 select them); with no rows and no draft the tab still shows `Belum ada transisi.`

**Acceptance criteria:**

- AC1: U, R and E1 to E8 pass; they fail before the change (paste the failures of the tests-first run).
- AC2: the specs of the F-shared bullet: paste the pass counts on desktop and phone (and `pda-storage` on webkit-phone).
- AC3: **Sizes from a clean build of `origin/staging` and of the branch, same machine:** no route's first JS grows by more than 0.1 KB (the PDA code is lazy; the shared files are not touched, so it should not grow at all); give the size of the PDA chunks and of the messages chunk before and after.
- AC4: **Seven deliberate breaks, each run on the final code, with the failing line and its file:line pasted and the one line of `git diff` that is the break** (a break run before your last change does not count): (B1) send a Pop edit as two separate `apply` calls instead of one batch (E6 fails); (B2) key the rows by index and do not move the focus (E3 fails); (B3) remove the duplicate refusal, so the row is merged (E5 fails); (B4) send the draft as soon as Dari is chosen (E4 fails); (B5) give the toast of a removed symbol a count of 0 (E1 fails); (B6) set the font size of the Pop field to 14 px (E7 fails); (B7) delete a state without the toast (E2 fails).
- AC5: the new keys are in `pda-messages.ts` only, in both languages; `i18n.test.ts` and `pda-messages.test.ts` pass; the report lists every key that you reused and every new one.
- AC6: `pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens`, Vitest, `pnpm build && pnpm size` pass; `git diff --stat` shows no FSM file and nothing in `crates/`.

**Verification:**

```
pnpm --filter web exec vitest run src/lib/editor/pda-table-edit.test.ts src/lib/i18n
pnpm build && pnpm size
pnpm --filter web exec playwright test pda-table-edit pda-panel pda-editor pda-storage pda-messages switcher editor-checks editor-panel editor-table --project=desktop
pnpm --filter web exec playwright test pda-table-edit pda-panel pda-editor pda-storage pda-messages --project=phone
pnpm --filter web exec playwright test pda-storage --project=webkit-phone
```

Follow the rules of `AGENTS.md` for every shell command (the Playwright runs are long: run them as background tasks, apply the stuck rule). Use the rules for the report: copy the lines you changed from `git diff`, not from memory.

**Rollback:** `git revert <sha>`. The table goes back to the read-only one of T-051; no document or format changes.

**Depends on:** T-051 and T-063 (both merged).

**Notes for worker:**

- Read `docs/decisions/0049-pda-panel.md` and `0050-lazy-pda-messages.md`, then `PdaTableView.svelte`, `pda-table.ts`, `pda-label.ts` (`parseRows`, `rowCommands`), `pda-commands.ts` (the commands and what each refuses) and the FSM `TableView.svelte` only for how it calls `onapply` and shows a refusal.
- Before you write anything, check with real commands: what `removeState` removes and what the count is for F5; which refusal key each bad input gives (`eps`, a name in use, 65 symbols, a missing symbol); the order of H after F4 with `comparePdaTransitions`. Paste the outputs in your restatement.
- The risk to watch is the focus when a row moves or is removed (a keyed list and `tick()`), and a draft row that survives a document change by mistake.
- Another worker may be working in a different folder on a different task at the same time. If your PR is merged second and `docs/agent/REPORT.md` conflicts, rebase and keep your own report.

---

## Task T-070 — Competing edges drawn dashed and the second edge of a pair selected (draft)

**Status:** proposed (after T-062)
**Owner:** worker

**Goal:** Design section 2 of `design/screens/pda-editor.md`: in a **DPDA**, the edges that hold a competing pair are drawn dashed in `--color-warning` (in an NDPDA they stay solid), and **Tunjukkan** of T-062 gives both edges of a pair the selection stroke (T-062 selects the first edge and marks both rows only). Both change the shared drawing (`DiagramDrawing.svelte`, `EditorCanvas.svelte`, the edge input of `DiagramInput`), so they need FSM tests (the FSM diagram must not change) and a decision about how the diagram learns the pairs (a new optional field of `DiagramInput`, the badge's own result as input). Not before T-062 is merged; the planner writes the full spec then.

**Depends on:** T-062.

---

## Task T-062 — PDA editor, part 11 of 12: the determinism badge and the competing pairs

**Status:** done
**Owner:** worker
**Branch:** `task/T-062-pda-determinism-badge`

**Goal:** Under the kind switch of the PDA panel (both tabs) a badge says whether the machine is deterministic, from `engine.pdaDeterminism`, and, when there are competing transitions, opens a list of the pairs, each with the two transitions, one sentence that says why they compete, and **Tunjukkan** (`design/screens/pda-editor.md`, section 5). A student who builds a DPDA sees at once which two transitions break it and where they are; a student who builds an NDPDA sees that the pairs are fine. T-051 already shows the checks line (`pda_check.competing_transitions` for a DPDA); the badge is the full picture for both kinds.

**Decisions (planner, 2026-11-09):**

- **The data is the engine's.** `engine.pdaDeterminism(toEnginePda(doc))` returns `Competition[]`: `{ from, first, second }`, the two indices (zero-based) into the engine's transition order, which is the order of `doc.transitions` (the same mapping as `competing_transitions` in `pda-checks.ts`: row number = index + 1). No TypeScript port of the check (CLAUDE.md, principle 2).
- **A second query, not a change of `checker.ts`.** `checker.ts` is shared with the FSM and is typed for `Issue[]`. Write `pda-determinism.ts` with a small `createDeterminism({ query, delayMs })` that follows the same rules as the checker (200 ms debounce after a change, a sequence number so that an answer for an older document is dropped, `dispose`), asks again after every change of the document and once after the first draw, and keeps `status` (`idle | checking | ready | failed`) and `pairs`. It is tested with a fake `query`. An engine that fails shows no badge (the checks line already shows the calm notice with its retry; do not show a second one). While it is `checking` the previous badge is hidden, not kept: **a badge never shows the answer for an older document.**
- **When the badge shows** (design table): no transition in the document: nothing. No pair: **Deterministik**, tone success, and it is plain text (a `<p>` or `<span>` with `role="status"` is not needed), not a button, because there is nothing to open. One or more pairs: a button (the disclosure), neutral tone for an NDPDA, warning tone for a DPDA: **Non-deterministik · n pasangan bersaing ▾** and **Bukan DPDA · n pasangan bersaing ▾**. The tone is never the only sign: the text says the same. Use the tokens the design names (`--color-success-tint` and `-ink`, `--color-neutral-tint`, `--color-warning-tint` and `-ink`); run `pnpm check:contrast` (the pre-push hook does) and, if the tool lists color pairs, add the new ones to it.
- **The disclosure:** a button full width of the panel and 44 px high, `aria-expanded` and `aria-controls`; closed when the page opens; the list opens under it (no popover); it stays open while the document changes, and goes back to closed when the pairs are gone. The list is a `<ul>`; under the cards, the note: `pda_editor.note_ndpda_ok` for an NDPDA, `pda_editor.note_dpda_no` for a DPDA.
- **A pair** is an `<li>` card: the state's name and a colon (`q0:`), the two transitions as the diagram writes them (`transitionLabel(doc, t)` of `diagram/pda-diagram.ts`; do not write a second one) joined by ` ↔ `, the reason sentence, and the button **Tunjukkan** (44 px). The cards are in the engine's order.
- **The reason sentence is built in the UI from the two transitions** by a pure function `competitionReason(doc, pair)` in `pda-determinism.ts`, from the definition: two transitions from one state compete when one of them reads ε or both read the same symbol, and one pop is a prefix of the other (an empty pop is a prefix of every pop). Let `t1` and `t2` be the transitions at `first` and `second`. If both read the same symbol `c`: key `pda_editor.compete_same_read { read: c, pop1, pop2 }`; otherwise (one of them, or both, reads ε): key `pda_editor.compete_epsilon_read { pop1, pop2 }`. In both, `pop1` is the pop that is the prefix and `pop2` the other, so when `t2.pop` is a prefix of `t1.pop` and not the other way round the two are swapped; when the pops are equal, `pop1` is `t1.pop`. Pops are written with `formatStackSeq` and the stack separator of the document (`ε` for empty). The sentence is `Keduanya membaca {read}, dan pop {pop1} adalah awalan dari pop {pop2}.` and `Salah satunya tidak membaca input, dan pop {pop1} adalah awalan dari pop {pop2}.` (and the English). When both pops are the same the sentence is still true but reads strangely ("pop ε adalah awalan dari pop ε"); keep the design's wording and mark the two keys `TODO(review)` in the glossary note, so that the owner can change the texts later.
- **Tunjukkan** (the selection is never in the document or the history): it selects the edge of the first transition (`editor.selectEdge(t1.from, t1.to)`), marks the rows of **both** transitions with the accent bar of T-051 (the `marked` set of `PdaEditor.svelte`, indices `first` and `second`, with `markedEdge` the first edge, so that the rule that clears the marks stays as it is), and announces `pda_editor.pair_selected { first, second }` (row numbers, one-based) in the badge's own visually hidden live region (`aria-live="polite"` on a `.sr-only` paragraph that is in the page all the time, with its text set when the button is pressed). It must not be `role="status"`: the editor's own announcer is the only element with that role, and `pda-panel` and `pda-table-edit` rely on it. Focus: when the Tabel tab is open, on the first control of the first row (the Dari field; a request prop of `PdaTableView` that reuses `focusRow`, because a lazily loaded component has no export type in Svelte 5); when the Definisi tab is open, the focus stays on the Tunjukkan button (a toggle keeps its focus), the first edge is selected (`aria-pressed` on its node) and the rows are announced. (Amended on 2026-11-09 after the worker's check: nothing outside the shared editor core can focus an edge node, and the shared core does not change in this task.) Pressing **Tunjukkan** again on the same pair clears the marks and the edge selection and says `editor.selection_cleared`; the button of the shown pair has `aria-pressed="true"`. The shown pair is forgotten whenever the marks are cleared by T-051's rule (a change of the document, another selection).
- **The second edge** of a pair that lies on another edge does not get a selection stroke, and the competing edges of a DPDA are not drawn dashed (design section 2): both change the shared drawing and need FSM tests. They are left to T-070 (proposed).
- **The head block is written once.** `PdaEditor.svelte` repeats the kind switch and the checks line in the two tab snippets (T-051). Make one snippet `head` (kind switch, badge, checks line) and use it in both; this is the only refactor of that file in this task.
- **The phone:** the badge is one row at 360 px: the visible text is short (`Non-det. · {count} ▾`; `Bukan DPDA · {count} ▾` and `Deterministik` are short already) and the button's `aria-label` carries the full text. Switch the visible text with the phone rule that the editor uses (`max-width: 39.99rem`), by two spans of which one is `display: none`, not by JavaScript. The list opens inline; nothing needs a hover.
- **Strings only in `pda-messages.ts`** (ADR 0050), both languages. Keys: `pda_editor.badge_deterministic`, `pda_editor.badge_nondeterministic { count }`, `pda_editor.badge_nondeterministic_short { count }`, `pda_editor.badge_not_dpda { count }`, `pda_editor.compete_same_read { read, pop1, pop2 }`, `pda_editor.compete_epsilon_read { pop1, pop2 }`, `pda_editor.compete_show`, `pda_editor.note_ndpda_ok`, `pda_editor.note_dpda_no`, `pda_editor.pair_selected { first, second }`, and any other that you need for an accessible name (say which). Texts: `Deterministik`, `Non-deterministik · {count} pasangan bersaing`, `Non-det. · {count}`, `Bukan DPDA · {count} pasangan bersaing`, `Tunjukkan`, `Pada NDPDA ini boleh. Pada DPDA setiap pasangan menjadi kesalahan.`, `Pada DPDA ini tidak boleh. Ubah salah satu transisi, atau pilih NDPDA.`; write the English. Add "pasangan bersaing" (competing pair) to `docs/glossary.md` with `TODO(review)` if it is not there.

**Scope (files):**

- New: `web/src/lib/editor/pda-determinism.ts` (the query, the reason, the model of the badge: tone, text key, count) and `pda-determinism.test.ts`; `web/src/lib/editor/PdaDeterminismBadge.svelte` (the badge, the list, the cards); `web/e2e/pda-determinism.spec.ts`; `docs/decisions/0052-pda-determinism-badge.md`.
- Edit: `web/src/lib/editor/PdaEditor.svelte` (the `head` snippet, the query, `Tunjukkan` and its focus), `web/src/lib/editor/PdaTableView.svelte`, `PdaTransitionsBlock.svelte` and `pda-table-props.ts` (only what is needed to focus a row: one optional request prop), `web/src/lib/i18n/pda-messages.ts` and its test if a key list is tested, `docs/glossary.md`, `docs/agent/PLAN.md` (status).

**Non-goals:** no dashed competing edges and no second selection stroke (T-070); no change to `checker.ts`, `KindSwitch.svelte`, `SidePanel.svelte`, `EditorCanvas.svelte`, `DiagramDrawing.svelte` or any FSM file; no change in `crates/`; no new dependency; no string in `id.ts` or `en.ts`; no saved machines, files or examples (T-052); no simulation (T-038).

**Fixtures (derive the pairs by hand first, then check each with the real engine and the real functions, and paste both):**

- *Machine G* (as in T-051): Σ {a, b}, Γ {A}; q0 (start), q1 (accepting); rows 1 `q0|ε|ε|ε|q1`, 2 `q0|a|ε|A|q0`, 3 `q0|b|A|ε|q1`, 4 `q1|b|A|ε|q1`. As a DPDA and as an NDPDA the engine gives two pairs: `{from:0, first:0, second:1}` and `{from:0, first:0, second:2}`.
- **F1, `competitionReason` on G:** pair (0,1): `t1` reads ε, `t2` reads `a`, both pops are empty: `compete_epsilon_read { pop1: 'ε', pop2: 'ε' }`. Pair (0,2): `t1` reads ε with an empty pop, `t2` reads `b` and pops `A`: `compete_epsilon_read { pop1: 'ε', pop2: 'A' }` (an empty pop is a prefix of `A`).
- *Machine J* (an NDPDA): Σ {a}, Γ {A, B}; `(q0, a, A→ε, q0)` and `(q0, a, AB→ε, q1)`. **F2:** one pair; `compete_same_read { read: 'a', pop1: 'A', pop2: 'AB' }`.
- *Machine K* (a DPDA): Σ {a}, Γ {A, B}; `(q0, ε, AB→ε, q1)` and `(q0, a, A→ε, q0)`. In the engine's order the ε-read transition is first. **F3:** one pair, and the pops are swapped because `t2.pop` is the prefix: `compete_epsilon_read { pop1: 'A', pop2: 'AB' }`.
- *Machine F* (T-051's, a DPDA with no pair): **F4:** `pdaDeterminism` gives `[]`; the badge is **Deterministik**. The empty PDA: no badge.
- **F5, the badge model:** DPDA with 2 pairs: warning, `badge_not_dpda { count: 2 }`; NDPDA with 2 pairs: neutral, `badge_nondeterministic { count: 2 }`; any kind with no pair: success, `badge_deterministic`; no transitions: none.

**Tests (write them first; they must fail before the code):**

- *U, `pda-determinism.test.ts`:* F1 to F3 (the reason, the swap, equal pops), F5 (the model), and the query with a fake `query`: (a) an answer that arrives after a newer request is dropped, (b) a failure gives `failed` and no pairs, (c) `dispose` stops everything, (d) one change, one request after the debounce (and a burst of changes, one request).
- *E1 to E8, `e2e/pda-determinism.spec.ts`* (desktop and phone; all assertions unconditional): (E1) the badge for the four cases (no transition: none; F: **Deterministik**; G as NDPDA: neutral text with `2`; G as DPDA: warning text with `2`), and switching DPDA and NDPDA changes the text and tone at once, in both tabs; (E2) the disclosure: closed at the start, `aria-expanded` true after a click, the two cards of G with their transitions, their sentences (F1) and the note; Enter and Space work on the button; (E3) Tunjukkan on the first card of G with the Tabel tab open: the first edge is selected (`aria-pressed` on it), rows 1 and 2 have the accent bar (`aria-current`), the focus is on the Dari field of row 1, the announcement says rows 1 and 2; pressed again, everything is cleared; (E4) the same with the Definisi tab open: the first edge is selected (`aria-pressed` on its node), the focus stays on the Tunjukkan button (which has `aria-pressed="true"`), there is no table, and the announcement is the same; (E5) an edit that removes the pair (delete a transition from the table) updates the badge to **Deterministik** and clears a shown pair; an edit that adds a competing transition to F updates the badge to one pair; (E6) stale answers: with the engine slowed (the technique of `editor-checks.spec.ts`), two quick edits (add a competing transition, then remove it) end with the badge that matches the last document; (E7) phone at 360 px: the visible text is short, the `aria-label` is the full text, the button is at least 44 px high, the card's Tunjukkan buttons too, nothing overflows sideways; `axe` finds no violation in any badge state (none, deterministic, neutral with the list open, warning with the list open), desktop and phone; (E8) the engine is not requested before the first draw of the PDA mode (the check of T-051's E8 still passes, unedited).
- *F-shared, nothing else moves:* `pda-panel`, `pda-editor`, `pda-storage`, `pda-messages`, `pda-table-edit`, `switcher`, `editor-checks`, `editor-panel`, `editor-table` pass with no edit.

**Acceptance criteria:**

- AC1: U and E1 to E8 pass; they fail before the change (paste the failures of the tests-first run).
- AC2: the specs of F-shared pass with no edit (pass counts on desktop and phone; `pda-storage` also on webkit-phone).
- AC3: **Sizes from a clean build of `origin/staging` and of the branch, same machine:** no route's first JS grows by more than 0.1 KB (all the code is in the PDA chunk); give the PDA chunk's size before and after, raw and gzip. `pnpm check:contrast` passes.
- AC4: **Eight deliberate breaks, each run on the final code, with the failing line and file:line pasted and the one line of `git diff` that is the break** (a break run before your last change does not count): (B1) swap the tones (an NDPDA gets the warning tone: E1 fails); (B2) show `pairs.length + 1` (E1 fails); (B3) mark rows `first + 1` and `second + 1` (E3 fails); (B4) accept a stale answer, by removing the sequence check (U fails, and E6); (B5) make the second press of Tunjukkan not clear (E3 fails); (B6) do not swap the pops (U, F3 fails); (B7) show the badge when there is no transition (E1 fails); (B8) drop the `aria-label` of the phone's short text (E7 fails).
- AC5: the new keys are in `pda-messages.ts` only, in both languages; `i18n.test.ts` and `pda-messages.test.ts` pass; the report lists every key.
- AC6: `pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens`, Vitest, `pnpm build && pnpm size` pass; `git diff --stat` shows no FSM file (`checker.ts` in particular) and nothing in `crates/`.

**Verification:**

```
pnpm --filter web exec vitest run src/lib/editor/pda-determinism.test.ts src/lib/i18n
pnpm build && pnpm size
pnpm check:contrast
pnpm --filter web exec playwright test pda-determinism pda-panel pda-editor pda-storage pda-messages pda-table-edit switcher editor-checks editor-panel editor-table --project=desktop
pnpm --filter web exec playwright test pda-determinism pda-panel pda-editor pda-storage pda-messages pda-table-edit --project=phone
pnpm --filter web exec playwright test pda-storage --project=webkit-phone
```

Follow the rules of `AGENTS.md` for every shell command (long runs as background tasks, the stuck rule). Quote the lines that you changed from `git diff`, not from memory.

**Rollback:** `git revert <sha>`. The badge goes; nothing in the documents or the formats changes.

**Depends on:** T-051, T-063 and T-061 (all merged).

**Notes for worker:**

- Read ADR 0049, 0050 and 0051, then `PdaEditor.svelte` (the snippets, `marked`, `handleMore`), `pda-checks.ts` (the same index mapping), `diagram/pda-diagram.ts` (`transitionLabel`, `formatStackSeq`, `stackSeparator`), `checker.ts` (to copy its rules, not to change it), `PdaTableView.svelte` and `PdaTransitionsBlock.svelte`.
- Before you write anything, check with real commands and paste the output: the pairs the real engine gives for G, J and K as DPDA and NDPDA; that the `first` and `second` indices are indices into `doc.transitions` for each of them; the names of the tokens in `tokens.css` and what `pnpm check:contrast` reads; how an edge node of the canvas is focused today (what `+ n lagi`'s tests use); the name of the editor method that clears the selection; and what a row needs so that the badge can focus its first control.
- The risk to watch is a badge or a shown pair that belongs to an older document (the stale answer, and the marks that outlive an edit), and the focus when the Tabel tab is not the open one.
- Another worker may be working in a different folder at the same time. If your PR is merged second and `docs/agent/REPORT.md` conflicts, merge `origin/staging` into your branch and keep your own report.

---

## Task T-052 — PDA editor, part 12 of 12: saved machines, files and the three examples (draft)

**Status:** proposed (after T-051, T-061 and T-062)
**Owner:** worker

**Goal:** "Mesin saya" lists FSMs and PDAs with a type chip and opens a PDA in the PDA mode; the first-run card of the PDA editor with the three examples of T-033; open and export `.jff` and JSON for a PDA (with the calm message for symbols of more than one character); the FSM importer's `jff.unsupported_type { type: "pda" }` offers "Buka di mode PDA". No share link (a later task). See `design/screens/pda-editor.md`, section 1 and "Files and export".

**Depends on:** T-051, T-061, T-062, T-063.

---

## Task T-038 — Conversions and simulation panel for the PDA (draft)

**Status:** proposed (after P-005 is approved and T-051, T-034, T-035, T-037 are merged)
**Owner:** worker

**Goal:** In the PDA editor, a panel that plays the simulation of T-031 (stack drawn, one step at a time, the peak number shown) and shows the traces of T-034 to T-037. A wireframe the owner approves comes first (planner task P-005, to be written after P-004).

**Depends on:** P-005, T-051, T-034, T-035, T-037.

---

## Planner task P-004 — Wireframe of the PDA editor

**Status:** done (drawn on 2026-11-06 in `design/screens/pda-editor.md` and `.svg`; the owner accepted the planner's pick on all five questions the same day; the build is split into T-033, T-039, T-049, T-051 and T-052)
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
- **T-066** `newStateCommand` in `web/src/lib/editor/table.ts` is typed for `MachineDocument` although it only reads `states`, so the PDA table repeats its six lines in `pda-table-edit.ts` (`addStateCommand`). Widen the parameter to `StatesDocument` and let the PDA call it (found by the worker in T-061; the task's non-goals forbade touching `table.ts`).
- **T-067** Two e2e locators pick the delete tool with `{ name: /^Hapus/ }` unscoped: `web/e2e/pda-editor.spec.ts:324` and `web/e2e/pda-panel.spec.ts:450`. The first one broke in T-061 as soon as the panel had buttons named "Hapus simbol/state/baris"; the second passes only because the panel is not in the DOM at that point. Make both `{ name: 'Hapus', exact: true }`, as `editor-edges.spec.ts:163` already does.
- **T-068** `web/src/lib/editor/history.ts` holds both `createHistory` and `createPdaHistory`, so the first load of every route downloads `pda-commands.ts` and `pda-document.ts`. Split the PDA history into its own module and import it only with the PDA mode; it shrinks `index.html`, `soal.html` and `panduan.html`, and it would remove the 0.2 KB that T-061 pays when its lazy table chunk starts importing the PDA commands (found by the worker in T-061, section 8 of its report).

**B. Grammar additions** (a wireframe the owner approves comes first for T-020)

- **T-020** Multi-string test for grammars, like the FSM test list, using the CYK parser.
- **T-021** JFLAP grammar files (`<type>grammar</type>`): import and export. Original fixtures only. The course grammar files in `REFERENCES/` must never become fixtures.
- **T-022** (optional) Right-linear grammar to FA, using the FSM engine.

**C. The PDA** (each step has its own ADR; a wireframe the owner approves comes first for T-033)
Decided by the owner on 2026-11-04 (see `DECISIONS.md`): the notation is Rich's and the slides' (not Sipser's); the PDA is non-deterministic as well as deterministic (the course homework uses both); every run has a step budget, like the FSM engine, and ends as "stopped" with the partial trace.

- **T-030** PDA data model, JSON, validation and the determinism check: specified in its own block above (`todo`). The three questions are settled from the slides (2026-11-05): the stack starts empty, one acceptance rule (input used up, stack empty, accepting state), `pop` and `push` are lists of named symbols, top first.
- **T-031** PDA simulation, breadth-first, with a stack trace, budgets and the peak number of configurations: specified in its own block above (`todo`; after T-030).
- **T-032** PDA `.jff` import and export: specified in its own block above (`todo`; T-030 and T-031 are merged).
- **T-033** PDA editor, part 1 of 5, the PDA document, its commands and its history: specified in its own block above (`done`, PR 165). **T-039** (the diagram shows a PDA): specified in its own block above (`done`, PR 167). **T-049** (the interaction core works for two kinds of document): specified in its own block above (`done`, PR 169). **T-053** (the canvas works for two kinds of document): specified in its own block above (`done`, PR 173). **T-054** (the label form): specified in its own block above (`done`, PR 176). **T-055** (the editor frame is shared): specified in its own block above (`done`, PR 178). **T-056** (saving a PDA on the device): specified in its own block above (`todo`, since 2026-11-08). **T-057** (the editor shell and the mode), **T-051** (the panel) and **T-052** (saved machines, files, examples): drafts above (`proposed`), one after the other.
- **T-034** CFG to PDA, top-down (slides, `CFGtoPDAtopdown`): specified in its own block above (`todo`, since 2026-11-05; T-032 is merged). Tested by language equivalence, not by structure against JFLAP's file.
- **T-035** CFG to PDA, bottom-up (slides, shift and reduce): specified in its own block above (`todo`, since 2026-11-05; T-034 is merged).
- **T-036** PDA to restricted normal form, with a trace: specified in its own block above (`done`, PR 161).
- **T-037** PDA in restricted normal form to CFG, with a trace: specified in its own block above (`done`, PR 163). The slides' example `wcwᴿ` is the oracle (76 rules, 15 after cleanup).
- **T-038** Conversions and simulation panel for the PDA: draft above (`proposed`; after P-004, P-005 and T-033).
- **T-071** One scheduler for the two engine queries of the PDA panel (`proposed`, found by T-062): `checker.ts` and `pda-determinism.ts` are the same rule (a debounce, a sequence number, a dispose) on two different answers, and the panel now asks the engine twice after every change. One small `createQuery` that both use would remove the second copy, but `checker.ts` is shared with the FSM, so it needs FSM tests and a decision of its own. Not urgent: there is no third query yet, and the copy is 40 lines.
- **P-004** Wireframe of the PDA editor: planner task above (`done`, approved on 2026-11-06).

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
