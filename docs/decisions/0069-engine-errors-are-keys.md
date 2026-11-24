# 0069. Engine errors are typed data mapped to message keys, never sentences

Status: accepted

## Context

`CLAUDE.md` principle 6 states that the Rust engine never produces user-facing sentences: it returns
data and message keys with named parameters, and the web UI turns them into text in the active
locale. The FSM and PDA modules already follow this rule, but the grammar module (`GrammarError` in
`crates/engine-core/src/grammar/error.rs`) carried Indonesian sentences in `Display` and in
`String` variant payloads, wrapped by `api.rs` as `api.invalid_grammar`,
`api.cnf_transformation_failed`, or `api.cyk_failed` with a `detail` parameter. The UI displayed
`detail` verbatim in both Indonesian and English, and fell back to raw keys or exception strings
when `detail` was absent.

## Decision

1. **Typed error enums in Rust.** Every engine error enum holds only structured data (user input
   snippets, counts, limits) and never free-text prose. `Display` prints the message key only (for
   logs and test diagnostics; it never reaches the UI).
2. **One `From<Error> for Message` conversion.** Each module provides a single `impl From<E> for Message`
   used by `api.rs` via `.map_err(Message::from)`. Generic wrapper keys (`api.invalid_grammar`,
   `api.cnf_transformation_failed`, `api.cyk_failed`) and the `detail` parameter are not used.
3. **One pure UI error formatter.** The UI resolves engine `Message` objects through a single helper
   (`formatGrammarError` in `web/src/lib/grammar/grammar-error-text.ts`): known keys are translated
   with their parameters; unknown keys and caught exceptions render a calm generic fallback key
   (`grammar.error.generic`), never the raw key, `params.detail`, or `Error.message`.
4. **Rollout order.** The grammar module is migrated first (T-028: `GrammarError`, six
   `grammar.error.*` keys plus the existing `grammar.cyk_input_too_long`). The language module
   (`LanguageError`, `api.invalid_language`, `api.enumeration_failed`, `LanguageWorkstation.svelte`)
   follows the same pattern next in T-028b.

## Consequences

- Every grammar error translates cleanly between Indonesian and English (including live locale
  switches) and is guarded by a WASM integration test checking `id`/`en` parity and placeholder
  substitution against real engine calls.
- Removing Indonesian sentences from `engine-core/src/grammar` shrinks the compiled WASM binary
  (−586 bytes gzip), while adding the six keys in `id.ts`/`en.ts` adds +298 bytes gzip to
  `sandbox.html` first-load JS.
- T-028b can reuse this exact pattern and ADR without designing a second mechanism.
