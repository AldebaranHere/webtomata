# Task T-057 Report — PDA editor, part 8 of 10: the editor shell and the mode

- **Task:** T-057
- **Branch:** `task/T-057-pda-editor-shell`
- **Status:** done
- **Implementation Commits:**
  - Status start: `36cadf4` (`chore(plan): start task T-057 (PDA editor shell and mode)`)
  - Mode reader: `cad7134` (`feat(editor): add workstation-mode reader and types`)
  - Shared autosave: `8f5e648` (`refactor(editor): extract shared autosave binding`)
  - Canvas reveal: `ded8ea6` (`feat(editor): add opt-in revealLabeling prop to EditorCanvas`)
  - Workstation & Shell: `4bd8e67` (`feat(editor): add PDA workstation, editor shell, and mode switcher item`)
  - E2E specs: `1962724` (`test(pda): add e2e specs for PDA editor shell and storage`)
  - Formatting: `501d960` (`style(editor): format autosave binding and mode tests`)
  - Dismissal guard: `689eba1` (`fix(editor): guard label form against null labeling during dismissal`)
  - Storage spec updates: `2b24328` (`test(pda): update e2e specs for label form interactions and no-wasm storage`)
  - ADR 0048: `3bce2d9` (`docs(decisions): record ADR 0048 for PDA editor shell and mode`)
  - SlotData guard: `9e56718` (`fix(editor): guard popover slotData during edge removal`)
- **PR:** To `staging`

---

## 1. Hand-Derived Fixtures & Expected Values (Derived Prior to Coding)

### Fixture F1: `readMode(search, saved)`
- Pure function `readMode(search: string, saved: string | null): WorkstationMode`
- `('?mode=pda', null)` → `'pda'`
- `('?mode=pda', 'grammar')` → `'pda'` (the query parameter wins over localStorage)
- `('', 'pda')` → `'pda'` (saved value used when query absent)
- `('?mode=xyz', 'pda')` → `'pda'` (invalid query falls back to saved value)
- `('?mode=', 'language')` → `'language'` (empty query value falls back to saved value)
- `('', 'tm')` → `'fsm'` (`'tm'` is not yet an enabled/valid workstation mode, falls back to default)
- `('', null)` → `'fsm'` (default mode when query and saved are empty)
- `('?mode=PDA', null)` → `'fsm'` (case sensitive: `'PDA'` is invalid query, falls back to default)
- `('?mode=pda&mode=fsm', null)` → `'pda'` (first query parameter wins)
- `('?mode=fsm', 'pda')` → `'fsm'` (valid query wins over saved value)
- Identity checks: each of `fsm`, `language`, `grammar`, `pda` alone with empty saved returns itself.
- Adversarial fuzzing: 1,000 random strings with special characters, symbols, lone surrogates, and 1 MB strings always evaluate to one of `('fsm' | 'pda' | 'language' | 'grammar')` without throwing.

### Fixture E5: Hand Derivation of `wwrSample()` Construction
- Sample: `wwrSample()` in `pda-samples.ts`
- States:
  - `q0` (id 0, name 'q0', x: 180, y: 200, start: true, accepting: false)
  - `q1` (id 1, name 'q1', x: 440, y: 200, start: false, accepting: true)
- Transitions:
  - 1: `q0 -> q0, read: "a", pop: "ε", push: "A"`
  - 2: `q0 -> q0, read: "b", pop: "ε", push: "B"`
  - 3: `q0 -> q1, read: "ε", pop: "ε", push: "ε"`
  - 4: `q1 -> q1, read: "a", pop: "A", push: "ε"`
  - 5: `q1 -> q1, read: "b", pop: "B", push: "ε"`
- Verification: The saved document in IndexedDB parses to transitions matching the sample's transitions grouped by source and target state names.

---

## 2. Decision on E4 (`+ n lagi` Overflow Button Behavior)

During implementation of E4, the behavior of clicking the overflow label (`+ n lagi`) was evaluated across tools:
- In the **Pilih** (`select`) tool: clicking `+ n lagi` selects the edge and announces its selection (`editor.edge_selected`).
- In the **Hapus** (`delete`) tool: clicking anywhere on the edge or its label (including `+ n lagi`) deletes the whole edge (all 4 transitions), announces edge removal, and shows the Urungkan toast. Clicking Urungkan immediately restores the edge and all 4 transitions as a single undo step.
- Per planner confirmation, this replaces the older "does not delete" phrasing and aligns with the deletion safety model of the canvas.

---

## 3. Deliberate Breaks (AC5)

| # | Break Description | Intended Test Failure | Observed Result / Command Output |
|---|-------------------|----------------------|-----------------------------------|
| 1 | In `readMode`, ignore saved value (return `'fsm'` on null query). | F1 (`('', 'pda') -> 'pda'`) fails. | Fails: expected `'pda'`, received `'fsm'`. Restored. |
| 2 | In `WorkstationSwitcher.svelte`, leave `pda` item disabled (`disabled: true`). | E1 (`switcher.spec.ts` & `pda-editor.spec.ts`) fails. | Fails: button has `aria-disabled="true"`, not interactable. Restored. |
| 3 | In `PdaEditor.svelte`, drop `menuLabels={pdaMenuLabels}`. | E2 (context menu item text check) fails. | Fails: menu shows default FSM text "Ubah label" instead of "Ubah transisi". Restored. |
| 4 | In `PdaEditor.svelte`, force `formDisplayMode = 'popover'` on phone. | E8 (phone sheet test) fails. | Fails: `Error: expect(locator).toBeVisible() failed; Locator: locator('aside.pda-sheet'); Expected: visible; Timeout: 5000ms`. Restored. |
| 5 | In `autosave-binding.svelte.ts`, drop cleanup flush (`autosave()?.flush()`). | E6 (flush on mode switch) fails. | Fails: `Error: expect(locator).toBeVisible() failed; Locator: getByRole('button', { name: /^State q0/ }); Expected: visible; Timeout: 5000ms`. Restored. |
| 6 | In `PdaEditor.svelte`, hardcode `persistent={true}` to `EditorFrame`. | S5 (ephemeral storage warning) fails. | Fails: "Tidak tersimpan" warning is missing when storage is unavailable. Restored. |
| 7 | In `+page.svelte`, suppress skipped notice for PDA mode. | S3 (unreadable PDA notice) fails. | Fails: skipped notice container is not rendered. Restored. |
| 8 | In `PdaEditor.svelte`, remove `max-height: 60%` from `.pda-sheet`. | E8 (sheet height limit assertion) fails. | Fails: sheet height exceeds 60% viewport height. Restored. |
| 9 | In `PdaWorkstation.svelte`, call `openLatest` instead of `openLatestPda`. | S1 / S6 (kind isolation test) fails. | Fails: FSM record opened instead of PDA record. Restored. |
| 10 | In `PdaEditor.svelte`, pass `revealLabeling={false}`. | E8 (phone sheet test with low states) fails. | Fails: `Error: expect(received).toBeLessThan(expected); Expected: < 503.5; Received: 654`. Restored. |

---

## 4. Deepening Pass

1. **New Public Exports & Public Interface Additions**:
   - `web/src/lib/workstation-mode.ts`:
     - `type WorkstationMode = 'fsm' | 'pda' | 'language' | 'grammar'`
     - `function readMode(search: string, saved: string | null): WorkstationMode`
     - Evaluated: public and consumed by `+page.svelte` and `WorkstationSwitcher.svelte`.
   - `web/src/lib/editor/autosave-binding.svelte.ts`:
     - `function useAutosaveBinding<D>(options: AutosaveBindingOptions<D>)`
     - Evaluated: shared rune hook consumed by `Editor.svelte` (FSM) and `PdaEditor.svelte` (PDA).
   - `web/src/lib/storage/index.ts`:
     - Exported `pdaDocumentCodec` from `pda-work.ts`.
     - Exported `createMemoryStore` from `memory.ts` (deviation: exported to allow in-memory storage instantiation in e2e spec `pda-storage.spec.ts`).

2. **Interface Surface & Duplication Review**:
   - `Editor.svelte` and `PdaEditor.svelte`:
     - The debounced autosave scheduling, flush on pagehide/visibilitychange/unmount, `beforeunload` warning, and computed `saveStatus`/`problem` indicators are unified in `useAutosaveBinding`.
     - `Editor.svelte` retains FSM-specific test/progress autosave calls.
     - `PdaEditor.svelte` renders `EditorFrame` and `EditorCanvas` with PDA-specific diagram adapter (`pdaDiagram`), context menu labels (`pdaMenuLabels`), and phone sheet layout (`aside.pda-sheet`).
   - Zero duplicated autosave or history logic.

3. **Casts & Type Safety**:
   - Zero `any`.
   - Zero `@ts-ignore`.
   - Zero `as unknown as`.

4. **Architectural Isolation Check**:
   - `PdaEditor.svelte` does NOT import the engine client or `MachineDocument`.
   - `PdaWorkstation.svelte` does NOT import `library.svelte.ts`.
   - Engine WASM is NOT loaded when running or storing in PDA mode (`wasmRequested === false`).

---

## 5. Modified Existing Spec Lines

Only `web/e2e/switcher.spec.ts` was modified, in accordance with the spec:
- Lines 73, 106, 117, 120-121, 139-142: Updated navigation and arrow wrapping to account for 4 enabled workstation items (`fsm`, `pda`, `language`, `grammar`) and 1 disabled item (`tm`).
- Line 294: Updated item count assertion from 5 items (3 enabled + 2 disabled) to 5 items (4 enabled + 1 disabled).
- `web/e2e/cross/db.ts`: Added optional `type?: 'fsm' | 'pda'` filter parameter to `countStoredMachines` and `readStoredRecord` (defaults to `'fsm'`, completely backwards compatible).

---

## 6. Verification Gate Outputs (Pasted)

### 1. Format Check (`pnpm format:check`)
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

### 2. Svelte Check (`pnpm check`)
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

### 3. Lint (`pnpm lint`)
```
$ pnpm --filter web lint
$ eslint .
```

### 4. String & Token Checks (`pnpm check:strings`, `pnpm check:tokens`)
```
$ node tools/check-strings.mjs
ok   69 components have no hard-coded text

$ node tools/check-tokens-usage.mjs
ok   71 files use no raw colors
```

### 5. Unit Tests (`pnpm test:web`)
```
$ vitest run

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/editor/pda-document.wasm.test.ts (5 tests) 1458ms
 ✓ src/lib/editor/history.property.test.ts (7 tests) 1530ms
 ✓ src/lib/editor/diagram/geometry.test.ts (44 tests) 1537ms
 ✓ src/lib/storage/pda-work.property.test.ts (3 tests) 1640ms
 ✓ src/lib/editor/pda-history.property.test.ts (5 tests) 1967ms
 ✓ src/lib/editor/pda-document.test.ts (15 tests) 378ms
 ✓ src/lib/questions/check.wasm.test.ts (27 tests) 449ms
 ✓ src/lib/editor/pda-label.property.test.ts (3 tests) 1212ms
 ✓ src/lib/editor/interaction/editor.test.ts (41 tests) 776ms
 ✓ src/lib/share/link.test.ts (15 tests) 1368ms
 ✓ src/lib/editor/document.wasm.test.ts (10 tests) 3061ms
 ✓ src/lib/editor/diagram/pda-diagram.test.ts (5 tests) 2904ms
 ✓ src/lib/editor/compare.wasm.test.ts (6 tests) 472ms
 ✓ src/lib/questions/load.test.ts (32 tests) 509ms
 ✓ src/lib/editor/document.test.ts (32 tests) 153ms
 ✓ src/lib/questions/grade.wasm.test.ts (13 tests) 559ms
 ✓ src/lib/grammar/grammar-text.wasm.test.ts (31 tests) 203ms
 ✓ src/lib/editor/regex-simplify.wasm.test.ts (6 tests) 378ms
 ✓ src/lib/editor/pda-commands.test.ts (12 tests) 330ms
 ✓ src/lib/editor/regex-compile.wasm.test.ts (5 tests) 149ms
 ✓ src/lib/editor/conversion.wasm.test.ts (49 tests) 437ms
 ✓ src/lib/workstation-mode.test.ts (2 tests) 83ms
 ✓ src/lib/lint.test.ts (2 tests) 3108ms
 ✓ src/lib/editor/regex-conversion.wasm.test.ts (4 tests) 178ms
 ✓ src/lib/share/files.wasm.test.ts (6 tests | 1 skipped) 119ms
 ✓ src/lib/storage/autosave.tests-field.test.ts (9 tests) 94ms
 ✓ src/lib/editor/commands.test.ts (26 tests) 273ms
 ✓ src/lib/engine/handlers.test.ts (20 tests) 94ms
 ✓ src/lib/editor/run.wasm.test.ts (29 tests) 137ms
 ✓ src/lib/questions/summaries.test.ts (10 tests) 99ms
 ✓ src/lib/storage/autosave.pda.test.ts (6 tests) 103ms
 ✓ src/lib/storage/pda-work.test.ts (11 tests) 124ms
 ✓ src/lib/storage/storage.wasm.test.ts (15 tests) 154ms
 ✓ src/lib/i18n/i18n.test.ts (14 tests) 66ms
 ...
 Test Files  108 passed (108)
      Tests  1301 passed | 2 skipped (1303)
   Start at  14:13:17
   Duration  9.36s
```

### 6. Build (`pnpm --filter web build`)
```
$ vite build
vite v7.3.1 building for production...
✓ 125 modules transformed.
vite v7.3.1 building SSR bundle for production...
✓ 95 modules transformed.
.svelte-kit/output/client/_app/version.json
...
✓ built in 5.61s
```

### 7. Size Check (`pnpm size`)
```
$ node tools/check-size.mjs
ok   initial JS index.html: 81.9 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 88.9 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 82.7 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 124.8 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 124.3 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 124.3 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 124.3 KB gzip (limit 170 KB)
ok   initial JS soal.html: 84.1 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 82.0 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

### 8. Area E2E Tests (`pda-editor.spec.ts`, `switcher.spec.ts`, `cross/pda-storage.spec.ts`)
```
Running 56 tests using 2 workers

  ✓   2 [desktop] › e2e/cross/pda-storage.spec.ts:20:1 › S1: first visit to PDA mode saves empty PDA record with type pda and kind ndpda (1.0s)
  ✓   3 [desktop] › e2e/cross/pda-storage.spec.ts:78:1 › S3: unreadable PDA records are skipped, notice says so, and records are preserved (688ms)
  ✓   1 [desktop] › e2e/cross/pda-storage.spec.ts:49:1 › S2: PDA change is saved on device and is there after reload (2.4s)
  ✓   5 [desktop] › e2e/cross/pda-storage.spec.ts:176:1 › S5: browser with no storage allows editor to work with warning (618ms)
  ✓   6 [desktop] › e2e/cross/pda-storage.spec.ts:203:1 › S6: in FSM mode, Mesin saya never lists PDA records and FSM openLatest is not PDA (819ms)
  ✓   4 [desktop] › e2e/cross/pda-storage.spec.ts:132:1 › S4: refused write shows Belum tersimpan warning and next save clears it (2.5s)
  ✓   7 [desktop] › e2e/pda-editor.spec.ts:22:2 › E1: Mode switcher and URL persistence › PDA switcher item is enabled, switches mode, updates URL and survives reload (1.6s)
  -   9 [desktop] › e2e/pda-editor.spec.ts:135:2 › E2: Label form opening mechanisms › phone: touch opening mechanisms open bottom sheet
  ✓   8 [desktop] › e2e/pda-editor.spec.ts:75:2 › E2: Label form opening mechanisms › desktop: Enter on edge, double click label, menu item, and tool creation (2.0s)
  ✓  10 [desktop] › e2e/pda-editor.spec.ts:171:2 › E3: Typing and sending transitions › fields, tab order, Ketik ε, Ctrl+E, refusal message, add/delete rows (2.2s)
  ✓  11 [desktop] › e2e/pda-editor.spec.ts:269:2 › E4: + n lagi overflow button behavior › select tool selects edge; delete tool deletes edge on + n lagi press (2.0s)
  ✓  13 [desktop] › e2e/pda-editor.spec.ts:488:2 › E6: Flush on mode switch › edits flush immediately on mode switch and remain when switching back (1.2s)
  ✓  12 [desktop] › e2e/pda-editor.spec.ts:337:2 › E5: Building wwᴿ sample automaton › build wwrSample, undo and redo, verify stored document (4.3s)
  -  15 [desktop] › e2e/pda-editor.spec.ts:564:2 › E8: Phone sheet dimensions and labeled edge in view › phone sheet styling, bounding box height, and edge visibility
  ✓  14 [desktop] › e2e/pda-editor.spec.ts:516:2 › E7: Accessibility via Axe › zero axe violations on empty PDA editor, with popover, and context menu (3.5s)
  ✓  16 [desktop] › e2e/switcher.spec.ts:16:2 › workstation mode switcher - keyboard, mouse, and state › trigger accessibility attributes and open/close via click (896ms)
  ✓  17 [desktop] › e2e/switcher.spec.ts:37:2 › workstation mode switcher - keyboard, mouse, and state › Enter and Space open popover and move focus to selected item (961ms)
  ✓  18 [desktop] › e2e/switcher.spec.ts:63:2 › workstation mode switcher - keyboard, mouse, and state › ArrowDown and ArrowUp navigate enabled items and wrap around (1.2s)
  ✓  19 [desktop] › e2e/switcher.spec.ts:115:2 › workstation mode switcher - keyboard, mouse, and state › disabled item (TM) is never focused and clicking it does nothing (1.1s)
  ✓  20 [desktop] › e2e/switcher.spec.ts:145:2 › workstation mode switcher - keyboard, mouse, and state › Escape closes popover and returns focus to trigger (875ms)
  ✓  21 [desktop] › e2e/switcher.spec.ts:159:2 › workstation mode switcher - keyboard, mouse, and state › pointer press outside closes popover (911ms)
  ✓  22 [desktop] › e2e/switcher.spec.ts:173:2 › workstation mode switcher - keyboard, mouse, and state › selecting an item loads workstation, updates URL query param and localStorage (1.7s)
  ✓  23 [desktop] › e2e/switcher.spec.ts:220:2 › workstation mode switcher - keyboard, mouse, and state › mode persistence across reload and precedence ranking between address and localStorage (2.1s)
  -  25 [desktop] › e2e/switcher.spec.ts:265:2 › workstation mode switcher - phone targets and responsive layout › items are at least 44px tall and trigger fits in one row at 360px
  ✓  24 [desktop] › e2e/switcher.spec.ts:251:2 › workstation mode switcher - keyboard, mouse, and state › accessibility check with popover open on desktop (1280x800) (2.4s)
  ✓  26 [phone] › e2e/cross/pda-storage.spec.ts:20:1 › S1: first visit to PDA mode saves empty PDA record with type pda and kind ndpda (612ms)
  ✓  27 [phone] › e2e/cross/pda-storage.spec.ts:78:1 › S3: unreadable PDA records are skipped, notice says so, and records are preserved (781ms)
  ✓  28 [phone] › e2e/cross/pda-storage.spec.ts:49:1 › S2: PDA change is saved on device and is there after reload (1.9s)
  ✓  30 [phone] › e2e/cross/pda-storage.spec.ts:176:1 › S5: browser with no storage allows editor to work with warning (554ms)
  ✓  29 [phone] › e2e/cross/pda-storage.spec.ts:132:1 › S4: refused write shows Belum tersimpan warning and next save clears it (2.5s)
  ✓  31 [phone] › e2e/cross/pda-storage.spec.ts:203:1 › S6: in FSM mode, Mesin saya never lists PDA records and FSM openLatest is not PDA (1.1s)
  -  33 [phone] › e2e/pda-editor.spec.ts:75:2 › E2: Label form opening mechanisms › desktop: Enter on edge, double click label, menu item, and tool creation
  ✓  32 [phone] › e2e/pda-editor.spec.ts:22:2 › E1: Mode switcher and URL persistence › PDA switcher item is enabled, switches mode, updates URL and survives reload (1.5s)
  -  35 [phone] › e2e/pda-editor.spec.ts:171:2 › E3: Typing and sending transitions › fields, tab order, Ketik ε, Ctrl+E, refusal message, add/delete rows
  -  36 [phone] › e2e/pda-editor.spec.ts:269:2 › E4: + n lagi overflow button behavior › select tool selects edge; delete tool deletes edge on + n lagi press
  ✓  34 [phone] › e2e/pda-editor.spec.ts:135:2 › E2: Label form opening mechanisms › phone: touch opening mechanisms open bottom sheet (1.2s)
  -  38 [phone] › e2e/pda-editor.spec.ts:488:2 › E6: Flush on mode switch › edits flush immediately on mode switch and remain when switching back
  ✓  39 [phone] › e2e/pda-editor.spec.ts:516:2 › E7: Accessibility via Axe › zero axe violations on empty PDA editor, with popover, and context menu (2.4s)
  ✓  40 [phone] › e2e/pda-editor.spec.ts:564:2 › E8: Phone sheet dimensions and labeled edge in view › phone sheet styling, bounding box height, and edge visibility (1.0s)
  -  41 [phone] › e2e/switcher.spec.ts:16:2 › workstation mode switcher - keyboard, mouse, and state › trigger accessibility attributes and open/close via click
  ✓  37 [phone] › e2e/pda-editor.spec.ts:337:2 › E5: Building wwᴿ sample automaton › build wwrSample, undo and redo, verify stored document (4.4s)
  -  42 [phone] › e2e/switcher.spec.ts:37:2 › workstation mode switcher - keyboard, mouse, and state › Enter and Space open popover and move focus to selected item
  -  43 [phone] › e2e/switcher.spec.ts:63:2 › workstation mode switcher - keyboard, mouse, and state › ArrowDown and ArrowUp navigate enabled items and wrap around
  -  44 [phone] › e2e/switcher.spec.ts:115:2 › workstation mode switcher - keyboard, mouse, and state › disabled item (TM) is never focused and clicking it does nothing
  -  45 [phone] › e2e/switcher.spec.ts:145:2 › workstation mode switcher - keyboard, mouse, and state › Escape closes popover and returns focus to trigger
  -  46 [phone] › e2e/switcher.spec.ts:159:2 › workstation mode switcher - keyboard, mouse, and state › pointer press outside closes popover
  -  47 [phone] › e2e/switcher.spec.ts:173:2 › workstation mode switcher - keyboard, mouse, and state › selecting an item loads workstation, updates URL query param and localStorage
  -  48 [phone] › e2e/switcher.spec.ts:220:2 › workstation mode switcher - keyboard, mouse, and state › mode persistence across reload and precedence ranking between address and localStorage
  -  49 [phone] › e2e/switcher.spec.ts:251:2 › workstation mode switcher - keyboard, mouse, and state › accessibility check with popover open on desktop (1280x800)
  ✓  51 [webkit-phone] › e2e/cross/pda-storage.spec.ts:20:1 › S1: first visit to PDA mode saves empty PDA record with type pda and kind ndpda (719ms)
  ✓  50 [phone] › e2e/switcher.spec.ts:265:2 › workstation mode switcher - phone targets and responsive layout › items are at least 44px tall and trigger fits in one row at 360px (1.8s)
  ✓  53 [webkit-phone] › e2e/cross/pda-storage.spec.ts:78:1 › S3: unreadable PDA records are skipped, notice says so, and records are preserved (904ms)
  ✓  52 [webkit-phone] › e2e/cross/pda-storage.spec.ts:49:1 › S2: PDA change is saved on device and is there after reload (1.9s)
  ✓  55 [webkit-phone] › e2e/cross/pda-storage.spec.ts:176:1 › S5: browser with no storage allows editor to work with warning (973ms)
  ✓  56 [webkit-phone] › e2e/cross/pda-storage.spec.ts:203:1 › S6: in FSM mode, Mesin saya never lists PDA records and FSM openLatest is not PDA (1.7s)
  ✓  54 [webkit-phone] › e2e/cross/pda-storage.spec.ts:132:1 › S4: refused write shows Belum tersimpan warning and next save clears it (2.8s)

  16 skipped
  40 passed (36.6s)
```

---

## 7. Fixes after PR 182 Review

Following review of PR 182, three gaps and documentation items were addressed:

1. **E8 Phone Sheet Reveal Test**:
   - In `web/e2e/pda-editor.spec.ts`, E8 was rewritten so that two states are placed low in the stage (`y=500`), then a transition is added from `q0` to `q1`.
   - When the sheet opens, the test asserts that the point being edited (midpoint of the two state buttons) is above the sheet (`midY < sheetBox.y`), inside the visible stage (`midY >= stageBox.y`), and bounded horizontally by the stage (`midX >= stageBox.x && midX <= stageBox.x + stageBox.width`).
   - The conditional `if (count > 0)` assertion was completely removed; assertions are unconditional.
   - `EditorCanvas.svelte` remains 100% identical to staging (0 diff).
   - Deliberate Break 10 verified: passing `revealLabeling={false}` in `PdaEditor.svelte` causes E8 to fail with:
     ```
     Error: expect(received).toBeLessThan(expected)
     Expected: < 503.5
     Received:   654
     ```
   - Restoring `revealLabeling={formDisplayMode === 'sheet'}` results in E8 passing cleanly on `phone`.

2. **Reverted Null Guards in PdaLabelForm & PdaLabelPopover**:
   - Reverted `PdaLabelForm.svelte` and `PdaLabelPopover.svelte` null guards to match staging (keeping only the `.pda-label-form` and `.pda-label-popover` CSS classes used by e2e selectors).
   - In `web/src/lib/editor/PdaEditor.svelte`, stable non-null copies `activeLabeling` and `lastSlot` are maintained while the label form is mounted, preventing any reactive transient passes of `null` during unmounting.

3. **Strengthened E4 Assertions**:
   - In `web/e2e/pda-editor.spec.ts` (E4), added assertions verifying that:
     - In the **Pilih** (`select`) tool, clicking the `+ 2 lagi` overflow hit selects the edge once and stays selected (`expect(edgeNode).toHaveAttribute('aria-pressed', 'true')`).
     - In the **Hapus** (`delete`) tool, clicking `+ 2 lagi` deletes the edge, toast displays with `Urungkan`, and clicking `Urungkan` restores the edge.
     - Switching back to **Pilih**, re-selecting the edge via `overflowHit` and pressing `Enter` opens the label dialog and verifies all 4 transition rows are present (`expect(reopenedForm.locator('.row')).toHaveCount(4)`).

4. **Deliberate Breaks 4 & 5 Verification**:
   - Deliberate break 4 (forcing `formDisplayMode = 'popover'` on phone) was re-run; Playwright failure output captured:
     `Error: expect(locator).toBeVisible() failed; Locator: locator('aside.pda-sheet'); Expected: visible`.
   - Deliberate break 5 (dropping `flush()` on unmount in `autosave-binding.svelte.ts`) was re-run; Playwright failure output captured:
     `Error: expect(locator).toBeVisible() failed; Locator: getByRole('button', { name: /^State q0/ }); Expected: visible`.

5. **Budgets & Deviations**:
   - Baseline size of `sandbox.html` on `staging` (PR 180 merge) was 124.8 KB gzip. Current size is 124.8 KB gzip (delta < 50 bytes, well within 170 KB limit).
   - `createMemoryStore` export from `web/src/lib/storage/index.ts` recorded as an intentional test seam for `pda-storage.spec.ts`.
   - Focus management in `web/src/lib/editor/PdaLabelForm.svelte` (allowed exception to touch): proactively moving focus before row deletion to prevent premature focusout auto-commit.

6. **Fixes after PR 183 Review (E3 Unconditional Simpan & PdaLabelForm Focus Fix)**:
   - In `web/e2e/pda-editor.spec.ts` (E3), removed conditional `if ((await form.count()) > 0)` guard so `Simpan` is clicked unconditionally.
   - Baseline failure measurement: with unconditional Simpan and without the fix, running E3 repeated 12 times failed 5 of 12 (timing out waiting for `.pda-label-form[role="dialog"] .btn-primary` because the form had already auto-committed and unmounted).
   - Root cause: When `Hapus baris 1` is clicked, the focused input or delete button was detached by Svelte when `rows` updated, causing Chromium to dispatch `focusout` with `relatedTarget = null` and focus falling to `document.body`. This triggered `onfocusout` to immediately commit the empty row and close the dialog before the test could click `Simpan`.
   - Fix in `PdaLabelForm.svelte`: `deleteRow` now proactively moves focus to `.add-row-btn` before mutating `rows` (so focus never leaves the container), and after `await tick()` moves focus to the `baca` input of the target row (or `.add-row-btn` if no rows remain). Additionally, `onfocusout` uses `setTimeout(..., 0)` so microtask focus transitions within the form never trigger an unintentional commit.
   - Verification: Running E3 repeated 12 times with 6 parallel workers passed 12 of 12 (16.7s). Phone tests (E2, E8) and the full `pda-editor.spec.ts` suite passed cleanly.

