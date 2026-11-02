# 0032. Context-free grammar (CFG), 6-phase CNF normalization, and CYK workstation

Status: accepted (implemented in PR 105 on 2026-10-31; refined for course method in PR 112 on 2026-11-02).

## Context

Context-Free Grammars (CFGs), Chomsky Normal Form (CNF), and the Cocke-Younger-Kasami (CYK) parsing algorithm form the core of context-free languages in Theory of Computation (Elaine Rich Chapter 11, and the CFG slides of the course).

Students must learn the exact 6-phase CNF transformation algorithm taught in course lectures, inspect step-by-step rule differences, and test string membership via the dynamic programming CYK triangular table. The implementation must follow course conventions (such as eliminating unproductive variables before unreachable variables), prevent combinatorial explosions during nullable expansion, and run interactively in the browser without backend dependencies.

## Decision

- **Dedicated Engine Module:** Implemented in `crates/engine-core/src/grammar/` with public APIs `parse_grammar`, `transform_to_cnf`, and `cyk_parse` exposed through WASM and typed worker RPCs (`web/src/lib/engine/protocol.ts`).
- **Data Model & Parser:**
  - `Grammar` contains a start variable name (`start: String`) and production rules (`rules: Vec<Production>`).
  - `Production` consists of a variable head (`head: String`) and a body (`body: Vec<Symbol>`), where `Symbol` is either `Terminal(char)` or `NonTerminal(String)`.
  - `GrammarParser` supports production arrows (`->`, `→`, `::=`), alternative splits (`|`), comment lines (`#`, `//`), empty string tokens (`ε`, `λ`, `^`, `\lambda`, `\epsilon`), uppercase variables with subscripts/indices (`S`, `A`, `T_a`, `X1`, `S0`), bracketed non-terminals (`<Var>`, `[Var]`), and lowercase terminal characters.
  - Grammar text length is capped at 8,192 characters (`too_long` in `crates/engine-core/src/api.rs:414, 424, 437`).
- **6-Phase Atomic CNF Transformation Pipeline:**
  The transformation (`crates/engine-core/src/grammar/cnf.rs`) runs six phases in this order. The order is the one that PR 105 chose, with Rich's chapter 11 as the source for the start symbol and the useless symbols. For the steps that the course slides also teach (ε-rules, unit rules, mixed rules, long right-hand sides) the relative order and the method are those of the slides; phase 6 follows the slide exactly since PR 112:
  1. **Phase 1: Isolate Start Symbol:** If the start symbol $S$ appears on the RHS of any production, a fresh start variable $S_0$ is generated and $S_0 \to S$ is added (`cnf.rs:135-158`).
  2. **Phase 2: Eliminate $\epsilon$-productions (Nullable):**
     - Nullable variables are discovered via fixed-point iteration (`cnf.rs:165-184`).
     - For each production containing nullable symbols, all $2^k$ subsets omitting nullable symbols are generated.
     - **Combinatorial Blowup Guard:** If a production has more than 10 nullable variables (`nullable_indices.len() > 10`), transformation aborts with `GrammarError::BudgetExceeded` (`cnf.rs:212-217`).
     - If the start symbol was nullable, $S \to \epsilon$ is preserved/added to maintain language equivalence (`cnf.rs:240-242`).
  3. **Phase 3: Eliminate Unit Productions ($A \to B$):** Unit pairs $(A, B)$ where $A \Rightarrow^* B$ are computed via BFS over the unit production graph (`cnf.rs:265-297`). Non-unit productions of $B$ are copied directly to $A$, and unit productions are removed (`cnf.rs:315-322`).
  4. **Phase 4: Eliminate Useless Symbols (Strict Course Order):**
     - **Phase 4a (Unproductive first):** Variables that can derive a string of terminals are identified via fixed-point iteration; rules containing unproductive variables are removed (`cnf.rs:342-375`).
     - **Phase 4b (Unreachable second):** Reachable variables from the start symbol are collected via BFS over remaining productive rules; unreachable symbols and their rules are removed (`cnf.rs:378-410`).
     - This exact order is required: reversing it fails to eliminate unreachable variables that only become unreachable after unproductive variables are pruned.
  5. **Phase 5: Isolate Terminals in Mixed Rules ($|body| \ge 2$):** In productions of length $\ge 2$ containing terminals, each terminal $c$ is replaced by a dedicated helper variable $T_c \to c$ (`cnf.rs:453-462`). Helper variables are deduplicated per terminal character across the grammar.
  6. **Phase 6: Binarize Long RHS Productions ($|body| \ge 3$):** Productions of length $\ge 3$ are decomposed right-to-left into binary cascades using fresh helper variables ($X_1, X_2, \dots$).
     - **Helper Variable Sharing (`share_helpers: bool`):** Defaults to `false` (`transform_with_options(&grammar, false)` in `cnf.rs:38`), adhering to the course method where each long rule generates distinct cascade variables without cross-rule sharing. When `share_helpers` is `true`, identical variable pairs are cached and reused via `pair_map: BTreeMap<(String, String), String>` (`cnf.rs:514-536`).
  - **Transformation Trace:** Each phase returns a `CnfStepResult` containing the phase number (1–6), phase name, explanation, the intermediate grammar, and lists of `added_rules` and `removed_rules` (`cnf.rs:15-22`).
- **CYK Parsing Algorithm (`crates/engine-core/src/grammar/cyk.rs`):**
  - **Validation:** `CykParser::is_cnf(grammar)` ensures rules are strictly $A \to B C$, $A \to a$, or $S \to \epsilon$.
  - **Input Limits:** The input string length is capped at `MAX_INPUT_LEN: usize = 100` (`cyk.rs:28, 60-66`), and the API rejects strings longer than 256 characters (`too_long` in `crates/engine-core/src/api.rs:438`).
  - **Dynamic Programming Table:** Generates a triangular table `table[length - 1][start_index]` storing sets of variables capable of deriving substrings $w[i \dots i + len - 1]$ in $O(n^3 \cdot |R|)$ time.
  - **Acceptance:** String $w$ is accepted if the start variable $S$ appears in cell `table[n - 1][0]` (or for empty input $n = 0$, if $S \to \epsilon$ is in the grammar).
- **UI Workstation Architecture:**
  - 3-column workstation in `web/src/lib/grammar/GrammarWorkstation.svelte`:
    - Left: Presets and custom grammars in `localStorage`.
    - Center: JFLAP-style rule matrix editor (one input cell for each alternative of a right-hand side), a symbol toolbar for the active row, and a MathML notation preview.
    - Right: Interactive 6-phase CNF stepper with diff pills, alongside CYK tester with triangular DP grid.
  - Dynamically loaded in `/sandbox` (`?mode=grammar`) to preserve initial bundle size.

## Consequences

- Students can step through the six phases of the CNF conversion, and compare each step with the course slides where the slides teach it.
- Combinatorial explosions in Phase 2 are bounded ($k \le 10$), and long input strings in CYK are bounded ($n \le 100$).
- CYK acceptance testing provides clear, visual derivation evidence through the dynamic programming table.
- Initial route bundle size remains protected through lazy dynamic component imports.
