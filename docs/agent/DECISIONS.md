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
