# 0048. PDA editor shell and workstation mode

Status: accepted

## Context

The PDA editor was decomposed into ten tasks (docs/agent/PLAN.md, T-055 to T-057, ADR 0041 to 0047).
With the data model (T-033), diagram geometry (T-039), generic editor core (T-049), generic canvas (T-053),
PDA three-field label form (T-054), extracted shared frame (T-055), and PDA storage queue on device (T-056) merged,
Task T-057 integrates these capabilities into a functioning workstation mode at `/sandbox?mode=pda`.

## Decision

1. **WorkstationMode and Mode Reader (`workstation-mode.ts`).**
   - Mode union expanded to `'fsm' | 'pda' | 'language' | 'grammar'`.
   - Pure function `readMode(search, saved)` determines active mode with precedence: valid query parameter `mode` > valid saved localStorage value > `'fsm'`. Case-sensitive. Never throws.
   - `WorkstationSwitcher` enables `pda` mode item without "Segera Hadir" badge.

2. **On-Demand Loading and Isolated Storage (`PdaWorkstation.svelte`).**
   - Loaded dynamically via `import()` when `activeMode === 'pda'`. First JavaScript bundle for other modes carries zero PDA editor code.
   - Opens its own store via `openStore()` and calls `openLatestPda(store, () => Date.now())`.
   - Propagates skipped corrupt/newer records to the page via `onskipped`, presenting the unreadable notice only while in PDA mode without deleting untouched records.
   - Falls back gracefully to memory store when storage operations fail.

3. **Editor Shell and Responsive Form Layout (`PdaEditor.svelte`).**
   - Instantiates `createPdaEditor(doc)` and renders `EditorFrame` with title, state count, save status line, fit button, toast, and announcer.
   - On desktop/laptop viewports, edge labeling renders `PdaLabelPopover` via canvas `label` snippet.
   - On mobile viewports (`max-width: 39.99rem`), edge labeling renders `PdaLabelForm` inside an `<aside class="pda-sheet">` via the frame's `panel` snippet. Display mode is chosen at open time and held constant until close.
   - `EditorCanvas` receives opt-in prop `revealLabeling` to ensure the labeled edge remains visible in the stage above the phone bottom sheet upon viewport resize.

4. **Shared Autosave Binding (`autosave-binding.svelte.ts`).**
   - Extracted shared reactive binding between editor instance and autosave queue into `useAutosaveBinding`.
   - Handles schedule on document reference change, flush on `visibilitychange` (`hidden`), `pagehide`, and component unmount, `beforeunload` warning when unsaved changes exist, and reactive save status / problem alerts.
   - Shared between `Editor.svelte` and `PdaEditor.svelte` without code duplication.

## Consequences

- The PDA editor shell is live at `/sandbox?mode=pda` allowing full graph creation, edge editing, undo/redo, and storage persistence.
- FSM editor DOM structure, pixel appearance, and existing storage behavior remain completely unchanged.

