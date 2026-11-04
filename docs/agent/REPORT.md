# Report — T-011

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-011
- title: End-to-end tests for the language workstation and the mode switcher
- branch: `task/T-011-language-and-switcher-e2e`
- commits: `0103fa8..e0c793d`
- pull request: to be opened
- status: done

## What changed
- `web/e2e/language-flow.spec.ts`:
  - New end-to-end test suite for the formal language workstation and string enumeration flow:
    - **Preset selection and proper order enumeration (desktop 1280x800):** verifies presets L1 (`{ab, aca, b, ccab}`), L7 (`{ab, bc}`), and L2 (`{ac, c, bab, bcaa}`) against hand-derived proper order string sequences and length badges.
    - **Finite language boundary:** verifies finite languages with fewer strings than $N$ (e.g. L1 with 4, L7 with 2) show all strings with no error banner.
    - **Custom formula & alphabet badge:** types `{a, b}*`, verifies alphabet badge shows `Σ = {a, b}`, and validates the first 10 strings against hand derivation.
    - **Panjang Min (|w| ≥ M):** verifies filtering with min length bound 2; confirms all output strings have length ≥ 2 and begin with `aa`.
    - **Jumlah String (N):** verifies string count limit 5; checks exact list length and metadata count.
    - **Format String Kosong:** tests switching empty string display between caret `^` and epsilon `ε`.
    - **Salin Semua (Copy All):** verifies clipboard copy of strings joined by newlines (with granted clipboard permissions on Chromium, skipped with message on Firefox/WebKit); verifies button is disabled when results list is empty.
    - **Invalid formula banner:** verifies invalid syntax (e.g. `∪ ∪ ∪` or unclosed `{`) displays red banner `role="alert"`, hides results list, and disables copy button.
    - **Symbol toolbar:** verifies clicking quick symbol buttons (`∪`, `#a(w)`) inserts text at textarea cursor position and preserves focus in the textarea.
    - **English locale:** verifies English preset names, column headers ("Enumeration Results (Proper Order)"), copy button ("Copy All"), and result metadata in English when locale is `en`.
    - **Phone layout (390x844):** verifies phone tabs flow (`Pustaka` -> preset tap jumps to `Editor` -> `Hasil` tab displays results); verifies all touch targets are ≥ 44px (`.sym-btn`, `#min-len-input`, `#max-count-input`, `#empty-sym-select`, `.btn-primary`).
    - **axe accessibility scans:** clean passes on desktop (1280x800) with results and with error banner, and phone (390x844) across all tabs and with error banner.
- `web/e2e/switcher.spec.ts`:
  - New end-to-end test suite for the workstation mode switcher:
    - **Trigger & Popover:** verifies `aria-haspopup="listbox"`, `aria-expanded="false"`, click open/close.
    - **Keyboard opening:** verifies Enter and Space open popover and focus active selected item (`aria-selected="true"`).
    - **Keyboard navigation:** verifies ArrowDown and ArrowUp navigate enabled options (FSM -> Language -> Grammar) and wrap around in both directions.
    - **Disabled items:** verifies PDA and Turing machine options have `aria-disabled="true"`, are skipped by arrow navigation, and clicking them does nothing.
    - **Escape and outside click:** verifies Escape closes popover and returns focus to trigger; verifies clicking outside closes popover.
    - **Selection & Mode loading:** verifies selecting Language loads `/sandbox?mode=language` and updates `localStorage`; Grammar loads `/sandbox?mode=grammar`; FSM restores default without `?mode=`.
    - **Precedence & Persistence:** verifies mode persistence across reload, URL `?mode=` winning over `localStorage`, invalid `?mode=` falling back to `localStorage`, and fallback to FSM when both are absent/invalid.
    - **Responsive dimensions & targets:** verifies all popover items are ≥ 44px tall; verifies trigger fits in one single line at 360px width.
    - **axe accessibility scans:** clean passes with popover open on desktop (1280x800) and phone (360x780).
- `web/src/lib/components/WorkstationSwitcher.svelte`:
  - Added `role="presentation"` to `<div class="category-header">` so axe validates that children of `role="group"` inside `role="listbox"` are options.
  - Added `role="option"` and `aria-selected="false"` to disabled `.switcher-item` elements to satisfy ARIA listbox requirements and match `design/screens/workstation-switcher.md`.
  - Added `min-height: var(--target-min);` to `.switcher-item` so switcher items meet the 44px touch target specification.

---

## Hand Derivation of Proper Order Strings (AC2)

Proper order (length-lexicographical order) defines that strings are ordered strictly by length first (shortest strings first), and within the same length, in standard alphabetical (lexicographical) order.

### 1. Preset L1: `{ab, aca, b, ccab}` over $\Sigma = \{a, b, c\}$
- Length 1: `b`
- Length 2: `ab`
- Length 3: `aca`
- Length 4: `ccab`
- **Ordered strings:** `['b', 'ab', 'aca', 'ccab']` (lengths: 1, 2, 3, 4)

### 2. Preset L7: `{ab, bc}` over $\Sigma = \{a, b, c\}$
- Length 2: `ab`, `bc`
- **Ordered strings:** `['ab', 'bc']` (lengths: 2, 2)

### 3. Preset L2: `{ac, c, bab, bcaa}` over $\Sigma = \{a, b, c\}$
- Length 1: `c`
- Length 2: `ac`
- Length 3: `bab`
- Length 4: `bcaa`
- **Ordered strings:** `['c', 'ac', 'bab', 'bcaa']` (lengths: 1, 2, 3, 4)

### 4. Custom Formula: `{a, b}*` over $\Sigma = \{a, b\}$ (First 10)
- Length 0 (1 string): `""` (displayed as `^` or `ε`)
- Length 1 (2 strings): `a`, `b`
- Length 2 (4 strings): `aa`, `ab`, `ba`, `bb`
- Length 3 (first 3 strings): `aaa`, `aab`, `aba`
- **Ordered strings:** `['^', 'a', 'b', 'aa', 'ab', 'ba', 'bb', 'aaa', 'aab', 'aba']` (lengths: 0, 1, 1, 2, 2, 2, 2, 3, 3, 3)

### 5. Custom Formula: `{a, b}*` with Min Length $|w| \ge 2$ (First 10)
- Length 2 (4 strings): `aa`, `ab`, `ba`, `bb`
- Length 3 (6 strings): `aaa`, `aab`, `aba`, `abb`, `baa`, `bab`
- **Ordered strings:** `['aa', 'ab', 'ba', 'bb', 'aaa', 'aab', 'aba', 'abb', 'baa', 'bab']` (lengths: 2, 2, 2, 2, 3, 3, 3, 3, 3, 3)

---

## Precedence and Query Parameter Behavior Finding

In `web/src/routes/sandbox/+page.svelte` (lines 107–119):
```typescript
const urlMode = new URLSearchParams(window.location.search).get('mode');
if (urlMode === 'language' || urlMode === 'grammar' || urlMode === 'fsm') {
    activeMode = urlMode;
} else {
    try {
        const saved = localStorage.getItem('webtomata_sandbox_mode');
        if (saved === 'language' || saved === 'grammar' || saved === 'fsm') {
            activeMode = saved;
        }
    } catch {
        // ignore
    }
}
```
Findings:
1. **URL precedence:** If `?mode=` contains a recognized valid mode (`'language'`, `'grammar'`, `'fsm'`), it takes precedence over any value stored in `localStorage`.
2. **Fallback to localStorage:** If `?mode=` is omitted, or contains an unknown/invalid value (e.g. `?mode=invalid`), it falls back to the valid mode stored in `localStorage.getItem('webtomata_sandbox_mode')`.
3. **Default to FSM:** If both the URL param and `localStorage` are absent or invalid, the active mode defaults to `'fsm'`.
This behavior is fully verified in `switcher.spec.ts`.

---

## Deliberate Breaks (AC5)

### Break 1: ArrowDown wrapping in `WorkstationSwitcher.svelte`
- Modification: replaced `const next = (idx + 1) % buttons.length;` with `const next = Math.min(buttons.length - 1, idx + 1);`.
- Command:
  ```bash
  pnpm --filter web exec playwright test --project=desktop -g "ArrowDown and ArrowUp navigate enabled items and wrap around"
  ```
- Output:
  ```
  1) [desktop] › e2e/switcher.spec.ts:63:2 › workstation mode switcher - keyboard, mouse, and state › ArrowDown and ArrowUp navigate enabled items and wrap around 
    Error: expect(locator).toBeFocused() failed
    Locator:  locator('.switcher-popover[role="listbox"]').locator('button.switcher-item[role="option"]').first()
    Expected: focused
    Received: inactive
      89 | 		// ArrowDown wraps to FSM
      90 | 		await page.keyboard.press('ArrowDown');
    > 91 | 		await expect(optFsm).toBeFocused();
  1 failed
  ```
- Code restored and re-verified.

### Break 2: Enumeration sort order in `LanguageWorkstation.svelte`
- Modification: replaced `results = res.value.strings;` with `results = [...res.value.strings].sort();` (purely alphabetical sorting instead of length-first).
- Command:
  ```bash
  pnpm --filter web exec playwright test --project=desktop -g "preset selection and proper order enumeration against hand derivation"
  ```
- Output:
  ```
  1) [desktop] › e2e/language-flow.spec.ts:64:2 › language workstation enumeration flow (desktop 1280x800) › preset selection and proper order enumeration against hand derivation 
    Error: expect(locator).toHaveText(expected) failed
    Locator:  locator('.string-ordered-list').locator('.string-row').first().locator('.word-text')
    Expected: "b"
    Received: "ab"
      84 | 			const row = rows.nth(i);
      85 | 			await expect(row.locator('.row-num')).toHaveText(`${i + 1}.`);
    > 86 | 			await expect(row.locator('.word-text')).toHaveText(HAND_DERIVED_L1[i]!);
  1 failed
  ```
- Code restored and re-verified.

### Break 3: Disabled handling in `WorkstationSwitcher.svelte`
- Modification: removed `disabled: true` from the PDA entry (`{ id: 'pda', mode: 'fsm', labelKey: 'sandbox.mode_pda' }`).
- Command:
  ```bash
  pnpm --filter web exec playwright test --project=desktop -g "disabled items (PDA, TM) are never focused and clicking them does nothing"
  ```
- Output:
  ```
  1) [desktop] › e2e/switcher.spec.ts:106:2 › workstation mode switcher - keyboard, mouse, and state › disabled items (PDA, TM) are never focused and clicking them does nothing 
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  locator('.switcher-popover[role="listbox"]').locator('.switcher-item.disabled')
    Expected: 2
    Received: 1
     115 |
     116 | 		const disabledItems = popover.locator('.switcher-item.disabled');
   > 117 | 		await expect(disabledItems).toHaveCount(2);
  1 failed
  ```
- Code restored and re-verified.

---

## Verification Outputs

### 1. Static Checks
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
$ pnpm --filter web lint
$ eslint .
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ node tools/check-strings.mjs
ok   63 components have no hard-coded text
```

### 2. Build
```
$ pnpm build:wasm && pnpm --filter web build
$ wasm-pack build crates/engine-wasm --target web --release --out-dir ../../web/src/lib/engine/wasm && pnpm build:types
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.02s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: ✨   Done in 17.83s
[INFO]: 📦   Your wasm pkg is ready to publish at web/src/lib/engine/wasm.
$ cargo test -p engine-core --features ts --test ts_export
running 1 test
test the_types_match_the_json ... ok
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s

$ vite build
vite v8.3.4 building ssr environment for production...
transforming...
✓ 321 modules transformed.
rendering chunks...
✓ built in 1.21s
Prerendering
> Using @sveltejs/adapter-static
Wrote site to "build"
✔ done
```

### 3. New Specs Repeated 5 Times
```
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/language-flow.spec.ts e2e/switcher.spec.ts --repeat-each=5

Running 180 tests using 6 workers

  90 skipped
  90 passed (1.7m)
```

### 4. Area Specs
```
pnpm --filter web exec playwright test --project=desktop --project=phone e2e/language-phone.spec.ts e2e/shell.spec.ts

Running 40 tests using 6 workers

  10 skipped
  30 passed (24.3s)
```
