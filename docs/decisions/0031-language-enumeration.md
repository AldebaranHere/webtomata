# 0031. Formal language algebra and proper-order string enumeration workstation

Status: accepted (implemented in PR 104 on 2026-10-31).

## Context

In Theory of Computation (Rich Chapter 2; Fasilkom UI Week 1–2), formal languages are introduced as sets of strings over an alphabet $\Sigma$, defined either by set-builder predicates or algebraic operations over languages (finite sets, union, intersection, difference, symmetric difference, concatenation, concatenation powers, Kleene star, Kleene plus, and string reversal).

Students need to verify language definitions by listing strings in length-lexicographical proper order (shorter strings first, then alphabetical). Infinite languages cannot be listed entirely, and predicate-based definitions can cause infinite loops or excessive memory usage without strict computational bounds. Furthermore, the workstation must operate entirely client-side without degrading initial page load performance.

## Decision

- **Dedicated Engine Module:** Implemented an AST and evaluator in `crates/engine-core/src/language/` with public API `enumerate_language` exposed via `crates/engine-wasm/` and typed worker protocol RPCs (`web/src/lib/engine/protocol.ts`).
- **Language Expression AST:**
  - `LanguageExpr` supports explicit finite sets (`FiniteSet`), named language references (`Ref`), union (`Union`), intersection (`Intersection`), difference (`Difference`), concatenation (`Concat`), powers (`Power`), Kleene star (`Star`), Kleene plus (`Plus`), string reversal (`Reverse`), and predicate set-builder languages (`PredicateLanguage`).
  - `LanguagePredicate` supports linear character count comparisons (`CountLinearGte`, `CountLinearLte`, `CountEq`), character count modulo (`CountMod`), length constraints (`LengthGte`, `LengthLte`, `LengthEq`), palindrome testing (`IsPalindrome`), substring matching (`ContainsSubstring`), universal prefix/suffix invariants (`ForallPrefix`, `ForallSuffix`), negation (`Not`), conjunction (`And`), and disjunction (`Or`).
- **Parser Robustness:**
  - `LanguageParser` handles ASCII and Unicode operators (`∪`, `∩`, `−`, `⊕`, `*`, `+`, `^R`, `^k`), LaTeX command aliases (`\cup`, `\cap`), English word keywords (`UNION`, `INTERSECT`, `MINUS`, `XOR`), empty string representations (`ε`, `^`, `\epsilon`, `\lambda`), bracketed identifiers, and input length limits (`too_long` at 4,096 characters, `crates/engine-core/src/api.rs:374`).
  - Cyclic references between named languages are detected during recursive evaluation and rejected (`LanguageError::CyclicReference`).
- **Dual Evaluation Strategy:**
  - **Constructive Generation (`can_generate`):** For purely generative expressions (finite sets, union, concatenation, powers, star, plus, reversal, and difference/intersection where an operand can be generated), words of length $l$ are formed constructively without brute-forcing non-matching candidate strings (`crates/engine-core/src/language/mod.rs:528-710`).
  - **Candidate Generation and Filtering (`generate_and_test`):** For predicate languages and expressions that cannot be generated constructively, strings over the inferred alphabet $\Sigma$ are generated in proper order and tested with `contains(expr, w)` (`crates/engine-core/src/language/mod.rs:758-812`).
- **Proper Order Enumeration:**
  - Strings are sorted by `compare_proper_order` (`crates/engine-core/src/language/mod.rs:97-102`): shorter strings precede longer strings; strings of equal length are sorted alphabetically.
- **Safety Budgets and Bounds:**
  - **Candidate Inspection Budget:** Testing candidates in `generate_and_test` is strictly bounded by `budget = 50_000usize` (`crates/engine-core/src/language/mod.rs:758`). Search halts immediately when the budget reaches zero.
  - **Finite Language Bound Pruning:** `max_length(expr)` (`crates/engine-core/src/language/mod.rs:402-456`) computes the maximum word length for provably finite languages (e.g. finite sets, union/concatenation of finite sets, difference where the minuend is finite). If the minimum requested length exceeds this bound, enumeration returns empty immediately.
  - **Option Clamping:** In `crates/engine-core/src/api.rs:397-400`, minimum length is clamped between 0 and 100 (`min_length.clamp(0, 100)`), string count is clamped between 1 and 100 (`max_count.clamp(1, 100)`), and search depth is bounded by `30.max(min_length + 20)`. Default options in `EnumerateOptions` specify `min_length: 0`, `max_count: 10`, `max_depth: 30` (`crates/engine-core/src/language/mod.rs:118-122`).
- **UI Workstation Architecture:**
  - Built a 3-column workstation in `web/src/lib/language/LanguageWorkstation.svelte` (Library, Formula Editor with quick symbols and MathML notation preview, Output controls and results list).
  - Mode switching in `/sandbox` (`?mode=language`) with persistent custom languages stored in browser `localStorage`.
  - Dynamically imported in `web/src/routes/sandbox/+page.svelte` to avoid increasing initial route JavaScript bundle size.

## Consequences

- Students can explore language algebra and predicate set-builder notations with immediate proper-order feedback.
- Infinite languages and dense alphabets cannot freeze or hang the browser worker due to the 50,000 candidate inspection budget and depth clamping.
- Initial route bundle size remains well within the 170 KB gzip limit because the workstation is loaded on demand.
