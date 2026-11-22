# T-081 — One editor bar on a phone for the FSM and the PDA mode

Branch `task/T-081-editor-bar-phone`, rebased onto `origin/staging` at `5925484` (PR 229, amended spec).
Status: `done`. **Not pushed:** awaiting owner review.

## 1. What changed

| File | Change |
| --- | --- |
| `web/src/lib/editor/EditorFrame.svelte` | Moved `.fit` out of `.bar` into `.stage` (`position: relative`); styled `.fit` as a floating 44 × 44 px `"Pas"` button at bottom-right of `.stage` under `max-width: 39.99rem`; moved `.work > :global(.toast)` to `bottom: calc(var(--target-min) + var(--space-5))` on phone so it never intersects `.fit`. |
| `web/src/lib/editor/Editor.svelte` | Swapped DOM order in `{#snippet actions()}` so `.machines` comes before `.help` (and `.share` stays after `.help`, hidden on phone). |
| `web/src/lib/editor/PdaEditor.svelte` | Added optional `onhelp?: () => void`; rendered `.help` after `.machines` and before `.files`; hid `.files` under `max-width: 39.99rem`. |
| `web/src/lib/editor/PdaWorkstation.svelte` | Added optional `onhelp?: () => void` and forwarded `{onhelp}` to `PdaEditor`. |
| `web/src/routes/sandbox/+page.svelte` | Passed `onhelp={openTour}` to `PdaWorkstation`. |
| `web/src/lib/storage/pda-work.ts` | Added `readPdaDocument(store, id)` to read a saved PDA document by id (returns `null` if missing, non-PDA, or corrupt). |
| `web/src/lib/share/PdaFileDialog.svelte` | Added `import '#lib/i18n/pda-messages.ts';` so opening the dialog from FSM mode registers PDA file messages and never shows raw keys. |
| `web/src/lib/editor/LibraryDialog.svelte` | Added `"Unduh"` (`library.download`) button on readable PDA rows (no `"Unduh"` on FSM or unreadable rows); lazily flushes `library.flushPda()` if open, reads via `readPdaDocument`, hides the list, and opens lazy `PdaFileDialog`. |
| `web/src/lib/components/WorkstationSwitcher.svelte` | Full-width 44 px trigger under `max-width: 39.99rem` with ellipsis on `.trigger-current`; guarded `.switcher-trigger:hover` inside `@media (hover: hover)`; narrowed transition to `border-color, background-color`; kept `triggerBtn?.focus()`. |
| `web/src/lib/i18n/id.ts`, `en.ts` | Added `library.download` (`Unduh` / `Download`); appended `(pada mode FSM)` / `(in FSM mode)` to `tour.s4_body` and `tour.s5_body`. |
| `web/src/lib/storage/pda-library.test.ts` | Added unit test for `readPdaDocument` (valid PDA, missing id, FSM record, corrupt PDA). |
| `web/e2e/editor-bar-phone.spec.ts` | Updated and expanded for F1–F8 (phone 320/360/412 px, desktop 1280 × 800, floating `"Pas"` vs dock/handle/toast, PDA `?` tour, library row `"Unduh"` in FSM & PDA with autosave flush, switcher width/hover guard/Tab focus, axe). |
| `web/e2e/pda-files.spec.ts` | Updated F3, F5, and F8 on `isMobile` to open the PDA download dialog via `"Mesin saya"` → row → `"Unduh"` (desktop still uses the bar button). |
| `docs/decisions/0061-one-editor-bar-on-a-phone.md` | ADR recording the layout, lazy download handling, hover guard, and real-phone check limit. |
| `docs/agent/PLAN.md` | Status set to `in-progress` in first commit and `done` in last commit. |

## 2. Tests first (AC1): RED run on `staging`

All new tests were written first and run against `staging` (`5925484`) before any source edit:

- **Unit (`src/lib/storage/pda-library.test.ts`):** `1 failed | 11 passed`:
  ```text
  FAIL  src/lib/storage/pda-library.test.ts > pda-library: readPdaDocument (T-081 F5) > reads a saved PDA document by id, and returns null for missing, FSM, or corrupt records
  TypeError: readPdaDocument is not a function
   ❯ src/lib/storage/pda-library.test.ts:282:24
  ```
- **E2E (`editor-bar-phone.spec.ts --project=phone --project=desktop`):** `11 failed | 7 skipped | 0 passed` (every single F1–F8 test failed on `staging`).

## 3. Deepening pass

- **New exports / public interface members:**
  1. `readPdaDocument(store: MachineStore, id: string): Promise<PdaDocument | null>` in `web/src/lib/storage/pda-work.ts`: called lazily by `LibraryDialog.svelte` and unit-tested in `pda-library.test.ts`. Cannot be private because its caller is in `lib/editor/`. Reuses `isPdaRecord` and `readStoredPda` (no duplicated validation/parsing).
  2. `onhelp?: () => void` on `PdaWorkstation.svelte` and `PdaEditor.svelte`: mirrors `Editor.svelte`'s existing `onhelp` prop.
  3. **Zero new hooks** on `library.svelte.ts`: moving `downloadPda` + lazy `PdaFileDialog` into lazy-loaded `LibraryDialog.svelte` kept `library.svelte.ts` untouched and kept `sandbox.html` first-load JS growth at +48 bytes (vs +284 bytes when initially placed in `sandbox/+page.svelte`).
- **Duplication check:** The 5-line `?` SVG inside `PdaEditor.svelte` matches `Editor.svelte` (same pattern as the existing `.machines` SVG in both components; left inline to avoid a new shared icon module for a single button).
- **Type casts added:** **0** (`any`, `@ts-ignore`, `as unknown as`: 0).

## 4. Route sizes in gzip bytes (AC3)

Baseline measured on `staging` (`24b268d`/`5925484`) vs final build (budget: ≤ +102 bytes per route):

| Route | Before (bytes) | After (bytes) | Delta |
| --- | ---: | ---: | ---: |
| `index.html` | 83,827 | 83,867 | +40 B |
| `panduan.html` | 82,976 | 83,016 | +40 B |
| `panduan/berakhiran-x.html` | 89,356 | 89,399 | +43 B |
| `sandbox.html` | 124,822 | 124,870 | +48 B |
| `soal.html` | 84,471 | 84,510 | +39 B |
| `soal/berakhiran-10.html` | 124,175 | 124,209 | +34 B |
| `soal/jumlah-a-genap.html` | 124,175 | 124,209 | +34 B |
| `soal/mengandung-101.html` | 124,175 | 124,209 | +34 B |
| `tentang.html` | 82,274 | 82,314 | +40 B |
| `wasm` | 236.9 KB | 236.9 KB | 0 B |

```text
$ pnpm size
ok   initial JS index.html: 81.9 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 87.3 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 81.1 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 121.9 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 121.3 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 121.3 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 121.3 KB gzip (limit 170 KB)
ok   initial JS soal.html: 82.5 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 80.4 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-Ii0Gidl3.wasm: 236.9 KB gzip (limit 250 KB)
```

## 5. Verification output (AC2, AC5)

- `pnpm check` → `svelte-check found 0 errors and 0 warnings`
- `pnpm lint` → exited 0 (no output)
- `pnpm format:check` → `All matched files use Prettier code style!` + `cargo fmt --check` exited 0
- `pnpm check:strings`, `pnpm check:tokens`, `pnpm check:contrast` → all passed (exited 0)
- `pnpm test:web` → all unit tests passed (including `pda-library.test.ts`, `tour.test.ts`, `first-load.test.ts`)
- `pnpm test:tools` → `tests 147, pass 147, fail 0`
- `pnpm --filter web exec playwright test editor-bar-phone pda-files --project=phone --project=desktop` → `23 passed, 7 skipped (35.6s)`
- `pnpm --filter web exec playwright test editor-view editor-layout switcher pda-library cross/cross cross/first-run cross/library cross/bar-phone --project=phone --project=desktop` → `166 tests run, 0 failed`
- `pnpm --filter web exec playwright test cross/bar-phone cross/cross cross/first-run cross/library --project=webkit-phone` → `0 failed`
- `pnpm --filter web exec playwright test editor-bar-phone --project=phone --project=desktop --repeat-each=5` → `55 passed, 35 skipped (1.3m)`
- **Not run locally:** Firefox (cannot start on the owner's laptop per `AGENTS.md`; runs in CI) and real Android phone check (owner checks sticky `:hover` and touch ergonomics on the preview).

## 6. Deliberate breaks on the final code (AC4)

Each break was applied to the final code, rebuilt, run against the targeted Playwright test, and restored cleanly:

- **B1 — swap Mesin and `?` in PDA mode only (`PdaEditor.svelte`):**
  Diff: moved `{#if onhelp}...{/if}` before `{#if library}...{/if}` in `PdaEditor.svelte`.
  Failing line:
  ```text
  1) [phone] › e2e/editor-bar-phone.spec.ts:94:2 › F1, F2, F8 (FSM + PDA at 360x740)
    -   StringMatching /^Mesin saya \(\d+\)$/,
        "Bantuan: tur 1 menit",
    +   "Mesin saya (2)",
    > 119 | expect(pdaBoxes.map((b) => b.name)).toEqual([
  ```

- **B2 — remove `onhelp` from PDA (`PdaWorkstation.svelte`):**
  Diff:
  ```diff
  -			{onhelp}
  ```
  Failing line:
  ```text
  1) [phone] › e2e/editor-bar-phone.spec.ts:282:2 › F4: "?" in PDA mode opens the tour dialog
    Locator: getByRole('button', { name: 'Bantuan: tur 1 menit' })
    Expected: visible / Error: element(s) not found
    > 288 | await expect(helpBtn).toBeVisible();
  ```

- **B3 — show `.files` on a phone again (`PdaEditor.svelte`):**
  Diff:
  ```diff
  -			display: none;
  +			display: flex;
  ```
  Failing line:
  ```text
  1) [phone] › e2e/editor-bar-phone.spec.ts:94:2 › F1, F2, F8 (FSM + PDA at 360x740)
        "Bantuan: tur 1 menit",
    +   "Unduh mesin ini sebagai file",
        "Urungkan",
    > 119 | expect(pdaBoxes.map((b) => b.name)).toEqual([
  ```

- **B4 — show `"Unduh"` on an FSM row (`LibraryDialog.svelte`):**
  Diff:
  ```diff
  -									{:else}
  +									{/if}
  +									{#if true}
  ```
  Failing line:
  ```text
  1) [desktop] › e2e/editor-bar-phone.spec.ts:306:2 › F5: "Unduh" in a PDA row...
    Locator: getByRole('dialog', { name: 'Mesin saya' }).getByRole('button', { name: 'Unduh', exact: true })
    Expected: 0 / Received: 1
    > 347 | await expect(list(page).getByRole('button', { name: 'Unduh', exact: true })).toHaveCount(0);
  ```
