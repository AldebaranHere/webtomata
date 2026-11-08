# Task T-063 Report — Load the PDA messages only in the PDA mode

Branch: `task/T-063-lazy-pda-messages`, cut from `origin/staging` at `f166898`
(merge of PR 189, the amended spec).

Commits:

- `0e3182e` `test(i18n): add failing PDA message tests before the split` — the tests
  first, with the task set to `in-progress`.
- `32a215d` `feat(i18n): load the PDA messages only in the PDA mode` — the code, the two
  existing test edits and ADR 0050.
- The last commit adds this report and sets the task to `done`.

## 1. What changed, and what did not

Moved exactly 25 keys from `web/src/lib/i18n/id.ts` and `en.ts` to the new lazy module
`web/src/lib/i18n/pda-messages.ts`, which registers both languages as a side effect and is
imported once, by `PdaWorkstation.svelte` (`#lib/i18n/pda-messages.ts`). No text and no key
name changed: the strings in `pda-messages.ts` are copied byte for byte from `id.ts`/`en.ts`.

`translate.ts` gains `addMessages(locale, dictionary)`, which fills a private `extra` table;
`translate` reads `MESSAGES[locale][key] ?? extra[locale][key] ?? key`. `id` and `en` are
never mutated (amended decision of 2026-11-09; Vitest runs with `isolate: false`).

`MessageKey` is now `keyof typeof id | keyof typeof pdaId`; `pdaId` is imported with
`import type`, so nothing of the module reaches the first load through the type.
`en` is typed `Record<keyof typeof id, string>`, `pdaEn` is `Record<keyof typeof pdaId, string>`.

Files: new `web/src/lib/i18n/pda-messages.ts`, `web/src/lib/i18n/pda-messages.test.ts`,
`web/e2e/pda-messages.spec.ts`, `docs/decisions/0050-lazy-pda-messages.md`; edited
`id.ts`, `en.ts`, `translate.ts`, `PdaWorkstation.svelte`, `diagram/pda-diagram.test.ts`,
`pda-checks.test.ts`, `i18n.test.ts`, `docs/agent/PLAN.md`. No file in `crates/` and no
e2e spec other than the new one was touched (`git diff --stat` below).

## 2. Planner approvals during the task (2026-11-09)

The owner approved these four edits to existing files during the task; the planner folds
them into `PLAN.md` in review.

1. **`i18n.test.ts`** (needed because `MessageKey` is wider than `keyof typeof id`, so
   `id[key]` is TS7053 under `strict`). Exactly two lines:
   - line 19: `const keys = Object.keys(id) as MessageKey[];` becomes
     `const keys = Object.keys(id) as (keyof typeof id)[];`
   - line 4 `import type { MessageKey } from './id.ts';` is deleted (it was then unused;
     `@typescript-eslint/no-unused-vars` would fail). No assertion changed.
2. **`pda-checks.test.ts`**, the two dictionary assertions only (five `pda_check.*` keys
   leave the shared dictionary):
   - added `import { pdaEn, pdaId } from '../i18n/pda-messages.ts';`
   - `expect(Object.hasOwn(id, textKey!), \`id has key ${textKey}\`).toBe(true);` becomes
     `expect(Object.hasOwn(id, textKey!) || Object.hasOwn(pdaId, textKey!), \`id or pdaId has key ${textKey}\`).toBe(true);`
   - `expect(Object.hasOwn(en, textKey!), \`en has key ${textKey}\`).toBe(true);` becomes
     `expect(Object.hasOwn(en, textKey!) || Object.hasOwn(pdaEn, textKey!), \`en or pdaEn has key ${textKey}\`).toBe(true);`
3. **`pda-diagram.test.ts`**: one added line, `import '#lib/i18n/pda-messages.ts';`
   (that test calls `translate` with a PDA key). No assertion changed.
4. **M2**: the empty PDA renders no `<table>`, so `pda_editor.table_title` and the five
   `pda_editor.col_*` headers cannot be on the page at the same time. M2 asserts the empty
   state (`Transisi (0)`, `Belum ada transisi.`) and then builds one transition and asserts
   `Transisi (1)` and the five headers. Both states run the raw-key check.

Not an approval, but recorded because it differs from the spec text: the spec says the
import line is `import './pda-messages.ts'` in `PdaWorkstation.svelte`. That path resolves
to `web/src/lib/editor/pda-messages.ts`, which does not exist; `pnpm check` caught it
immediately (`Cannot find module or type declarations for side-effect import of
'./pda-messages.ts'`). The line is `import '#lib/i18n/pda-messages.ts';`, the same module
and the same one line.

## 3. Tests first (AC1): the failing run before the code

Unit tests, before `pda-messages.ts` existed:

```
 RUN  v5.0.3 /home/Aldebaran64/webtomata-ds/web

 ❯ src/lib/i18n/pda-messages.test.ts (0 test)
 ✓ src/lib/i18n/i18n.test.ts (14 tests) 68ms

 FAIL  src/lib/i18n/pda-messages.test.ts [ src/lib/i18n/pda-messages.test.ts ]
Error: Cannot find module './pda-messages.ts' imported from /home/Aldebaran64/webtomata-ds/web/src/lib/i18n/pda-messages.test.ts
```

E2E, against the build of the unchanged branch (M1 is the test that must be red; M2 and M3
describe behaviour that must survive, so they already pass — their guard is B2 and B5):

```
  1) [desktop] › e2e/pda-messages.spec.ts:45:2 › M1: the FSM page downloads the shared dictionary, but none of the PDA messages
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: false
    Received: true
      54 | 		expect(scripts.some((body) => body.includes('Tersimpan di perangkat ini'))).toBe(true);
    > 55 | 		expect(scripts.some((body) => body.includes('Transisi di antara'))).toBe(false);
       | 		                                                          ^
    at .../web/e2e/pda-messages.spec.ts:55:71

  1 failed
  3 skipped
```

The spec's M2 originally has no reachable state (section 2, point 4); before that was
settled the first run of the file also failed on a locator bug of mine
(`getByRole('radio', { name: 'DPDA' })` matches `NDPDA` too; fixed with `exact: true`).
That is a test fix, not evidence of the code.

After the change:

```
 ✓ src/lib/i18n/pda-messages.test.ts (6 tests) 35ms
 ✓ src/lib/i18n/i18n.test.ts (14 tests) 91ms
 Test Files  2 passed (2)
      Tests  20 passed (20)
```

## 4. F5 — nothing else moves (AC2)

Unit tests: the full Vitest run that passed after the change (section 8) has
`src/lib/editor/diagram/pda-diagram.test.ts` and `src/lib/editor/pda-checks.test.ts` green
with only the lines of section 2 changed. `i18n.test.ts` has only its two lines changed.

Browser specs, on the final build:

```
=== pda-messages desktop+phone ===
  6 passed (7.4s)

=== desktop area (pda-panel pda-editor pda-storage switcher editor-checks) ===
  6 skipped
  33 passed (41.4s)

=== phone area (pda-panel pda-editor pda-storage) ===
  9 skipped
  17 passed (24.9s)

=== webkit-phone pda-storage ===
  6 passed (7.9s)

=== phone switcher editor-checks ===
  10 skipped
  3 passed (8.6s)
```

The skips are the existing `test.skip(isMobile)` / `test.skip(!isMobile)` project splits.

## 5. Deliberate breaks (AC5), each on the final code

Each break was made on the committed implementation, run, and restored; `git status` was
empty between breaks. The line quoted for the failure is the one Vitest or Playwright named.

### B1 — `'pda_editor.save'` back into `id.ts` and `en.ts` (U3 fails)

```
 FAIL  src/lib/i18n/pda-messages.test.ts > the PDA messages > U3: are not in the shared dictionary, and no key is in both
AssertionError: id: pda_editor.save: expected true to be false // Object.is equality
     55|    expect(Object.hasOwn(id, key), `id: ${key}`).toBe(false);
```

The break (`git diff -U0`; the comma on the preceding value line is required, so the file
stays valid TypeScript):

```
+	'pda_editor.save': 'Save'
+	'pda_editor.save': 'Simpan'
```

U4 also failed during this break (`expected 'Simpan' to be 'pda_editor.save'`), because the
key is then in `MESSAGES` as well; the break's target is U3.

### B2 — delete `import '#lib/i18n/pda-messages.ts';` from `PdaWorkstation.svelte` (M2 fails)

```
  ✘  1 [desktop] › e2e/pda-messages.spec.ts:59:2 › M2: the PDA mode shows the Tabel panel in Indonesian, and no raw key
    Locator: getByRole('complementary', { name: 'Panel' }).getByRole('heading', { name: 'Transisi (0)' })
    Error: element(s) not found
    > 66 | 		await expect(side.getByRole('heading', { name: 'Transisi (0)' })).toBeVisible();
```

The failure snapshot of that run shows the raw keys on the page:
`kind.dpda`, `kind.ndpda`, `pda_editor.table_title`, `pda_editor.table_empty`.

The break:

```
-	import '#lib/i18n/pda-messages.ts'; // The PDA messages travel with this workstation only (T-063).
```

### B3 — remove the final `?? key` from `translate` (U4 fails)

```
 FAIL  src/lib/i18n/pda-messages.test.ts > the PDA messages > U4: a key that is not registered yet gives the key itself, not undefined
TypeError: Cannot read properties of undefined (reading 'replace')
 ❯ format src/lib/i18n/translate.ts:26:18
 ❯ src/lib/i18n/pda-messages.test.ts:67:10
```

The break:

```
-	return format(MESSAGES[locale][key] ?? extra[locale][key] ?? key, params);
+	return format(MESSAGES[locale][key] ?? extra[locale][key]!, params);
```

### B4 — import `pda-messages.ts` from `Editor.svelte` (M1 fails; sizes)

```
  1) [desktop] › e2e/pda-messages.spec.ts:45:2 › M1: …
    Error: expect(received).toBe(expected) // Object.is equality
    Expected: false
    Received: true
    > 55 | 		expect(scripts.some((body) => body.includes('Transisi di antara'))).toBe(false);
```

`pnpm size` with this break: `sandbox.html` 124.5 -> 125.5 KB gzip,
`soal/berakhiran-10.html` 123.9 -> 124.9 KB; `index.html` 81.4, `panduan.html` 82.3 and
`soal.html` 83.7 are unchanged (they do not load `Editor.svelte`). It is the +1.0 KB on the
editor routes that the task removes.

The break:

```
+	import '#lib/i18n/pda-messages.ts';
```

### B5 — register only `pdaId` (M3 fails)

```
  ✘  1 [desktop] › e2e/pda-messages.spec.ts:84:2 › M3: with English saved, the PDA mode shows the English texts
    Locator: getByRole('complementary', { name: 'Panel' }).getByRole('heading', { name: 'Transitions (0)' })
    Error: element(s) not found
    > 89 | 		await expect(side.getByRole('heading', { name: 'Transitions (0)' })).toBeVisible();
```

The English page showed the raw keys (`pda_editor.table_title`, `pda_editor.table_empty`,
`kind.dpda`, `kind.ndpda`), which is the fallback of `translate` doing its job.

The break:

```
-addMessages('en', pdaEn);
```

## 6. Sizes (AC3)

Both builds on this machine, same commands. The baseline was built on `HEAD 3322b86` with
`git diff origin/staging --stat` empty (`git status --short` empty before and after);
build output and the wasm package are git-ignored.

`pnpm size`, baseline `origin/staging`:

```
ok   initial JS index.html: 82.3 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 89.4 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 83.1 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 125.4 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 124.8 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 124.8 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 124.8 KB gzip (limit 170 KB)
ok   initial JS soal.html: 84.6 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 82.4 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

`pnpm size`, this branch:

```
ok   initial JS index.html: 81.4 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 88.5 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 82.3 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 124.5 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 123.9 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 123.9 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 123.9 KB gzip (limit 170 KB)
ok   initial JS soal.html: 83.7 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 81.6 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

| Route | before | after | change |
| --- | --- | --- | --- |
| `index.html` | 82.3 | 81.4 | −0.9 |
| `sandbox.html` | 125.4 | 124.5 | −0.9 |
| `soal.html` | 84.6 | 83.7 | −0.9 |
| `panduan.html` | 83.1 | 82.3 | −0.8 |
| `soal/berakhiran-10.html` | 124.8 | 123.9 | −0.9 |

No route grew. `sandbox.html` shrank 0.9 KB, more than the 0.5 KB floor.

The shared chunk that holds the dictionary (found by searching the build for a text that
every route has, `Tersimpan di perangkat ini`; it is referenced by all nine `.html` files):

| chunk | before | after |
| --- | --- | --- |
| dictionary | `CB0UzqGA.js` raw 114,808 B; gzip 32,099 B; gzip -9 31,986 B | `-1oaGXnc.js` raw 111,884 B; gzip 31,234 B; gzip -9 31,129 B |
| PDA chunk (`PdaWorkstation`/`PdaEditor`/label/table + the lazy messages) | `BdTe0IJB.js` raw 18,163 B; gzip 6,657 B; gzip -9 6,655 B | `BrEhgw_x.js` raw 21,185 B; gzip 7,533 B; gzip -9 7,528 B |
| definition view (unchanged, separate lazy chunk) | `ydtHyXdc.js` raw 2,793 B; gzip 1,163 B | `45qCLec_.js` raw 2,793 B; gzip 1,161 B |

The lazy messages add 3,022 raw / 876 gzip bytes to the PDA chunk, which no route loads
unless the PDA mode opens; in the dictionary they cost 865 gzip bytes on every route.
(gzip here is `gzip -c`, the zlib default that `tools/check-size.mjs` uses; `gzip -9` given
too because the numbers are unrounded.)

## 7. The texts are out of every other chunk (AC4)

Each text searched as a whole literal, with its delimiters (the build writes some strings
with double quotes and some with backticks):

```
#!/bin/bash
cd web/build/_app/immutable
maps() {
	local text="$1"
	for d in '"' "'" '`'; do
		grep -rlF "$d$text$d" . --include='*.js' 2>/dev/null | sed 's|^\./||'
	done | sort -u
}
while IFS=$'\t' read -r key text; do
	printf '%-32s %s\n' "$key" "$(maps "$text" | tr '\n' ' ')"
done < /tmp/ac4-texts.tsv        # the 25 key/text pairs, read from pda-messages.ts
```

Output on the final build:

```
kind.dpda                        chunks/BrEhgw_x.js
kind.ndpda                       chunks/BrEhgw_x.js
pda_editor.edge_more             chunks/BrEhgw_x.js
pda_editor.form_title            chunks/BrEhgw_x.js
pda_editor.col_read              chunks/BrEhgw_x.js
pda_editor.col_pop               chunks/BrEhgw_x.js
pda_editor.col_push              chunks/BrEhgw_x.js
pda_editor.field_label           chunks/BrEhgw_x.js
pda_editor.row_delete            chunks/BrEhgw_x.js
pda_editor.add_row               chunks/BrEhgw_x.js
pda_editor.label_hint            chunks/BrEhgw_x.js
pda_editor.save                  chunks/BrEhgw_x.js
pda_editor.cancel                chunks/-1oaGXnc.js chunks/BrEhgw_x.js
pda_editor.menu_edit             chunks/BrEhgw_x.js
pda_editor.read_one_symbol       chunks/BrEhgw_x.js
pda_check.no_accepting_state     chunks/BrEhgw_x.js
pda_check.duplicate_transition   chunks/BrEhgw_x.js
pda_check.pop_never_pushed       chunks/BrEhgw_x.js
pda_check.competing_transitions  chunks/BrEhgw_x.js
pda_check.accepting_state_free_move chunks/BrEhgw_x.js
pda_editor.col_from              chunks/-1oaGXnc.js chunks/BrEhgw_x.js
pda_editor.col_to                chunks/-1oaGXnc.js chunks/BrEhgw_x.js
pda_editor.table_title           chunks/BrEhgw_x.js
pda_editor.table_empty           chunks/-1oaGXnc.js chunks/BrEhgw_x.js
pda_editor.definition_hint       chunks/BrEhgw_x.js
```

The 21 texts that belong only to the moved keys are in `BrEhgw_x.js` and nowhere else. The
four that stay in the shared dictionary belong to keys that stay too:

- `pda_editor.cancel` "Batal" — kept by `soal.reset_cancel`
- `pda_editor.col_from` "Dari" — kept by `convert.col_from`
- `pda_editor.col_to` "Ke" — kept by `convert.col_to`
- `pda_editor.table_empty` "Belum ada transisi." — kept by `definition.no_transitions`

All 25 texts are in the PDA chunk. No `.html` in `build/` contains any of the 25 (same
script against `web/build/*.html web/build/*/*.html`, no output), and no `.html` references
`BrEhgw_x.js`, so the chunk is only reached from the PDA mode.

## 8. The gate (AC6)

```
$ pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
$ prettier --check .
All matched files use Prettier code style!
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
svelte-check found 0 errors and 0 warnings
$ eslint .
$ node tools/check-strings.mjs
ok   71 components have no hard-coded text
$ node tools/check-tokens-usage.mjs
ok   73 files use no raw colors
```

`pnpm build && pnpm size`: the build finished (`Wrote site to "build"`, exit 0) and the
`pnpm size` lines are in section 6.

No `crates/` change:

```
$ git diff --stat f166898 -- crates/
(empty)
```

**Vitest, full run.** One full run passed after the change:

```
 Test Files  112 passed (112)
      Tests  1316 passed | 3 skipped (1319)
   Duration  14.25s
```

The later full runs did not pass, and not because of this task: two pre-existing heavy
property tests sit close to the 5 s default timeout, and the machine was carrying a load
average of 3.7 to 17.8 from the other worker's checkout. The failing tests move between
runs and none of them imports the i18n modules. The last run (load average 3.70) had
`1315 passed | 1 failed`, the one failure being `editor.property.test.ts` timing out at 5 s.

```
 FAIL  src/lib/editor/layout.test.ts > placing the states > property: any machine of up to 40 states …
Error: Test timed out in 5000ms.
 FAIL  src/lib/editor/interaction/editor.property.test.ts > random sequences of actions in the editor …
Error: Test timed out in 5000ms.

 FAIL  src/lib/editor/diagram/geometry.test.ts > the whole drawing > draws the worst case, 600 random edges …
AssertionError: expected 1081.3778720000003 to be less than 1000
 ❯ src/lib/editor/diagram/geometry.test.ts:585:16
```

In the passing run those two property tests took 3,971 ms and 4,930 ms; alone on an idle
machine they take 1,712 ms and 1,824 ms (run with
`pnpm --filter web exec vitest run src/lib/editor/layout.test.ts src/lib/editor/interaction/editor.property.test.ts`,
20 tests passed). Running the full suite without the new test file gives the same timeouts,
so the new file is not the cause. I did not raise a timeout or skip a test: CI, on a
dedicated runner, is the arbiter for these numbers.

## 9. Deepening pass

1. **New exports and their use.**
   - `pdaId` (new module): needed by `id.ts` for the type union (type-only) and by the
     tests; keep.
   - `pdaEn` (new module): the English half of the pair, used by `addMessages` and by
     `pda-checks.test.ts`; keep as data, not as a test seam.
   - `addMessages` (`translate.ts`): one caller today (`pda-messages.ts`), cannot be
     private (another module calls it), and the alternative — importing the PDA dictionary
     into `translate.ts` — would put the texts back in the shared chunk. It is the seam
     that T-061, T-062 and T-052 use.
   - No new member of a public interface. `MESSAGES` keeps its name and its users;
     its value type becomes `Partial<Record<MessageKey, string>>` so a missing key is
     expressible (callers already had to accept `string | undefined` under
     `noUncheckedIndexedAccess`).
   - Logic written twice: U2 repeats the "never empty / same parameters" checks of
     `i18n.test.ts` for the new dictionary. Deliberate: the shared test must not import the
     lazy module, because with `isolate: false` its result would then depend on the order of
     the test files. The `PDA_KEYS` list in the test is the task's oracle, not a copy of the
     implementation.
2. **The interface is smaller than the work behind it.** Callers keep `t` and `translate`;
   the only new call is `addMessages`, and the PDA module exports plain data.
3. **Casts added: zero.** The two casts in `pda-diagram.test.ts` are unchanged from before.

## 10. The 25 keys and where they are used (AC6 table)

Every shipped user is in the PDA chunk; the tests are not built.

| key | files |
| --- | --- |
| `kind.dpda`, `kind.ndpda` | no literal (``t(`kind.${option}`)`` in `KindSwitch.svelte:45`, called with `dpda`/`ndpda` from `PdaEditor.svelte:114,119,266,279`) |
| `pda_editor.edge_more` | `PdaEditor.svelte:160`; `diagram/pda-diagram.test.ts:154,157` |
| `pda_editor.form_title` | `PdaEditor.svelte:259`, `PdaLabelForm.svelte:176` |
| `pda_editor.col_read`, `col_pop`, `col_push` | `PdaTableView.svelte:30,31,32`, `PdaLabelForm.svelte:180,181,182,196,212,228` |
| `pda_editor.field_label` | `PdaLabelForm.svelte:196,212,228` |
| `pda_editor.row_delete` | `PdaLabelForm.svelte:242` |
| `pda_editor.add_row` | `PdaLabelForm.svelte:263` |
| `pda_editor.label_hint` | `PdaLabelForm.svelte:266` |
| `pda_editor.save`, `cancel` | `PdaLabelForm.svelte:283,280` |
| `pda_editor.menu_edit` | `pda-label.ts:24`; `pda-label.test.ts:385,387` |
| `pda_editor.read_one_symbol` | `pda-label.ts:69,80`; `pda-label.test.ts:129,134,304` |
| `pda_editor.col_from`, `col_to` | `PdaTableView.svelte:29,33` |
| `pda_editor.table_title` | `PdaTableView.svelte:18,25` |
| `pda_editor.table_empty` | `PdaTableView.svelte:20` |
| `pda_editor.definition_hint` | `PdaDefinitionView.svelte:48` |
| `pda_check.no_accepting_state` etc. (5) | `pda-checks.ts:12,14,15,16,17`; `pda-checks.test.ts:53,62,68,74,80,100,106,132,149,150` |

No key is used outside the PDA chunk in shipped code (`grep -rnF` over the repository,
excluding `web/src/lib/i18n`).

## 11. Not run, and why

- Firefox and the full Playwright suite: `AGENTS.md` forbids the full suite locally and the
  Firefox project is the small cross set; CI runs both.
- Lighthouse and `pnpm smoke`: not part of this task's verification.
- The phone itself and the live site: the owner's.

## 12. Rollback

`git revert 32a215d` restores the 25 keys to `id.ts`/`en.ts`; the two test edits of
section 2 go back with it. Nothing else depends on the change.
