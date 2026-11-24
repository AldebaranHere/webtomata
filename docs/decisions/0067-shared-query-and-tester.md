# ADR 0067: one scheduled query, one tester, and the small copies of the PDA work

- **Status:** Accepted (2026-11-24, task T-071)
- **Context:** The PDA work (T-033 to T-038) copied FSM pieces on purpose, so those tasks left the FSM's tests alone (ADR 0064, 0065). The copies that were the *same code with another type* now cost more than they save, and a third machine would copy them again. Measured on 2026-11-24: `tester.ts` and `pda-tester.ts` were the same 122 lines with other type names; `checker.ts` and `pda-determinism.ts` repeated the debounce, the sequence number and `dispose` (200 ms) and differed in two places; the last-50-rows window existed in `pda-run.ts`, `grammar-to-pda.ts`, `pda-conversion.ts` (twice) and inline in two FSM panels; `grammarText` in `pda-conversion.ts` was a second implementation of `grammarToText` in `grammar/grammar-text.ts`; and `input.unknown_symbol` was mapped twice. The similar, not identical, copies (the run models, the run panels, the test lists, the conversion models and panels) are T-071b, decided after the Turing-machine task shows what a third machine needs.

## Decision

1. **One scheduled query (`query.ts`).** `createQuery` keeps the newest document, counts a sequence number, waits (default 200 ms), asks the engine, drops an answer for an older document, never runs after `dispose`, and exposes `status`, `value`, `problem`, `subscribe`, `schedule`, `retry`, `dispose`. Its six options are the differences between the two callers: `ask`, `toValue` (which gets the document the answer is for), `empty()`, `emptyAtSchedule` (default false), `keepsProblem` (default true: a cancelled call goes back to `idle`; false: `failed`, as the badge had it) and `delayMs`. `createChecker` and `createDeterminism` stay the thin public functions the editors call, with their names and interfaces; the badge does not expose `retry` or `problem`.
2. **One tester (`tester.ts`).** `createTester` is generic over the document and the outcome. The FSM's calls (`run`, `delayMs`) are unchanged and get the machine's own `documentsEqual` by default; **any other document must pass `sameDocument`**, enforced by two overloads, because the FSM's equality reads `on` and ignores `pop` and `push` (two different PDAs would look equal and keep stale rows). `pda-tester.ts` is deleted; the PDA's test file becomes `tester.pda.test.ts` with every case.
3. **One window (`list-window.ts`).** `windowRows(rows, limit)` is the definition; `shownRows`, `windowEarlierRows` and `listWindow`/`rulesWindow` delegate to it. The FSM's two panels (`RunPanel.svelte`, `ComparePlayer.svelte`) keep their inline copies: they are T-071b.
4. **One grammar text (`grammar/grammar-text.ts`).** `grammarToText` is the definition (it owns the format, has the round-trip tests and the `emptySymbol` parameter). `grammarText` in `pda-conversion.ts` is a one-line call to it; both names stay, so no test is edited, and a test holds the two together on the wcwᴿ grammar and the nine presets.
5. **One refusal mapping (`run-text.ts`).** `unknownSymbolText` maps `input.unknown_symbol` (a symbol that is not in the alphabet, counted from 1); `refusalText` and `pdaRefusalText` both call it.

## Consequences

- No behavior change: the two wrappers pass exactly the rules they had, and the existing tests pass unedited (imports, the moved test file and the new tests only).
- First JS on the four editor routes grows by 181 to 183 bytes gzip (`sandbox.html` 125,419 → 125,600; each `soal/*.html` 124,629 → 124,812) because the FSM route now carries the generic query's options and wrapper. Every other route is 2 bytes smaller, the PDA's lazy chunk falls from 64,184 to 62,607 bytes raw, and the whole build's JS is 199 bytes gzip smaller. The 170 KB budget is untouched.
- One type assertion is added, in `tester.ts`: `documentsEqual as (a: D, b: D) => boolean`, for the default that the overloads only allow when the document is a `MachineDocument`. The pre-existing `checkItems` cast in `checker.ts` stays.
- Guards B1 (the sequence check), B2 (`dispose` stops an answer on its way), B3 (the badge empties at `schedule`), B4 (the checks keep their items), B5 (`sameMachine`), B6 (the window) and B7 (the PDA's equality, at run time and in the types) each have a test that fails when the rule is broken.

## Alternatives considered

- Unify the run models, the run panels, the test lists and the conversions too: rejected (T-071b: a shape drawn from two machines is the wrong shape more often than one drawn from three, and it touches every FSM test and first JS).
- Leave the copies: rejected (a scheduler bug would have to be fixed in two files, and the stale-answer rule is the one we cannot get wrong).
- Make `sameDocument` required for every caller: rejected (it edits 11 FSM test calls and breaks the FSM's public factory for no gain).
- Delete one of the two grammar-text names: rejected (it needs non-import edits to two existing test files; the second name costs one line).
