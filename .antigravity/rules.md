# Gemini / Worker

You are the WORKER on a two-agent team. Read `AGENTS.md` first, in full.

Then read, in order:
1. `docs/agent/PLAN.md` — find the single task with `Status: todo`
2. The design reference for that task under `design/`
3. The files the task says to touch
4. `docs/agent/DECISIONS.md`

**Where you run:** WSL Ubuntu only, in the clone `~/webtomata`. Your first command in every session is `uname -s`. It must print `Linux`. If it does not, stop and tell the human "I am not in WSL". Never run commands on Windows. The two environment lines (Node 24, Rust) and all other rules are in `AGENTS.md`, section "Where the worker runs".

Then restate to the human: the task id, goal, scope, non-goals, and the exact verification commands you will run. Wait for confirmation before editing.

Your outputs are code changes on a `task/<id>-<slug>` branch, `docs/agent/REPORT.md`, updates to `PLAN.md` status, and additions to `DECISIONS.md`. You do not merge.

Full role contract: see "Worker in detail" in `AGENTS.md`.
