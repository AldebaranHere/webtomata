# Decision log

Append-only. Newest at the top. One entry per decision. If a decision is reversed, add a new entry that supersedes the old one; do not edit the old one.

Format:

## YYYY-MM-DD — <short title>
- Decider: planner | worker
- Context: one sentence
- Decision: one sentence
- Alternatives considered: one line
- Reversible? yes | no
- Affects: files, modules, or plans

---

## 2026-11-05 — CFG to PDA bottom-up conversion with step trace (task T-035)
- Decider: worker
- Context: The course lecture (Slide13, page 8) teaches `CFGtoPDAbottomup`, constructing an equivalent 2-state non-deterministic PDA with an empty initial stack that parses by shift-reduce moves and step traces.
- Decision: Implemented `cfg_to_pda_bottomup` in `crates/engine-core/src/cfg_pda.rs` with API endpoint `cfg_to_pda_bottomup`. Shares alphabet building, state definitions, clash checks (`pda.cfg.symbol_clash`), and rule deduplication with T-034. Adds shift transitions reading terminals and pushing them, reduce transitions popping reversed rule bodies top-first and pushing the head variable, and accept transition popping the start variable to the accepting state. For grammars without ε-rules, simulations terminate as `Finished` with bounded stack depth; for grammars with ε-rules, non-language strings can exhaust budgets and terminate `Stopped` (`max_stack` or `max_configurations`).
- Alternatives considered: Separate modules for top-down and bottom-up (rejected: 80% shared validation logic fits cleanly in one compact module under 400 lines); pop list in forward grammar order (rejected: Slide13 page 8 specifies top-of-stack first, matching the reversed push order of shifts).
- Reversible? yes
- Affects: `crates/engine-core/src/cfg_pda.rs`, `lib.rs`, `api.rs`, `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/protocol.ts`, `handlers.ts`, `docs/decisions/0038-cfg-to-pda-bottomup.md`, `docs/ARCHITECTURE.md`

---

## 2026-11-05 — CFG to PDA top-down conversion with step trace (task T-034)
- Decider: worker
- Context: The course lecture (Slide13, page 4) teaches `CFGtoPDAtopdown`, translating a context-free grammar into a 2-state non-deterministic PDA with an empty initial stack and trace steps.
- Decision: Implemented in `crates/engine-core/src/cfg_pda.rs` with API endpoint `cfg_to_pda_topdown`. Emits 3 types of transitions: start transition pushing the start variable to stack; rule transitions popping head and pushing RHS top-first (ε-rules push empty); and terminal transitions reading and popping matching terminals. Input alphabet is sorted terminals, and stack alphabet is a single unified list of variables and terminals sorted in byte order. Duplicate rules are merged to prevent duplicate transition warnings. Symbol name collisions between variables and terminals are rejected with `pda.cfg.symbol_clash`. Step traces are emitted in linear order with wire transitions and localized message keys.
- Alternatives considered: Pre-normalizing the grammar before conversion (rejected: students need to inspect their exact unmodified rules); separate variable and terminal stack alphabet partitions (rejected: byte-order sorted unified list preserves canonical ordering).
- Reversible? yes
- Affects: `crates/engine-core/src/cfg_pda.rs`, `lib.rs`, `api.rs`, `ts.rs`, `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/protocol.ts`, `handlers.ts`, `docs/decisions/0037-cfg-to-pda-topdown.md`

---

## 2026-11-05 — Pushdown automaton (PDA) JFLAP .jff import and export (task T-032)
- Decider: worker
- Context: Fasilkom UI students and lecturers exchange PDA files with JFLAP (`<type>pda</type>`). JFLAP reads pop/push strings top-first (one char per symbol) and implicitly adds a bottom marker `Z` that our course simulator ignores (Slide12).
- Decision: Implemented `parse_pda_jff` and `to_pda_jff` in `crates/engine-core/src/jff.rs`, sharing state parsing and XML escaping helpers with the FSM implementation without altering FSM behavior. Pop and push strings serialize and parse top-first character-by-character. Multi-character `<read>` labels are refused with `jff.pda_read_not_single { label, from, to }`. PDAs containing multi-character stack or input symbols (e.g. `S0` from CFG conversions) cannot be exported and fail with `jff.symbol_not_single_character { symbol }`. Imported PDAs default to `ndpda`. Machines relying on JFLAP's implicit bottom marker import without modification, trigger `pda.pop_never_pushed` validation warnings, and reject on an empty stack.
- Alternatives considered: Decomposing multi-character read labels into intermediate states like FSMs (rejected: alters stack semantics without knowing JFLAP PDA behavior); automatically injecting a bottom marker on import (rejected: contradicts course Slide12 rules).
- Reversible? yes
- Affects: `crates/engine-core/src/jff.rs`, `lib.rs`, `api.rs`, `ts.rs`, `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/protocol.ts`, `handlers.ts`, `docs/decisions/0036-pda-jff.md`

---

## 2026-11-05 — PDA simulation engine, trace ranking, and peak configuration tracking (task T-031)
- Decider: worker
- Context: PDA execution requires breadth-first simulation with a single computation trace, budget safety, and measurement of peak configurations alive in the queue for homework assessment.
- Decision: Implemented level-by-level BFS in `crates/engine-core/src/pda_simulate.rs` dropping duplicate configurations across and within levels, halting at the first level with an accepting configuration. Rejected traces select the best final configuration ranked by (conditions satisfied > position > creation order) with priority-ordered diagnostic failure messages (`input_left` > `not_accepting_state` > `stack_not_empty`). Added `StopReason::MaxStack` and default budgets (`max_steps: 10_000`, `max_configurations: 20_000`, `max_stack: 500`) with measured worst-case resident memory delta of ~37.8 MB (well below 50 MB).
- Alternatives considered: Eagerly returning on first accepting config mid-level before finishing the level (rejected: would skew peak_configurations count across levels); ranking rejected traces solely by distance without considering stack status.
- Reversible? yes
- Affects: `crates/engine-core/src/pda_simulate.rs`, `stop.rs`, `api.rs`, `ts.rs`, `crates/engine-wasm/src/lib.rs`, `web/src/lib/engine/handlers.ts`, `protocol.ts`, `docs/decisions/0035-pda-simulation.md`

---

## 2026-11-05 — The PDA is specified from the slides (T-030 to T-038)
- Decider: owner (approved the decisions and the breakdown); planner (specs)
- Context: The owner asked whether the PDA gets the same pairs of conversions as the FSM and a non-deterministic version. The planner read the PDA slides (Slide12 and Slide13, three semesters), the HW06 text and the owner's sample machines. The newer Slide12 says that JFLAP's bottom-of-stack symbol must be ignored (the grader is built without it) and that machines are built "per the concept taught".
- Decision: (1) The stack starts empty; the engine adds no marker. (2) One acceptance rule, from the slides: input used up, stack empty, accepting state; no "final state only" mode (the grader does not use it); a rejection says which condition failed. (3) `pop` and `push` are lists of named stack symbols, top first; a transition that pops nothing does not check the stack. (4) The PDA is non-deterministic by default; a DPDA is the case where no two transitions compete (same read or one reads nothing, and one pop is a prefix of the other, from the slides); there is no NDPDA to DPDA conversion because none exists in general. (5) The simulator is breadth-first and returns the peak number of configurations, because the homework grades non-determinism that way; our count may differ from the server's. (6) `.jff` export refuses stack or input symbols longer than one character; import ignores JFLAP's marker. (7) Conversions follow the slides: CFG to PDA top-down and bottom-up, PDA to restricted normal form, then to CFG (new tasks T-036 and T-037); the oracle is language equivalence by simulation, not JFLAP's file, and for T-037 the slides' own example. (8) Sample machines never solve the languages of the current homework.
- Alternatives considered: a second acceptance mode for JFLAP files (dropped: code is a cost and the grader does not use it); single-character stack symbols (rejected: the slides use `id` and our variables are named `S0`, `T_a`).
- Reversible? yes
- Affects: `docs/agent/PLAN.md` (T-030 to T-038, P-004)

---

## 2026-11-05 — T-060 merged; T-015 (the toggle) specified
- Decider: owner (accepted T-060 as built); planner (what "versi ringkas" means)
- Context: T-060 (PR 147) put the six phases in the homework order. The owner accepted that unit-rule removal can leave unreachable variables in the final grammar (the homework order has no cleanup stage after it; Rich's textbook leaves them too), and that opening a nullable CNF result as a new grammar adds a second `S₀` (the slide rule "add `S₀` when the start symbol is nullable").
- Decision: "versi ringkas" is one flag with two effects: phase 5 reuses a variable whose only rule is `A → a`, and phase 6 shares identical helper variables. One flag, renamed from `share_helpers` to `short_version`. A note appears in a phase only when something was reused or shared. The choice is kept in `localStorage`, not in the share link. "Open as new grammar" and CYK use the version on screen. T-015 becomes `todo`.
- Alternatives considered: two flags (one per phase), which the UI has no use for; reusing any variable that has `A → a` among several rules, which changes the language.
- Reversible? yes
- Affects: `docs/agent/PLAN.md` (T-015)

---

## 2026-11-05 — The owner approved the CNF stepper wireframe; T-060 is `todo`
- Decider: owner (approval); planner (status)
- Context: The owner read `design/screens/cnf-stepper-homework-order.md` and agreed with the stage order, the start-symbol rule and the toggle labels "versi panjang / versi ringkas".
- Decision: T-060 becomes `todo`. T-015 (the toggle) stays `proposed` until T-060 is merged and its full spec is written.
- Alternatives considered: none.
- Reversible? yes
- Affects: `docs/agent/PLAN.md` (T-060, P-002)

## 2026-11-05 — The CNF stepper follows the homework order (T-060), and T-029 is specified
- Decider: owner (follow the homework); planner (specs)
- Context: T-010 review. The course homework asks for six CNF stages: unreachable, non-productive, ε, unit, mixed, long rules. The engine's six phases are: start symbol, ε, unit, useless (both kinds), terminals, long. Its phase names and descriptions are Indonesian sentences written in Rust. The worker of T-010 also found that the CYK tester joins rule symbols with no space, which the planner reproduced: `S -> T_aT_b` fails with "must be CNF", `S -> T_a T_b` works.
- Decision: (1) The six phases follow the homework order (T-060, `proposed` until the owner approves the wireframe `design/screens/cnf-stepper-homework-order.md`). The owner asked the planner to settle the two content questions from the course files; there is no homework answer key, so the planner used the slides and checked the four 2026 HW05 grammars by hand. Start symbol: no stage of its own; as the slides (CFG2, "returning ε") say, if `S` is nullable a new start symbol `S₀ → S | ε` is added in the ε stage, whether or not `S` is on a right-hand side. Order of the first two stages: the homework's (unreachable, then non-productive), and the second stage also removes what its own removal made unreachable; for the four homework grammars the order changes nothing. (2) The phase names and descriptions become message keys, in the same task. (3) The toggle "versi panjang / versi ringkas" (T-015) comes after T-060. The owner renamed the first label from "versi kuliah" to "versi panjang" on 2026-11-05, because the site is for students outside Fasilkom UI too; English: "Long version" and "Short version". (4) T-029 (the CYK tester uses `grammarToText`) is `todo`: it breaks the main flow of convert, open as grammar, test a string.
- Alternatives considered: keep Rich's order and explain it in a guide (a student comparing with the homework still sees different intermediate grammars); split the key change from the order change (the same twelve texts would be rewritten twice).
- Reversible? yes
- Affects: `docs/agent/PLAN.md` (T-029, T-060, T-015, P-002), `design/screens/cnf-stepper-homework-order.md` and `.svg`, `docs/ux/wireframes.md`

## 2026-11-04 — Rule rows on touch screens (T-024), and three tasks specified
- Decider: owner (design and CNF/PDA answers); planner (specs)
- Context: The planner measured the rule matrix of the grammar Editor, found that a row can be deleted only by right-click, and proposed a phone layout (P-003). The owner also answered the open questions for the CNF switch and the PDA.
- Decision: (1) T-024: option B (alternatives flow in one line, like the course notation), applied at width ≤ 900 px and on `pointer: coarse` screens, with a 44 px "×" that deletes without asking. (2) T-010 (grammar flow e2e) and T-011 (language workstation and switcher e2e) are specified; expected results are derived by hand, and an engine disagreement stops the task. (3) T-012 is `rejected`: the drag handle already has seven real-touch tests in `editor-panel-height.spec.ts`. (4) CNF switch (P-002): the long version is the default, a toggle switches to a minimized version with reused rules, one version at a time. (5) PDA: Rich's and the slides' notation, deterministic and non-deterministic, a step budget with a "stopped" result and a partial trace.
- Alternatives considered: option A (stacked alternatives, easier to tap, reads less like the textbook); a phone-only layout by width (leaves landscape tablets with small targets).
- Reversible? yes
- Affects: `docs/agent/PLAN.md` (T-024, T-010, T-011, T-012, P-002, backlog C), `design/screens/grammar-rule-rows-phone.md` and `.svg`

## 2026-11-04 — The worker does not run the full e2e suite on its machine
- Decider: planner (the owner asked whether the worker could shard the suite like CI)
- Context: CI runs the e2e suite in four shards on four machines (about 5 minutes); the worker ran the whole suite on one laptop under WSL, which takes much longer, and sharding on one machine does not add speed.
- Decision: the worker runs the specs of the area (found with `grep -l`), the cross-browser spec of the area for layout, touch or phone changes, and repeats new specs 5 or 10 times; CI runs the full suite and the owner merges only on green. A task that lists `pnpm test:e2e` means the area specs unless it says "full suite locally". T-025 was changed to match, and it also gets the small e2e that T-013 left out (T-013 AC2 was checked by hand only).
- Alternatives considered: running `--shard` in sequence (no gain); raising `--workers` or the WSL core and memory limits (the owner may try it; not a rule).
- Reversible? yes
- Affects: `AGENTS.md` (verification tiers), `docs/agent/PLAN.md` (T-025)

## 2026-11-04 — Four small tasks specified: T-019, T-017, T-025, T-013 (and T-028 found)
- Decider: planner (the owner approves by merging the PR)
- Context: The owner asked for the specs of the four small items of the backlog while T-002 runs.
- Decision: T-019, T-017, T-025 and T-013 are `todo`. While reading the code for T-019 the planner found that the grammar engine's errors are Indonesian sentences that the UI shows as they are (and a raw key when there is no `detail`); that is a larger task, T-028, in the backlog. T-013 follows the pattern that `language/presets.ts` already has (a text field for each language) and does not add a new mechanism. T-019 adds one message key, `grammar.cyk_input_too_long`, with wording written by the planner.
- Alternatives considered: one big task for all grammar errors now (too large for one review); moving preset text into the message files (a second mechanism next to the one that exists).
- Reversible? yes

## 2026-11-04 — Lessons from the review of T-050 (the CI fast path)
- Decider: planner
- Context: The first spec of T-050 had two gaps that the worker and the review found. The spec said that `audit.yml` and `fuzz.yml` get `paths-ignore`, but both already have a positive `paths` filter (GitHub forbids both on one event), so they never run for a documents-only change. And the spec did not say how to list the changed files: `git diff --name-only` detects renames, so a code file moved into `docs/` listed only the new path and would have been classed as documents-only.
- Decision: `audit.yml` and `fuzz.yml` stay as they are, and the guard rail checks that their `paths` contain no allowlisted entry. The `scope` job uses `git diff --no-renames --name-only -z`, a guard rail requires the flag, and paths may use only `A-Z a-z 0-9 . _ - /`. The proof after the merge also tries a rename into `docs/`.
- Alternatives considered: `paths-ignore` on all four (widens `audit` and `fuzz` to every code pull request); a rename-aware check of both sides (more code, same result).
- Reversible? yes
- Note: the planner's spec was wrong in the first point and silent on the second; a spec for a security-relevant change must name the exact git flags.

## 2026-11-03 — Readable CNF helper names and `λ` as empty (tasks T-026, T-027)
- Decider: owner (planner proposed)
- Context: The review of T-023 showed that the grammar the button stores can differ from the CNF result on screen: the parser reads the helper name `T_(` as `T_` plus `(`, and reads `λ` as a terminal, although the Editor legend says it means the empty string.
- Decision: The engine names the helper of a non-alphanumeric terminal `T_p<n>` (T-026), and the parser accepts `λ` as the empty string (T-027). T-023 writes `ε` for an empty body and marks the two known failures `it.fails` until T-026.
- Alternatives considered: hide the button when a name is unreadable (needs a new message element and a wireframe); rename only in the stored copy (the stored text would differ from what the student saw).
- Reversible? yes
- Note: the planner's T-023 plan told the worker to copy the Editor's `λ`; that was wrong because the engine does not read `λ` as empty. The worker found it, and the review logged it.

## 2026-11-03 — Open the CNF result as a new grammar (task T-023)
- Decider: owner (planner proposed)
- Context: After the phone test the owner noticed that the FSM panels end with "Buka sebagai mesin baru" but the grammar workstation has no way to keep the CNF result.
- Decision: The last step (step 6) of the CNF tab gets a primary button "Buka sebagai tata bahasa baru". It adds "<name> (CNF)" to the custom grammars, selects it and shows it in the Editor; the original grammar does not change. No button on steps 1 to 5, and no new message element. The engine result is turned into text with one space between all symbols, and a round-trip test through the real parser guards it. The worker also fixes the custom id `G<length+1>` that can repeat after a delete.
- Alternatives considered: a button on every phase (more copies, more scope, the owner chose the last step only); staying on the CNF tab after the tap (the owner chose the jump to the Editor).
- Reversible? yes
- Affects: `web/src/lib/grammar/*`, `web/src/lib/i18n/*`, `docs/agent/PLAN.md` (T-023; backlog T-024 and T-025 come from the review of T-016)

## 2026-11-03 — A fast path in CI for documents-only changes (task T-050)
- Decider: owner (planner proposed)
- Context: Every pull request runs the whole CI (about 6 to 7 minutes, plus CodeQL, audit, fuzz and a preview deploy), even a change of one document. The owner asked for a faster way and asked whether it is a security risk. The post-mortem had left this undecided.
- Decision: The decision is made inside `ci.yml` by a `scope` job and a small script with a short exact allowlist (`docs/`, `design/`, `.antigravity/` and six root files), deny by default. The heavy jobs skip, and the gate `web` and the check `rust` still report, so the pull request stays mergeable. A change of `content/`, `.github/`, `tools/`, `web/` or `crates/` is never documents-only, a push to `main` always runs everything, and any error means "run everything". The workflows that are not required checks use `paths-ignore` with the same list, and a guard rail keeps the lists equal. Task T-050; ADR 0033 is written by the worker.
- Alternatives considered: `paths-ignore` on `ci.yml` (the required checks would never report and the PR would wait for ever); a third-party path-filter action (a new dependency in the supply chain); doing nothing.
- Reversible? yes
- Affects: `.github/workflows/*`, `tools/`, `docs/decisions/0033-docs-only-fast-path-in-ci.md`, `docs/agent/PLAN.md` (T-050)

## 2026-11-03 — The owner names the task in the start prompt; no promotion pull requests
- Decider: owner (planner proposed)
- Context: The planner opened a pull request only to change the status of the next task from `proposed` to `todo`, and each such pull request ran the whole CI.
- Decision: `todo` means ready (all fields written and approved by the owner) and several tasks can be `todo` at once. The owner names the task in the start prompt ("Do task T-xxx"). The worker checks that the task is `todo`, that its date has come and that its dependencies are merged, and sets it to `in-progress` in its first commit and to `done` in its last. The planner batches its own document changes and suggests an order in `PLAN.md`.
- Alternatives considered: Keep exactly one `todo` task (a promotion pull request for each task); let the worker pick any `todo` task (the owner loses control of the order).
- Reversible? yes
- Affects: `AGENTS.md`, `.antigravity/rules.md`, `docs/agent/WORKFLOW.md`, `docs/agent/PLAN.md`

## 2026-11-03 — T-004 accepted after the planner removed unsupported statements from the ADRs
- Decider: planner
- Context: The ADRs of the language and grammar engines (T-004) quoted many numbers and line references, and all of them matched the code. But they also said that the grammar editor has a text mode (it does not), gave weeks of the course with no source, and said that the six CNF phases strictly follow the lecture order and match the course slides (the slides teach four of the six steps).
- Decision: The planner corrected those sentences on the worker's branch before merge (a documentation fix of three lines, so no fix task) and accepted the task. The ADRs now say what the code does and what the sources support.
- Alternatives considered: A fix task for the worker (a round trip of several minutes for three sentences); merging as it was (a false statement in an ADR).
- Reversible? yes
- Affects: `docs/decisions/0031-language-enumeration.md`, `docs/decisions/0032-grammar-cnf-cyk.md`

## 2026-11-02 — The phone layout of the grammar and language workstations
- Decider: owner (planner proposed)
- Context: On a phone, the two workstations stack three areas as small boxes with their own scroll bars (the owner's phone test).
- Decision: Below 900 px, one area at a time with a tab strip at the top (`Pustaka`, `Editor`, `CNF`, `CYK` for the grammar; `Pustaka`, `Editor`, `Hasil` for the language), the same tab pattern as the FSM panel tabs. The page scrolls as a whole. A tap on a preset jumps to the Editor tab. The grammar Editor tab ends with a shortcut button "Ubah ke CNF". Task T-016.
- Alternatives considered: Tabs at the bottom (the FSM editor has its tabs at the top); no shortcut button (the owner wants it).
- Reversible? yes
- Affects: `design/screens/workstation-phone-layout.md`, `docs/agent/PLAN.md` (T-016)

## 2026-11-02 — The start state is drawn as a large hollow triangle, like JFLAP
- Decider: owner (planner proposed)
- Context: The start marker was a short arrow with the label "mulai". The students know JFLAP from the course, where the start state has a large triangle.
- Decision: A hollow triangle (28 long, 36 wide, tip on the rim of the state) with the label "mulai" kept beside it, drawn from the existing tokens. One geometry function draws it, so the editor, the guide embeds, the comparison player and the SVG and PNG export all change. Task T-018.
- Alternatives considered: The old arrow; the triangle alone with no label.
- Reversible? yes
- Affects: `design/screens/start-state-marker.md`, `docs/ux/editor-interactions.md`, `docs/agent/PLAN.md` (T-018)

## 2026-11-02 — The worker runs in a WSL-native clone, after the owner's setup is tested
- Decider: owner (planner proposed)
- Context: Windows blocks `wasm-pack` (Device Guard), and the owner often saw the worker fail on the WASM build. The report of task T-014 shows that the worker already ran `wasm-pack` through WSL, on the Windows folder mounted at `/mnt/d`, and that it worked (28 s). That mix (Windows for `cargo` and Node, WSL for `wasm-pack`, one shared `node_modules` and `target`) works, but it is not the same as the CI, which is Linux only. The WSL clone `~/webtomata` was old, pointed at the Windows folder, and had no Git login, no pre-push hook and no Playwright browsers.
- Decision: The worker runs every command in WSL Ubuntu, in the clone `~/webtomata`, never on Windows (`AGENTS.md`, "Where the worker runs"). The rule takes effect only after the owner has done the one-time setup and the worker has passed the test in the private setup note, because with the rule on and the setup missing, the worker must stop. The rules PR is merged after that test. **Added the same day, after the owner's test:** the owner's Antigravity IDE opens the WSL folder as a Windows network path with a PowerShell terminal (it has no WSL connection), so the rule has two modes: A, a native Linux shell, and B, the bridge `wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc '...'`, which the worker already uses and which runs every command in WSL. In tests, `-e` kept the login shell's PATH (Node 24 first), while `--` let the outer shell expand `$VARIABLES` first, so only `-e` is allowed.
- Alternatives considered: Keep the mix and write it down as the rule (works today with no setup, but the two systems share `node_modules` and `target`, and a pass on Windows says less about the Linux CI).
- Reversible? yes
- Affects: `AGENTS.md`, `.antigravity/rules.md`, `docs/agent/WORKFLOW.md`

## 2026-11-02 — Publish a clean docs branch, not the scaffolding branch
- Decider: planner (approved by the owner, who asked for a security audit first)
- Context: The repository is public. The audit of the scaffolding branch found no secrets, account ids or personal data, but found: (1) `design/tokens.md` held invented token values (a blue `#2563eb`, `space.1 = 4px`) that do not match `web/src/lib/styles/tokens.css`, and `AGENTS.md` tells the worker to follow `design/`; (2) commit 23d2a7a cut most rules from `.editorconfig` and removed the binary markers from `.gitattributes`, and put a byte-order mark before the first rule of both files, which can stop the first rule from working; (3) the snapshot files `02-tree.md`, `03-manifests.md` and `06-diff.md` list the names of the owner's private files (`REFERENCES/`, `MD_FILES/`) and 2,000 build-output paths; (4) several new files had a byte-order mark or CRLF line endings; (5) there is no `CODEOWNERS` for the agent instruction files. (An earlier draft of this entry said that `staging` had no protection. That was wrong: the ruleset named `main` also covers `staging`, with a required pull request, no force-push, no deletion, and the checks `rust` and `web`. The owner is the only collaborator. Corrected before this entry was merged.)
- Decision: Publish one commit on a new branch cut from `staging`, with the agent files and docs, no byte-order marks, LF line endings, `design/tokens.md` replaced by a pointer to the real tokens, and without `.editorconfig`, `.gitattributes` and the three snapshot files above (they are git-ignored now; the snapshot tool regenerates them). Private file names are removed from `PLAN.md` and `DECISIONS.md`. A `.github/CODEOWNERS` file lists the agent files and the CI, deploy and dependency files, so that a second collaborator in the future cannot change them without the owner's review (the owner leaves "Require review from Code Owners" off while they are the only maintainer, because the author of a PR cannot approve it). The owner is advised to require approval for every outside contributor's workflow run, and to delete the remote branch `handoff/2026-11-01`.
- Alternatives considered: Merge the scaffolding branch as it is (it would put the broken config files and the file-name lists into `staging`).
- Reversible? yes
- Affects: `.gitignore`, `design/tokens.md`, `docs/agent/*`, `.antigravity/rules.md`, `AGENTS.md`, `CLAUDE.md`

## 2026-11-02 — Keep `wrangler` 4.155.0 until 2026-11-12, then remove the age-rule exclusions
- Decider: owner (planner proposed)
- Context: PR 103 let `wrangler@4.155.0` and `miniflare@5.20261023.2-beta` (both published on 2026-10-28) skip the two-week `minimumReleaseAge` rule, to fix flaky preview uploads (together with a retry loop). `wrangler` runs in the deploy job that holds the Cloudflare token.
- Decision: Do not revert. Both versions are 14 days old on 2026-11-11; on or after 2026-11-12 task T-005 removes the two exclusions and proves that install, build and the preview upload still work.
- Alternatives considered: Revert to 4.149.0 now (could bring back the flaky uploads); keep the exclusions for good (the rule would have a hole).
- Reversible? yes
- Affects: `pnpm-workspace.yaml`, `docs/agent/PLAN.md` (T-005)

## 2026-11-02 — CNF follows the course method by default; a minimized version is an option
- Decider: owner (planner proposed)
- Context: The course slide for "Eliminating Long RHS" makes `n − 2` new variables for each long rule, with no sharing. The worker's change a82bf0e shares a helper variable between rules that need the same pair, so a hand solution and the tool differ.
- Decision: The default of phase 6 is the course method (no sharing). Sharing stays in the engine behind an option that is off by default (T-014). The owner wants the page to show both, "versi kuliah" (verbose) and "versi ringkas" (minimized), with a toggle; the planner draws it (P-002) before T-015.
- Alternatives considered: Keep sharing as the default (shorter output, but not what the student writes); remove sharing (loses the owner's minimized idea).
- Reversible? yes
- Affects: `crates/engine-core/src/grammar/cnf.rs`, the grammar workstation, `docs/agent/PLAN.md` (T-014, T-015, P-002)

## 2026-11-01 — Replace the HW05 CNF presets with original examples
- Decider: owner (planner proposed)
- Context: The CNF presets and three Rust tests are named after a course homework (HW05), while the About page and `CONTRIBUTING.md` promise that content is never copied from course homework.
- Decision: Replace them with five grammars designed by the planner (`CNF_ORDER`, `CNF_NULLABLE`, `CNF_START_LONG`, `CNF_UNIT_CHAIN`, `CNF_SHARED_TAIL`), tested against the language each must keep (task T-003). The course grammar files in `REFERENCES/` are never fixtures.
- Alternatives considered: Keep the presets and rename them (the content would still be the homework).
- Reversible? yes
- Affects: `web/src/lib/grammar/presets.ts`, `crates/engine-core/tests/grammar.rs`

## 2026-11-01 — Order of work: clean up, grammar additions, the PDA; regex questions after launch
- Decider: owner (planner proposed)
- Context: The worker built the language and grammar workstations before the handoff, without wireframes, e2e tests, glossary entries or ADRs. The owner also wants a multi-string test for grammars, JFLAP grammar files, and CFG to PDA (JFLAP's two conversions). `MD_FILES/NEW_ROADMAP.md` is the owner's list of features "forgotten" and to be made better than JFLAP; it adds to the "Later" list of `MD_FILES/ROADMAP.md` and does not replace the v1 plan.
- Decision: (A) clean up first; (B) grammar additions; (C) the PDA, one PR per step, with an ADR and, for screens, an approved wireframe first; (D) the v1 launch tasks run alongside because they need the owner's phone and students. Regex "write an expression" questions come after launch; the question format stays open for them.
- Alternatives considered: Engines first (the product would reach the beta with untested screens); regex questions in v1 (the Compare feature already lets a student check a regex).
- Reversible? yes
- Affects: `docs/agent/PLAN.md`, `MD_FILES/ROADMAP.md` ("Later" list)

## 2026-11-01 — Roles, branch flow and the worker's limits
- Decider: owner (planner proposed)
- Context: The two-agent team was set up without the owner's standing rules, and the worker made decisions that belong to the owner (course material in the repository, a dependency age-rule exclusion, screens without a wireframe).
- Decision: The planner is Claude (Sonnet 5.5). The worker is Gemini 3.8 Flash, in Antigravity. The owner merges every PR. One task is one PR from `task/<id>-<slug>` to `staging`. `AGENTS.md` now holds the owner's standing rules and a list of decisions that the worker never makes alone.
- Alternatives considered: A Haiku 5.5 worker (it uses the owner's Claude allowance, which is limited; Gemini is practically unlimited for the owner and gives a second vendor to review the work).
- Reversible? yes
- Affects: `AGENTS.md`, `.antigravity/rules.md`, `docs/agent/PLAN.md`

## 2026-11-01 — Restore the project rules in CLAUDE.md, under a team section
- Decider: planner (approved by the owner)
- Context: Commit 23d2a7a replaced the 179-line `CLAUDE.md` (principles, stack, layout, engine and frontend rules, budgets, security, testing, definition of done) with a 16-line planner stub, while `ci.yml`, `ARCHITECTURE.md` and about ten ADRs still cite it (for example "budgets in `CLAUDE.md` §7").
- Decision: Put the full old text back from commit 49ade57, below a short team section that says which rules bind which agent. The project rules win over `AGENTS.md` where they differ.
- Alternatives considered: Move the rules to a new file and change every citation (many edits, more risk of a missed reference).
- Reversible? yes
- Affects: `CLAUDE.md`, `AGENTS.md` (to be aligned in a later entry), every doc that cites `CLAUDE.md`

## 2026-11-01 — Self-healing dpkg repair and bounded retry in browser dependency installation
- Decider: worker
- Context: Installing 181 WebKit system libraries on Ubuntu CI timed out at 75s mid-unpack, causing subsequent retries to fail with unconfigured dpkg errors.
- Decision: Introduce `repair_dpkg` (`pkill -9`, `fuser` lock wait, `dpkg --configure -a`) on every retry, set `DPkg::Lock::Timeout=120`, and increase attempt timeout to 300s.
- Alternatives considered: Rely on external GitHub Action cache or force-clean dpkg cache without configure.
- Reversible? yes
- Affects: `tools/install-browser-deps.sh`, `tools/install-browser-deps.test.mjs`, `.github/workflows/ci.yml`

## 2026-11-01 — Pass-through pointer events on inactive panel drag handle and mobile canvas z-index stacking
- Decider: worker
- Context: Mobile E2E test timed out because the panel drag bar overlay intercepted pointer clicks over the canvas confirmation button.
- Decision: Set `pointer-events: none` on `.bar` and `.name` during resting state (reactivating on `:active` and `.dragging`), set canvas `z-index: 2` over mobile panel `z-index: 1`, and clamp label bounding box within viewport.
- Alternatives considered: Use `{ force: true }` in Playwright click or move the drag bar into normal block layout flow.
- Reversible? yes
- Affects: `web/src/lib/editor/SidePanel.svelte`, `web/src/lib/editor/Editor.svelte`, `web/src/lib/editor/LabelField.svelte`

## 2026-11-01 — Reuse intermediate non-terminal variables for identical RHS pairs in CNF binarization
- Decider: worker
- Context: Step 6 of CNF conversion ("Remove Long RHS Rules") created duplicate non-terminals (e.g. `X1 -> AB`, `X2 -> AB`) for the same variable pair across different rules.
- Decision: Maintain a lookup map `(String, String) -> String` to reuse existing generated non-terminals for identical right-hand side pairs.
- Alternatives considered: Generate distinct non-terminals per production or post-process duplicate variables via equivalence reduction.
- Reversible? yes
- Affects: `crates/engine-core/src/grammar/cnf.rs`

## 2026-11-01 — Contextual per-row symbol toolbar and blur-based empty cell pruning in CFG editor
- Decider: worker
- Context: Users struggled with inserting special characters into individual rule cells and empty input cells caused unintentional empty string assignments.
- Decision: Replace the static global "Sisipkan" bar with a contextual toolbar anchored to the active editing row, require explicit ε insertion, and auto-prune empty cells and rows on blur.
- Alternatives considered: Retain static top bar or treat empty input cells as ε by default.
- Reversible? yes
- Affects: `web/src/lib/grammar/GrammarWorkstation.svelte`, `web/src/lib/grammar/RuleAlternativeCell.svelte`

## 2026-11-01 — Categorized dropdown popover for workstation switcher in site header
- Decider: worker
- Context: Adding CFG/CNF and language enumeration workstations crowded the top navigation bar with horizontal links.
- Decision: Consolidate workstation selection into a categorized popover dropdown menu (`WorkstationSwitcher.svelte`) with 44px touch targets.
- Alternatives considered: Horizontal scrolling tab bar or multi-line header navigation.
- Reversible? yes
- Affects: `web/src/lib/components/SiteHeader.svelte`, `web/src/lib/components/WorkstationSwitcher.svelte`
