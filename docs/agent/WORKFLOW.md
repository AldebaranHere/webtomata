# How the owner, the planner and the worker work together

Three roles:

- **Owner** (the human). Names the goals, approves plans and designs, tests on a phone, merges every PR.
- **Planner** (Claude). Writes tasks in `PLAN.md`, draws wireframes in `design/` and `docs/ux/`, reviews every PR, logs decisions. Does not build features.
- **Worker** (Gemini, in Antigravity). Does exactly one task at a time, on its own branch, and opens a PR. Does not merge, and does not decide.

## The loop

1. **The owner names a goal** in a chat with the planner.
2. **The planner writes the task** in `PLAN.md` with every field (goal, scope, non-goals, files, design reference, acceptance criteria, exact verification commands, rollback). For a new screen, the planner first draws a wireframe, and the owner approves it. When the owner has approved the task (or its design), the task is `Status: todo`, in the same PR that adds it. There is no separate pull request to promote it. Several tasks can be `todo`; the planner says: "T-xxx is ready to dispatch" and suggests an order.
3. **The owner starts the worker.** Open a new Gemini chat for each task. The worker runs in **WSL Ubuntu**, in the clone `~/webtomata`, not on Windows (see "Where the worker runs" in `AGENTS.md`). The worker updates `staging` itself at the start of the task. Then paste the start prompt (below) with the id of the task that you choose.
4. **Before it codes**, the worker reads `AGENTS.md`, the task in `PLAN.md`, the design reference, the files it will touch, and `DECISIONS.md`. Then it **restates** the task id, goal, scope, non-goals and the exact commands it will run, and **waits**. The owner checks the restatement against the task and answers "Confirmed. Go." If it does not match, the owner corrects it before any code is written.
5. **While it codes**, the worker:
   - makes the branch `task/T-xxx-<slug>` from `staging`, and sets the task to `in-progress` in its first commit;
   - writes the tests first and shows a deliberate break of each new rule;
   - runs the checks of the task (the pre-push hook also runs the fast CI checks);
   - stops and writes a `blocked` entry in `PLAN.md` if the plan is wrong or a decision is needed. It never improvises. The owner takes a `blocked` task back to the planner.
6. **After it codes**, the worker pushes the branch, opens a PR to `staging` (title and body in Google's change-description style), writes `docs/agent/REPORT.md` with the **real pasted output** of every verification command, sets the task status in `PLAN.md`, adds any decision to `DECISIONS.md`, and lists out-of-scope findings as `proposed` entries. It does not merge, and it does not start the next task.
7. **The worker is done** when all four are true: the PR is open, the required CI checks are green, `REPORT.md` has the pasted output, and `PLAN.md` shows the new status. The owner then tells the planner: "T-xxx is ready for review: PR NN."
8. **The planner reviews** the diff and the actual command output, not only the summary. The verdict is one of:
   - **Accepted.** The owner merges the PR and says "NN merged".
   - **Fix task.** The planner writes a fix task (`T-xxx-fix`, `todo`). Go back to step 3 with it.
   - **Planner is wrong.** The planner corrects the plan and logs it.
9. **The planner is done** when the next task is `todo` and the planner has said which one to start, or when a design is ready for the owner to approve. Then the owner moves to the worker. The loop repeats from step 3.

## Start prompt for the worker

> You are the WORKER. First, run the WSL check from `AGENTS.md` ("Where the worker runs", rule 3): it must print `Linux` and `v24.21.0`; if not, stop and tell me. Read `AGENTS.md` and `.antigravity/rules.md` in full. Then do task T-xxx from `docs/agent/PLAN.md` (replace T-xxx by the id): it must have `Status: todo`, its date must have come, and the tasks it depends on must be done and merged; if not, stop and tell me why. Restate its id, goal, scope, non-goals and the exact verification commands. Do not edit anything until I answer "Confirmed. Go."

If Antigravity already loads `.antigravity/rules.md` on its own, the first two sentences are repeated work, which is harmless.

## Prompt for the planner

> T-xxx is ready for review: PR NN.

or, to start a new task:

> I want <goal>. Plan it.

## What counts as "done" and who decides

| Question | Answer |
|---|---|
| Is the worker done? | PR open, required checks green, `REPORT.md` filled with real output, `PLAN.md` status updated. |
| Is the task accepted? | Only when the planner says "Accepted". The worker's word is not enough. |
| Can the PR be merged? | After "Accepted" and green CI. Only the owner merges. |
| Can the next task start? | When the owner names it in the start prompt. It must be `todo`, and the tasks it depends on must be merged. |
| Who decides about a dependency, a security setting, a license, course material, a new screen, a design token? | The owner. The worker never decides these alone (see `AGENTS.md`). |

## If something goes wrong

- **CI is red.** Give the worker the failing job and ask it to fix it on the same branch. If it cannot, bring it to the planner.
- **The worker did something outside the task.** Do not merge. Tell the planner; it writes a fix task or asks for a revert.
- **The worker and the planner disagree.** The owner decides.
- **A task is blocked twice.** The owner and the planner replan that slice.
