# T-076 — A downloaded `.jff` keeps its name on Android, and a file is told by its content

Branch `task/T-076-file-names`, cut from `origin/staging` at `1271d15` (PR 216, the amended spec). Status:
`done`. Commits: `207097a` (the change) and the last commit of this branch (this report and the status).

The owner's report, reproduced before any change: a `.jff` downloaded from the PDA editor on Android Chrome
was saved as `aⁿbⁿ (n ≥ 1).jff.xml` and "Buka file…" answered `import.unknown_type`. The run is in the
pre-flight (section 1).

## 1. What changed

| File | Change |
| --- | --- |
| `web/src/lib/share/open-file.ts` | `fileKind(name, text)` (exported) = `importKind(name) ?? kindOfText(text)`; `kindOfText` private, first character after `/^\s*/`; `openFile` checks the size, then reads, then tells the kind; `titleOfFileName` strips `.jff`, else `.jff.xml`, else `.xml` |
| `web/src/lib/share/pda-files.ts` | `isPdaFile` and `openPdaFile` use `fileKind`, with the size check first; the doc comment of `isPdaFile` rewritten |
| `web/src/lib/share/files.ts` | `DOWNLOAD_TYPE = 'application/octet-stream'` |
| `ShareDialog.svelte`, `PdaFileDialog.svelte` | pass `DOWNLOAD_TYPE` for the `.jff` and the JSON; SVG and PNG unchanged |
| tests | `open-file.test.ts`, `pda-files.test.ts`, `files.test.ts`, `open-from-file.test.ts`; e2e `open-file.spec.ts`, `pda-files.spec.ts`, `share-link.spec.ts`; `web/e2e/fixtures.ts` (one shared blob spy, see 6) |
| docs | `docs/decisions/0057-file-kind-by-content.md`; `docs/agent/PLAN.md` (status) |

The size check is now the **first** thing in `openFile`, `isPdaFile` and `openPdaFile`: a file over
`FILE_BYTE_LIMIT` (1,048,576 bytes) is `import.too_big` (or "not a PDA file" for `isPdaFile`) whatever its
name, and `text()` is never called. Before, both readers decided the kind before the size, so an unknown
name was refused as `import.unknown_type` without ever being size-checked.

### The three existing tests that changed, and only these

The probe run of the pre-flight (`pnpm --filter web exec vitest run src/lib/share/*.test.ts`, 51 passed)
and this change:

| Test | Was | Now | Why |
| --- | --- | --- | --- |
| `open-file.test.ts:155` `reads a file by its content when the name does not say…` (was `refuses an extension that is not known, and says which one`) | `file('a.txt', '{}')` → `import.unknown_type` | `document.invalid_file` (the text starts with `{`, so it is JSON; the document parser refuses it), and a new `file('a.txt', 'halo')` → `import.unknown_type` | F1: a `.txt` whose text starts with `{` is JSON |
| `pda-files.test.ts:86` `tells a PDA by its content when the name does not say…` (was `says no for a name that is neither…`) | `isPdaFile('a.txt'/'a', '{"kind":"dpda"}')` → `false` | `true` (and `'a.txt'`/`halo` → `false`, `'a.json'`/`not json` → `false` kept) | F3: a PDA JSON named `anbn.txt` opens |
| `pda-files.test.ts:204` `checks the size before it reads the text, and reads a .txt that holds a PDA .jff` (was `…and refuses an unknown extension`) | `openPdaFile(file('a.txt', pdaJffText))` → `import.unknown_type` | the engine is called with the text and the result is `ok: true` | F1/F3: the content says `.jff` |

No other existing test was edited. The two e2e `catatan.txt`/`halo` cases and every `open-file.wasm`,
`pda-files.wasm`, `files.wasm` and `open-from-file` case pass unedited.

## 2. The derivations of the fixtures

**F1 — `fileKind(name, text)`.** Derivation: the name wins when `importKind` answers. `a.jff` → `jff`
(whatever the text), `a.json` and `a.webtomata.json` → `json`. Otherwise the first character after every
white space at the start of the text: `<` → `jff`, `{` → `json`, anything else → `null`. `\s` in
JavaScript matches `U+FEFF`, so a BOM is white space: `'\uFEFF{'` → `json`, `' \uFEFF\n{'` → `json`,
`'  \n\t<structure/>'` → `jff`. `halo` → `null`; `[]` → `null`; `''` and `' \n\t\uFEFF '` → `null` (the
search for `\S` finds nothing).
**F2 — the title.** The rule is one suffix, matched case-insensitively on the lower-cased name but sliced
from the original: `.jff` → `a.jff` gives `a`; `.jff.xml` → `aⁿbⁿ (n ≥ 1).jff.xml` gives
`aⁿbⁿ (n ≥ 1)` (8 characters off, not 4, so not `….jff`); `.xml` → `x.XML` and `a.jff.XML` give `x` and
`a`. `.jff.xml` alone leaves `''` (`checkTitle('')` is ok, and the empty title already opens as
`editor.untitled`). The existing cases (`Berakhiran 01.jff`, `x.JFF`, `.jff`, the 300 emoji, the control
characters) are unchanged because they end in `.jff`.
**F3 — both readers (Playwright).** The PDA `.jff` of `aⁿbⁿ` is written inline in `pda-files.spec.ts`
(`anbnJff`, checked against the real engine before the test was written: `ok: true`, states `q0`/`q1`,
kind `ndpda`). Named `anbn.jff.xml` it has no known extension, so the content decides: `<` → `jff`, and
`PDA_JFF` matches `<type>pda</type>` → `openPdaFile` → a new PDA record, the mode switches to `pda` in
the FSM mode and stays in the PDA mode; the title is `anbn` (F2). A PDA JSON named `anbn.txt` is `{` →
`json` → `PDA_JSON` matches `"kind":"dpda"` → a PDA, with the document's own title. An FSM `.jff` named
`even-a.jff.xml` is `jff` → `openFile` → the engine → an FSM machine, title `even-a`.
**F4 — the hostile files.** The unknown name `foto.jpg` (a name that says nothing) is the case that was
never size-checked before. At `1 MB − 1` and at `1 MB` it is read and sniffed (the text `{"schemaVersion":1}`
→ `json` → `document.invalid_file`; the PDA `.jff` text → `jff` → the engine); at `1 MB + 1` it is
`import.too_big` and `text()` is never called, in both readers (the spy count stays at 2). A `1 MB + 1`
`x.jff.xml` is also `import.too_big` with zero reads. `'\u0000\u0000'` named `x.jff.xml` is neither kind
→ `import.unknown_type` (the engine is not asked). `<broken` named `x.jff.xml` is `jff` → the engine → the
real engine answers `jff.xml_invalid` with line 1, column 1 (checked against the WASM engine, and asserted
in `open-file.spec.ts` as the visible text "File .jff ini rusak: XML-nya tidak terbaca di baris 1, kolom 1.").
Each refusal writes no record, opens nothing and says why (`open-from-file.test.ts`); the count of records
and the open machine are as before.
**F5 — the blob type.** `DOWNLOAD_TYPE` is `application/octet-stream`. `download()` builds
`new Blob([text], { type: `${type};charset=utf-8` })`, so the type the browser sees is
`application/octet-stream;charset=utf-8` for a `.jff` and for a JSON, `image/svg+xml;charset=utf-8` for the
SVG (also a string) and `image/png` for the PNG (a `Blob`, used as it is). The spy wraps
`URL.createObjectURL` with `page.addInitScript` before the page's first script and records `blob.type`, so
the test observes what the browser acts on; a `suggestedFilename()` check passes with `application/xml`
too and proves nothing.

## 3. Verification

All of it on the final code (after every break was restored; the restored files are byte-identical to the
files the checks ran on, `diff -q` empty).

```
$ pnpm format:check
All matched files use Prettier code style!

$ pnpm check
svelte-check found 0 errors and 0 warnings

$ pnpm lint
$ pnpm --filter web lint
$ eslint .

$ pnpm check:strings
ok   76 components have no hard-coded text

$ pnpm check:tokens
ok   78 files use no raw colors

$ pnpm test:web
 Test Files  122 passed (122)
      Tests  1424 passed | 3 skipped (1427)

$ pnpm --filter web exec vitest run src/lib/share/
 Test Files  10 passed (10)
      Tests  110 passed | 2 skipped (112)

$ pnpm --filter web exec vitest run src/lib/share/open-file.wasm.test.ts src/lib/share/pda-files.wasm.test.ts src/lib/share/files.wasm.test.ts src/lib/share/local-jff.test.ts
 Test Files  4 passed (4)
      Tests  23 passed | 2 skipped (25)

$ pnpm build && pnpm size
ok   initial JS index.html: 81.8 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 87.2 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 81.0 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 121.9 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 121.2 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 121.2 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 121.2 KB gzip (limit 170 KB)
ok   initial JS soal.html: 82.5 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 80.3 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)

$ cd web && pnpm exec playwright test open-file pda-files share-link cross/open-file --project=desktop --project=phone
  2 skipped
  72 passed (1.3m)
```

The two skipped e2e cases are the tests that each project cannot run (a phone-only test on desktop and the
reverse).

**Sizes in bytes, all nine pages**, the metric of `tools/check-size.mjs` (the gzip sum of the `.js` that the
HTML references), before (`11577ba`) and after, measured by the same command both times:

| Page | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `index.html` | 83,801 | 83,802 | +1 |
| `panduan.html` | 82,949 | 82,950 | +1 |
| `panduan/berakhiran-x.html` | 89,329 | 89,330 | +1 |
| `sandbox.html` | 124,790 | 124,789 | −1 |
| `soal.html` | 84,444 | 84,445 | +1 |
| `soal/berakhiran-10.html` | 124,149 | 124,150 | +1 |
| `soal/jumlah-a-genap.html` | 124,149 | 124,150 | +1 |
| `soal/mengandung-101.html` | 124,149 | 124,150 | +1 |
| `tentang.html` | 82,247 | 82,248 | +1 |

No route grew by more than 1 byte (AC3 allows 102). The module that grew is lazy: the share reader is
`_app/immutable/chunks/BsyC2EOn.js`, 1,936 raw bytes (926 gzip, was 1,734 raw), and no HTML lists it.

## 4. The breaks (AC4), each on the final code

| Break | The one line | The test that failed |
| --- | --- | --- |
| **B1** `kindOfText` always `null` | `function kindOfText(text: string): ImportKind \| null { return null; }` (the five lines that read the character deleted) | `open-file.test.ts:61` `expected null to be 'jff'`; also `:158` and `:209` `expected 'import.unknown_type' to be 'document.invalid_file'`, and `:242` `expected [] to deeply equal [ '<broken' ]` |
| **B2a** the size check after the read, in `openFile` | `-  if (!(file.size <= FILE_BYTE_LIMIT)) return fail('import.too_big', …);` moved below `const text = await file.text();` | `open-file.test.ts:143` `expected true to be false` (a file of 1 MB + 1 was read); `:216` `expected 3 to be 2`; `:229` `expected 1 to be +0` |
| **B2b** the same in `isPdaFile` | `-  if (!(file.size <= FILE_BYTE_LIMIT)) return false;` moved below `text = await file.text();` | `pda-files.test.ts:101` `expected 1 to be +0`; `:238` `expected 3 to be 2` |
| **B3** `titleOfFileName` stops taking off `.xml` | `-const NAME_SUFFIXES = [JFF_EXTENSION, `${JFF_EXTENSION}.xml`, '.xml'] as const;` → without `'.xml'` | `open-file.test.ts:87` `expected 'x.XML' to be 'x'` |
| **B4** the constant back to `application/xml` | `-export const DOWNLOAD_TYPE = 'application/octet-stream';` → `'application/xml'` | `pda-files.spec.ts:289` and `share-link.spec.ts:464`: `- "application/octet-stream;charset=utf-8"` / `+ "application/xml;charset=utf-8"` |

Three further breaks, for rules that AC4 does not name, so that no new test is allowed to be unfalsifiable:

| Break | The one line | The test that failed |
| --- | --- | --- |
| the content wins over the name | `return kindOfText(text) ?? importKind(name);` | `open-file.test.ts:54` `expected 'json' to be 'jff'` |
| the `.xml` rule before the `.jff.xml` rule | `const NAME_SUFFIXES = ['.xml', `${JFF_EXTENSION}.xml`, JFF_EXTENSION] as const;` | `open-file.test.ts:86` `expected 'aⁿbⁿ (n ≥ 1).jff' to be 'aⁿbⁿ (n ≥ 1)'` |
| the size check after the read in `openPdaFile` | the same move as B2a, in `openPdaFile` | `pda-files.test.ts:216` `expected 1 to be +0`; `:253` `expected 3 to be 2` |

Every break was restored; `diff -q` against the backups prints nothing and the suite is green again
(section 3).

## 5. Deepening pass

**New exports.** `fileKind` (`open-file.ts`): used by `openFile`, `isPdaFile` and `openPdaFile` and tested
directly by F1 — it cannot be private, and `kindOfText` is private because only `fileKind` calls it.
`DOWNLOAD_TYPE` (`files.ts`): used by the two dialogs and by the constant test; it cannot be private
because the two dialogs are in two files. `watchBlobs` and `blobTypes` (`web/e2e/fixtures.ts`): test-only,
used by the two dialog specs; they are a seam because the same spy is needed in two spec files, and the
alternative was the same ten lines twice. That file is the one file this task touched beyond the scope's
list; the change is +26 lines, and the two specs import it. **No new member of a public interface**:
`ImportFile`, `ImportEngine`, `ImportPdaEngine` and `PdaJffEngine` are unchanged.

**Written twice?** The kind rule is in one place (`fileKind`), the title rule in one place
(`NAME_SUFFIXES`). The size predicate `file.size <= FILE_BYTE_LIMIT` stands in three readers, as it did
before, because each answers differently (`fail('import.too_big', …)` with the limit, or `false`); merging
them would add an interface to save three lines. The `fail` helper already existed in both modules.

**Casts added: zero.** The e2e spy declares `window.__blobTypes` with `declare global` instead of a cast.
The `as const` on `NAME_SUFFIXES` is a literal-type annotation, not a cast. No `any`, no `@ts-ignore`, no
`as unknown as`.

## 6. What I did not run, and the phone re-check

- **The owner's phone.** Nothing here reproduces Chrome on Android renaming a download; the type is proved,
  the rename is not. The owner should check, after the merge: a new `.jff` is saved as `….jff` and opens,
  and an already-saved `….jff.xml` opens.
- **The live site.** Not deployed; the check is on the built site.
- The full e2e suite and `pnpm test:e2e:cross` were not run (the task's verification is the specs of the
  area), and Firefox/WebKit were not run (the cross specs need `pnpm test:e2e:cross`, CI runs them).
- **Residual risk, for the phone check:** the picker's `accept=".jff,.json,application/json"` does not list
  `.xml`, so some phones may not offer a saved `….jff.xml` in the chooser at all. The owner's Chrome did.
  The list is left as it is (widening it would hide other files), as the spec says.
