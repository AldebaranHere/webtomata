# T-065 — Symbol names: refuse the ε word in the document, and the missing text of `document.duplicate_symbol`

Branch `task/T-065-symbol-names`, cut from `origin/staging` at `1b7fc81` (PR 234, amended spec).
Commits: `59cd0f9` (`in-progress`), `7d80bf8` (implementation & tests), `HEAD` (ADR 0062, `DECISIONS.md`, `REPORT.md`, `PLAN.md` `done`).
Status: `done`. **Not pushed:** awaiting owner review.

## 1. What changed

| File                                                       | Change                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/src/lib/editor/document.ts`                           | Exported `EPSILON_WORDS: readonly string[] = ['eps', 'ε']` (single source of truth) and added `checkNewSymbol(symbol)` calling `checkSymbol` and refusing `EPSILON_WORDS` with `document.reserved_symbol { symbol }`. `checkSymbol` and `checkDocument` are unchanged.                   |
| `web/src/lib/editor/commands.ts`                           | `addSymbol` now calls `checkNewSymbol(command.symbol)`.                                                                                                                                                                                                                                  |
| `web/src/lib/editor/pda-commands.ts`                       | `addInputSymbol` and `addStackSymbol` now call `checkNewSymbol(command.symbol)`. `addTransition` keeps `checkSymbol` so legacy PDAs carrying `eps` in their alphabet still work.                                                                                                         |
| `web/src/lib/editor/pda-label.ts`                          | Removed its copy of `EPSILON_WORDS` and imported `EPSILON_WORDS` from `./document.ts`.                                                                                                                                                                                                   |
| `web/src/lib/editor/interaction/label.ts`                  | Removed private `const EPSILON_WORDS = new Set(['eps', 'ε'])` and imported `EPSILON_WORDS` from `../document.ts` (`EPSILON_WORDS.includes(word)`).                                                                                                                                       |
| `web/src/lib/editor/pda-table-edit.ts`                     | Removed `EPSILON_WORDS` check (and unused import) from `symbolNameRefusal`; it now refuses only whitespace and commas (`pda_editor.symbol_reserved`).                                                                                                                                    |
| `web/src/lib/i18n/id.ts`                                   | Added ASCII-only `'document.reserved_symbol'` (`'{symbol} berarti ε, jadi tidak bisa dipakai sebagai nama simbol.'`) and moved `'document.duplicate_symbol'` (`'Simbol {symbol} sudah ada.'`).                                                                                           |
| `web/src/lib/i18n/en.ts`                                   | Added ASCII-only `'document.reserved_symbol'` (`'{symbol} means ε, so it cannot be a symbol name.'`) and moved `'document.duplicate_symbol'` (`'Symbol {symbol} already exists.'`).                                                                                                      |
| `web/src/lib/i18n/pda-messages.ts`                         | Removed `'document.duplicate_symbol'` from `pdaId`/`pdaEn` and shortened `'pda_editor.symbol_reserved'` to `'Nama simbol tidak boleh berisi spasi atau koma.'` / `'A symbol name cannot contain spaces or commas.'`.                                                                     |
| `web/src/lib/editor/document.test.ts`                      | Added unit tests for `EPSILON_WORDS`, `checkNewSymbol`, `checkSymbol('eps')`, and F2 legacy readers (`readStoredDocument`, `parseDocumentText`, `encodePlainLink`/`decodeLink`, `readStoredPda`, `parsePdaDocumentText`).                                                                |
| `web/src/lib/editor/commands.test.ts`                      | Added F1 test: `addSymbol` refuses `eps` with `document.reserved_symbol { symbol: 'eps' }`, keeps `ε` as `document.invalid_symbol`, accepts `a`.                                                                                                                                         |
| `web/src/lib/editor/pda-commands.test.ts`                  | Added F1 test for `addInputSymbol`/`addStackSymbol` and verified legacy PDA `addTransition` with `eps` still succeeds.                                                                                                                                                                   |
| `web/src/lib/editor/pda-table-edit.test.ts`                | Updated `symbolNameRefusal` test for F4 (and pinned `' eps '.trim()` → `document.reserved_symbol`), extended `TABLE_KEYS` with `document.reserved_symbol`, and updated `R3` to reflect `document.duplicate_symbol` + `document.reserved_symbol` moving to `id`/`en` (approved in Scope). |
| `web/src/lib/i18n/pda-messages.test.ts`                    | Removed `'document.duplicate_symbol'` from `PDA_KEYS` (approved in Scope).                                                                                                                                                                                                               |
| `web/src/lib/editor/pda-label.test.ts`                     | **Existing test edited (owner-approved):** built legacy `docEps` (Probe 4) via `parsePdaDocument` instead of `pdaDocumentFrom`, because `pdaDocumentFrom` runs `addStackSymbol` which now refuses `eps`.                                                                                 |
| `web/src/lib/editor/pda-label.property.test.ts`            | **Existing test edited (owner-approved):** removed `'eps'` from `ADVERSARIAL_SYMBOLS` with a one-line comment pointing to the legacy case in `pda-label.test.ts` (`makeRandomPda` unchanged), because `pdaDocumentFrom` now refuses `eps`.                                               |
| `web/e2e/pda-table-edit.spec.ts`                           | Updated E1 (F4) to assert the document's text for `eps` and the shortened `pda_editor.symbol_reserved` text for `a b` and `a,b` (approved in Scope).                                                                                                                                     |
| `web/e2e/editor-table.spec.ts`                             | Added F3 e2e test verifying FSM table shows localized `document.duplicate_symbol` (not the raw key) and `document.reserved_symbol` in both `id` and `en`.                                                                                                                                |
| `docs/decisions/0062-symbol-names-refuse-epsilon-words.md` | ADR recording the `checkNewSymbol` split, single `EPSILON_WORDS`, shared dictionary move, and the 2026-11-23 +130 B size-cap ruling.                                                                                                                                                     |
| `docs/agent/DECISIONS.md`                                  | Appended T-065 decision entry.                                                                                                                                                                                                                                                           |
| `docs/agent/PLAN.md`                                       | Marked T-065 `in-progress` in first commit and `done` in last commit.                                                                                                                                                                                                                    |

## 2. Fixture derivations (F1–F4)

- **F1:** `checkNewSymbol('eps')` passes `checkSymbol('eps')` (3 ASCII letters, not `ε`), then hits `EPSILON_WORDS.includes('eps')` → `{ ok: false, error: { key: 'document.reserved_symbol', params: { symbol: 'eps' } } }`. `checkNewSymbol('ε')` hits `checkSymbol('ε')` first → `{ ok: false, error: { key: 'document.invalid_symbol', params: { symbol: 'ε', reason: 'epsilon' } } }`. `addSymbol`, `addInputSymbol`, and `addStackSymbol` all call `checkNewSymbol`; `'a'` / `'A'` pass.
- **F2:** Legacy FSM JSON (`alphabet: ['eps']`, transition `0 --eps--> 1`) and legacy PDA JSON (`inputAlphabet: ['eps']`, `stackAlphabet: ['eps']`, transition `0 --eps, eps/eps--> 1`) are validated through `checkDocument` / `parsePdaDocument`, which call `checkSymbol` (not `checkNewSymbol`). All five readers (`readStoredDocument`, `parseDocumentText`, `decodeLink(encodePlainLink(...))`, `readStoredPda`, `parsePdaDocumentText`) return `ok: true` with `'eps'` intact in the alphabets, and `checkSymbol('eps')` returns `{ ok: true }`.
- **F3:** Adding existing symbol `'0'` in the FSM table calls `addSymbol('0')` → `{ key: 'document.duplicate_symbol', params: { symbol: '0' } }`, formatted via shared `id.ts`/`en.ts` as `Simbol 0 sudah ada.` (`id`) and `Symbol 0 already exists.` (`en`), never the raw key. `TABLE_KEYS` in `pda-table-edit.test.ts` (R1/R2) covers every refusal key of both tables (now including `document.reserved_symbol`) across `id` and `en` with matching parameters.
- **F4:** In `PdaAlphabetBlock.svelte`, `drafts[kind].trim()` turns `' eps '` → `'eps'`. `symbolNameRefusal` returns `null` for `'eps'`, `'ε'`, and `' eps '` and returns `pda_editor.symbol_reserved` (`Nama simbol tidak boleh berisi spasi atau koma.`) for `'a b'`, `'a,b'`, `'a\tb'`. `'eps'` then reaches `addInputSymbol`/`addStackSymbol` and displays `eps berarti ε, jadi tidak bisa dipakai sebagai nama simbol.`.

## 3. Tests first (AC1): RED run on `staging`

Before editing any production file, the new/updated unit tests were run on `origin/staging` (`1b7fc81`):

```text
 Test Files  5 failed (5)
      Tests  8 failed | 91 passed (99)

 FAIL  src/lib/editor/commands.test.ts > the alphabet > addSymbol refuses the ε word eps with document.reserved_symbol
 FAIL  src/lib/editor/document.test.ts > the rules for symbols (the same as the engine) > checkNewSymbol refuses ε words with document.reserved_symbol while checkSymbol keeps accepting eps
 FAIL  src/lib/editor/pda-commands.test.ts > PDA alphabets and cascade removal > addInputSymbol and addStackSymbol refuse eps with document.reserved_symbol while keeping addTransition working for legacy eps
 FAIL  src/lib/editor/pda-table-edit.test.ts > U: the commands of the editable table > refuses spaces and commas, and leaves ε words to the document command
 FAIL  src/lib/editor/pda-table-edit.test.ts > R: every text that the table can show exists in both languages > R1
 FAIL  src/lib/editor/pda-table-edit.test.ts > R: every text that the table can show exists in both languages > R2
 FAIL  src/lib/editor/pda-table-edit.test.ts > R: every text that the table can show exists in both languages > R3
 FAIL  src/lib/i18n/pda-messages.test.ts > the PDA messages > U1: have the same keys in Indonesian and English
```

## 4. Deepening pass

- **New exports / public interface members:**
  1. `EPSILON_WORDS: readonly string[]` in `web/src/lib/editor/document.ts`: moved from `pda-label.ts` (so the shared FSM bundle never imports from the lazy PDA chunk). Imported by `pda-label.ts` and `interaction/label.ts`, and used internally by `checkNewSymbol`. Cannot be private because both label parsers share it; eliminates the previous duplicate `Set` in `interaction/label.ts`. (Not imported in `pda-table-edit.ts` because `symbolNameRefusal` no longer checks ε words.)
  2. `checkNewSymbol(symbol: string): Check` in `web/src/lib/editor/document.ts`: called by `commands.ts` (`addSymbol`) and `pda-commands.ts` (`addInputSymbol`, `addStackSymbol`). Cannot be private because those callers live in sibling modules; reuses `checkSymbol` with zero duplicated validation logic.
- **Duplication check:** Zero copies of `EPSILON_WORDS` remain outside `document.ts`; `symbolNameRefusal` no longer duplicates the ε-word refusal; `document.duplicate_symbol` exists in one dictionary (`id.ts`/`en.ts`) only.
- **Type casts added:** **0** (`any`, `@ts-ignore`, `as unknown as`: 0).

## 5. Route sizes in gzip bytes (AC3)

Baseline measured from a clean build of `origin/staging` (`960cecc`, identical build output to `1b7fc81`) vs final build.
**Size-cap ruling (2026-11-23):** The initial +102 B cap was exceeded (+111 B to +124 B per route) because moving `document.duplicate_symbol` into the shared dictionary, adding `document.reserved_symbol` in both languages, and moving `EPSILON_WORDS`/`checkNewSymbol` into `document.ts` inherently costs ~120 B gzip on every route. By planner/owner ruling on 2026-11-23, AC3 for T-065 was raised to **≤ +130 B per route** without shortening the texts.

| Route                       | Before (bytes) | After (bytes) |  Delta |
| --------------------------- | -------------: | ------------: | -----: |
| `index.html`                |         83,867 |        83,989 | +122 B |
| `panduan.html`              |         83,016 |        83,138 | +122 B |
| `panduan/berakhiran-x.html` |         89,399 |        89,523 | +124 B |
| `sandbox.html`              |        124,870 |       124,986 | +116 B |
| `soal.html`                 |         84,510 |        84,628 | +118 B |
| `soal/berakhiran-10.html`   |        124,209 |       124,320 | +111 B |
| `soal/jumlah-a-genap.html`  |        124,209 |       124,320 | +111 B |
| `soal/mengandung-101.html`  |        124,209 |       124,320 | +111 B |
| `tentang.html`              |         82,314 |        82,438 | +124 B |
| `wasm`                      |       236.9 KB |      236.9 KB |    0 B |

```text
$ node tools/check-size.mjs
ok   initial JS index.html: 82.0 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 87.4 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 81.2 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 122.1 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 121.4 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 121.4 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 121.4 KB gzip (limit 170 KB)
ok   initial JS soal.html: 82.6 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 80.5 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-Ii0Gidl3.wasm: 236.9 KB gzip (limit 250 KB)
```

## 6. Deliberate breaks on final code (AC4)

All four breaks were run against final commit `7d80bf8` and restored cleanly:

- **B1 — `addSymbol` accepts `eps` again** (`web/src/lib/editor/commands.ts`):

  ```diff
  -	checkNewSymbol,
  +	checkSymbol,
  -			const bad = failed(checkNewSymbol(command.symbol));
  +			const bad = failed(checkSymbol(command.symbol));
  ```

  ```text
  FAIL  src/lib/editor/commands.test.ts > the alphabet > addSymbol refuses the ε word eps with document.reserved_symbol
  AssertionError: expected { ok: true, doc: { …(9) } } to deeply equal { ok: false, error: { …(2) } }
  ```

- **B2 — reader refuses a stored `eps`** (`web/src/lib/editor/document.ts`):

  ```diff
  -		rule('symbol', checkSymbol(symbol).ok, { symbol });
  +		rule('symbol', checkNewSymbol(symbol).ok, { symbol });
  ```

  ```text
  FAIL  src/lib/editor/document.test.ts > the rules for symbols (the same as the engine) > legacy stored records, JSON files and share links carrying symbol eps still load
  AssertionError: expected { ok: false, reason: 'corrupt' } to deeply equal { ok: true, doc: { …(9) } }
  ```

- **B3 — table's `eps` branch put back** (`web/src/lib/editor/pda-table-edit.ts`):

  ```diff
  -	if (/\s/.test(name) || name.includes(',')) {
  +	if (name === 'eps' || /\s/.test(name) || name.includes(',')) {
  ```

  ```text
  FAIL  src/lib/editor/pda-table-edit.test.ts > U: the commands of the editable table > refuses spaces and commas, and leaves ε words to the document command
  AssertionError: name "eps": expected { …(2) } to be null // Object.is equality
  ```

- **B4 — `document.duplicate_symbol` loses its `en` text** (`web/src/lib/i18n/en.ts`):
  ```diff
  -	'document.duplicate_symbol': 'Symbol {symbol} already exists.',
  ```
  ```text
  FAIL  src/lib/i18n/i18n.test.ts > the messages > have the same keys in Indonesian and English
  AssertionError: expected [ 'app.name', 'app.privacy', …(897) ] to deeply equal [ 'app.name', 'app.privacy', …(898) ]
  ```

## 7. Verification output (AC2, AC5)

```text
$ pnpm lint
$ eslint .

$ pnpm check
svelte-check found 0 errors and 0 warnings

$ pnpm test:web
 Test Files  122 passed (122)
      Tests  1432 passed | 2 skipped (1434)

$ pnpm check:strings
ok   76 components have no hard-coded text

$ pnpm check:tokens
ok   78 files use no raw colors

$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!
```

Playwright specs named in pre-flight (`e2e/pda-table-edit.spec.ts`, `e2e/editor-table.spec.ts`, `e2e/cross/table.spec.ts`) on `desktop` and `phone`, plus 5× repeat of the new test:

```text
$ pnpm --filter web exec playwright test e2e/pda-table-edit.spec.ts e2e/editor-table.spec.ts e2e/cross/table.spec.ts --project=desktop --project=phone
  3 skipped
  59 passed (1.0m)

$ pnpm --filter web exec playwright test e2e/editor-table.spec.ts -g "localized refusals" --project=desktop --project=phone --repeat-each=5
  10 passed (16.2s)
```

Not run locally: full Playwright suite (CI runs all 4 shards) and Firefox (cannot start on the owner's laptop per `AGENTS.md`).
