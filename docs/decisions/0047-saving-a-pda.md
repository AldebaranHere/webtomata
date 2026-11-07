# 0047. Saving pushdown automata on the device

Status: accepted

## Context

Task T-056 introduces storage support for pushdown automata (`PdaDocument`).
Like FSM machines, PDA machines must persist on the user's device across sessions, reloads, and browser restarts.
ADR 0023 established the single-store, single-database architecture for saved machines (`webtomata` database, `machines` object store in IndexedDB).
We need to store PDA records in that same store without breaking existing FSM machines, without altering existing storage APIs or tests, and without duplicating the autosave serialization and queueing infrastructure.

## Decision

1. **One store, discriminator `type: 'pda'`.**
   Both FSM and PDA records reside in the `machines` object store.
   FSM records remain typed with optional `type?: 'fsm'`.
   PDA records are distinguished by mandatory `type: 'pda'`.
   The `kind` field on `SavedPdaMachine` is constrained to `PdaKind` (`'dpda' | 'ndpda'`), while on `SavedFsmMachine` it is `Kind` (`'dfsm' | 'ndfsm'`).
   To preserve honest typing without requiring casts across existing callers, `SavedPdaMachine` explicitly defines `titles?: undefined; tests?: undefined; progress?: undefined`, allowing safe access on the union `AnySavedMachine` while narrowing cleanly via type guards `isPdaRecord` and `isFsmRecord`.

2. **Single autosave queue with DocumentCodec.**
   `createAutosave` is generalized using `DocumentCodec<D, R>` (`serialize`, `apply`).
   The core serialization, debouncing, serialization of sequential writes, status transitions, and retry loops are implemented once in `createAutosaveCore`.
   Overloads for `createAutosave`:
   - FSM caller: `createAutosave(options: FsmAutosaveOptions): FsmAutosave`
   - PDA caller: `createAutosave(options: PdaAutosaveOptions): PdaAutosave`
   The returned `PdaAutosave` interface exposes only document scheduling (`schedule`, `flush`, `status`, `subscribe`, `dispose`) and strictly omits FSM-only methods (`scheduleTests`, `scheduleProgress`).

3. **Pure PDA storage operations in `pda-work.ts`.**
   `web/src/lib/storage/pda-work.ts` provides pure storage functions for pushdown automata:
   - `readStoredPda(text: string): PdaReadResult`: Validates document text against length limits (`LIMITS.documentBytes`), checks `schemaVersion === 1`, parses via `parsePdaDocument`, and returns `{ ok: true, doc }` or `{ ok: false, reason: 'corrupt' | 'newer' | 'unsupported' }`. Never throws.
   - `createPdaMachine(store, doc, now)`: Writes a new `SavedPdaMachine` to the store.
   - `openLatestPda(store, now)`: Lists PDA records, sorts by `openedAt` descending (tie-breaker `id`), opens the first readable record (updating its `openedAt` to `now()`), collecting skipped records. If none are readable or none exist, creates and saves a fresh empty NDPDA (`createPdaDocument()`). Refused writes (e.g. storage full) do not block opening. Store list errors propagate.

4. **Strict isolation between FSM and PDA records.**
   - FSM operations (`openLatest`, `listEntries`, `placeExample`) filter records with `isFsmRecord(r) && !isQuestionRecord(r.id)`.
   - General library operations (`duplicateMachine`, `renameStored`) filter with `!isPdaRecord(r)`, ensuring both FSM machines and `soal:` question records are supported while PDA records remain untouched.

## Consequences

- Existing FSM storage tests compile and pass with zero modifications.
- FSM and PDA storage live in the same IndexedDB store with zero schema migrations required.
- Single write queue semantics prevent concurrent writes and race conditions for both FSM and PDA machines.
