# Task T-055 Report — PDA editor, part 6 of 10: the editor frame is shared

- **Task:** T-055
- **Branch:** `task/T-055-editor-frame`
- **Status:** done
- **Implementation Commits:**
  - Status start: `6c00fc0` (`docs(agent): set T-055 to in-progress`)
  - Framework extraction and completion: `f00699d` (`feat(editor): extract shared editor frame`)
- **PR:** #178 (https://github.com/AldebaranHere/webtomata/pull/178)

---

## 1. Pre-flight & Stray Diff Confirmation

Prior to starting implementation on clean `staging`:
- Confirmed `git diff web/src/lib/editor/pda-label.ts` contained only whitespace / formatting differences from prior commits, safely discarded via `git restore web/src/lib/editor/pda-label.ts`.
- Validated environment in WSL Ubuntu (Node v24.21.0, Rust, pnpm, wasm-pack).

---

## 2. Oracle Baseline & Determinism (F1 & F2)

Before modifying any source files, baseline determinism was verified on clean `staging` (commit `5b65deb`) by capturing 16 screenshots (8 desktop @ 1440x900, 8 phone @ Pixel 7) and 16 DOM snapshots (`document.querySelector('.editor').outerHTML` with Svelte comments and whitespace normalized) twice into `~/tmp/oracle-run-1` and `~/tmp/oracle-run-2`.
Running `node ~/tmp/compare-oracle.mjs ~/tmp/oracle-run-1 ~/tmp/oracle-run-2` confirmed:
```
Result: 0 image diffs, 0 DOM diffs.
```
This immutable set was stored in `~/tmp/oracle-baseline/`.

### The 8 States Evaluated:
1. `/sandbox` empty with first-run card
2. `/sandbox` with sample machine open and state $q_0$ selected
3. Label box open on an edge (`Enter` on selected transition edge)
4. `Tabel` tab open in side panel
5. `Konversi` tab open in side panel
6. State deleted, toast notification showing
7. `/soal/mengandung-101` with editor and Umpan balik tab open
8. Context menu open on state $q_0$

### F1 & F2 Refactor Comparison Output:
Comparing `oracle-baseline` against the refactored code `oracle-refactor`:
```
Comparing 16 images and 16 DOM snapshots between:
  A: /home/Aldebaran64/tmp/oracle-baseline
  B: /home/Aldebaran64/tmp/oracle-refactor
  ✓ desktop-1-empty.html: identical DOM
  ✓ desktop-2-state-selected.html: identical DOM
  ✓ desktop-3-label-open.html: identical DOM
  ✓ desktop-4-tab-table.html: identical DOM
  ✓ desktop-5-tab-conversion.html: identical DOM
  ✓ desktop-6-toast.html: identical DOM
  ✓ desktop-7-soal-feedback.html: identical DOM
  ✓ desktop-8-context-menu.html: identical DOM
  ✓ phone-1-empty.html: identical DOM
  ✓ phone-2-state-selected.html: identical DOM
  ✓ phone-3-label-open.html: identical DOM
  ✓ phone-4-tab-table.html: identical DOM
  ✓ phone-5-tab-conversion.html: identical DOM
  ✓ phone-6-toast.html: identical DOM
  ✓ phone-7-soal-feedback.html: identical DOM
  ✓ phone-8-context-menu.html: identical DOM
  ✓ desktop-1-empty.png: 0 differing pixels
  ✓ desktop-2-state-selected.png: 0 differing pixels
  ✓ desktop-3-label-open.png: 0 differing pixels
  ✓ desktop-4-tab-table.png: 0 differing pixels
  ✓ desktop-5-tab-conversion.png: 0 differing pixels
  ✓ desktop-6-toast.png: 0 differing pixels
  ✓ desktop-7-soal-feedback.png: 0 differing pixels
  ✓ desktop-8-context-menu.png: 0 differing pixels
  ✓ phone-1-empty.png: 0 differing pixels
  ✓ phone-2-state-selected.png: 0 differing pixels
  ✓ phone-3-label-open.png: 0 differing pixels
  ✓ phone-4-tab-table.png: 0 differing pixels
  ✓ phone-5-tab-conversion.png: 0 differing pixels
  ✓ phone-6-toast.png: 0 differing pixels
  ✓ phone-7-soal-feedback.png: 0 differing pixels
  ✓ phone-8-context-menu.png: 0 differing pixels

Result: 0 image diffs, 0 DOM diffs.
```
- **AC1:** 16 of 16 pairs pixel-identical (0 differing pixels).
- **AC2:** 16 of 16 DOM snapshots identical (0 diffs). Zero wrapper elements added or removed.

---

## 3. Deliberate Breaks (AC5)

Four deliberate breaks were made, verified failing, and cleanly restored:

### Break 1: Dropped `.editor { flex-direction: column; }` in phone media query
- **Break:** Removed `.editor { flex-direction: column; }` from the `@media (max-width: 39.99rem)` block in `EditorFrame.svelte`.
- **Caught by:** Phone project test execution (`e2e/editor-bar-phone.spec.ts` and `screenshot-oracle.mjs` state 5 on phone). The phone layout broke: `aside.panel` rendered horizontally next to canvas instead of below, causing `button.go` to intercept pointer events and time out.
- **Restored:** `.editor { flex-direction: column; }` restored in `EditorFrame.svelte`.

### Break 2: Moved `<Toast>` before `<div class="stage">`
- **Break:** Relocated `<Toast ... />` before `<div class="stage">` in `EditorFrame.svelte`.
- **Caught by:** F2 DOM snapshot comparison:
  ```
  DOM mismatch in desktop-1-empty.html
  DOM mismatch in desktop-6-toast.html
  DOM mismatch in phone-1-empty.html
  DOM mismatch in phone-6-toast.html
  Result: 1 image diffs, 4 DOM diffs.
  ```
- **Restored:** `<Toast>` restored after `<div class="stage">` and overlays in `EditorFrame.svelte`.

### Break 3: Dropped `data-ready` attribute from `<div class="editor">`
- **Break:** Changed `<div class="editor" data-ready={ready || undefined}>` to `<div class="editor">`.
- **Caught by:** `e2e/editor.spec.ts:28:1` ("the Sandbox opens with the sample, and the page does not scroll"):
  ```
  Error: locator.waitFor: Test timeout of 10000ms exceeded.
  Call log:
    - waiting for locator('.editor[data-ready]') to be visible
     at openSandbox (fixtures.ts:69:44)
  ```
- **Restored:** `data-ready={ready || undefined}` restored in `EditorFrame.svelte`.

### Break 4: Dropped `role="alert"` from `.problem` paragraph
- **Break:** Changed `<p class="problem" role="alert">{t('storage.' + problem + '_hint')}</p>` to `<p class="problem">{t('storage.' + problem + '_hint')}</p>`.
- **Caught by:** `e2e/cross/storage.spec.ts:145:1` ("a browser that refuses storage: the editor works, with a warning that nothing is saved"):
  ```
  Error: expect(locator).toContainText(expected) failed
  Locator: getByRole('alert')
  Expected substring: "memblokir penyimpanan"
  Timeout: 5000ms
  Error: element(s) not found
  ```
- **Restored:** `role="alert"` restored on `<p class="problem">` in `EditorFrame.svelte`.

---

## 4. Deepening Pass (AC6)

### Component Seam & API: `EditorFrame.svelte`
`EditorFrame.svelte` exports a single Svelte 5 component with strictly typed props and snippets.

#### Props:
- `ready?: boolean`: controls `data-ready` attribute on root `.editor`.
- `tool: Tool`: current active tool passed to `ToolRail`.
- `canUndo: boolean`: undo capability state passed to `ToolRail` and phone `HistoryButtons`.
- `canRedo: boolean`: redo capability state passed to `ToolRail` and phone `HistoryButtons`.
- `ontool: (tool: Tool) => void`: callback for tool selection.
- `onundo: () => void`: callback for undo action.
- `onredo: () => void`: callback for redo action.
- `title: string`: title text in `.bar .title`.
- `stateCount: number`: state count in `.bar .count`.
- `saveStatus?: SaveStatus`: status for `SaveStatusLine`.
- `persistent?: boolean`: persistent storage flag for `SaveStatusLine`.
- `hasAutosave?: boolean`: whether autosave status should be rendered.
- `onfit: () => void`: click handler for `.bar .fit` button (delegates to canvas fit).
- `problem?: 'unavailable' | 'failed' | null`: storage failure alert state.
- `hintLine?: string | null`: keyboard/interaction hint message.
- `covered?: boolean`: hides stage when modal canvas is active (e.g. conversions).
- `toast?: Announcement | null`: active toast message.
- `ontoastundo?: () => void`: toast undo callback.
- `ontoastdismiss?: () => void`: toast dismiss callback.
- `announcement?: Announcement | null`: screen reader announcement.

#### Snippets:
- `actionsBeforeFit?: Snippet`: FSM auto-layout action button.
- `actions?: Snippet`: FSM help, share, library dialog buttons.
- `stage: Snippet`: canvas viewport (`EditorCanvas`).
- `coveredContent?: Snippet`: conversion canvas overlay.
- `overlay?: Snippet`: `FirstRun` card and layout notice.
- `panel?: Snippet`: side workstation panel (`SidePanel`).

#### Audit:
1. **Public surface:** Only the necessary frame properties and slots are exported. All internals are private to the component.
2. **Duplication:** Zero duplicate logic. The framing CSS (work area, toolbar, status lines, toast positioning, and phone media query layout) exists in `EditorFrame.svelte` only.
3. **Casts:** Zero casts (`any`, `@ts-ignore`, `as unknown as`). All types are checked strictly via TypeScript and Svelte 5 runes.

---

## 5. Line Counts & Moved CSS (AC4)

- **`web/src/lib/editor/Editor.svelte`**:
  - Before: 774 lines
  - After: 640 lines (-134 lines)
- **`web/src/lib/editor/EditorFrame.svelte`**:
  - Created: 241 lines
- **Moved CSS rules from `Editor.svelte` to `EditorFrame.svelte`:**
  - `.editor`
  - `.stage`, `.stage[hidden]`
  - `.work`
  - `.bar`, `.bar p.title`, `.bar p.count`, `.bar button.fit`
  - `.phone-history`
  - `.hint-line`, `.problem`
  - `.toast-slot`
  - `@media (max-width: 39.99rem)` responsive phone rules:
    - `.editor` (column flex, dock reordering)
    - `.stage` (dock ordering)
    - `.bar` (order, height, padding, gap)
    - `.bar p.title` (font size, flex shrink)
    - `.bar p.count` (display none)
    - `.bar button.fit` (44px target)
    - `.phone-history` (display flex)

---

## 6. Verification Results

### Static Checks:
```
$ pnpm format:check
All matched files use Prettier code style!

$ pnpm check
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...
svelte-check found 0 errors and 0 warnings

$ pnpm lint
$ eslint .
(clean, 0 errors, 0 warnings)

$ pnpm check:strings
ok   67 components have no hard-coded text

$ pnpm check:tokens
ok   69 files use no raw colors
```

### Unit Tests:
```
$ pnpm test:web
 Test Files  104 passed (104)
      Tests  1278 passed | 2 skipped (1280)
   Duration  8.44s
```

### Build & Bundle Size:
```
$ pnpm size
ok   initial JS index.html: 81.8 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 87.1 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 80.8 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 121.3 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 120.9 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 120.9 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 120.9 KB gzip (limit 170 KB)
ok   initial JS soal.html: 82.3 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 80.2 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

### Playwright Area E2E Specs:
- **Desktop Project (`e2e/editor*.spec.ts`, `e2e/axe*.spec.ts`, `e2e/cross/storage.spec.ts`):**
  - **134 passed**, 43 skipped (touch-specific tests skipped on desktop), 0 failed.
- **Phone Project (`e2e/editor*.spec.ts`, `e2e/axe*.spec.ts`):**
  - **25 passed**, 13 skipped (mouse/desktop-specific tests skipped on phone), 0 failed.
- Total area specs: 159 passed across desktop and phone configurations.
