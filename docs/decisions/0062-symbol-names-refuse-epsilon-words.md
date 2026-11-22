# ADR 0062 — Symbol names: refuse ε words on add, keep readers accepting legacy `eps`

- **Status:** Accepted (2026-11-23, task T-065)

## Context

`checkSymbol` in `web/src/lib/editor/document.ts` enforces the Rust engine's symbol rules (non-empty, not `ε`, ≤ 32 code points, no whitespace/control/lone-surrogate characters). Because the engine accepts `eps`, `checkSymbol('eps')` returned ok, allowing `addSymbol`, `addInputSymbol`, and `addStackSymbol` to add a symbol named `eps` even though `eps` means ε in transition labels (making the symbol untypeable in labels). Meanwhile:

1. `checkSymbol` is also called by all document readers (`checkDocument`, `parseDocument`, `parseDocumentText`, `parsePdaDocument`, `parsePdaDocumentText`), by `pda-commands.ts` (`addTransition`), and by `document.wasm.test.ts` (engine parity). Changing `checkSymbol` directly would break legacy saved machines, JSON files, and share links that already contain a symbol named `eps`.
2. `EPSILON_WORDS` existed in two places: exported from lazy PDA module `pda-label.ts` (for `pda-table-edit.ts`) and duplicated as a private `Set` in `interaction/label.ts`.
3. `document.duplicate_symbol` existed only in lazy `pda-messages.ts`, so the FSM table displayed the raw key when adding a duplicate symbol.

## Decision

1. **Split command check from reader/engine check:** Keep `checkSymbol` unchanged. Add `checkNewSymbol(symbol)` in `document.ts` that runs `checkSymbol(symbol)` and then refuses any word in `EPSILON_WORDS` with `document.reserved_symbol { symbol }`. Call `checkNewSymbol` only from the three symbol-adding commands (`addSymbol`, `addInputSymbol`, `addStackSymbol`). `addTransition` in `pda-commands.ts` and every reader keep calling `checkSymbol`, so legacy data with `eps` loads and works unchanged.
2. **One shared `EPSILON_WORDS` list:** Move `export const EPSILON_WORDS: readonly string[] = ['eps', 'ε']` to `document.ts` and import it from `pda-label.ts` and `interaction/label.ts` (avoiding any shared-to-lazy import from the FSM bundle into the PDA chunk).
3. **Move `document.duplicate_symbol` and add `document.reserved_symbol` in `id.ts` / `en.ts`:** Both keys use ASCII-only text in the shared dictionary and `document.duplicate_symbol` is removed from `pda-messages.ts` (preserving ADR 0050's disjoint-dictionary invariant).
4. **Shorten the PDA table's pre-check:** Remove the `EPSILON_WORDS` branch from `symbolNameRefusal` in `pda-table-edit.ts` so it checks only whitespace and commas, and shorten `pda_editor.symbol_reserved` to match.
5. **Size-cap ruling (2026-11-23):** Moving `document.duplicate_symbol` into the shared dictionary, adding `document.reserved_symbol` in both languages, and moving `EPSILON_WORDS` / `checkNewSymbol` into `document.ts` added +111 B to +124 B gzip per route, exceeding the initial +102 B AC3 cap. By planner/owner ruling on 2026-11-23, the T-065 AC3 cap was raised to +130 B per route because ~120 B is inherent to carrying two shared keys in two languages plus the shared list, without shortening the user-facing sentences into unclear text.

## Consequences

- New FSM and PDA symbols cannot be named `eps` (refused with `document.reserved_symbol`) or `ε` (refused with `document.invalid_symbol`), and the FSM table shows localized Indonesian and English messages for both `document.duplicate_symbol` and `document.reserved_symbol`.
- Legacy stored records, JSON files, and share links carrying `eps` continue to open without migration, and `document.wasm.test.ts` stays in full agreement with the Rust engine.
- Initial JS grows by +111 B to +124 B gzip per route (within the 2026-11-23 +130 B ruling; all routes remain well under the 170 KB budget).
