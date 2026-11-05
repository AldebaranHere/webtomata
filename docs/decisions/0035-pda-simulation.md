# 0035. Pushdown automaton (PDA) simulation: breadth-first search, stack traces, and peak configurations

Status: accepted (2026-11-05).

## Context

Pushdown automata (PDAs) require an execution engine that can simulate both deterministic (DPDA) and non-deterministic (NDPDA) machines on input strings.

In the course (Fasilkom UI Teori Bahasa dan Automata, Slide12 and homework assignments):
1. Simulations run breadth-first across instantaneous configurations $(q, i, \gamma)$ where $q$ is the active state, $i$ is the number of input symbols consumed, and $\gamma$ is the contents of the stack (top of stack is leftmost / index 0).
2. The initial configuration is $(start, 0, [])$ (stack starts empty).
3. A transition $(q, c, \gamma_1 \to \gamma_2, r)$ applies to configuration $(q, i, s)$ iff $c$ matches the next input symbol $w[i]$ (or reads nothing if $c = \varepsilon$) and $\gamma_1$ is a prefix of stack $s$. A transition popping empty string $\gamma_1 = []$ applies to any stack, whether empty or not.
4. Acceptance requires $(q, |w|, [])$ with $q \in F$: the entire input is consumed, the stack is completely empty, and the machine is in an accepting state.
5. In course homework (e.g. HW06), machine efficiency and non-determinism are evaluated based on the peak number of configurations alive simultaneously in the BFS queue.
6. Simulations must never hang or crash the browser. Step, configuration, and stack depth budgets must bound computation, returning a clean stopped state with a partial trace when exceeded.

## Decision

- **Simulation Engine:**
  Implemented in `crates/engine-core/src/pda_simulate.rs`, exposed via `api::simulate_pda` in `crates/engine-core/src/api.rs`, WebAssembly bridge in `crates/engine-wasm/src/lib.rs`, and typed RPC handlers in `web/src/lib/engine/handlers.ts` and `protocol.ts`.
- **Breadth-First Search by Levels:**
  - Level 0 holds the initial configuration $(start, 0, [])$.
  - Level $k+1$ expands configurations of Level $k$ in strict, canonical order: configurations are expanded in parent order, and transitions are evaluated in the PDA's sorted canonical order.
  - A global `seen: HashSet<Config>` records visited configurations across all levels. Any configuration already encountered in the current or previous levels is immediately discarded, ending infinite loops that do not alter the configuration.
  - The simulation halts immediately at the first level that contains an accepting configuration, selecting the first accepting configuration generated in that level.
- **Trace of One Computation:**
  - Each step record `PdaStep` contains `{ position, symbol, transition, state, stack, message }`.
  - For accepted runs: trace is the path from start to the first accepting configuration found. The last step message is `pda.sim.accepted`.
  - For rejected runs: trace is the path from start to the **best final configuration** (a configuration from which no transition leads to an unseen configuration). Candidates are ranked by:
    1. Count of satisfied acceptance conditions (input exhausted, accepting state, stack empty; score 0 to 2),
    2. Larger input position consumed (`position`),
    3. Earlier creation order in the BFS queue.
    The last step message reflects the failure reason by strict priority:
    `pda.sim.input_left { left }` > `pda.sim.not_accepting_state` > `pda.sim.stack_not_empty { depth }`.
  - For stopped runs: trace is the path from start to the best configuration explored so far.
- **Metrics:**
  - `peak_configurations`: Largest count of configurations held by any single level after dropping repeats. A DPDA always produces `peak_configurations = 1`.
  - *Note on server grader:* The server autograder's BFS queue count may differ slightly if the server uses a single FIFO queue with interleaved pushes/pops or does not deduplicate across levels.
  - `explored`: Total number of unique configurations created throughout the simulation.
- **Budgets and Default Limits:**
  - `PdaBudget`:
    - `max_steps`: maximum BFS levels (default: 10,000).
    - `max_configurations`: maximum total configurations explored (default: 20,000).
    - `max_stack`: maximum allowed stack depth on any single configuration (default: 500).
  - Added `StopReason::MaxStack` to `StopReason` enum and TypeScript declarations.
  - Worst-case memory with defaults (a machine creating 20,000 configurations at stack depth 500) was measured in native tests at ~37.8 MB RSS delta, well within the 50 MB budget ceiling.

## Consequences

- PDA simulation is completely deterministic, producing identical traces and metrics across runs.
- Acceptance strictly adheres to course conventions (input exhausted, stack empty, accepting state).
- Partial traces and rich failure diagnostics allow students to see exactly why their PDA rejected an input string.
- Safe execution in WebAssembly with strict resource caps and zero panic risks.

