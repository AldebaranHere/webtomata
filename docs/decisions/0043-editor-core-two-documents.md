# ADR 0043: Editor Interaction Core for Two Document Kinds

- **Decider:** worker (approved by planner & owner)
- **Date:** 2026-11-06
- **Context:** The FSM editor's interaction logic in `interaction/editor.ts` was hardcoded to `MachineDocument` and FSM `Command`. The PDA editor (part of the 8-task PDA editor roadmap, T-049) requires states, placement, selection, drag, undo/redo, and edge lifecycle to operate identically on `PdaDocument` and `PdaCommand` without duplicating over 700 lines of canvas and editor state mechanics.
- **Decision:** Split `interaction/editor.ts` into a generic `createEditorCore<D extends StatesDocument, C>(initial: D, kind: EditorKind<D, C>)` and two thin kinds (`fsmKind` in `editor.ts` and `pdaKind` in `pda-editor.ts`).
  1. `StatesDocument` is a structural interface capturing the shared fields: `states`, `start`, `accepting`, and `{ from, to }` transitions. Both `MachineDocument` and `PdaDocument` satisfy this without modification.
  2. `StateCommand` defines the seven common commands (`addState`, `removeState`, `moveState`, `renameState`, `setStart`, `setAccepting`, `setTitle`).
  3. `EditorKind<D, C>` supplies exactly four operations: `createHistory`, `equal`, `edgeText`, and `removeEdge`.
  4. `commitEdge(commands: readonly C[])` provides the unified label commit tail: handles empty commands, batches execution into one undo step, closes the label box, handles refusals, and announces `edge_removed` (when no transition remains between the pair) or `edge_changed`. FSM `commitLabel` delegates its execution tail to `commitEdge`.
  5. `EditorState<D = MachineDocument>` defaults to `MachineDocument` to maintain zero-change backwards compatibility for existing FSM components (`Editor.svelte`, `EditorCanvas.svelte`, `Announcer.svelte`, etc.).
- **Alternatives considered:**
  - Unifying `MachineDocument` and `PdaDocument` into a single tagged union or bloated structure (rejected: touches ~40 files and every test).
  - Duplicating the editor state machine for PDA (rejected: ~700 lines of code duplication).
- **Reversible?** Yes.
- **Affects:** `web/src/lib/editor/interaction/document-view.ts`, `editor.ts`, `pda-editor.ts`, `menu.ts`, `placement.ts`, `selection.ts`, `diagram/pda-diagram.ts`.

