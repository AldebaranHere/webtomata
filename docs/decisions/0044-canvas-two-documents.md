# ADR 0044: Canvas Rendering and Label Slot for Two Document Kinds

- **Decider:** worker (approved by planner & owner)
- **Date:** 2026-11-07
- **Context:** The FSM canvas component `web/src/lib/editor/EditorCanvas.svelte` was hardcoded to `MachineDocument`, FSM `Editor`, `LabelField`, and `labelOf`. With `createEditorCore` established in T-049 (ADR 0043), the canvas and drawing pipeline must support both FSM and PDA documents without duplicating canvas rendering, camera controls, gesture handling, or selection mechanics.
- **Decision:**
  1. Parameterize `EditorCanvas.svelte` with `<script lang="ts" generics="D extends StatesDocument, C">`. Its props accept `editor: EditorCore<D, C>`, `state: EditorState<D>`, and a required pure diagram adapter `diagram: (doc: D) => DiagramInput`.
  2. Extract FSM-specific label field editing into `FsmLabelBox.svelte`. The canvas computes `{ x, y, from, to }` in screen coordinates via `labelSlot` derived state and exposes it through `Snippet<[LabelSlot]>` (`label?: Snippet<[LabelSlot]>`). `Editor.svelte` passes `diagram={fsmDiagram}` and wraps `FsmLabelBox` in `{#snippet label(slot)}`.
  3. Support multi-line edge overflow: `DiagramEdgeInput` and `LabelShape` add optional `overflow?: true` (omitted when false so FSM baseline shapes remain strictly identical). `pdaDiagram` sets `overflow: true` when transitions exceed 3 (`MAX_EDGE_LINES`).
  4. DiagramDrawing draws a dedicated pointer target `<rect class="hit-overflow">` for the "+ n lagi" line (`overflowTarget(label)`: 44 px high, centered on `labelLineY(label.box, label.lines.length - 1)`). The overflow hit target is rendered *after* `<rect class="hit-label">` to ensure top hit-test precedence. It emits `onmore(from, to)`, which defaults on the canvas to `editor.selectEdge(from, to)`.
  5. Add `menuLabels?: Partial<Record<MenuAction, MessageKey>>` override to `ContextMenu.svelte` and `EditorCanvas.svelte`, allowing document-specific context menu item translations without altering default FSM menu labels.
- **Alternatives considered:**
  - Keeping label editing inside `EditorCanvas.svelte` with branching logic for FSM and PDA (rejected: couples PDA 3-field form logic into the general canvas and bloats canvas component).
  - Drawing overflow target as part of the label text without a 44 px touch rect (rejected: violates 44 x 44 px touch accessibility target rule).
- **Reversible?** Yes.
- **Affects:** `web/src/lib/editor/EditorCanvas.svelte`, `Editor.svelte`, `FsmLabelBox.svelte`, `ContextMenu.svelte`, `diagram/geometry.ts`, `diagram/DiagramDrawing.svelte`, `diagram/pda-diagram.ts`.
