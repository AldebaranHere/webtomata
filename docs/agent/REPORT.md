# Report — T-004

> Written by the worker at the end of the session. One file per task; overwrite each session.

## Task
- id: T-004
- title: Glossary entries and ADRs for the language and grammar engines
- branch: `task/T-004-adr-glossary-grammar-language`
- commit: `9d46f2f`
- pull request: https://github.com/AldebaranHere/webtomata/pull/116
- CI run: https://github.com/AldebaranHere/webtomata/actions/runs/41441069292

## What changed
- `docs/decisions/0031-language-enumeration.md`:
  - Created ADR 0031 in the standard format (Status, Context, Decision, Consequences) documenting the language enumeration engine from PR 104.
  - Documents the AST structures (`LanguageExpr`, `LanguagePredicate`), dual evaluation strategy (`can_generate` constructive word generator vs. `generate_and_test` candidate filtering), proper order sorting (`compare_proper_order`), candidate inspection safety budget (50,000 checks), bound pruning for provably finite languages (`max_length`), parameter clamping, and the 3-column workstation architecture.
- `docs/decisions/0032-grammar-cnf-cyk.md`:
  - Created ADR 0032 in the standard format documenting the context-free grammar, 6-phase CNF normalization, and CYK parsing engine from PR 105 and PR 112.
  - Documents the grammar data model and parser, the 6-phase CNF normalization pipeline in strict course lecture order (Phase 1 start symbol isolation, Phase 2 nullable expansion with a 10-variable combinatorial blowup guard, Phase 3 unit rule elimination via BFS unit pairs, Phase 4 unproductive-first then unreachable useless symbol elimination, Phase 5 terminal isolation for rules with body length $\ge 2$, and Phase 6 binarization for rules with body length $\ge 3$ with configurable `share_helpers` defaulting to false), the CYK triangular dynamic programming algorithm, and input string length bounds (100 characters max).
- `docs/glossary.md`:
  - Appended an "Added in the grammar and language workstations (`TODO(review)`)" paragraph listing all technical Indonesian terms introduced across `language.*` and `grammar.*` messages in `web/src/lib/i18n/id.ts` alongside their English counterparts.

---

## Acceptance Criteria Verification

### AC1: ADR Numbers and Code Locations
Every budget, limit, and constant quoted in the two ADRs exists directly in the codebase:

#### ADR 0031: Formal Language Algebra & Enumeration
- **Candidate inspection budget (50,000 checks)**: `crates/engine-core/src/language/mod.rs:758` (`let mut budget = 50_000usize;`).
- **Minimum length clamping (`0` to `100`)**: `crates/engine-core/src/api.rs:397` (`min_length: min_length.clamp(0, 100)`).
- **String count limit clamping (`1` to `100`)**: `crates/engine-core/src/api.rs:398` (`max_count: max_count.clamp(1, 100)`).
- **Search depth calculation (`30.max(min_length + 20)`)**: `crates/engine-core/src/api.rs:399` (`max_depth: 30.max(min_length + 20)`).
- **Default enumeration options (`min_length: 0`, `max_count: 10`, `max_depth: 30`)**: `crates/engine-core/src/language/mod.rs:118-122`.
- **Expression text length limit (4,096 characters)**: `crates/engine-core/src/api.rs:374` (`too_long(expr_text, "expression characters", 4096)`).

#### ADR 0032: Context-Free Grammar, CNF Normalization & CYK
- **Grammar text length limit (8,192 characters)**: `crates/engine-core/src/api.rs:414, 424, 437` (`too_long(grammar_text, "grammar characters", 8192)`).
- **CYK input text length limit (256 characters)**: `crates/engine-core/src/api.rs:438` (`too_long(input_word, "input characters", 256)`).
- **CYK maximum input string length (100 characters)**: `crates/engine-core/src/grammar/cyk.rs:28, 60` (`pub const MAX_INPUT_LEN: usize = 100;`).
- **Phase 2 nullable variable explosion guard (10 variables)**: `crates/engine-core/src/grammar/cnf.rs:212` (`if nullable_indices.len() > 10`).
- **Phase 5 mixed rule threshold (body length $\ge 2$)**: `crates/engine-core/src/grammar/cnf.rs:437` (`if rule.body.len() < 2`).
- **Phase 6 long rule threshold (body length $\ge 3$)**: `crates/engine-core/src/grammar/cnf.rs:499` (`if rule.body.len() <= 2`).
- **6 CNF Phases**: Phase 1 (`cnf.rs:135`), Phase 2 (`cnf.rs:161`), Phase 3 (`cnf.rs:262`), Phase 4 (`cnf.rs:341`), Phase 5 (`cnf.rs:429`), Phase 6 (`cnf.rs:488`).

### AC2: Glossary Term Coverage
All Indonesian technical terms in `web/src/lib/i18n/id.ts` under `language.*` and `grammar.*` that were not previously present in `docs/glossary.md` have been cataloged under "Added in the grammar and language workstations (`TODO(review)`)":
- Context-free grammar & CNF: *Tata bahasa bebas konteks* (context-free grammar / CFG), *Bentuk Normal Chomsky* (Chomsky Normal Form / CNF), *aturan produksi* (production rule), *variabel / nonterminal* (variable / nonterminal), *simbol terminal* (terminal symbol), *simbol awal* (start symbol), *ruas kiri* (left-hand side / LHS / head), *ruas kanan* (right-hand side / RHS / body), *alternatif* (alternative).
- Normalization phases: *aturan unit* (unit production), *pasangan unit* (unit pair), *variabel nullable* (nullable variable), *simbol tak berguna* (useless symbol), *tidak menghasilkan terminal* (unproductive), *tidak dapat dijangkau* (unreachable), *aturan campuran* (mixed production), *isolasi terminal* (terminal isolation), *binarisasi* (binarization), *variabel kaskade / variabel pembantu* (cascade variable / helper variable).
- CYK: *algoritma CYK* (CYK algorithm), *tabel dynamic programming* (dynamic programming table), *menurunkan / penurunan* (derive / derivation), *uji string* (string testing).
- Formal Language & Enumeration: *enumerasi kata* (string enumeration), *urutan leksikografis panjang / proper order* (length-lexicographical proper order), *beda simetris* (symmetric difference / XOR), *Kleene plus* (Kleene plus), *pembalikan string* (string reversal), *pangkat konkatenasi* (concatenation power), *awalan* (prefix), *akhiran* (suffix), *format string kosong* (empty string format: caret / epsilon), *formula bahasa* (language formula), *perpustakaan tata bahasa* (grammar library), *perpustakaan bahasa* (language library).

### AC3: Unclear Choices for Planner Review
1. **Enumeration max depth discrepancy**: In `crates/engine-core/src/api.rs:399`, `max_depth` is dynamically computed as `30.max(min_length + 20)`, whereas `EnumerateOptions::default()` in `crates/engine-core/src/language/mod.rs:120` hardcodes `max_depth: 30`. The reason for this difference between default struct instantiation and API parameter clamping is unrecorded.
2. **Candidate inspection budget hardcoding**: In `crates/engine-core/src/language/mod.rs:758`, the candidate testing budget is hardcoded as `let mut budget = 50_000usize;` within `enumerate()`, rather than being exposed as a configurable field in `EnumerateOptions` or `crates/engine-core/src/api.rs`. The reason is unrecorded.
3. **Intersection word generation heuristic**: In `can_generate_internal` for `LanguageExpr::Intersection(a, b)` (`crates/engine-core/src/language/mod.rs:613-628`), if both `a` and `b` can generate words, the evaluator always generates words from operand `a` and tests membership in `b`, regardless of which language has smaller cardinality or finite bounds. The reason is unrecorded.
4. **Phase 5 terminal helper sharing vs. Phase 6 `share_helpers`**: In `crates/engine-core/src/grammar/cnf.rs:453-462`, Phase 5 always reuses terminal helper variables ($T_a \to a$) across rules via `term_map: BTreeMap<char, String>`, regardless of whether `share_helpers` is `false` or `true`. Only Phase 6 binarization respects the `share_helpers` parameter. Furthermore, if the grammar already had an existing rule `A -> a`, Phase 5 introduces a new `T_a -> a` instead of reusing `A` (already noted as a lecture slide note difference in PR 112). The reason is unrecorded.
5. **Two different input length limits for CYK**: `CykParser::MAX_INPUT_LEN` is set to 100 in `crates/engine-core/src/grammar/cyk.rs:28`, but `crates/engine-core/src/api.rs:438` checks `too_long(input_word, "input characters", 256)` before calling the parser. Any string between 101 and 256 characters passes API validation but fails in `CykParser::parse` with `GrammarError::BudgetExceeded`. The reason for having divergent bounds is unrecorded.

---

## Verification Outputs

### 1. `pnpm format:check`
```
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

### 2. `pnpm check:strings`
```
$ node tools/check-strings.mjs
ok   62 components have no hard-coded text
```

### 3. Additional Guardrails and Checks
```
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
```

```
$ pnpm --filter web lint
$ eslint .
(exited 0 with no errors)
```

```
$ node tools/check-tokens-usage.mjs
ok   64 files use no raw colors
```

```
[pre-push] All fast CI checks passed.
```
