# 0029. Questions are read at build time, and the list keeps its filters in the address

Status: accepted (the owner approved the plan for Q3 on 2026-10-29).

## Context

The questions are YAML files in `content/questions` (ADR 0021). The list page (Q3a) and the page of each question (Q3b) must be prerendered, so that search engines see them and the first paint needs no script. There is no backend, so the files must be part of the site. The file format, the schema and the checks already exist (Q1, Q2); the site must not accept a file that they refuse.

## Decision

- **Read at build time, in a server load.** `web/src/routes/soal/+page.server.ts` reads the files with `import.meta.glob` (as text), checks each one with the same loader and schema as `pnpm check:questions` (`web/src/lib/questions/summaries.ts`), and returns only what the list needs: the id, the title in both languages, the type, the difficulty, the week and the pattern. A file that breaks a rule, or whose id is not its name, fails the build with the name of the file and the line. The YAML reader and the schema validator run only at build time, so they are not in the code that the browser loads.
- **The statement and the solution are not in the list.** They are in the page of the question (Q3b), and the solution, which Q4 needs to check an answer, is a separate file for each question. The reference solution is shipped to the browser: this is accepted in the roadmap (there is no backend) and is written in the authoring guide (Q7).
- **The filters are in the address** (`?minggu=1&jenis=build-dfsm&tingkat=2`), so that a filtered list can be shared. A prerendered page cannot read a search part at build time, so the page is built with no filter and reads `location.search` once it is in the browser. A value that is not known is ignored: an old or hand-typed link shows the whole list. The address is changed with `history.replaceState` (the Sandbox does the same), keeping the state that the router put in the entry.
- **One choice in each filter**, with "Semua". A laptop shows the filters in the page; a phone shows a button "Filter (n)" that opens a sheet, and the choices apply with "Terapkan".
- **A local static server shows `/soal` from `soal.html`** even when a folder `soal/` (with its `__data.json`) exists, as the real host does (`tools/serve-build.mjs`).

## Consequences

- A broken question cannot reach the site. The cost is that a contributor sees the error at build time, and `pnpm check:questions` shows the same problems with the engine checks too.
- The list has no JavaScript cost for reading questions; the size of the page did not grow beyond the filters and the cards (67 KB gzip of 170 KB).
- A question file that exists only on one computer (not in the repository) shows in the list of that computer's build, so the browser tests never count all the questions.
- Cards are not links until the question page exists (Q3b); the prerenderer refuses a link to a page that does not exist.

## Q3b: the page of a question and the work of the student

- **One page for each question**, prerendered (`/soal/<id>`), with `entries()` from the same files and checks. The page gets only what it shows: the statement, title, type, alphabet, constraints, week, level, textbook sections and the place in the list. The solution, the examples and the hints are not in it (a test fails if they are).
- **The work of the student** is one record for each question in the same store as "Mesin saya", with the id `soal:<id of the question>` (`web/src/lib/storage/question-work.ts`). No new field and no migration: the id says what the record is. `openLatest` (the machine that the Sandbox opens) and `listEntries` (the list "Mesin saya") leave these records out, so a question machine is never opened by the Sandbox, even when it was opened last. Q5 (progress) can find them by the prefix.
- **A record that cannot be read** is not changed when the page opens: the machine starts again in memory, a notice says so, and the old text stays until the first change is saved. A store that refuses the first write does not stop the page: the save status says it later.
- **The editor of a question** takes a list of panel tabs (Simulasi, Tabel, Definisi), and the page leaves out the share button, the list of machines, the tour and the examples. A remembered tab that this panel does not have opens the first tab.
- **The cards of the list are links** (the title, with the whole card as its target).

