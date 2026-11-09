# Task T-061 Report — Editing in the Tabel tab of the PDA editor

Branch: `task/T-061-pda-table-editing`, cut from `origin/staging` at `a49611e` (merge of
PR 193, the amended T-061 spec).

Commits:

- `7f7754f` `feat(editor): add the pure part of the editable PDA table (T-061)` — the pure
  module, its tests, the messages, the one export of `pda-label.ts`; the task set to
  `in-progress`.
- `4587913` `feat(editor): edit the transitions of a PDA in the Tabel tab (T-061)` — the three
  blocks, the table view, the editor wiring, the new e2e spec and the one approved edit of
  `pda-panel`.
- The commit after that adds this report, ADR 0051 and the three `proposed` lines. When the
  two questions of section 12 are answered, one last commit carries the answer and sets the
  task to `done`; until then the task stays `in-progress` on purpose.

**Status of the task: not ready to merge yet.** One existing spec fails on the new markup
through an over-broad selector, and one acceptance criterion (AC3, sizes) is over its gate by
92 bytes. Both are questions for the owner, in section 12; the code was not bent to hide either.

## 1. What changed

The read-only table of T-051 became the editable Tabel tab of `design/screens/pda-editor.md`,
section 6, in three blocks under the head block:

- **Alfabet** (`PdaAlphabetBlock.svelte`): the chips of Σ and of Γ, a field and a button to add
  a symbol, a remove button on each chip that takes its transitions with a toast and Urungkan.
  A symbol name that is `eps`, `ε`, or that holds whitespace or a comma is refused before any
  command, with `pda_editor.symbol_reserved` (the amendment of 2026-11-09).
- **State** (`PdaStatesBlock.svelte`): one row for each state — the name (press to rename,
  `Enter` sends, `Esc` cancels), a start radio, an accepting checkbox, a delete button — and
  `+ State`. The words are the FSM table's (`table.state`, `table.start`, `table.accepting`).
- **Transisi (n)** (`PdaTransitionsBlock.svelte`): Dari (a chooser of states), Baca (a chooser
  of the input symbols, ε first), Pop and Push (text fields), Ke (a chooser of states) and a
  delete button in every row, in the engine's order, and `+ Tambah transisi` for a draft row.

`pda-table-edit.ts` is the pure part: the counts for the toast, the placement of a new state
with `freeSpot`, the batch of a row edit, the duplicate check, the draft rule, the reserved
names. `pda-table-props.ts` holds the props type, so `PdaEditor.svelte` can name the lazily
loaded component without loading it. `PdaTableView.svelte` keeps its name, stays the lazy
entry, and is now the container of the three blocks.

Every edit is one command of the document, so undo, the diagram, the definition, the checks
and the autosave follow with no new code. A row edit is one `batch` (new symbols, the remove
of the old row, the add of the new one); a row that would equal another one is refused with its
number instead of being merged away; the rows are keyed by a JSON tuple of their five values
(the draft by `'draft'`), and after a command the row's new index comes from a dry run of the
same command through `applyPdaCommand`, then `tick()` and the focus on the same control.

Files: new `PdaAlphabetBlock.svelte`, `PdaStatesBlock.svelte`, `PdaTransitionsBlock.svelte`,
`pda-table-props.ts`, `pda-table-edit.ts`, `pda-table-edit.test.ts`,
`web/e2e/pda-table-edit.spec.ts`, `docs/decisions/0051-pda-table-editing.md`; edited
`PdaTableView.svelte`, `PdaEditor.svelte`, `pda-label.ts` (one export), `pda-messages.ts`,
`pda-messages.test.ts`, `web/e2e/pda-panel.spec.ts` (one approved line), `docs/agent/PLAN.md`.
No file in `crates/`, no FSM file, and no new string in `id.ts` or `en.ts`.

## 2. Planner approvals during the task (2026-11-09)

These three edits to existing files were approved or forced on 2026-11-09; the planner folds
them into the plan in review.

1. **`web/e2e/pda-panel.spec.ts`** (approved, option (a) of my pre-flight question). One
   assertion of E4, because the value of a text field is not text content:

   ```
   -		// Row 2: q0 a ε A q0
   +		// Row 2: q0 a ε A q0. The Push cell is a field since T-061, so its text is its value.
     		await expect(rows.nth(1)).toContainText('q0');
     		await expect(rows.nth(1)).toContainText('a');
   -		await expect(rows.nth(1)).toContainText('A');
   +		await expect(rows.nth(1).getByRole('textbox', { name: /Baris 2.*Push/i })).toHaveValue('A');
   ```

   Same intent, not weaker: it checks the transition's Push value itself. `tr`, `caption`,
   `th.from`, `.wrap`, `aria-current`, the five column headers and the heading `Transisi (n)`
   are unchanged.

2. **`web/src/lib/i18n/pda-messages.test.ts`, U1** (forced by AC5, not optional): U1 asserts
   that the module holds an exact key list, and the amendment puts 11 more keys in it, so the
   list must grow or AC5's "`pda-messages.test.ts` passes" cannot hold. The diff is the
   comment and the 11 literal lines:

   ```
   -// The 25 keys that T-063 moves out of the shared dictionary (docs/agent/PLAN.md).
   +// The 25 keys that T-063 moves out of the shared dictionary, and the 11 that T-061 adds
   +// (docs/agent/PLAN.md, T-061: the editable Tabel tab).
   ...
   +	'pda_editor.alphabet_input',
   +	'pda_editor.alphabet_stack',
   +	'pda_editor.add_transition',
   +	'pda_editor.state_delete',
   +	'pda_editor.state_removed',
   +	'pda_editor.row_duplicate',
   +	'pda_editor.row_added',
   +	'pda_editor.row_changed',
   +	'pda_editor.row_removed',
   +	'pda_editor.symbol_reserved',
   +	'document.duplicate_symbol'
   ```

   No assertion was weakened: the test still demands an exact set and the two languages.

3. **`web/e2e/pda-editor.spec.ts`**: **not edited** — it needs one, and that is question 1 of
   section 12.

## 3. Tests first

`web/src/lib/editor/pda-table-edit.test.ts` before `pda-table-edit.ts` existed:

```
 ❯ src/lib/editor/pda-table-edit.test.ts (0 test)

⎯⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/lib/editor/pda-table-edit.test.ts [ src/lib/editor/pda-table-edit.test.ts ]
Error: Cannot find module './pda-table-edit.ts' imported from /home/Aldebaran64/webtomata-ds/web/src/lib/editor/pda-table-edit.test.ts
 ❯ src/lib/editor/pda-table-edit.test.ts:15:1
 Test Files  1 failed (1)
```

`web/e2e/pda-table-edit.spec.ts` before the blocks existed (desktop, `10 failed, 1 skipped`):

```
  ✘   3 [desktop] › e2e/pda-table-edit.spec.ts:99:2 › E1: the Alfabet block › adds c, refuses eps / a b / a,b, … (10.3s)
  ✘   1 [desktop] › e2e/pda-table-edit.spec.ts:289:2 › E4: the draft row › the draft keeps what was typed … (30.3s)
  ✘   6 [desktop] › e2e/pda-table-edit.spec.ts:243:2 › E4: the draft row › Dari alone sends nothing, Ke sends it, … (30.3s)
  ✘   5 [desktop] › e2e/pda-table-edit.spec.ts:217:2 › E3: a row that moves › F4 on H: … (10.6s)
    Error: expect(locator).toHaveCount(expected) failed
    Locator:  getByRole('complementary', { name: 'Panel' }).getByRole('group', { name: 'Alfabet input Σ' }).locator('.chip')
    Expected: 2
    Received: 0
      107 | 		// The two alphabets of F, as chips.
    > 108 | 		await expect(sigma.locator('.chip')).toHaveCount(2);
           | 		                                     ^
  10 failed
   1 skipped
```

## 4. U, R and E1 to E8

```
$ pnpm --filter web exec vitest run src/lib/editor/pda-table-edit.test.ts src/lib/i18n
 ✓ src/lib/i18n/pda-messages.test.ts (6 tests) 32ms
 ✓ src/lib/i18n/i18n.test.ts (14 tests) 63ms
 ✓ src/lib/editor/pda-table-edit.test.ts (16 tests) 20ms
 Test Files  3 passed (3)
      Tests  36 passed (36)
```

`pda-table-edit.test.ts` (U1 to U13, R1 to R3) checks: F1 the batch of a Push edit and no new
symbol; F2 the duplicate refused with `n` = 2 and the document untouched; F3
`addStackSymbol(B)`, remove, add, and Γ `["A","B"]`; F4 the edited row at index 1 of H and the
whole document in `comparePdaTransitions` order; F5 the counts 2 / 3 / 2 and what
`removeState` really takes; F6 the plain `addTransition` landing at row 1; a row that changes
nothing gives `null`; an index out of the table gives `null`; a draft with one state or with
none gives `null`; a draft with a new stack symbol is the batch; a draft that is already a row
is refused; a new state never within 72 px of another and `{200, 200}` on an empty document;
the six reserved names refused and five ordinary names accepted; R1/R2 every text the table
can show has both languages and the same parameters; R3 the 11 new keys are in
`pda-messages.ts` only.

The e2e spec (desktop `10 passed, 1 skipped` in the final run; the phone project runs all of
them): E1 the alphabet, the three reserved names, the removal with its toast and one
Urungkan; E2 rename with Enter, a name in use refused under the field, the start radio, the
accepting checkbox, `+ State` 72 px away from the others, delete with its count and Urungkan;
E3 F4 on H, the row at 2 and the focus on its Dari; E4 the draft (Dari alone sends nothing,
Ke sends, focus and announcement, the keyboard only, it survives other edits, and a Dari whose
state is removed goes back to the placeholder); E5 the duplicate under the row (proved against
the Definisi tab) and 65 symbols with `aria-invalid`; E6 F1 and F3 each one Urungkan; E7 axe
and the phone sizes; E8 `+ n lagi` marks four rows and an edit clears them.

## 5. The seven deliberate breaks, on the final code

Each was made on the committed code, built, run against the spec that must catch it, and then
removed (`git checkout --`); the tree was verified clean afterwards.

**B1 — send a Pop edit as separate `apply` calls** (`PdaTransitionsBlock.svelte`):

```
-		const refused = onapply(result, {
-			say: { key: 'pda_editor.row_changed', params: { n: (landed < 0 ? index : landed) + 1 } }
-		});
+		const pieces = result.type === 'batch' ? result.commands : [result];
+		const refused = pieces.reduce<{ key: MessageKey; params: Params } | null>(
+			(sofar, one) => onapply(one) ?? sofar,
+			null
+		);
```

```
  ✘  [desktop] › e2e/pda-table-edit.spec.ts:395:2 › E6: one edit is one undo step › F1 and F3 are each one Urungkan…
    Error: expect(locator).toHaveValue(expected) failed
    Expected: "A"
    Received: "ε"
    > 405 | 		await expect(field(page, 1, 'Push')).toHaveValue('A');
```

**B2 — key the rows by index and do not move the focus** (`PdaTransitionsBlock.svelte`):

```
-		await focusRow(landed < 0 ? index : landed, field);
+		void landed;
...
-					{#each rows as row (row.key)}
+					{#each rows as row, position (position)}
```

```
  ✘  [desktop] › e2e/pda-table-edit.spec.ts:248:2 › E3: a row that moves › F4 on H: …
    Error: expect(locator).toBeFocused() failed
    Expected: focused
    Received: inactive
    > 259 | 		await expect(movedFrom).toBeFocused();
```

**B3 — remove the duplicate refusal** (`pda-table-edit.ts`):

```
-	const duplicate = duplicateRow(doc, fields.from, fields.to, wanted, index);
-	if (duplicate !== null) return refuse('pda_editor.row_duplicate', { n: duplicate + 1 });
```

```
  ✘  [desktop] › e2e/pda-table-edit.spec.ts:361:2 › E5: refusals › F2 shows the duplicate under the row, …
    Error: expect(locator).toBeVisible() failed
    Error: element(s) not found
    > 369 | 		await expect(panel(page).getByText('Transisi itu sudah ada di baris 2.')).toBeVisible();
```

**B4 — send the draft as soon as Dari is chosen** (`pda-table-edit.ts`):

```
-	if (fields.from === null || fields.to === null) return null;
+	if (fields.from === null) return null;
...
-	const duplicate = duplicateRow(doc, fields.from, fields.to, wanted, null);
+	const duplicate = duplicateRow(doc, fields.from, fields.to ?? fields.from, wanted, null);
```

```
  ✘  [desktop] › e2e/pda-table-edit.spec.ts:274:2 › E4: the draft row › Dari alone sends nothing, Ke sends it, …
    Error: expect(locator).toHaveCount(expected) failed
    Expected: 4
    Received: 5
    > 289 | 		await expect(rows(page)).toHaveCount(4);
```

**B5 — the toast of a removed symbol with a count of 0** (`PdaAlphabetBlock.svelte`):

```
-		const count = symbolUseCount(doc, symbol, kind);
+		const count = 0;
```

```
  ✘  [desktop] › e2e/pda-table-edit.spec.ts:130:2 › E1: the Alfabet block › adds c, refuses eps / a b / a,b, …
    Error: expect(locator).toContainText(expected) failed
    Expected substring: "Simbol b dihapus, beserta 2 transisi."
    Received string:    "Simbol b dihapus, beserta 0 transisi. Urungkan"
    > 170 | 		await expect(toast(page)).toContainText('Simbol b dihapus, beserta 2 transisi.');
```

**B6 — the Pop field at 14 px** (`PdaTransitionsBlock.svelte`):

```
 	.f-pop,
 	.f-push {
 		width: 5rem;
+		font-size: 14px;
 	}
```

```
  ✘  [phone] › e2e/pda-table-edit.spec.ts:427:2 › E7: touch sizes, sideways scroll and axe › phone: every control …
    Error: field 2
    Expected: >= 16
    Received:    14
    > 453 | 			expect(size, `field ${i}`).toBeGreaterThanOrEqual(16);
```

**B7 — delete a state without the toast** (`PdaStatesBlock.svelte`):

```
-		const refused = onapply(
-			{ type: 'removeState', id },
-			{ say: { key: 'pda_editor.state_removed', params: { name, count } }, toast: true }
-		);
+		void count;
+		const refused = onapply({ type: 'removeState', id });
```

```
  ✘  [desktop] › e2e/pda-table-edit.spec.ts:180:2 › E2: the State block › renames with Enter, refuses a name in use, …
    Error: expect(locator).toContainText(expected) failed
    Expected substring: "State q0 dihapus, beserta 2 transisi."
    Error: element(s) not found
    > 239 | 		await expect(toast(page)).toContainText('State q0 dihapus, beserta 2 transisi.');
```

The tree after the seven breaks, with every one removed:

```
$ git status --short
?? docs/decisions/0051-pda-table-editing.md
$ git diff --stat
(nothing)
```

## 6. The F-shared specs (AC2)

```
$ pnpm --filter web exec playwright test pda-table-edit pda-panel pda-editor pda-storage \
    pda-messages switcher editor-checks editor-panel editor-table --project=desktop
  1 failed
  20 skipped
  52 passed (52.3s)
  ✘ 34 [desktop] › e2e/pda-editor.spec.ts:269:2 › E4: + n lagi overflow button behavior › select tool selects edge; delete tool deletes edge on + n lagi press
```

```
$ pnpm --filter web exec playwright test pda-table-edit pda-panel pda-editor pda-storage \
    pda-messages --project=phone
  9 skipped
  31 passed (34.2s)
```

```
$ pnpm --filter web exec playwright test pda-storage --project=webkit-phone
  6 passed (6.3s)
```

The one desktop failure is the question of section 12, item 1: `pda-editor` E4 picks the
delete tool with `page.getByRole('button', { name: /^Hapus/ })`, and three of the new
accessible names start with "Hapus" (`table.remove_symbol`, `pda_editor.state_delete`,
`pda_editor.row_delete` — keys the plan tells me to reuse), so the locator matches 14 buttons:

```
    Error: locator.click: Error: strict mode violation: getByRole('button', { name: /^Hapus/ }) resolved to 14 elements:
        1) <button … class="tool has-tip">…</button> aka getByRole('button', { name: 'Hapus', exact: true })
        2) <button … aria-label="Hapus simbol a" class="remove svelte-10iy50m">…</button>
       10) <button … aria-label="Hapus state q0" class="delete svelte-14vi5dv">…</button>
    > 324 | 		const deleteBtn = page.getByRole('button', { name: /^Hapus/ });
```

`pda-panel`, `pda-editor` (E1, E2, E3, E5, E6, E7 and the rest of E4), `pda-messages`,
`pda-storage`, `switcher`, `editor-checks`, `editor-panel` and `editor-table` pass unedited.

## 7. Checks (AC6)

```
$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!

$ pnpm check
svelte-check found 0 errors and 0 warnings

$ pnpm lint
$ eslint .
(no output: no error)

$ node tools/check-strings.mjs
ok   74 components have no hard-coded text

$ node tools/check-tokens-usage.mjs
ok   76 files use no raw colors
```

The whole Vitest suite, alone, before the commit (`pnpm --filter web exec vitest run`):

```
 Test Files  113 passed (113)
      Tests  1332 passed | 3 skipped (1335)
   Duration  12.67s
```

## 8. Sizes (AC3) — over the gate by 92 bytes, and why

Same machine, clean builds of `origin/staging` (`3a1c1c9`) and of this branch, in
`~/tmp/T-061-baseline` and in the working tree:

| route | before (KB gzip) | after (KB gzip) | delta |
| --- | --- | --- | --- |
| `index.html` | 81.4 | 81.5 | +0.1 |
| `panduan.html` | 82.3 | 82.3 | 0 |
| `sandbox.html` | 124.5 | **124.7** | **+0.2** |
| `soal.html` | 83.7 | 83.7 | 0 |
| `soal/berakhiran-10.html` | 123.9 | 124.1 | +0.2 |
| `soal/jumlah-a-genap.html` | 123.9 | 124.1 | +0.2 |
| `soal/mengandung-101.html` | 123.9 | 124.1 | +0.2 |
| `tentang.html` | 81.6 | 81.6 | 0 |

Chunks (raw / gzip, zlib level 9):

| role | before | after |
| --- | --- | --- |
| shared dictionary | 111,884 / 31,158 | 111,884 / **31,158** (byte-identical) |
| PDA mode, incl. `pda-messages` | 21,185 / 7,545 | 22,069 / 7,740 |
| transitions table (lazy, new) | 2,478 / 1,067 | 19,330 / 5,978 |
| definition (lazy) | 2,793 / 1,158 | 2,793 / 1,157 |

What the growth is, proved by an experiment: the exact bytes of `sandbox.html`'s first load
are 127,628 gzip now against 127,432 on `origin/staging` (+196). The set of chunks changed
like this:

```
GONE  HRPVxpbz.js 32170        (the chunk that held the editor and the PDA document)
NEW   DGFXRyeR.js 28957        (the same, without pda-document)
NEW   C9VrHXEV.js  3369        (pda-document, its own chunk)
NEW   app.* +13, 5.* +27       (the two shared chunks, renumbered)
```

`pda-document.ts` was **already in the sandbox first load** before this task (it sits in
`D_geX4Vz.js` and in the editor chunk, because `history.ts` holds both `createHistory` and
`createPdaHistory`). The lazy table chunk now imports `pda-commands.ts` for the dry run, which
is a third consumer, so Rollup hoists `pda-document` into a chunk of its own: no module enters
the first load, but the split costs 196 bytes of chunk prologue. Two controls:

- taking the dry run out entirely gives exactly 127,444 bytes = 124.5 KB = the baseline
  (`sandbox.html` first JS gzip bytes: 127444 = 124.5 KB), and
- making the dry run a dynamic import does **not** help (127,657 = 124.7 KB).

So the 0.2 KB is the price of the newly announced row number and of the focus that follows a
row: both need the row's index *after* the command, i.e. a dry run of the batch before
`onapply` is called. The 170 KB budget is untouched (124.7 KB), the shared dictionary is
byte-identical, and no route downloads a module it did not download before. The gate the
planner set for the task (0.1 KB) is missed by 92 bytes on four routes. Question 2 of
section 12.

## 9. Deepening pass

New exports and interface members:

| export | can it be private? | already done elsewhere? | duplicated logic |
| --- | --- | --- | --- |
| `symbolUseCount(doc, symbol, kind)` | no, the block calls it | the FSM has `removeSymbolNote`, which counts only `on`; the PDA needs the stack side too | no |
| `stateUseCount(doc, id)` | no, the block calls it | nothing in the repo counts a state's transitions | no |
| `addStateCommand(doc)` | no, the block calls it | `table.ts`'s `newStateCommand` says the same for `MachineDocument` | **yes, 6 lines**, because the non-goals forbid touching `table.ts`; logged as `proposed` |
| `editRowCommand(doc, index, fields)` | no | `rowCommands` of the label form is edge-scoped and merges duplicates | no (it calls `parseRows`) |
| `draftCommand(doc, fields)` | no | no | reuses `newSymbolCommands` and `duplicateRow` internally with `editRowCommand` |
| `symbolNameRefusal(text)` | no, the block calls it | `pda-label.ts` had the two words inline; it now exports `EPSILON_WORDS` and both use it | no |
| `RowFields`, `SymbolKind` | types only | — | — |
| `PdaTableApply`, `PdaTableProps` | types only, needed to name the lazy component | mirrors `TableViewProps` deliberately (the spec says "the same shape") | no |
| `EPSILON_WORDS` (`pda-label.ts`) | no, the table needs it | it replaced two inline comparisons in the same file, so it is one fact in one place | no |

The interface is smaller than the work behind it: five functions and two types for three
blocks. Nothing is exported only for a test: the tests call the same five functions the
components call. Casts added: **one**, in `pda-table-edit.test.ts`, the named helper `textOf`
that reads a dictionary by a key of the union of both dictionaries, with a comment.

Two duplications that stay, with the reason: (1) `addStateCommand` repeats
`newStateCommand`'s placement because the FSM file is out of scope — a `proposed` line in
`PLAN.md` suggests widening `newStateCommand`'s parameter to `StatesDocument` in a later task;
(2) `PdaTableView.svelte` and `pda-table-props.ts` mirror their FSM twins, which the plan asked
for by name.

## 10. What I did not run, and why

- The full e2e suite (`pnpm test:e2e`, `pnpm test:e2e:cross`): `AGENTS.md` forbids it on the
  worker's machine; the area's specs are in sections 6 and 4.
- Firefox: it does not start on the owner's laptop; CI runs it.
- Lighthouse and the smoke test: no layout, route or font change; CI runs them.

## 11. Out of scope, logged as `proposed`

1. **T-066** `newStateCommand` of `table.ts` is typed for `MachineDocument` although it only
   needs `states`; widening it to `StatesDocument` would remove the six duplicated lines.
2. **T-067** `web/e2e/pda-panel.spec.ts:450` has the same over-broad `{ name: /^Hapus/ }` as
   `pda-editor.spec.ts:324`. It passes today only because the panel is not in the DOM at that
   point of the test; it is a trap for the next task that adds a "Hapus …" button.
3. **T-068** `history.ts` (which the first load needs) imports `pda-commands.ts` and
   `pda-document.ts` for `createPdaHistory`, so the whole PDA document layer is in the first
   load of every route. Splitting the two histories would shrink `index.html`, `soal.html` and
   `panduan.html` and would let this task's dry run cost nothing.
4. `document.duplicate_symbol` has no text in the shared dictionary, so the FSM table shows the
   raw key when a symbol is added twice (the PDA table now has a text, in `pda-messages.ts`).
   The planner already filed that as T-065.

## 12. Questions for the owner (the task is not ready to merge until they are answered)

1. **`web/e2e/pda-editor.spec.ts` line 324** fails through a strict-mode violation, not an
   assertion: `const deleteBtn = page.getByRole('button', { name: /^Hapus/ });` now matches 14
   buttons. May I change that one line to the form the FSM's own edge test already uses,
   `page.getByRole('button', { name: 'Hapus', exact: true })`, with a comment that the tool is
   meant and not one of the panel's buttons (`editor-edges.spec.ts:163` does exactly this)? No
   assertion changes.
2. **AC3 is over its gate by 92 bytes** (+0.2 KB on `sandbox.html` and the three question
   pages that embed the editor, +0.1 KB on `index.html`), caused by Rollup re-splitting the
   editor chunk around `pda-document.ts` when the lazy table chunk starts importing
   `pda-commands.ts` for the dry run (section 8). The 170 KB budget holds and no module is new
   in the first load. Three ways forward, my recommendation is (a):
   - (a) accept the 0.2 KB as a one-time exception, as T-051's 0.54 KB was;
   - (b) drop the dry run: the announcement then says the row's *old* number when an edit moves
     it (F4 would announce "Baris 1" for what is now row 2), and the focus still follows the
     row after `tick()`;
   - (c) let `onapply` hand the new document back to the table (a change to the props contract
     the plan fixed: "the same shape as `TableViewProps.onapply`"), which removes the dry run
     and the cost.
