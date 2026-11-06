# 0041. The PDA editor document, its commands and its history

Status: accepted

## Context

The PDA editor (`design/screens/pda-editor.md`, approved on 2026-11-06) is built in five tasks:

1. **T-033 (this ADR):** `PdaDocument`, `PdaCommand`, `createPdaHistory`, `toEnginePda` / `fromEnginePda`, and the three first-run example documents (`pda-samples.ts`).
2. **T-039:** diagram adapter (`DiagramInput`, `fsmDiagram(doc)`, `pdaDiagram(doc)`) and multi-line edge label geometry.
3. **T-049:** PDA editor shell (`/sandbox?mode=pda`), canvas, tool rail, undo/redo, DPDA | NDPDA switch, and three-field transition label form.
4. **T-051:** Tabel and Definisi tabs, determinism badge (`pdaDeterminism`), and checks (`validatePda`).
5. **T-052:** saved machines with a type chip, `.jff` and JSON import/export, and the first-run examples card. (Simulation playback and PDA/CFG conversion traces follow in **T-038**.)

`MachineDocument` is imported by ~40 files across FSM checks, conversions, regular expressions, storage, and tests; turning it into a union would touch all of them.

## Decision

- **A parallel document (`pda-document.ts`), not a union.** `PdaDocument` (`schemaVersion: 1`, `title`, `kind: 'dpda' | 'ndpda'`, `inputAlphabet`, `stackAlphabet`, `states`, `start`, `accepting`, `transitions`, `nextStateId`) sits next to `MachineDocument`. Shared primitives stay in `document.ts` (`StateEntry`, `Result`, `Check`, `LIMITS`, `checkName`, `checkSymbol`, `checkTitle`, `isCoordinate`, `message`, `stateEntry`).
- **Copied from the FSM document and commands:**
  - `createPdaDocument`, `freezePdaDocument`, `pdaTransitionEntry`, `comparePdaTransitions`, `toEnginePda`, `fromEnginePda`, `pdaDocumentsEqual`, `serializePdaDocument`, `parsePdaDocument`, and `parsePdaDocumentText` in `pda-document.ts` are modeled directly on `createDocument`, `freezeDocument`, `transitionEntry`, `compareTransitions`, `toMachine`, `documentFromMachine`, `documentsEqual`, `serializeDocument`, `parseDocument`, and `parseDocumentText` in `document.ts`.
  - `applyPdaCommand` and `wellFormed` in `pda-commands.ts` are modeled on `applyCommand` and `wellFormed` in `commands.ts`.
  - `pdaDocumentFrom` in `pda-samples.ts` is modeled on `documentFrom` in `diagram/samples.ts`.
- **One generic history (`history.ts`).** An internal `createGenericHistory(initial, { apply, equal, limit })` backs both `createHistory` (whose signature and behavior for FSMs are unchanged) and `createPdaHistory(initial, options)` (bound to `applyPdaCommand` and `pdaDocumentsEqual`).
- **Names in the document, symbol numbers in the engine.** `inputAlphabet` and `stackAlphabet` store symbol names in the order the user added them; that order defines their `SymbolId` index in the engine. Transitions store `{ from, read: string | null, pop: readonly string[], push: readonly string[], to }` (`read: null` is ε; index 0 of `pop` and `push` is the top of the stack; there is no bottom-of-stack marker). `comparePdaTransitions` sorts transitions in the exact order of Rust's `PdaTransition`: by `from`, then `read` (`null` before any symbol, then by index in `inputAlphabet`), then `pop` and `push` element-by-element by index in `stackAlphabet` (shorter prefix first), then `to`.
- **Commands (`PdaCommand`) and refusals.** The 15 commands (`addState`, `removeState`, `moveState`, `renameState`, `setStart`, `setAccepting`, `addTransition`, `removeTransition`, `addInputSymbol`, `removeInputSymbol`, `addStackSymbol`, `removeStackSymbol`, `setKind`, `setTitle`, `batch`) are pure and atomic. `removeState`, `removeInputSymbol`, and `removeStackSymbol` cascade to remove transitions that reference the removed state or symbol. `addTransition` never adds a symbol to an alphabet on its own; unknown symbols are refused with `pda_document.unknown_symbol { symbol }`, duplicate transitions with `pda_document.duplicate_transition`, `pop` or `push` longer than `MAX_PDA_STRING` (64) with `pda_document.string_too_long { limit: 64 }`, and unknown `schemaVersion` values in `parsePdaDocument` with `pda_document.unsupported_version { version }`.

## Consequences

- Existing FSM modules and tests remain untouched while the PDA editor shares the same immutability, validation, and snapshot-based undo/redo guarantees.
- Every `PdaDocument` produced by `createPdaDocument`, `applyPdaCommand`, or `parsePdaDocument` converts via `toEnginePda` into a `Pda` accepted unchanged by `loadPda`, with transitions already in the engine's canonical order.

