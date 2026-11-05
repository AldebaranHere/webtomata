# 0037. Context-free grammar (CFG) to pushdown automaton (PDA), top-down

Status: accepted (2026-11-05).

## Context

Converting context-free grammars (CFGs) to pushdown automata (PDAs) is a central constructive proof in Theory of Computation (Elaine Rich Chapter 12; Fasilkom UI course slides Slide13, page 4). The standard top-down algorithm (`CFGtoPDAtopdown`) constructs an equivalent non-deterministic pushdown automaton (NDPDA) that mimics leftmost derivations on its stack.

Students need to see the exact resulting machine and trace each transition added by the algorithm:
1. An initial transition pushing the start variable onto an empty stack.
2. Rule transitions that pop a variable and push its right-hand side (top of stack first).
3. Terminal transitions that read and pop matching input characters.

## Decision

- **Dedicated Engine Module:**
  Implemented in `crates/engine-core/src/cfg_pda.rs` with API endpoint `cfg_to_pda_topdown` in `crates/engine-core/src/api.rs`, exposed to WebAssembly via `crates/engine-wasm/src/lib.rs` and typed worker RPCs in `web/src/lib/engine/protocol.ts`.
- **Seven Core Decisions:**
  1. *Input Handling:* Grammar text is parsed directly using `GrammarParser::parse` (capped at 8,192 characters, returning `api.invalid_grammar` on syntax errors). Unreachable rules, unit rules, long right-hand sides, and $\varepsilon$-rules are retained without pre-normalization so students inspect their exact rules.
  2. *Alphabets:* The input alphabet consists of the sorted terminals (`Grammar::terminals`). The stack alphabet is a single unified list containing all variables (`Grammar::variables`, including the start symbol) and all terminals, sorted strictly in byte order (e.g. `'S' < 'a'`). Multi-character variable names (`S0`, `T_a`) are permitted in the stack alphabet.
  3. *States:* The machine has exactly two states: `StateId(0)` named `"p"` (initial) and `StateId(1)` named `"q"` (accepting). The result carries state metadata `states: [{ id: 0, name: "p" }, { id: 1, name: "q" }]` (`StateName`), with `start: Some(0)`, `accepting: [1]`, and `kind: PdaKind::Ndpda`.
  4. *Name Clash Refusal:* If any variable name equals a terminal name (e.g. bracketed non-terminal `<a>`), the conversion is rejected with `pda.cfg.symbol_clash { symbol }`.
  5. *Duplicate Rule Merging:* Duplicate rules with identical `head` and `body` are deduplicated to prevent `pda.duplicate_transition` warnings; only the first occurrence is kept and emitted in the trace.
  6. *No Conversion Budget:* The construction is strictly linear ($1 + \text{distinct rules} + \text{terminals}$) and cannot loop; runtime loop protection is handled separately by the simulator budget (`PdaBudget`).
  7. *Step Trace:* Returns `steps: Vec<CfgPdaStep>` in construction order: start step (`cfg_pda.top_down.start`), rule steps in grammar order (`cfg_pda.top_down.rule { rule }`), and terminal steps in sorted character order (`cfg_pda.top_down.terminal { symbol }`). Wire transitions use `PdaWireTransition`.
- **JFLAP Export Compatibility:**
  Because JFLAP 7.1 `.jff` PDA export only supports single-character stack symbols (ADR 0036), PDAs generated from grammars containing multi-character variables (e.g. `S0`) cannot be exported to JFLAP and will produce `jff.symbol_not_single_character { symbol }`. Single-character grammars round-trip cleanly.

## Consequences

- The engine provides a mathematically rigorous, canonical top-down conversion from CFG to PDA matching Slide13 page 4.
- Students can step through each transition creation incrementally with localized explanations.
- Downstream UI panels (tasks T-033, T-038) can visualize the conversion steps and simulate the resulting PDA directly.

