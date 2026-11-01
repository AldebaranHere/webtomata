# Plan — <milestone name>

> Owner: planner. Approved by human before execution.
> Worker dispatches one task at a time. Tasks are ordered.

Status legend: `proposed` | `todo` | `in-progress` | `blocked` | `done` | `rejected`

---

## Task T-001 — <title>

**Status:** todo
**Owner:** worker
**Branch:** `task/T-001-<slug>`

**Goal:** one paragraph.

**Scope (in):**
- Bullet 1

**Non-goals (out):**
- Bullet 1 (with reason, e.g. "handled by T-004")

**Files expected to touch:**
- `web/src/lib/editor/Foo.svelte`
- `web/src/lib/editor/foo.test.ts`

**Design reference:**
- `design/screens/<screen>.md` — sections X, Y
- `design/tokens.md` — tokens used: `color.primary`, `space.3`

**Acceptance criteria:**
- AC1: observable behavior
- AC2: observable behavior
- AC3: axe passes with zero violations on the touched flow

**Verification:**
pnpm format:check
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web test -- <pattern>
pnpm --filter web test:e2e --project=phone e2e/<file>.spec.ts:<line>
Expected: all pass; the new test `<name>` covers AC1.

**Rollback:** `git revert <sha>` is sufficient; no data migration.

**Depends on:** none

**Notes for worker:** none
