# Agent conventions and planner/worker protocol

This repository is developed by a **two-agent team**:

- **PLANNER** — Claude / Sonnet. Owns architecture, design, and review. Does not implement features except trivial fixes.
- **WORKER** — Gemini / Antigravity. Executes exactly one task at a time from `docs/agent/PLAN.md`.

The human is the plan approver and the merge gate. How the loop works, step by step, with the prompts: `docs/agent/WORKFLOW.md`.

## Read order at the start of every session

1. This file (`AGENTS.md`)
2. `docs/agent/HANDOFF.md`
3. `docs/agent/HANDOFF-SNAPSHOT/` (only the parts you need)
4. `docs/agent/DECISIONS.md`
5. `docs/agent/PLAN.md`
6. The design reference for the current scope, under `design/`

No agent may change code before it has restated the current state to the human.

## Repository layout (high level)

- `crates/engine-core/` — the Rust engine (FSM, regex, grammars, languages); `crates/engine-wasm/` — the WASM bridge
- `web/` — SvelteKit application (`web/src/`)
- `web/src/lib/editor/` — editor components and stores
- `web/src/lib/engine/` — the TypeScript client of the engine (worker, protocol, handlers)
- `web/src/lib/grammar/`, `web/src/lib/language/` — the grammar and language workstations
- `web/src/lib/questions/`, `web/src/lib/guides/` — Soal and Panduan
- Unit tests sit next to the code (`*.test.ts`, `*.wasm.test.ts` under `web/src/`); Rust tests are in `crates/*/tests/`
- `web/e2e/` — Playwright end-to-end tests (`web/e2e/cross/` runs in Firefox and WebKit)
- `content/` — questions and guides (plain files)
- `tools/` — CI checks and scripts (`tools/*.test.mjs` are their tests)
- `docs/decisions/` — ADRs; `docs/ux/` — wireframes and interaction specs; `docs/glossary.md` — Indonesian terms
- `design/` — design artifacts (tokens, components, per-screen specs)
- `docs/agent/` — the state machine of this team (handoff, plan, report, decisions)
- `MD_FILES/` and `REFERENCES/` — private files on the owner's laptop, git-ignored. The one real copy is in the WSL clone `~/webtomata` (the planner reads it as `\\wsl.localhost\Ubuntu\home\Aldebaran64\webtomata`). Read them, never commit them or copy their text.

Update this section as the project evolves.

## Commands

- Install: `pnpm install`
- Dev: `pnpm --filter web dev`
- Format check (web and Rust): `pnpm format:check`
- Svelte check (types): `pnpm check`
- Lint (web): `pnpm lint`; lint (Rust): `pnpm lint:rust`
- Unit tests (web): `pnpm test:web`; Rust tests: `cargo test`; WASM tests: `pnpm test:wasm`; tool tests: `pnpm test:tools`
- Guard rails: `pnpm check:workflows`, `pnpm check:contrast`, `pnpm check:tokens`, `pnpm check:strings`, `pnpm check:questions`
- E2E (desktop + phone): `pnpm test:e2e`; E2E in Firefox and WebKit: `pnpm test:e2e:cross`
- E2E (desktop only): `pnpm --filter web exec playwright test --project=desktop`
- Build: `pnpm build`; then `pnpm size`, `pnpm smoke`, `pnpm lighthouse`
- Everything the CI runs: `pnpm verify`
- Snapshot (a Windows PowerShell script for the owner and the planner, not for the worker): `powershell -ExecutionPolicy Bypass -File tools/agent-snapshot.ps1`

The WASM build needs Rust and `wasm-pack`, so the worker runs these commands in WSL (see the next section). Firefox does not start on the owner's laptop; the Firefox tests run only in CI.

Adjust this list when commands change. Never reference commands that do not exist.

## Where the worker runs: WSL Ubuntu, never Windows

The worker runs **every command** in **WSL Ubuntu**, in the clone `~/webtomata` (`/home/Aldebaran64/webtomata`). It never runs commands with Windows tools (Windows `node`, `pnpm`, `cargo`, `git`).

Why: Windows blocks `wasm-pack` (Device Guard), so the WASM build and the WASM tests fail there. The CI runs on Linux, and WSL is Linux, so a local pass is a better sign of a CI pass.

1. **Where.** Work only in `~/webtomata`, on the WSL disk. Never in `/mnt/c` or `/mnt/d` (slow, and file locks break builds). Never in the Windows folder `D:\dev\webtomata`: it belongs to the owner and the planner. The two clones meet only through GitHub.
2. **Two ways to run.**
   - **Mode A (best):** your shell is Linux. Run the commands below as written.
   - **Mode B (the owner's setup today):** your shell is Windows PowerShell and the folder is open as `\\wsl.localhost\Ubuntu\home\Aldebaran64\webtomata`. Then **every command that is not a file edit** goes through the bridge. Never run `node`, `pnpm`, `cargo`, `wasm-pack` or `git` directly in PowerShell.
     ```
     wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc '<command>'
     ```
     Rules for the bridge: (a) use `-e`, never `--` (the outer shell would expand `$VARIABLES` first and break the command); (b) put the whole command in single quotes and use no double quotes inside it (Windows PowerShell 5.1 deletes them before bash sees the command, so `grep -E "a|b" file` arrives as `grep -E a | b file`: a pipe, and a `grep` with no file that waits for input for ever); (c) for anything with quotes, `awk`, `sed`, a loop or several lines, write a script file `~/tmp/<name>.sh` and run `wsl.exe -d Ubuntu --cd ~/webtomata -e bash ~/tmp/<name>.sh`; (d) the `-l` makes bash read `~/.profile`, which puts Node 24 and Rust on the PATH. The commands below are written for Mode A: in Mode B, wrap each one in the bridge.
3. **Check first, in every session.** Mode A: run `uname -s; node --version`. Mode B: run `wsl.exe -d Ubuntu --cd ~/webtomata -e bash -lc 'uname -s; node --version'`. It must print `Linux` and `v24.21.0`. If WSL does not answer, or prints something else, **stop** and tell the owner "I am not in WSL". Never continue with Windows tools.
4. **Environment (Mode A).** In every new shell, run these two lines (the default `node` is v22 and `cargo` is not on the PATH; in Mode B the login shell does it for you):
   ```
   . "$HOME/.cargo/env"
   export PATH="$HOME/tools/node/bin:$PATH"
   ```
   Then check: `node --version` prints `v24.21.0` (the project needs 24.x), and `cargo --version` and `wasm-pack --version` print versions. If a check fails, stop and tell the owner. Do not install tools. Do not use `sudo`.
5. **Start of a task.** First `git status --short` must print nothing. If it prints anything, **stop** and tell the owner; do not switch branch, stash or discard. Then `cd ~/webtomata && git fetch origin && git switch staging && git pull --ff-only && pnpm install --frozen-lockfile`. Before a web test that loads the engine, run `pnpm build:wasm`.
6. **Git.** Commit and push from WSL (in Mode B, through the bridge). `git remote -v` must show `https://github.com/AldebaranHere/webtomata.git`. If a push asks for a password or a token, stop. Never type a secret, and never ask the owner to paste one. The pre-push hook `.git/hooks/pre-push` must exist in the WSL clone. If it is missing, stop and tell the owner. Never push without it, and never use `--no-verify`.
7. **Pull request.** `gh` is not installed in WSL. Use the Windows `gh.exe`, which is already signed in. Mode A: `cat body.md | gh.exe pr create --repo AldebaranHere/webtomata --base staging --head <branch> --title "<title>" --body-file -`. Mode B: run `gh` directly in PowerShell, with `--repo AldebaranHere/webtomata --base staging --head <branch> --title '<title>' --body-file \\wsl.localhost\Ubuntu\home\Aldebaran64\tmp\body.md`. Keep temporary files (PR text, scripts) in `~/tmp`, not in the repository.
8. **E2E tests** need the Playwright browsers in WSL. Check `ls ~/.cache/ms-playwright`. If it is empty and the task needs e2e, stop and tell the owner. Do not run `playwright install --with-deps` yourself. Engine, documentation and unit-test tasks do not need e2e.
9. **What you cannot run** (a phone, the live site) is the owner's. Say in `REPORT.md` what you did not run and why.
10. **Line endings.** Files must have LF line endings and no byte-order mark. In Mode B your editor writes through a Windows path, so run `pnpm format` before the checks, and look at `git diff --stat` for files that you did not mean to change.
11. **Private folders.** `MD_FILES/`, `REFERENCES/` and `.agents/` in `~/webtomata` are the one real copy that the owner and the planner read. They are git-ignored, so git keeps no history of them. (a) Treat them as read-only: never edit, move or delete a file in them; if one is wrong, tell the owner. (b) Never run `git clean -x`, `git clean -X` or `git clean -fdx`: they delete ignored files. (c) Never replace one of these folders by a link; the editor does not follow a link that leaves the workspace.
12. **Searching, and commands that can hang (both modes).** (a) Search and read with the editor's own search and read tools. Use shell `grep` only for what they cannot do, and in Mode B only through a script file. (b) A one-liner in the bridge contains no `"`, `|`, `&&`, `;` or `$(...)`: anything with those goes in a script file. (c) A command that could read standard input (`grep`, `cat` or `xargs` with no file, anything at the end of a pipe) ends with `< /dev/null`, and a command that could run long is wrapped with `timeout` (for example `timeout 120`). (d) A search or a short command that has run for more than 30 seconds is stuck, not slow: stop it, look at the exact command line that bash received (`set -x`, or print the script), fix the quoting and run it again. Do not wait for it, and do not poll a background task more than twice without reading its output.

## Coding standards

- Follow existing patterns in the touched directory; do not introduce a new pattern without a decision entry.
- Naming, folder structure, error handling, accessibility rules: follow what is already there.
- No new dependencies without a decision entry in `docs/agent/DECISIONS.md`.
- No silent refactors. If something is out of scope, log it in `PLAN.md` as `proposed`.
- **Search before you write.** Before adding a helper, a type or a format, search the repository for one that already does it (by name and by behavior). One fact lives in one place: if two functions must agree (a label format, a sort order, a limit), one of them calls the other.
- **Small public surfaces.** A module exports what its callers need and nothing else. Do not export a function or add a member to an interface only so that a test can reach it: test through the public interface, or name the seam and say why it exists. Do not use `export *` to publish a whole file.
- **Types are checked, not bypassed.** No `any`, no `@ts-ignore`, no `as unknown as`. If one cast cannot be avoided, put it in one small named helper with a comment that says why it is safe, and name the helper in `REPORT.md`.
- **Edit with the edit tool.** Do not rewrite a file with `sed`, a script or a whole-file write, and never rewrite `PLAN.md` or another document wholesale. Run `git diff` after every edit and read it (an unquoted `sed` once removed the last letter of 45 document lines).

## Accessibility rules (non-negotiable)

- Every interactive target is at least 44 x 44 px on touch.
- Every control is reachable by keyboard with a visible focus ring.
- No new `aria-*` pattern that the codebase has not already used without a decision entry.
- The axe check must pass on every e2e flow.

## Branch and commit policy

- Worker works on branches: `task/<plan-task-id>-<short-slug>`, cut from `staging`.
- One task is one pull request, to `staging`. Never to `main`. Never push to `staging` or `main`.
- One commit per logical change. Conventional Commits format (`feat(engine): ...`).
- The PR title and body follow Google's guide for change descriptions: a short imperative first line that stands alone; the body says the problem, why this approach, what is left out, and the checks that were run. No attribution lines in commits or PRs.
- The worker does **not** merge. The human merges after planner review.
- No force-push to shared branches.

## Project rules and the owner's standing rules

`CLAUDE.md` holds the project rules (principles, stack, engine and frontend rules, budgets, security, testing, definition of done). They bind the worker too. Where this file and `CLAUDE.md` differ, `CLAUDE.md` wins and the planner logs the difference.

The owner's standing rules for every task:

- **Tests first.** Write the test, watch it fail, then write the code. Show a deliberate break of each new rule (change the code on purpose, watch the test fail, then restore it). A bug fix starts with a test that fails.
- **Every user-facing string** goes through i18n, in `id` and `en` (`pnpm check:strings` enforces it for components). A new Indonesian term goes into `docs/glossary.md` marked `TODO(review)`, and is reported.
- **No invented layouts.** A new screen needs a wireframe in `design/` or `docs/ux/wireframes.md` that the owner has approved before any code.
- **Verification tiers.** Always run: lint, `pnpm check`, unit tests, `pnpm check:strings`, `pnpm check:tokens`, `pnpm format:check`, and the e2e tests of the area. The area is every spec that opens a screen or component you touched (find them with `grep -l` on the component name, the route or a visible text); for layout, touch or phone changes also run the cross-browser spec of that area with `--project=firefox` and `--project=webkit-phone`. Repeat new e2e tests 5 times (10 times for storage, touch, workers or timing). **Do not run the full suite (`pnpm test:e2e`, `pnpm test:e2e:cross`) on your machine** unless the task says so: CI runs all of it in four parallel shards (about 5 minutes), and one full run on a laptop takes far longer. The owner merges only when CI is green. If a task's Verification lists `pnpm test:e2e` or `pnpm test:e2e:cross`, read it as "the specs of the area, as above", unless it says "full suite locally". Paste real output into `REPORT.md`, and name the specs you ran.
- **Original content.** Questions, guides and examples are original. Never copy or closely paraphrase current or past course homework or exams.
- **Never commit** `MD_FILES/`, `REFERENCES/`, `content/questions/contoh-saya.yaml`, secrets, or build output. Never ask the owner for a secret or a token.
- **Never** raise a size or performance budget, weaken or skip a test, or disable a lint rule to get a green check.

## Decisions the worker never makes alone

Stop and write a `blocked` entry (or a question in `REPORT.md`) for any of these:

- adding or updating a dependency, or changing a dependency age rule (`minimumReleaseAge`, `minimumReleaseAgeExclude`, `auditConfig`, the audit ignores);
- anything about security headers, CSP, workflow permissions, secrets, or deploy settings;
- a license, or using any course material, in the repository;
- a new screen, a layout change, or a change of a design token;
- a change of how a textbook method works (the course method wins: Rich first, Sipser second);
- anything that changes what the planner wrote in a task's scope or non-goals.

## Roles in detail

### Planner

- Owns `docs/agent/PLAN.md` and `design/`.
- Every dispatchable task entry must contain all schema fields (see `PLAN-TEMPLATE.md`). A `proposed` backlog line may be shorter, and is not dispatchable until the planner completes it.
- A task is `todo` when it is ready: every field is written and the human approved it (or its design). Several tasks can be `todo` at the same time. The human names the one to do next in the start prompt. The planner never opens a pull request only to change a status: a task is written as `todo` in the PR that adds it, after the human approved it.
- Every task must include a verification command with an expected result.
- After every worker report, the planner reviews the diff and the actual command output, then either accepts the task or files a fix task.
- Does not tell the human to start task N+1 until task N is accepted, when N+1 depends on it or touches the same files.
- Escalates to the human for: product intent ambiguity, scope change, budget concerns, cross-cutting decisions.
- Decides and logs for: implementation detail ambiguity, minor library choices, ordering within the plan.

The planner reviews every worker pull request with the same checks as the worker's definition of done: the deepening pass, the breaks (the planner also makes its own, and runs property tests with more seeds than the worker did), the boundary values, and the documents (a diff of a document shows only the intended lines).

### Worker

- Reads `PLAN.md`, finds the task that the human named in the start prompt, and restates it before coding. The task must have `Status: todo`, its date (if it has "not before ...") must have come, and every task it depends on must be `done` and merged. If not, stop and say why.
- Sets the task to `in-progress` in the first commit of its own branch, and to `done` in the last commit of the same pull request.
- Executes exactly that task. Does not start the next.
- No unrequested changes. Out-of-scope work becomes a `proposed` entry in `PLAN.md`.
- If the plan is wrong or impossible: stop, write a `blocked` defect entry with evidence, hand back.
- Respects `design/`. Does not invent tokens, spacing, colors, or component patterns.
- Ends the session by writing `REPORT.md` with actual verification output (paste, do not summarize) and updating `PLAN.md` status.

## Definition of ready (planner side)

A task is dispatchable only when it has:

- A unique id and a title
- A goal
- A scope and a non-goals list
- Files expected to touch
- A design reference (if UI/UX)
- Acceptance criteria
- Verification: exact commands and expected result
- A rollback note
- `Status: todo`

If any field is missing, the worker must reject the task back to the planner.

## Definition of done (worker side)

A task is done only when:

- Every verification command passed and its actual output is pasted into `REPORT.md`.
- The diff matches the stated scope.
- `PLAN.md` task `Status: done` and the commit/branch is recorded.
- Any new decisions are appended to `DECISIONS.md`.
- Any out-of-scope observations are logged as `proposed`.
- **The deepening pass is written in `REPORT.md`** (do it before you open the pull request): (1) list every new export and every new member of a public interface; for each, say whether it can be private, whether something that exists already does the same, and whether any logic is written twice (also inside the new code); remove or merge what you can, and give a reason for each duplicate or test-only export that stays. (2) The interface is smaller than the work behind it. (3) Count the casts you added (the goal is zero).
- **Every test can fail.** For each rule or property that a new test checks, name a one-line break that would violate it, make the break, see the test fail, and restore it. Report the breaks you tried, and any that the tests did not catch, with what you did about it. A test that cannot fail is not a test.
- **Limits and boundaries.** Every limit is tested at one below, at, and one above (the exact values, not only a far-over case), and the check runs before the work it protects (before the loop, the allocation or the build), not after.
- **Random tests are judged on the larger run.** When a constant is tuned with a seeded property test (a spacing, a size, a count), run at least ten times as many seeds as you used to tune it, and paste that result. A value that holds for the seeds it was tuned on is not yet a bound.
- **Quick loop, full gate once.** While you work, run only the tests that relate to your change (a file, a pattern, `vitest related`); run the whole gate of this file once before you push, and paste its output.

## Escalation

- Worker detects plan defect -> `blocked` entry, hand back. Do not improvise.
- Planner detects worker deviation -> fix task, do not silently accept.
- Both agents disagree about product intent -> human decides.
- Repeated `blocked` on the same task (>= 2) -> human replans that slice.
