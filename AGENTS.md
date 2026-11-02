# Agent conventions and planner/worker protocol

This repository is developed by a **two-agent team**:

- **PLANNER** — Claude / Sonnet. Owns architecture, design, and review. Does not implement features except trivial fixes.
- **WORKER** — Gemini / Antigravity. Executes exactly one task at a time from `docs/agent/PLAN.md`.

The human is the plan approver and the merge gate.

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
- `MD_FILES/` and `REFERENCES/` — private files on the owner's laptop, git-ignored. Read them, never commit them or copy their text.

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
- Snapshot: `powershell -ExecutionPolicy Bypass -File tools/agent-snapshot.ps1`

The WASM build needs Rust and `wasm-pack`. The owner's Windows laptop builds it in WSL (see `MD_FILES/AGENT-HANDOFF.md`). Firefox does not start on that laptop; the Firefox tests run only in CI.

Adjust this list when commands change. Never reference commands that do not exist.

## Coding standards

- Follow existing patterns in the touched directory; do not introduce a new pattern without a decision entry.
- Naming, folder structure, error handling, accessibility rules: follow what is already there.
- No new dependencies without a decision entry in `docs/agent/DECISIONS.md`.
- No silent refactors. If something is out of scope, log it in `PLAN.md` as `proposed`.

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
- **Verification tiers.** Always run: lint, `pnpm check`, unit tests, `pnpm check:strings`, `pnpm check:tokens`, `pnpm format:check`, and the e2e tests of the area. Before a PR also run the full desktop and phone e2e suite and `pnpm test:e2e:cross` when you touched layout, storage, touch or workers. Repeat new e2e tests 5 times (10 times for storage, touch, workers or timing). Paste real output into `REPORT.md`.
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
- Exactly one task has `Status: todo` at a time.
- Every task must include a verification command with an expected result.
- After every worker report, the planner reviews the diff and the actual command output, then either accepts the task or files a fix task.
- Does not dispatch task N+1 until task N is accepted.
- Escalates to the human for: product intent ambiguity, scope change, budget concerns, cross-cutting decisions.
- Decides and logs for: implementation detail ambiguity, minor library choices, ordering within the plan.

### Worker

- Reads `PLAN.md`, picks the single task with `Status: todo`, and restates it before coding.
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

## Escalation

- Worker detects plan defect -> `blocked` entry, hand back. Do not improvise.
- Planner detects worker deviation -> fix task, do not silently accept.
- Both agents disagree about product intent -> human decides.
- Repeated `blocked` on the same task (>= 2) -> human replans that slice.
