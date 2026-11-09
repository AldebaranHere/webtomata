# 0053. The PDA first run reuses the FSM card, and an example replaces an empty record in place

Status: accepted

## Context

An empty PDA editor was a blank canvas: `PdaWorkstation` passed no first-run to `PdaEditor`, while
the FSM editor shows "Coba contoh" over an empty machine (`design/screens/pda-editor.md` section 1;
`docs/agent/PLAN.md`, T-073, split out of T-052). The three examples already exist as documents
(`pda-samples.ts`), but their titles and descriptions live in Indonesian only, and the card's type is
the FSM's `Example` (a `content/examples/*.json` row with `title` and `description` in both languages
and a `Kind`).

The FSM's `library.openExample` does not make a record in every case: `placeExample` rewrites the
current record in place when it is empty and the student has not touched it, and makes a new record
only otherwise, so that "Mesin saya" keeps no empty machine. The PDA had no twin of that function:
`createPdaMachine` only creates, and `PdaWorkstation` keyed its editor on the record id, which a
replaced record keeps.

## Decision

1. **One card, rows that are already text.** `FirstRun.svelte` takes
   `{ id, title, description, chip }` strings, and the tour button appears only when an `ontour` is
   passed. `Editor.svelte` keeps its public `firstRun` prop typed with the FSM's `Example[]` and maps
   it to those rows with `getLocale()` and `t()` in one `$derived`, so `routes/sandbox/+page.svelte`
   is not touched and the FSM shows the same texts and order.
2. **The PDA's rows travel with the PDA.** `PdaWorkstation` takes the three documents of
   `PDA_SAMPLES`, in that order, and the six texts (`pda_first.*`) are added to the lazy
   `pda-messages.ts`; the chips are the existing `kind.dpda` and `kind.ndpda`. The PDA passes no
   `ontour`, so the card has no tour.
3. **An example replaces an empty record in place.** `placePdaExample(store, openId, doc, now)` in
   `storage/pda-work.ts` is the twin of `placeExample`: when the current record is a PDA with title
   `''`, no state and no symbol in either alphabet (read from the store), the same record is rewritten
   (same id and `createdAt`); otherwise `createPdaMachine` makes a new one. It returns the document
   read back with `readStoredPda`, so the editor edits a copy and never the module-level sample; a
   refused write rejects and leaves the current record as it was.
4. **The editor is keyed on its own counter.** Because a replaced record keeps its id,
   `PdaWorkstation` has an `editorKey` and `{#key editorKey}`, as `Library.Current.key` does for the
   FSM. The old autosave is flushed and disposed before the new record's autosave starts; a failed
   open keeps it.
5. **The panel waits behind the card.** `PdaEditor` renders the side panel only when `showFirstRun`
   is false, as the FSM editor does; the card is the `overlay` snippet of the existing `EditorFrame`
   slot, with the same `.first-run` wrapper as `Editor.svelte`. The "Buka file .jff atau JSON" button
   of the design sheet waits for T-075.

## Consequences

- The FSM card and its tests are unchanged; the card's own texts stay in the shared dictionary.
- An empty PDA record is not left behind for T-074's list, and a later visit to an empty record shows
  the card again (a new visit).
- The six PDA e2e files start on an empty PDA: they leave the card through one helper in
  `e2e/fixtures.ts` (`openPda`), and only the assertion that said the card is absent is flipped.
- The shared card's rows add almost nothing to the first JS of `sandbox.html` and the question pages;
  the sample texts and the card's glue travel in the lazy PDA chunk.
