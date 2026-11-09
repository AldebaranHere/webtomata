# 0055. PDA files: routing by content, one lazy opener, and a download dialog

Status: accepted

## Context

T-074 made the "Buka file…" button of "Mesin saya" reachable in the PDA mode too, and every file went
through the FSM reader: a `.jff` of type `pda` failed with `jff.unsupported_type` and a PDA JSON with
`document.invalid_file`. The PDA editor had no way to give a machine back as a file, although the engine
reads and writes the PDA `.jff` (T-032) and the PDA document reads and writes its JSON (T-033).

The page's `openFromFile` held the FSM path, and the page is in the sandbox's first load: adding the PDA
branch there would grow it. The PDA workstation is not mounted in the FSM mode, so it cannot make the
record of a PDA file chosen from the FSM mode.

## Decision

1. **The file is told by its content.** A `.jff` is a PDA when `/<type>\s*pda\s*<\/type>/` matches (the
   engine trims the type); a JSON file is a PDA when `/"kind"\s*:\s*"(dpda|ndpda)"/` matches. This is a
   sniff, not a parse: the real parser checks the rest, so a false positive only gives a message.
   Anything else goes through the FSM reader exactly as before.
2. **One lazy opener.** The body of `openFromFile` moves out of `+page.svelte` into
   `web/src/lib/share/open-from-file.ts`, which holds both paths and receives what it needs in one
   context object. The page keeps one hook, so the page's own chunk gets smaller.
3. **A PDA file is a new PDA record, and the opener makes it.** `openPdaFile` reads the file and checks
   it; only then does `createPdaMachine` write the record (a throw is `storage.failed`). The list closes
   and an older failure is cleared, as opening an FSM does. The page switches to the PDA mode and gives
   the workstation the open request `{ id, seq }`; a failed file writes nothing and says why in the list,
   which stays open.
4. **A `.jff` result passes once more through the PDA document** (`parsePdaDocumentText(serializePdaDocument(doc))`),
   so every limit and rule holds for a document that came from a `.jff`; a JSON result is already checked
   and is not parsed again. The file's size is checked before its text is read.
5. **An FSM file chosen in the PDA mode switches the page to the FSM mode**, after it was opened.
6. **The PDA editor gives the open PDA back.** A button in its own bar (visible at every width, when the
   machine has at least one state) opens a small native dialog with "Unduh .jff" and "Unduh JSON". The
   `.jff` is `exportPdaJff(toEnginePda(doc), jffLayout(doc))`; the JSON is the readable document file. A
   machine with a symbol of more than one character is refused calmly for the `.jff`, and JSON is still
   offered. The names come from `fileName`, with `share.file_fallback` as the fallback.
7. **Messages.** The failure keys a file can meet (`import.*`, `jff.*`, `document.*`, `pda_document.*`,
   `storage.failed`) stay in the shared dictionary, because the page's `known(key)` reads only that one;
   only the download dialog's own strings travel with the PDA chunk in `pda-messages.ts`. The text of
   `jff.unsupported_type` now names both `fa` and `pda`.
8. **The fuzz target** `parse_pda_jff` checks that the PDA `.jff` parser never panics and that an imported
   PDA survives a write and a read. `fuzz/Cargo.toml` gets its `[[bin]]`.

## Consequences

- A student opens a PDA `.jff` or JSON in one tap, from either mode, and a PDA file never touches the open
  machine or the list of FSMs.
- The FSM path is the same code, moved; its unit and end-to-end tests pass unedited except the three that
  asserted a PDA `.jff` is refused (they use a grammar file now).
- The sandbox's first JS grows by more than the 0.1 KB the task allowed, even though the page's own chunk
  shrinks: Rollup shares `pda-document.ts` with the first-JS chunk, which brings the document functions
  that only the lazy modules used. The numbers and the alternatives are in the report of T-075; the
  planner decides whether to accept them.
- The `.jff` keeps names and places; the JSON keeps everything, including symbols of several characters.
