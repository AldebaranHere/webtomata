# 0050. The PDA messages are a lazy module, not part of the shared dictionary

Status: accepted

## Context

The message dictionary (`web/src/lib/i18n/id.ts` and `en.ts`) is in the first-load JS of every
route, so every string that a mode adds grows the home page, the guides and the questions too.
T-051 paid a one-time exception of +0.54 KB gzip on `sandbox.html` for 12 PDA keys (ADR 0049), and
T-061, T-062 and T-052 would each add more (`docs/agent/DECISIONS.md`, 2026-11-09). At the time of
this task 25 PDA keys lived in the shared dictionary and nothing outside the PDA chunk used them.

## Decision

1. **A lazy module per language pair.** `web/src/lib/i18n/pda-messages.ts` exports `pdaId` and
   `pdaEn` and, as a side effect of being imported, registers both. `PdaWorkstation.svelte` is the
   one importer, so the texts travel with the PDA chunk and no route's first load changes for them.
2. **The registry is separate from the shared dictionary.** `translate.ts` gains
   `addMessages(locale, dictionary)`, which fills a private `extra` table, and `translate` reads
   `MESSAGES[locale][key] ?? extra[locale][key] ?? key`. `id` and `en` are never mutated: Vitest
   runs with `isolate: false`, so a merge into them would make the parity test and "none of the 25
   keys is in the shared dictionary" depend on the order of the test files.
3. **One key type for callers.** `MessageKey` is `keyof typeof id | keyof typeof pdaId`; the second
   part is a type-only import, erased at build time. `en` is `Record<keyof typeof id, string>` and
   `pdaEn` is `Record<keyof typeof pdaId, string>`, so a missing translation is still a type error.
4. **A key that is registered nowhere is shown as itself.** A visible `pda_editor.save` is a bug
   that a test and a person can see; `undefined` or an exception is not.

## Consequences

- Every route's first-load JS shrinks: `sandbox.html` 125.4 -> 124.5 KB gzip, `index.html`
  82.3 -> 81.4, `soal.html` 84.6 -> 83.7, `panduan.html` 83.1 -> 82.3. The dictionary chunk falls
  from 114,808 to 111,884 bytes raw (32,099 -> 31,234 bytes gzip); the PDA chunk grows from
  18,163 to 21,185 bytes raw (6,657 -> 7,533 gzip).
- A later PDA task adds its strings to `pda-messages.ts`, in both languages, and never to `id.ts`
  or `en.ts`; a pull request that adds a PDA string to the shared dictionary is refused in review.
- Two existing tests changed for the type: the cast of the key list in `i18n.test.ts`, and the two
  "the key has a text" assertions of `pda-checks.test.ts`, which now also look in `pdaId`/`pdaEn`.
  `pda-diagram.test.ts` imports the new module because it calls `translate` with a PDA key.
- `pnpm check` no longer proves that every PDA key has a text in the shared dictionary; U3 of
  `pda-messages.test.ts` proves that it does not, and U1/U2 prove both languages are complete.
