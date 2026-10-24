# 0017. The machine document, its commands and its history

Status: accepted

## Context
The diagram, the table and the formal definition must show one machine, and every edit must be undoable (`CLAUDE.md`, section 6). The engine knows states by number only; names and places of states belong to the user interface. The document will be saved (IndexedDB), shared (a link) and read from untrusted files, and a possible lecturer mode (v2) needs edits as plain data. Code is in `web/src/lib/editor/`.

## Decision
- **The document is plain, frozen, versioned data** (`schemaVersion` 1): title, kind, alphabet, states (`id`, `name`, `x`, `y`), start, accepting, transitions (`from`, `on`, `to`, with `on: null` for ε) and `nextStateId`. Transitions are stored as the engine stores them; the diagram groups them into edges for display. Lists are kept sorted in the order of the engine (transitions by state, symbol number and target), so `toMachine(doc)` is exactly what `loadMachine` gives back.
- **Ids are never used twice** (`nextStateId` only grows), so a trace that names a state always means the same state, also after undo and redo. A new state gets the name `q<k>` with the smallest free `k`.
- **Rules are the rules of the engine.** A symbol is not empty, not `ε`, at most 32 characters (code points), and has no Unicode `White_Space` or control character (`\s` is not the same set); the limits are 2,000 states, 100,000 transitions and 256 symbols. `document.wasm.test.ts` checks every character of the Basic Multilingual Plane against the real engine.
- **State names are unique, trimmed, not empty and at most 32 characters.** A JFLAP file may have blank or repeated names, so `documentFromJff` repairs them (blank becomes `q<id>`, a repeat gets a suffix `q1_2`, the first one keeps its name) and returns `document.name_changed` notes. A saved document is strict.
- **Commands are plain data and `applyCommand` is a pure function** that returns a new document or an error message. It never throws and never changes the old document. A refused command changes nothing; a command that changes nothing gives back the same object. A `batch` is all or nothing.
- **Undo and redo keep earlier versions of the document, not inverse commands.** I first planned inverse commands, then chose snapshots: undo gives back exactly the earlier document, whatever the command was, so the combined commands (removing a state with its transitions, removing a symbol) cannot restore the wrong thing. Documents are immutable and share most of their parts, so a version costs one copy of the list that changed. Measured with 2,000 states: a drag step takes 0.07 ms, and undoing or redoing 200 steps takes 0.1 ms.
- **One gesture is one step**, with a `coalesce` key on the commands and `seal()` to end the group. The history never reads a clock. A gesture that ends where it began leaves no step. The depth is 200 steps.
- **Undo covers document edits only.** Selection, pan and zoom are not undoable. U3 may refine this.
- **Reading a document is strict.** `parseDocumentText` checks the size in bytes (1 MiB) before it parses; `parseDocument` reads every field by name, refuses unknown fields (so a `__proto__` key too), duplicate ids, transitions to missing states or symbols, and anything that `checkDocument` finds. It never throws.
- **Tests:** commands one by one, batches, history, 200 random sequences of 30 commands from a fixed seed (rules hold after every step; undo all gives the first document; a random walk of undo and redo always shows the recorded document; ids are never reused), and the engine round trip with 100 random documents. The four finite automata in `REFERENCES/JFF-FILES` (not in the repository) are imported, turned into documents and exported again when the folder exists.

## Consequences
- A view cannot change a document by mistake (it is frozen), and a bad file cannot crash the app.
- Memory: each step holds the lists that its edit copied. Course machines are tiny. A document with 100,000 transitions would copy that list on every transition edit, up to 200 times; the editor cannot show such a machine anyway. If S4 needs it, the history can get a limit by size.
- The command set will grow with S4 to S6 (for example moving several states). Each new command is a few lines and a test. Commands that no view uses by the end of S6 should be removed.
- A symbol with several characters (`num`) is a valid symbol in the document, but a JFLAP export refuses it (ADR 0011).
