# 0049. PDA editor panel: tabs, kind switch, checks, read-only table and formal definition

Status: accepted

## Context

Task T-057 established the PDA editor shell and workstation mode at `/sandbox?mode=pda`.
To provide parity with the FSM editor, the PDA editor requires its side panel (column on laptop, bottom sheet with drag bar on phone) with the `Tabel` and `Definisi` tabs, the `DPDA | NDPDA` kind switch, engine validation checks, transition table inspection, and formal definition display.

## Decision

1. **Engine Loading in PDA Mode (Supersedes ADR 0048).**
   - The PDA editor now loads the engine via `#lib/engine/client.ts` to request `engine.validatePda` in its Web Worker after the first draw. This replaces ADR 0048's "PDA mode never loads the WASM".
   - The Rust engine remains the sole source of truth; no validation logic is re-implemented in TypeScript.

2. **Generic Checker (`checker.ts`).**
   - `createChecker<D>` is generalized to accept an arbitrary document type `D` and an issue-to-item converter `toItems`.
   - FSM passes `checkItems` (or defaults to it), keeping all existing FSM tests and behaviors identical.
   - PDA passes `pdaCheckItems` (`pda-checks.ts`), which maps `pda.*` issue keys to message keys, translates `from`/`state` to state names under `{state}`, and converts 0-based competition indices into 1-based table row numbers `{first}` and `{second}` without marking row numbers as state nodes.

3. **Generalized Components (`SidePanel.svelte`, `KindSwitch.svelte`).**
   - `SidePanel.svelte` makes `simulation` and `conversion` snippets optional, rendering only the tabs present in the `tabs` prop. PDA passes `tabs=['table', 'definition']`. `readTab` safely defaults to `'table'` when saved storage points to `'simulation'`.
   - `KindSwitch.svelte` is generic over kind types `K extends string`, defaulting to `Kind` (`'dfsm' | 'ndfsm'`) with optional `options` allowing PDA to supply `'dpda' | 'ndpda'`.

4. **Read-Only Transition Table and Formal Definition (`PdaTableView.svelte`, `PdaDefinitionView.svelte`).**
   - `pdaTableOf(doc)` (`pda-table.ts`) formats transitions in engine canonical sort order (`doc.transitions`), reusing `formatStackSeq` and `stackSeparator` from `pda-diagram.ts`.
   - `PdaTableView.svelte` is loaded on demand when the table tab is activated, rendering a semantic `<table>` with sticky first column for mobile side-scroll and accent bar styling for marked rows.
   - `pdaDefinitionOf(doc)` and `pdaDefinitionText(doc)` (`pda-definition.ts`) format the 6-tuple $M = (K, \Sigma, \Gamma, \Delta, s, A)$ and its transition relation lines in mono font.

5. **Diagram Overflow Selection (`+ n lagi`).**
   - Clicking `+ n lagi` on the canvas in the `Pilih` tool selects the edge, activates the `Tabel` tab, and marks the edge's transitions with `aria-current="true"` and an accent bar.
   - In the `Hapus` tool, clicking `+ n lagi` deletes the edge immediately and does not open the panel.

## Consequences

- The PDA editor now provides complete inspection of transitions and formal definitions with validation checks and non-blocking kind switching.
- FSM editor tests and behavior remain completely unedited.
- The route's initial JS remains within budget; table and definition views are lazily loaded.

