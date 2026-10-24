# 0019. Messages as a typed dictionary, and the app shell

Status: accepted

## Context
Every user-facing string must go through i18n, with `id` as the default and `en` as the second language (`CLAUDE.md`, section 6). The site is a static build with no backend. Guide pages must stay light. `CLAUDE.md` allows Paraglide JS or a small typed dictionary.

## Decision
- **A small typed dictionary, not Paraglide.** `web/src/lib/i18n/id.ts` holds the keys and the Indonesian text; `en.ts` is typed `Record<MessageKey, string>`, so TypeScript refuses a missing key. `i18n.test.ts` checks that no message is empty, that both languages use the same `{parameters}`, and that a long text is not left identical in both. No dependency, about 40 lines. We give up Paraglide's per-route splitting; at our size the dictionaries are a few kilobytes.
- **The language is chosen in the browser.** Prerendered pages are Indonesian (`<html lang="id">`). After the page loads, `loadLocale()` applies the choice saved in `localStorage` (`webtomata.lang`) and sets `<html lang>`. A value that is not a language is ignored, and blocked storage never throws. English readers see Indonesian for a moment on each load. Separate `/en/…` URLs would remove that, at a much higher cost (every route and every guide twice); we can add them later without breaking links.
- **Indonesian is the default for everyone.** We do not read `navigator.language` (less fingerprinting, and the same page for all).
- **`t(key, params)` is the only way to show text.** It reads Svelte state, so a template that calls it follows the language switch. Engine messages (keys with parameters) will use the same dictionary.
- **No hard-coded text, enforced** by `tools/check-strings.mjs` (`pnpm check:strings`, in CI). It reads every `.svelte` file with the Svelte compiler and fails on literal text with a Latin letter in the markup, in `aria-label`, `alt`, `title`, `placeholder` or the description of the page, or as a string literal in braces. Greek letters, digits and punctuation are allowed.
- **The shell:** four prerendered routes (`/`, `/sandbox`, `/soal`, `/panduan`), a header with the three links (`aria-current="page"` on the current one), the ID/EN switch, a skip link, a `main` landmark and a footer. On a phone the links are behind a Menu button (one breakpoint, 40rem). Pages that are not built yet show a title and "Segera hadir".
- **The engine version is shown on `/` only.** Other pages do not load the WASM, so guide pages stay light. The smoke test and the browser tests wait for the version on `/`.
- **Hidden from search engines until launch:** `X-Robots-Tag: noindex` in `web/static/_headers`. Roadmap task L4 removes it. (Lighthouse runs on a local server without these headers, so its SEO score is not affected.)

## Consequences
- A new message needs `id` and `en` in the same change, or the build fails type checks.
- The switch causes a short flash for English readers (see above).
- The check for hard-coded text does not see text built in a script (for example a string inside an `{#each}` array). Components must put such text in messages too; review keeps watch.
- Lighthouse now audits all four routes. `/soal` and `/panduan` already use the list-page budget (95 on every category).
