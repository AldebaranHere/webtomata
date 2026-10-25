# 0025. Examples and the first run

Status: accepted

## Context
A new visitor opened the Sandbox and found a sample machine that they had not asked for (X1 replaces it). The wireframes (U1) show an empty machine with "Coba contoh": a short list of examples, a way to start from an empty canvas, and an optional one-minute tour. Examples must be patterns, never solutions of homework, and anyone should be able to add one with a pull request.

## Decision
- **Examples are plain data.** One file for each in `content/examples/<id>.json`: the title and a description in both languages, the alphabet, the states with their places, the transitions (states by name, `null` for ε), and the strings that the machine accepts and rejects. The files are put in the bundle when the site is built (`import.meta.glob`). `parseExample` checks a file with words that an author can use. Three examples ship now: Berakhiran 01 (the machine of the old sample), Jumlah a genap, and a union through ε-transitions (an NDFSM). The fourth of the wireframe (regex to NDFSM) joins with the conversions (S7).
- **They are tested against the engine.** A test builds each example, runs its accepted and rejected strings through `simulateMany`, and requires that the engine finds nothing to point out in the machine: a student must not open an example and find a warning in it.
- **The first visit makes an empty machine, not a sample.** The Sandbox saves it like any machine. "Coba contoh" is over the canvas while the machine is empty. It goes away for good, in that editor, when a state is added or "Mulai dari kanvas kosong" is pressed: a student who deletes every state is working, and the card does not come back. A reload of an empty machine offers it again.
- **An example is put in place.** When the open machine is empty and untouched (no state, no test string, no title), the same record is rewritten with the example (`placeExample`): "Mesin saya" keeps no empty machine behind. In any other case the example becomes a machine of its own. Nothing that exists is overwritten, a machine that cannot be read is left as it is, and a refused write changes nothing.
- **An example opens with test strings:** its accepted and rejected strings in turn, saved in the `tests` field of the record (ADR 0023), so a new student sees S6-3 at work at once.
- **The tour is a plain dialog of five steps** (a sheet on a phone), loaded only when it is opened. A spotlight over the interface is fragile on a small screen. Closing it in any way (finish, Lewati, Esc, the backdrop) marks it seen in `localStorage` (`webtomata.tour`); the first-run card then stops offering it. A blocked `localStorage` means "not seen", and nothing else. The "?" button in the bar opens it at any time, and the dialog links to Panduan.
- **Each step shows the control that it teaches** as a picture of it, with its name and key read from the list that the tool bar uses (`web/src/lib/editor/tools.ts`), so the tour cannot drift from the buttons. A ring on the real button needs a non-modal card that does not cover it (the tool bar is at the bottom of a phone, where a sheet sits); it is left for after the first usability round (U5a).
- **Left out for now:** "Buka file .jff atau JSON" (there is nothing to open it with before S10b) and the regex example (S7).

## Consequences
- About a hundred browser tests relied on the sample. `openSandbox` now opens the example "Berakhiran 01" from the card and removes its test strings (`tests: 'keep'` keeps them), so those tests start as they did before. The tests of the first run use `openSandbox(page, { example: false })`.
- A new example is a pull request with one JSON file; a test fails if a string is wrong or the machine has a check.
- The texts of the card and the tour (`first.*`, `tour.*`) are a draft with `TODO(review)` until the feedback guide (U4); the owner approves them in the pull request.
