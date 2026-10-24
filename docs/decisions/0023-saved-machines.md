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
