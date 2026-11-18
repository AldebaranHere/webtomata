# 0057. A file is told by its name, and by its content when the name does not say

Status: accepted

## Context

On a real Android phone (Chrome), the `.jff` that the PDA editor downloaded was saved as
`aⁿbⁿ (n ≥ 1).jff.xml`: `download` gave the blob the type `application/xml`, and Chrome adds the
extension of a known type to a name whose own extension it does not know. Choosing that file in "Buka
file…" answered "File ini bukan keduanya" (`import.unknown_type`), because `importKind(name)` knew only
`.jff` and `.json`. The FSM's "Bagikan" dialog gave its `.jff` the same type, so it had the same fault.
T-075 had made this visible: the opener is shared, and it asked the name alone.

## Decision

1. **The name still wins when it is known.** `importKind(name)` is unchanged (`.jff`, `.json`,
   `.webtomata.json`), and its tests pass unedited.
2. **One rule in one place.** `web/src/lib/share/open-file.ts` exports `fileKind(name, text)`, which is
   `importKind(name) ?? kindOfText(text)`; `kindOfText` is private. It reads the first character after
   `/^\s*/`: `<` is a `.jff`, `{` is JSON, anything else is `null` (reported as `import.unknown_type`).
   JavaScript's `\s` already matches a BOM, so there is no second step for `U+FEFF`. `openFile`,
   `isPdaFile` and `openPdaFile` all use it, so the two readers cannot disagree.
3. **Size, then read, then kind.** Both readers checked the kind before the size limit, so an unknown
   name was never size-checked. Now the size is checked first, for every name: a file over the limit is
   `import.too_big` and is never read. The sniff only picks the reader; the engine and the document
   parser still validate everything.
4. **The title loses the extension that Android added.** `titleOfFileName` strips a trailing `.jff`, else
   a trailing `.jff.xml`, else a trailing `.xml`, each case-insensitively and always slicing the original
   name: `aⁿbⁿ (n ≥ 1).jff.xml` gives `aⁿbⁿ (n ≥ 1)`, not `aⁿbⁿ (n ≥ 1).jff`.
5. **The download type.** `files.ts` exports `DOWNLOAD_TYPE = 'application/octet-stream'`, and
   `ShareDialog.svelte` and `PdaFileDialog.svelte` pass it for their `.jff` and JSON buttons. The SVG and
   PNG downloads keep their types, and `download()` is not changed: it appends `;charset=utf-8` to a text
   blob, so the blob's type is `application/octet-stream;charset=utf-8`. The MIME essence is what the
   browser looks at, and every test expects the suffix.
6. **How it is proved.** Unit tests: the kind by name and by content; the title; the size trio
   (1 MB − 1, 1 MB, 1 MB + 1) for an unknown name in both readers, with a spy that the file over the
   limit is never read. Playwright: a `.jff` saved as `anbn.jff.xml` and a PDA JSON saved as `anbn.txt`
   open, in the FSM mode and in the PDA mode, and an FSM `.jff` saved as `even-a.jff.xml` opens as a
   machine. The blob type is proved by a `URL.createObjectURL` spy in each dialog's spec, because a
   suggested file name is the same with the old type and would prove nothing. Nothing in Playwright
   reproduces Chrome on Android renaming a download.

## Consequences

- A downloaded `.jff` keeps its name, and a file that Android already saved as `….jff.xml` opens.
- Three existing tests changed, and only these: `open-file.test.ts`'s `file('a.txt', '{}')` (now JSON, so
  `document.invalid_file`), and in `pda-files.test.ts` the two `isPdaFile` cases for a `.txt` and an
  extensionless file holding `{"kind":"dpda"}` (now `true`) and the `openPdaFile` case for a `.txt`
  holding a PDA `.jff` (now reaches the engine).
- A non-machine file whose first character is `<` now gets the engine's `jff.*` message instead of
  "neither". It is a refusal either way.
- The share reader stays lazy: its chunk went from 1,734 to 1,936 raw bytes and no HTML lists it; no
  route's first JS grew by more than 1 byte (the budget allows 102).
- The file picker's `accept=".jff,.json,application/json"` still does not list `.xml`, so some phones may
  not offer a `….jff.xml` in the chooser. The owner's Chrome did. Changing the list would hide other
  files, so it is left as it is and recorded for the phone re-check.
