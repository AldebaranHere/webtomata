# 0023. Saved machines on the device

Status: accepted

## Context

A student must be able to build a machine, close the page and find it again (S10a). `CLAUDE.md` decides: no account, no backend, autosave to IndexedDB through a small wrapper, and the status "Tersimpan di perangkat ini". The document already has a versioned JSON format with a parser that checks every rule (S3).

## Decision

- **One database, one store.** The IndexedDB database `webtomata` has one object store, `machines`, with one record for each machine: `{ id, recordVersion: 1, title, kind, createdAt, updatedAt, openedAt, doc }`. `doc` is the text of `serializeDocument`, so it is checked again with every rule when it is read. The title, the kind and the dates are copies in the record, so a list of machines can be shown without reading any document.
- **No package for IndexedDB.** The part of the API that is used is about 100 lines (`web/src/lib/storage/indexeddb.ts`). A write resolves when its transaction is complete. The storage sits behind a four-method interface (`list`, `get`, `put`, `delete`), so the unit tests use an in-memory store, and the real code runs in Chrome, Firefox and WebKit in `e2e/cross/storage.spec.ts`.
- **Autosave.** A change is saved 800 ms after the last one. Writes go one at a time and in order (a slow write cannot overwrite a later one). When the tab is hidden or closed, what waits is saved at once. The status is `saved`, `unsaved`, `saving` or `failed`.
- **Opening.** The Sandbox opens the machine with the biggest `openedAt`. With nothing saved it saves the sample as the first machine (X1 replaces that with the first-run screen). The prerendered page has an empty frame, and the editor takes its place when the machine has been read, so a reload does not show the sample for a moment.
- **A machine that cannot be read is never changed or deleted.** It is skipped, the next one opens, and the page says so ("Datanya tidak dihapus"). The reasons are `corrupt` (not JSON, or it breaks a rule), `newer` (a `schemaVersion` above ours) and `unsupported` (older, with no migration). If none can be read, a new machine is made beside them.
- **Migrations.** `web/src/lib/storage/migrate.ts` reads a stored document and moves an old version up one step at a time with a table of migrations, which is empty today because version 1 is the first. A migration must raise the version, or the document is `corrupt`; a migration that throws also gives `corrupt`. The first change of the format adds an entry, with a test.
- **No storage.** If IndexedDB is missing, refuses to open or fails on the first read, the editor works in memory. The title bar says "Tidak tersimpan", an alert says why, and leaving the page asks first. A write that is refused later (the disk is full) says "Belum tersimpan", keeps the work on the screen and tries again with the next change or when the tab is hidden.
- **No request for persistent storage.** `navigator.storage.persist()` can show a permission prompt in Firefox, which is a surprise for a student. We do not ask.

## Consequences

- **Two tabs on the same machine:** the last save wins. Each tab saves its whole document, so the result is never a mix of the two. A notice between tabs may come with S10b.
- **Safari deletes the site data of a site that was not visited for about seven days.** A student who takes a break can lose the machines. The list says so plainly, and export (S10b) is the backup. We cannot prevent it without asking for persistent storage.
- **A write that starts at the moment the page closes can be lost.** Hiding the tab saves at once, and while a change is unsaved the page asks before it is left; this is the guard, and we do not rely on the last moment.
- **The tests cannot make a real disk full.** A refused write is simulated by making `put` throw `QuotaExceededError`.
- The record keeps `recordVersion` apart from the document's `schemaVersion`, so the shape of a record can change without a change of the document.

## The list (S10a-2)

- **Delete with a time to undo.** A machine that is deleted leaves the list at once and is removed from the store after six seconds, unless **Urungkan** is pressed. If the page is closed inside the six seconds, the machine stays: it is never removed unless its time ends. Several deletes can wait at once; the toast offers Urungkan for the last one.
- **Rename of the open machine** goes through the editor, so that it is one undo step and the autosave writes it. Another machine is changed in its record, with the same title rule as the document.
- **The list reads every record** each time it is opened (title, kind, dates, and whether the document can be read), so it is never out of date after a change in another tab.

## Titles in two languages

- **Content has two titles.** A machine that comes from our own content (the sample now, the examples of X1, the starting machine of a question) carries `titles: { id, en }` in its record. The title of a question file is required in both languages (`title.id` and `title.en`, schema version 1, since no question file existed yet).
- **What is shown:** while the title of the document is one of the two, the page shows the one of the language that is active (the title bar, the rows of the list, the toast of a delete). The document keeps the title of the language that was active when the machine was made. A title that the user chooses is the user’s, never translated, and the record then drops `titles`; an undo that brings the first title back brings `titles` back.
- **Not retroactive:** a sample that was saved before this change has no `titles` and stays as it was. A student can rename it.
- **Export (S10b)** writes the title of the language that is active.

## Test strings (S6-3)

- **A field of the record, not of the document.** The record may have `tests`, a list of strings (at most 50, each at most 200 characters, no repeats). `recordVersion` stays 1: the field is optional and only adds. A new machine has none, and an empty list leaves no field. The list is not in the document, so it is not in the undo history, and it is not in a file or a link (S10b may add it).
- **Written by the same autosave.** `scheduleTests` puts the list in the same single write queue and with the same delay as the document, so neither can overwrite the other (a test runs random orders of changes). A change of the list alone does not touch the document text, the title or the titles of the content.
- **Read with `readTests`, never trusted.** Anything that is not a list gives an empty one, what is not a string is dropped, a long string is cut, repeats are removed, and only the first 50 are kept. Reading never writes: a record with a bad field is still listed and opened, and the next save cleans it. A duplicate copies the (clean) list; a rename keeps the record's own field.
- **Results are not saved.** They are worked out again after each change of the machine, so they cannot be old.
- **A downgrade loses the list:** an older version of the app that saves the machine writes the record without `tests`. We accept that.
