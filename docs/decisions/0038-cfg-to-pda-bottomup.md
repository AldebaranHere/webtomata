# 0038. Context-free grammar (CFG) to pushdown automaton (PDA), bottom-up

Status: accepted (2026-11-05).

## Context

Converting context-free grammars (CFGs) to pushdown automata (PDAs) via shift-reduce parsing is a core constructive equivalence proof in Theory of Computation (Elaine Rich Chapter 12; Fasilkom UI course slides Slide13, page 8). The bottom-up algorithm (`CFGtoPDAbottomup`) constructs an equivalent non-deterministic pushdown automaton (NDPDA) that parses words by shifting terminals onto the stack, reducing matching right-hand sides to variables, and accepting when only the start variable remains on the stack.

Students need to see the exact resulting machine and trace each transition added by the algorithm:
1. Shift transitions that read input terminals and push them onto the stack.
2. Reduce transitions that pop the reversed right-hand side of a rule (top of stack first) and push the rule's variable.
3. An accept transition that pops the start variable and transitions to the accepting state.

## Decision

- **Dedicated Engine Function & Shared Helpers:**
  Implemented in `crates/engine-core/src/cfg_pda.rs` with API endpoint `cfg_to_pda_bottomup` in `crates/engine-core/src/api.rs`, exposed to WebAssembly via `crates/engine-wasm/src/lib.rs` and typed worker RPCs in `web/src/lib/engine/protocol.ts`. Shared alphabets, clash checks, and deduplication logic are factored into private helpers in `cfg_pda.rs`, preserving T-034's top-down behavior and results unchanged.
- **Five Core Decisions:**
  1. *Same Inputs, Alphabets, States, and Errors as T-034:* Grammar text is parsed directly using `GrammarParser::parse` (8,192-character limit, `api.invalid_grammar` on syntax errors) without pre-normalization. Input alphabet is sorted terminals; stack alphabet is variables $\cup$ terminals sorted in byte order. States are $p = \text{StateId}(0)$ (start) and $q = \text{StateId}(1)$ (accepting), with `kind: PdaKind::Ndpda`. Variable/terminal collisions yield `pda.cfg.symbol_clash { symbol }`. Rule bodies longer than `MAX_PDA_STRING` (64) yield `machine.limit_exceeded`. Duplicate rules are deduplicated (first occurrence retained).
  2. *Shared Implementation:* Shared helper `prepare_cfg_pda_context` handles alphabet generation, state creation, and validation with strict error precedence: input `Alphabet::new`, then name-clash check, then stack `Alphabet::new`.
  3. *Step Trace:* Returns `steps: Vec<CfgPdaStep>` in exact construction order: shift steps for sorted terminals (`cfg_pda.bottom_up.shift { symbol }`), reduce steps for distinct rules in grammar order (`cfg_pda.bottom_up.reduce { rule }`), and accept step last (`cfg_pda.bottom_up.accept`).
  4. *No Conversion Budget:* The construction is strictly linear ($O(\text{terminals} + \text{distinct rules} + 1)$ steps) and cannot loop.
  5. *Simulation Termination with $\varepsilon$-rules:* For grammars without $\varepsilon$-rules, reduce operations pop at least one symbol and push one symbol, bounding stack depth by the number of shifts; simulation of any input is strictly finite and always ends `Finished`. When an $\varepsilon$-rule ($X \to \varepsilon$) is present, reduce transitions pop nothing (`pop: []`) and push a variable, creating unbounded derivation trees on words outside the language; such runs exhaust simulation budgets and terminate as `Stopped` (with `max_stack` or `max_configurations`), while strings in the language are found by BFS (`Finished`, accepted).
- **JFLAP Export Compatibility:**
  As in ADR 0037, because JFLAP 7.1 `.jff` PDA export only supports single-character stack symbols (ADR 0036), PDAs generated from grammars containing multi-character variables (e.g. `S0`) cannot be exported to JFLAP and return `jff.symbol_not_single_character { symbol }`.

## Consequences

- The engine provides a canonical bottom-up CFG-to-PDA conversion matching Slide13 page 8 alongside the top-down conversion of T-034.
- Incremental step traces with localized strings in Indonesian and English explain shifts, reduces, and acceptance.
- Downstream UI panels (tasks T-033, T-038) can inspect and simulate bottom-up PDAs directly.

