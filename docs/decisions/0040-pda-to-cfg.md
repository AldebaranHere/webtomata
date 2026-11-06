# 0040. Pushdown automaton in restricted normal form to context-free grammar (PDA to CFG)

Status: accepted (2026-11-06).

## Context

The course (Slide13, pages 20 to 27; Elaine Rich Chapter 12) converts a pushdown automaton to a context-free grammar in two stages: `pda_to_rnf` (ADR 0039) rewrites an arbitrary PDA into restricted normal form (RNF), and `PDAtoCFG` turns an RNF machine `M = (K, Σ, Γ, Δ, s', {a})` into a context-free grammar whose start symbol `S` derives a string `w` iff `(s, w, #) ⊢* (a, ε, ε)`. Students need to inspect the generated rules and the step-by-step trace of the algorithm.

## Decision

- **Module and API.** `crates/engine-core/src/pda_cfg.rs`: `pda_to_cfg(&Pda) -> Result<PdaToCfg, Message>`, `MAX_PDA_CFG_RULES = 20_000`, `PdaToCfg { grammar, variables, steps }`, `CfgVariable { name, from, stack, to }`, and `PdaCfgStep { added, message }`. Exposed as `pda_to_cfg(pda_json)` in `api.rs`, `pdaToCfg` in `crates/engine-wasm/src/lib.rs`, and `pdaToCfg(pda)` in `web/src/lib/engine/protocol.ts` and `handlers.ts`.
- **Six decisions of the spec.**
  1. _Input validation (checked in exact order by a private helper `rnf_shape_error`):_
     - (a) no start state: `pda_cfg.no_start_state`;
     - (b) the start state `s'` must have exactly one outgoing transition (reading `ε`, popping `[]`, and pushing one symbol `#`), no incoming transition, and must not be accepting: otherwise `pda_cfg.bad_start { state }`;
     - (c) `accepting` must have length 1 (`a`): otherwise `pda_cfg.not_one_accepting { count }`;
     - (d) every transition into `a` (checked in `Pda::new` sorted order) must read `ε`, pop `[#]`, and push `[]`: otherwise `pda_cfg.bad_accept { from }`;
     - (e) every transition not from `s'` (in sorted order) must pop exactly one symbol: otherwise `pda_cfg.not_single_pop { from, to }`;
     - (f) every input symbol (in alphabet order) must be a single character that `GrammarParser` reads back as `Symbol::Terminal(c)` (not ASCII uppercase, whitespace, `<`, `[`, `|`, `\`, `ε`, `λ`, or `^`): otherwise `pda_cfg.terminal_not_readable { symbol }`.
  2. _Variable names:_ the start symbol is `S`. Every other variable is `V_{q}g{k}p{p}` where `q` and `p` are decimal `StateId`s and `k` is either the decimal `SymbolId` of the stack symbol or `e` for `ε` (for example `V_0g2p3`, `V_1gep1`). The slide's `<q,γ,p>` cannot be used as the raw `Grammar` symbol name because `GrammarParser` strips `<…>` brackets while `grammarToText` writes `NonTerminal` names without brackets, so `0,a,3` would be re-parsed as terminals. `GrammarParser` reads `V_{q}g{k}p{p}` as a single `NonTerminal` and round-trips it cleanly through `grammarToText`.
  3. _Rules and order:_ active states `K` are all states of the PDA except `s'` in ascending `StateId` order (including unreachable states, matching the slides). Rules are the concatenation of steps: (1) `S → V_{s}g{marker_id}p{a}`; (2) `V_{q}gep{q} → ε` for `q ∈ K` ascending; (3) one step per transition not from `s'` in `Pda::new` sorted order. Case A (`push` empty) iterates `w ∈ K` ascending and emits `V_{q}g{γ}p{w} → c V_{r}gep{w}`. Case B (`push` of length `n ≥ 1`, top symbol `γ1 = push[0]`) iterates `(v1, …, vn) ∈ Kⁿ` in lexicographic order (`v1` slowest, `vn` fastest) and emits `V_{q}g{γ}p{vn} → c V_{r}g{γ1}p{v1} V_{v1}g{γ2}p{v2} … V_{v(n−1)}g{γn}p{vn}` (with `vn` in the head).
  4. _No cleanup:_ `pda_to_cfg` returns the full uncleaned grammar (76 rules for `wcwᴿ`); removing unreachable and non-productive rules belongs to the CNF phases.
  5. _Size limit before building rules:_ before allocating any rule, the exact rule count `1 + |K| + Σ |K|^max(n, 1)` is computed in `u64` with `checked_pow` and `checked_add`. If it overflows or exceeds `MAX_PDA_CFG_RULES = 20_000`, `machine.limit_exceeded { what: "rules", limit: 20000 }` is returned immediately.
  6. _Result metadata and trace:_ `variables` lists every `V_…` variable appearing in any rule head or body, sorted by `(from, stack_id_with_epsilon_last, to)` with `stack: Option<String>` carrying the stack symbol name (`None` for `ε`) so the UI (T-038) can render `<q,γ,p>`. Step messages use `pda_cfg.start`, `pda_cfg.empty { count }`, `pda_cfg.push_none { from, to }`, and `pda_cfg.push { from, to, pushes }`.
- **15 versus 16 rules on Slide13 page 27.** Slide13 page 27 states in prose that 16 rules remain after removing unproductive and unreachable rules from the 76-rule `wcwᴿ` grammar, but its numbered list ([1]–[10] and [14]–[18], skipping [11]–[13]) contains 15 rules. Independent reachability and productivity filtering of the 76 rules confirms that 15 rules remain (`<s,ε,s> → ε` is productive but unreachable from `S`).

## Consequences

- Every RNF machine produced by `pda_to_rnf` whose input symbols are single grammar-readable characters and whose rule count is at most `20,000` converts to an equivalent `Grammar` that round-trips through `grammarToText` and `GrammarParser::parse` and works directly with `CnfTransformer` and `CykParser`.

