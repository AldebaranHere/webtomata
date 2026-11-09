# 0056. The PDA history has its own module

Status: accepted

## Context

`history.ts` held `createHistory` (FSM) and `createPdaHistory` (PDA). The FSM editor core imports
`history.ts`, and `history.ts` imports `pda-commands.ts` and `pda-document.ts`, which only the PDA
mode needs, so every route that mounts the editor downloaded them in its first load. T-075 made this
visible: Rollup extracted `pda-document.ts` into a modulepreloaded chunk (`oVwv-99E`, 2,503 bytes gz)
and the first JS of `sandbox.html` grew by 696 bytes and the three `soal/*.html` by 769 each (the
owner's one-time exception, ADR 0055).

## Decision

1. `createPdaHistory` and the `PdaHistory` type move to `web/src/lib/editor/pda-history.ts`, with the
   same code, defaults and depth. `history.ts` keeps the generic engine and exports it
   (`createGenericHistory` and `GenericApplyResult`) so that the PDA twin can use it; `history.ts`
   imports no PDA module.
2. `interaction/pda-editor.ts` imports the PDA twin; `index.ts` re-exports it so the barrel's surface
   is unchanged.
3. The guard is `web/src/lib/first-load.test.ts`: a static walk from the layout and the sandbox
   entries over value imports and re-exports, through `.ts` and `.svelte` script blocks, resolving
   `#lib/`. It fails when the walk reaches `pda-document.ts`, `pda-commands.ts` or `pda-history.ts`,
   and it cannot pass silently (every entry must exist; `history.ts` and `interaction/editor.ts` must
   be reached; an unresolved relative or `#lib/` specifier fails). Its header names the accepted
   blind spot: the soal route's `storage/index.ts` → `pda-work.ts` chain, which the build tree-shakes.
4. A small test, `web/src/lib/editor/pda-history.test.ts`, fixes the PDA history's 200-step default.

## Consequences

The PDA document and commands leave the first JS of `sandbox.html` (129,020 → 124,790 bytes) and of
each `soal/*.html` (128,376 → 124,149 bytes), which pays back the exception of ADR 0055; the other
routes lose 11 bytes each and never fetched the PDA chunks. The PDA mode fetches `oVwv-99E.js`
(2,503 bytes gz, `pda-document.ts`) when it is chosen; `pda-commands.ts` moved into `R52WEoXk.js`
(2,833 bytes gz, with `pda-work.ts`), and the new `pda-history.ts` sits in the PDA editor chunk. No
budget changed.
