# 0070. The language errors are keys, and the messages no screen can show are deleted

Status: accepted

## Context

ADR 0069 turned the grammar module's errors into typed data with message keys. The language module
(`LanguageError` in `crates/engine-core/src/language/`) was the remaining place where the engine
built Indonesian sentences, and `api.rs` wrapped them as `api.invalid_language` or
`api.enumeration_failed` with a `detail` parameter that the workstation printed verbatim. Reading the
20 `InvalidSyntax` sites showed that only seven distinct messages can leave `parse`: the set-builder
attempt (`parser.rs:270`) discards its error and backtracks to the finite-set parser, so ten
predicate messages are dead, two more came from `_` arms over a fixed relation-operator list, and
`DepthExceeded` was never constructed.

## Decision

1. `LanguageError` is typed data with nine variants: `UnexpectedCharacter { position, rest }`,
   `ExpectedPowerNumber`, `NumberTooLarge`, `UnclosedParenthesis`, `UnexpectedSymbol { symbol }`,
   `UnexpectedEnd`, `ExpectedCommaOrBrace`, `UndefinedReference { name }` and
   `CyclicReference { name }`. Each is reachable through `parse`, the evaluator or `api`;
   `Display` prints the key only, and one `From<LanguageError> for Message` maps it to
   `language.error.*` with `position`, `rest`, `symbol` and `name` as parameters.
2. The dead messages are deleted (T-028's precedent: it removed unreachable `GrammarError`
   variants). `try_parse_set_builder` and the predicate subtree return `Option`: a failure means
   "not a set-builder", which is exactly what the caller already did with the error. A pinning test
   keeps the student-visible result: a malformed set-builder still reports
   `language.error.expected_comma_or_brace` from the finite-set fallback.
3. The relation operator is a private `RelOp` enum, so both matches are exhaustive and the two
   dead `_` arms disappear without a panic path and without inventing a variant.
4. `api.invalid_language`, `api.enumeration_failed` and the `detail` parameter are gone from the
   language functions; `api.invalid_environment` keeps its key and gets text in both languages.
5. The UI resolves both modules through one helper,
   `formatEngineError(error, translate, genericKey)` in `web/src/lib/engine/error-text.ts`, moved
   from the grammar folder. It never shows the raw key, a `detail`, or `error.message`.
6. The four pre-existing crash classes in the module (byte-index slicing, unbounded recursion,
   `usize::MAX` arithmetic, capacity overflow) are **not** changed here: the report lists the exact
   input and failure for each, and the owner writes that task.

## Consequences

- `sandbox.html` first JS grows +540 B gzip (125,969 -> 126,509) for 11 keys in two languages; the
  language chunk shrinks 63 B (8,655 -> 8,592) and the WASM binary shrinks 929 B (243,114 ->
  242,185), all inside the budgets.
- A language error reaches the screen only as a key that exists in `id` and `en`; a switch between
  the languages re-translates an open banner.
- A future precise message for a malformed set-builder needs a real change to `parse_set` (the
  internal attempt no longer carries a message), not a key.
