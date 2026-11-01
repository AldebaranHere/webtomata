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

- `web/` — SvelteKit application (`web/src/`)
- `web/src/lib/editor/` — editor components and stores
- `web/src/lib/engine/` — FSM/PDA/TM engine (Rust/WASM bridge)
- `web/e2e/` — Playwright end-to-end tests
- `web/tests/` — unit tests
- `design/` — design artifacts (tokens, components, per-screen specs)
- `docs/agent/` — the state machine of this team (handoff, plan, report, decisions)

Update this section as the project evolves.

## Commands

- Install: `pnpm install`
- Dev: `pnpm --filter web dev`
- Format check: `pnpm format:check`
- Typecheck: `pnpm --filter web typecheck`
- Lint: `pnpm --filter web lint`
- Unit tests: `pnpm --filter web test`
- E2E (desktop + phone): `pnpm --filter web test:e2e`
- E2E (desktop only): `pnpm --filter web test:e2e --project=desktop`
- Build: `pnpm --filter web build`
- Snapshot: `powershell -ExecutionPolicy Bypass -File tools/agent-snapshot.ps1`

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

- Worker works on branches: `task/<plan-task-id>-<short-slug>`.
- One commit per logical change. Conventional Commits format.
- The worker does **not** merge. The human merges after planner review.
- No force-push to shared branches.

## Roles in detail

### Planner

- Owns `docs/agent/PLAN.md` and `design/`.
- Every task entry must contain all schema fields (see PLAN.md template).
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
