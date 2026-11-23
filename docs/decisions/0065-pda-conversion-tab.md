# 0065. The Konversi tab of the PDA editor (PDA to a grammar)

Status: accepted

## Context

The PDA editor had two work tabs, Tabel and Definisi, and T-038a added Simulasi as the first. P-005
(`design/screens/pda-simulation-conversion.md`, section 2, frame C) gives it a fourth and last tab,
Konversi, with the two stages of the slides: restricted normal form (`pda_to_rnf`, T-036) and the
grammar (`pda_to_cfg`, T-037). The engine and the worker already had both calls
(`pdaToRnf`/`pdaToCfg` in `protocol.ts`); no `crates/` change was needed.

The fixtures were measured with the real engine on 2026-11-23: wcwᴿ has 5 RNF steps (4 states,
13 transitions), 14 CFG steps, 76 rules and 34 variables; F-ONE has 3 RNF steps and 4 added
transitions at its expansion step; F-SPLIT has 3 RNF steps including `pda.rnf.split` and 17 CFG
rules; F-NOSTART is refused with `pda.rnf.no_start_state`. The grammar parser keeps `<…>` in a
head but drops it in a body, so `<q,A,r>` names parse without error and are disconnected (for
wcwᴿ, heads ∩ body = 0). The engine's own `V_…` names round-trip exactly (76 rules, the same 34
variables).

## Decision

1. **Two stages, one engine call each.** "Mulai" calls `pdaToRnf` once. Stage 2 is disabled until
   RNF exists; "Ke tata bahasa" calls `pdaToCfg` once on `RnfResult.pda`, never on the student's
   PDA. The stepper is local after that, and an answer that arrives after the document changed is
   dropped, as the FSM's `ConversionPanel` does. A stage-2 refusal keeps stage 1 visible with one
   calm sentence.
2. **Copy, do not generalize.** New `pda-conversion.ts` (the model), `PdaConversionPanel.svelte`
   and `PdaConversionCanvas.svelte`; the FSM's conversion files and the grammar stepper are not
   touched. `PlayerControls` and the existing `convert.*` keys are reused. The new `pda_convert.*`
   keys live in `pda-messages.ts` and travel with the PDA chunk (ADR 0050).
3. **The panel has the exact diff; the canvas has the states and the `from>to` group.** The shared
   drawing layer groups transitions by `from>to` and paints `taken` only in its interactive form;
   AC10 forbids changing it. The panel therefore shows the exact **Dihapus** (struck through) and
   **Ditambah** lists (both windowed at 50), and the read-only canvas highlights the step's states
   and the `from>to` group. The exact per-transition stroke is T-085.
4. **`rnfLayout` returns every state.** Source states keep their positions. The new start state is
   260 units left of the source **start** state and the new accepting state 260 units right of the
   source **accepting** state; split states go 200 units below the state they split from and are
   shifted right until they overlap nothing. The layout is used both on the canvas and when the
   result opens as a new machine. The 410-unit arbitrary-grid rule of T-033 does not apply to this
   four-state result; the readable content on a phone is the sentence and the diff lists.
5. **The opened grammar uses the engine's `V_…` names.** The parser's bracket rule makes
   `<q,A,r>` text semantically broken; the panel shows `<q,A,r>` only as presentation. In the
   grammar mode, the variables are `V_…`, and one grey sentence says so. The grammar text is one
   line per head, start first, `ε` for an empty body, and the grammar mode's own receiver adds its
   uniqueness suffix.
6. **The handoff is the page's.** The seam commit (T-038c) declares
   `PdaWorkstation.onopengrammar?(title, text)` and the page turns a request into the grammar mode.
   T-038b passes the callback through `PdaEditor` to the panel. **Buka PDA ini sebagai mesin
   baru** stays inside `PdaWorkstation`: `createPdaMachine(store, doc)` writes a new record, and
   the workstation's own `openPdaById` opens it. The source record is never touched.
7. **Titles and kind.** `"<source title> (RNF)"` and `"<source title> (CFG)"`, clamped so
   the whole title fits `LIMITS.titleChars` (100), with `editor.untitled` for an empty source. The
   saved RNF machine is an NDPDA even when the source was a DPDA.
8. **Limits.** The canvas is drawn only when the result has at most 30 states and 150 transitions;
   above that the pane shows one calm sentence and the panel and open button still work. The
   per-step lists and the rules-so-far list show the last 50 with "… n baris sebelumnya".
9. **The head is in the pane.** The Konversi pane renders the kind switch, the determinism badge
   and the checks, like the other PDA tabs, in the open tab only. A change from the head is an
   edit, and an edit closes the conversion.
10. **The step sentences are the engine's keys with names.** The numeric `state`, `from` and `to`
    parameters are mapped to state names as `conversionText` does for the FSM. `pda_cfg.start` and
    `pda_cfg.empty` hard-code `s`/`a`/`q`, so the panel uses its own `pda_convert.start_rule` and
    `pda_convert.empty_rules` sentences, which match the rule list under them.
11. **No new term.** RNF stays in English, as the glossary already says; there is no "bentuk normal
    terbatas".

## Consequences

- No `crates/` change; the `.wasm` stays at 243 700 B gzip (238.0 KB; 12 300 B below the budget).
- The sandbox route's first JS grows from 125 053 B to 125 130 B gzip (+77 B; the panel and its keys
  are in the lazy PDA chunk).
- The duplication of the FSM conversion panel, the FSM conversion model and `grammarToText` goes
  to T-071 (which unifies the schedulers and the conversions).
- The engine grammar has 13 body variables that are not the head of any rule (rules into the new
  accepting state, and unreachable variables). AC5's literal "every body nonterminal has a head"
  cannot hold for the correct engine grammar; the task checks instead that the opened grammar's
  head and body variable sets equal the engine grammar's, and the text round-trips to 76 rules.
