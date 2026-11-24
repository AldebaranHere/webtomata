# 0071. The language engine counts characters, uses exact counts, and bounds enumeration length

Status: accepted

## Context

While implementing T-028b, six user-reachable inputs were found to panic, overflow, or abort the language engine (`crates/engine-core/src/language/`), and two more were uncovered during T-090 pre-flight (`Power(a, k)` linear recursion on large `k`, and `min_length + 20` on an unclamped `min_length` in `api.rs`). In the browser, any Rust panic or stack overflow traps the WASM module and kills the worker. Three of the crashes stemmed from mixing UTF-8 byte lengths/indices with Unicode character counts, two from `usize` addition/multiplication overflow (which panicked in debug and silently wrapped to wrong verdicts in release), and one from unbounded `String::with_capacity` and recursion depth on huge `|w| >= N` predicates.

## Decision

1. **Length means Unicode characters everywhere in `language/`.** Every language-string length measurement (`compare_proper_order`, `LengthGte`/`LengthLte`/`LengthEq`, `min_length`, `max_length`, `FiniteSet` generation, and `api::enumerate_language`'s 4,096-character expression limit) counts Unicode scalar values (`chars().count()`). Every `str` slice in `Concat`, `Star`, `ForallPrefix`, and `ForallSuffix` iterates valid UTF-8 character boundaries (`char_indices()` plus `w.len()`). `generate_and_test` tracks character depth explicitly rather than comparing `current.len()`.
2. **Linear count predicates use exact `u128` arithmetic.** `CountLinearGte`, `CountLinearLte`, and `CountEq` widen coefficients, counts, and offsets to `u128` via a shared helper (`eval_linear_counts`) so `coeff * count + offset` cannot overflow or saturate on either 32-bit (`wasm32`) or 64-bit native targets. Strict parser inequalities (`|w| > N`, `c#a(w) > N`) use `checked_add(1)` and propagate `LanguageError::NumberTooLarge` out of set-builder parsing.
3. **Enumeration refuses starting lengths above `ENUMERATION_MAX_LENGTH = 200` with a typed error.** `LanguageEvaluator::enumerate` checks the effective starting length (`options.min_length.max(self.min_length(expr))`) against `ENUMERATION_MAX_LENGTH` before any allocation or recursion, returning `LanguageError::LengthTooLarge { limit }` (`language.error.length_too_large`), and clamps `end_len` to `ENUMERATION_MAX_LENGTH`. `Power(a, k)` uses iterative DP bounded by `min(k, n)` rather than recursing `k` times. `200` is twice the web UI's `min_length` cap (`100`) and was verified in release `wasm32` on the deepest predicate and constructive paths (0.55–2.70 ms, no stack trap).

## Consequences

- Multi-byte UTF-8 words (e.g. `é`, `日`, `😀`) have character-accurate lengths and proper-order sorting (`|é| = 1`, `"é" < "ab"`), while ASCII behavior is unchanged.
- Both native 64-bit and `wasm32` 32-bit targets return typed errors or exact verdicts without panicking or aborting; note that `usize::MAX` differs across targets (`u32::MAX` on `wasm32`, `u64::MAX` on 64-bit native), so 64-bit literals overflow `parse_number` on `wasm32` with the same `language.error.number_too_large` key.
- `sandbox.html` first JS grows +65 B gzip (126,451 → 126,516 B) for the two new i18n keys in `id`/`en`; `engine_wasm_bg.wasm` grows +1,978 B gzip (242,084 → 244,062 B, 238.4 KB / 250 KB budget).
