# Handoff — <YYYY-MM-DD>

> Written by the previous worker before handing control back to the planner.
> Keep this under one page. Put evidence in `HANDOFF-SNAPSHOT/`; do not paraphrase what the snapshot already says.

## Session window
- Branch at freeze: `handoff/<date>`
- Freeze tag: `handoff-<date>`
- HEAD: `<sha>`
- Baseline: `<sha>`

## What was built
- Bullet 1
- Bullet 2

## What works end to end
- Bullet 1 (with the test/command that proves it)

## What is broken or half-done
- Bullet 1 — with the failing test name or the reproduction command

## Known risks
- Bullet 1

## Open questions for the planner
- Bullet 1

## Where the evidence is
- `HANDOFF-SNAPSHOT/01-git.md` — branches, commits, diffstat
- `HANDOFF-SNAPSHOT/05-verify.md` — real output of format, typecheck, lint, tests, build
- `HANDOFF-SNAPSHOT/06-diff.md` — full diff since baseline (may be truncated)
- `DECISIONS.md` — every decision made during the session

## Anything the planner should NOT re-litigate
- Bullet 1 (with the reason)
