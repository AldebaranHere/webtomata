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

## Q4a: grading, and the answer file

- **The answer is in a file of its own.** `/soal/<id>/jawaban.json` holds the version and the solution (`web/src/routes/soal/[id]/jawaban.json/+server.ts`, prerendered for each machine question). The page of the question does not carry it, and a test checks that the page and its data have no transition of the solution and no examples. The page fetches the file only when the student asks to check an answer (Q4b); `loadAnswer` checks its size and its shape. There is no backend, so anyone can read the file: the roadmap accepts that and the authoring guide (Q7) says it. The hints are in the page data: a hint is a help, not the answer.
- **Grading is a pure function** (`web/src/lib/questions/grade.ts`) that returns data and message keys. The order is that of the panel and of `docs/ux/feedback-copy.md`:
  1. **Structure.** The errors of the engine's `validate` (not the warnings; a missing transition is not counted when the question allows an incomplete DFSM), then what the question asks: the kind DFSM for a DFSM question (a DFSM is accepted in an NDFSM question), the alphabet of the question (symbols that are missing or extra), the maximum number of states, ε-transitions when they are forbidden, and, only when nothing else is wrong, that the machine is minimal. Any problem gives the list and **no verdict**.
  2. **Language.** `equivalent(student, solution)` gives the verdict, the shortest wrong string and the two lists (the engine already did this for the compare feature).
  3. **Computation.** One `simulate` call on the shortest wrong string, as lines with the names of the states of the student.
- **"Dekat" is a rule, not a feeling:** the shortest wrong string has at most 4 symbols, the two lists together have at most 5 strings, and the lists were not cut.
- **The words** are in `feedback-text.ts` and the message files (`feedback.*`), written from the approved U4 guide. A test reads every key in both languages, checks that no title uses a harsh word, and that no guiding question names a fix. The guiding question is one generic template ("Setelah {string}, mesinmu ada di {states}. Apakah itu yang perlu diingat mesin?"), so the question files have no new field.
- **Tests with an outside truth.** For every question file of the repository the solution is graded as right; a machine with one state flipped between accepting and not is graded against a small machine runner in the test and every string up to length 6, so the verdict, the witness being the shortest, and both lists are checked; 80 random machines are graded the same way.
- **Not in Q4a:** the UI (Q4b), and regular expression questions (their answer box comes with the first such question).

## Q4b: the screen

- **Umpan balik is a tab of the panel**, first, and open when the page opens (`startTab`). The editor takes a `feedbackSlot` snippet that gets the machine as it is now and `tryString`, which opens Simulasi and starts a run (the same `startRun` as the Run panel). `PANEL_TABS` lists the five tabs; the Sandbox has `SANDBOX_TABS` (the first four), and a tab that a panel does not have is never opened, even if it was the one saved last.
- **The check** fetches `jawaban.json`, calls `grade` in the page (the engine runs in its worker) and shows the result. A result for an older call is dropped; a result is marked old when the machine changes. The page keeps the pane mounted (hidden when another tab is open), so a result is not lost.
- **The hints** are in the left column, in memory only (progress is Q5).

