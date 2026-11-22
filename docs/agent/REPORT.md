# Reports of the worker tasks

Since 2026-11-23 each task writes its own report: `docs/agent/reports/<task id>.md` (for example `T-084.md`). A report is written by the worker of that task and is not edited by another task, so two pull requests never touch the same report file.

- `reports/T-065.md` is the report of T-065 (symbol names), the last one written in the old rolling file.
- The reports of earlier tasks were one rolling file, `docs/agent/REPORT.md`, that each task replaced. They are in git history: `git log --follow -p -- docs/agent/REPORT.md`.
