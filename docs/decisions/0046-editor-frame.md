# ADR 0046: Shared Editor Frame Component

- **Decider:** worker (approved by planner & owner)
- **Date:** 2026-11-08
- **Context:** `Editor.svelte` (774 lines) combined FSM-specific logic (conversions, tester, runner, checks, tables, first-run overlay) with the shared editor framing: tool rail layout, work area, top action bar (title, state count, save status line, fit button, phone undo/redo), hint and problem alert lines, stage wrapper, toast notification slot, side panel slot, announcer, and responsive/phone layout CSS (~220 lines). As established in `DECISIONS.md` (2026-11-08) for the PDA editor (T-055), copying this framing into `PdaEditor.svelte` would duplicate ~220 lines of CSS and media queries and invite layout drift.
- **Decision:**
  1. Extract `EditorFrame.svelte` (`web/src/lib/editor/EditorFrame.svelte`) to own the outer `.editor` container (`data-ready={ready || undefined}`), the `<ToolRail>`, `<div class="work">`, the `<div class="bar">` shared items (title, state count, `SaveStatusLine`, `fit` button, and `.phone-history` `HistoryButtons`), `<p class="problem" role="alert">`, `<p class="hint-line">`, `<div class="stage">`, `<Toast>`, and `<Announcer>`.
  2. The frame receives FSM- or PDA-specific content via typed Svelte 5 snippets:
     - `actionsBeforeFit?: Snippet`: toolbar controls rendered before the fit button (used by FSM layout button);
     - `actions?: Snippet`: toolbar controls rendered after the fit button (used by FSM help, share, and library buttons);
     - `stage: Snippet`: the main workspace canvas (`EditorCanvas`);
     - `coveredContent?: Snippet`: full-frame canvas replacement when active (FSM conversion canvas);
     - `overlay?: Snippet`: canvas overlays (FSM `FirstRun` card and layout status);
     - `panel?: Snippet`: side panel (`SidePanel` on FSM).
  3. `EditorFrame.svelte` receives framing props: `ready`, `tool`, `canUndo`, `canRedo`, `ontool`, `onundo`, `onredo`, `title`, `stateCount`, `saveStatus`, `persistent`, `hasAutosave`, `onfit`, `problem`, `hintLine`, `covered`, `toast`, `ontoastundo`, `ontoastdismiss`, `announcement`.
  4. All framing, work area, bar, toast, and responsive media queries (`@media (max-width: 39.99rem)`) move into `EditorFrame.svelte`. CSS scoping is preserved without `:global()` by applying rules directly to elements authored in `EditorFrame.svelte`.
  5. The DOM structure remains identical: zero wrapper elements added or removed.
- **Alternatives considered:**
  - Duplicate the frame markup and CSS in `PdaEditor.svelte` (rejected: duplicates 220 lines of CSS and responsive breakpoint rules that would drift).
  - Component inheritance or wrapper layout without slots (rejected: Svelte 5 snippets provide a cleaner, explicit, type-safe API).
- **Reversible?** Yes.
- **Affects:** `web/src/lib/editor/EditorFrame.svelte`, `web/src/lib/editor/Editor.svelte`, future `PdaEditor.svelte` (T-057).
