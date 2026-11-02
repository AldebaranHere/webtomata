# Plan — Milestone 0: clean up, then grammar additions, then the PDA

> Owner: planner. Approved by the human on 2026-11-01 (outline A to D). Each task is approved again by the human when it is promoted to `todo`.
> The worker does one task at a time. Only one task has `Status: todo`. The planner promotes the next task after it accepts the previous one.
> The blank task template is in `PLAN-TEMPLATE.md`.

Status legend: `proposed` | `todo` | `in-progress` | `blocked` | `done` | `rejected`

## Order of work

- **A. Clean up** (this plan, T-001 to T-005 and P-001, then T-010 to T-013).
- **B. Grammar additions** (T-020 to T-022): a multi-string test for grammars, JFLAP grammar import and export, right-linear grammar to FA.
- **C. The PDA** (T-030 to T-035): model, simulation, `.jff`, editor, CFG to PDA (LL), CFG to PDA (LR).
- **E. Turing machines** (T-040 to T-048): one tape, `.jff`, editor, k tapes, macro notation. They follow the PDA and the owner names each step.
- **D. Launch work** (G4, G5, L3, L4, the beta) runs alongside. It needs the owner's phone and students. See `MD_FILES/ROADMAP.md`.

Rules for every task (from `CLAUDE.md` and `AGENTS.md`): tests first, with a deliberate break of each new rule; every user-facing string in `id` and `en`; new Indonesian terms in `docs/glossary.md` marked `TODO(review)`; a new screen needs a wireframe the owner has approved; no new dependency without a decision entry; never weaken a test or raise a budget; the PR goes to `staging` and the owner merges it.

---

## Task T-001 — Add a `typecheck` script (and get the first Linux CI run)

**Status:** todo
**Owner:** worker
**Branch:** `task/T-001-typecheck-alias`

**Goal:** `pnpm --filter web typecheck` must work from a clean checkout. It does not exist today: `web/package.json` has only `check`, which already runs `svelte-kit sync` first. The handoff and the old plan template named a script that was never there. This is also the first PR to `staging` since the handoff, so its CI run is the first proof that the Linux-only tests in `tools/install-browser-deps.test.mjs` pass (they are skipped on Windows).

**Scope (in):**
- Add `"typecheck": "pnpm run check"` to `web/package.json`.
- Add `"typecheck": "pnpm --filter web typecheck"` to the root `package.json`.

**Non-goals (out):**
- No change to the `check` script (it works and CI uses it).
- No change to workflows, `AGENTS.md`, or any `.svelte`/`.ts` file. The planner edits `AGENTS.md`.
- If the dpkg tests fail or are skipped in CI, do not fix them here (see AC5).

**Files expected to touch:**
- `web/package.json`
- `package.json`

**Design reference:** none (no UI).

**Acceptance criteria:**
- AC1: After `web/.svelte-kit` is removed, `pnpm --filter web typecheck` exits 0 and prints `svelte-check found 0 errors and 0 warnings`.
- AC2: `pnpm typecheck` at the repository root does the same.
- AC3: `pnpm check` still passes, unchanged.
- AC4: The PR is opened to `staging` from `task/T-001-typecheck-alias`. Title: `chore(web): add a typecheck script`. The description follows Google's CL style (problem, why, what is left out, checks) and the repository's PR template, with no attribution lines. The worker does not merge.
- AC5: In the CI log of the job that runs `pnpm test:tools`, the seven tests of `install-browser-deps` are listed as passed, not skipped. Paste those lines into `REPORT.md`. If they are skipped or fail, set the task to `blocked`, paste the log, and hand back. Do not change the tests in this PR.

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

**Status:** proposed (earliest start 2026-11-04; promote after T-001 is accepted)
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

**Status:** proposed (promote after T-002, or after T-001 if the owner wants it first)
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

**Status:** proposed
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

**Status:** proposed (earliest start 2026-11-12; the owner decided on 2026-11-02 to keep `wrangler` 4.155.0 until then)
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

**Status:** proposed (promote after T-003 is accepted)
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

## Planner task P-001 — As-built spec of the grammar workstation, the language workstation and the switcher

**Status:** todo (planner)
**Owner:** planner

Write `design/screens/grammar-workstation.md`, `design/screens/language-workstation.md` and `design/screens/workstation-switcher.md` from the screenshots and the code, and add them to `docs/ux/wireframes.md`. No redesign of the laptop layouts. The owner approves each. T-010 to T-012 wait for this.

**Added on 2026-11-02, after the owner's phone test:** the two workstations are not usable on a phone. Both stack their three areas as small boxes with their own scroll bars, so a student sees about one item of the library, one row of the grammar, or only the heading of the CNF phase; in the language workstation the results are below the settings and off the screen. P-001 therefore also proposes a phone layout for both (my proposal: one area at a time with a bottom tab bar, like the panel tabs of the FSM editor: Perpustakaan, Editor, Hasil or Transformasi and Uji). The owner approves it before T-016.

## Planner task P-002 — Wireframe of the CNF "versi kuliah / versi ringkas" switch

**Status:** proposed (after P-001)
**Owner:** planner

The owner's idea (2026-11-02): the CNF conversion shows a verbose version that follows the course (no sharing) and a minimized version, with a toggle. The planner draws it and the owner approves it before T-015. Open points for the owner at that time: is "minimized" only shared helper variables, or also reuse of an existing `A → a` rule for a terminal (the slide mentions it)? Are the two versions shown one at a time, or side by side?

---

## Backlog (`proposed`, not dispatchable until the planner specifies the missing fields)

**A. Clean up (after P-001 is approved)**
- **T-010** e2e and axe tests for the grammar workstation (build a grammar, run the six phases, test a string with CYK; laptop and phone).
- **T-011** e2e and axe tests for the language workstation and the workstation switcher (keyboard, 44 px targets).
- **T-012** A test and, if needed, a fix for the panel drag handle on a phone (the `pointer-events` change in PR 105 has no test).
- **T-016** The phone layout of the grammar and the language workstations (after P-001 is approved). It also covers the phone checks of G4 for these screens. Tests on the phone project and WebKit phone.
- **T-015** The UI switch between the course version and the minimized version of the CNF conversion (needs P-002 approved, and T-014 done).
- **T-013** Check whether preset titles and descriptions of the grammar and language workstations belong in the i18n files (they are plain Indonesian text in `presets.ts`), and move them if so. Also make the rule chips readable (`S → T_aST_b` has no spaces).

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
- **T-046** Macro notation: the model, and the expansion of a macro diagram to a standard TM (the exercise of homework 9, part C). The target is the course notation (the owner's figures show a start arrow, `L` and `R` blocks, scanning blocks with a set of symbols, write blocks, `H`, and arrows labeled with a symbol or a set). **JFLAP has a "Turing Machine with Building Blocks" mode (the owner's screenshot shows extra tools), but none of the owner's sample files uses a block, so the planner does not yet know how JFLAP saves blocks, and its blocks (sub-machines) may differ from the course notation.** Before this task: the owner saves one `.jff` made with building blocks; the planner writes the model and an ADR; the owner approves them. The result opens as a new machine, like a minimized machine, with an option to save it. Examples in the repository must be original.
- **T-047** Macro editor, with a "Macro to TM" button (scenario 2 of the owner, 2026-11-02): the editor shows the TM version of the macro and offers to save it. A wireframe the owner approves comes first.
- **T-048** TM to macro, "folding" (scenario 1 of the owner, 2026-11-02; JFLAP has no such feature): a button in the TM editor shows the TM in macro form and offers to save it. The idea is to recognize the building blocks of the course notation (move, write, scan to a symbol of a set) inside a TM and replace each by a block; what cannot be recognized stays as a plain sub-machine. Needs an ADR for the method. **Correctness test:** the expansion of the folded macro accepts and rejects the same strings as the original TM, for every string up to a given length, and gives the same tape result in function mode. A research task: it starts only after T-046 and T-047, with the owner's examples of the blocks of the course.

**D. Launch** — G4, G5, L3, L4, U5a and the beta: see `MD_FILES/ROADMAP.md`.
