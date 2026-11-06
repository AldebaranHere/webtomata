# Task T-033 Report — PDA editor, part 1 of 5: the PDA document, its commands and its history

- **Task:** T-033
- **Branch:** `task/T-033-pda-document`
- **Status:** done

---

## 1. Hand Derivations (Derived Before Writing or Running Tests)

### 1.1 Transition Ordering Rule (`comparePdaTransitions`)

In the engine (`crates/engine-core/src/pda.rs`), `PdaTransition` derives `Ord` on:
1. `from: StateId` (ascending numeric state ID)
2. `read: Option<SymbolId>` (`None` / $\varepsilon$ comes before `Some(id)`, then ascending `SymbolId`, which is the index in `inputAlphabet`)
3. `pop: Vec<SymbolId>` (lexicographic comparison element-by-element by `SymbolId`, i.e., index in `stackAlphabet`; a shorter list that is a prefix of a longer list comes first)
4. `push: Vec<SymbolId>` (same lexicographic comparison by index in `stackAlphabet`)
5. `to: StateId` (ascending numeric state ID)

---

### 1.2 Fixture F1: $a^n b^n$ with $n \ge 1$ (`dpda`)

- **Kind:** `'dpda'`
- **States:** `q0` (`id: 0`, start, not accepting), `q1` (`id: 1`, accepting)
- **Input alphabet $\Sigma$:** `["a", "b"]` (`"a"` $\mapsto 0$, `"b"` $\mapsto 1$)
- **Stack alphabet $\Gamma$:** `["A"]` (`"A"` $\mapsto 0$)
- **Transitions in engine order (`from`, `read`, `pop`, `push`, `to`):**
  - Index `0`: `q0 a / ε / A q0` $\equiv$ `{ from: 0, read: "a", pop: [], push: ["A"], to: 0 }`
  - Index `1`: `q0 b / A / ε q1` $\equiv$ `{ from: 0, read: "b", pop: ["A"], push: [], to: 1 }`
  - Index `2`: `q1 b / A / ε q1` $\equiv$ `{ from: 1, read: "b", pop: ["A"], push: [], to: 1 }`
  - *Order check:* Indices `0` and `1` have `from = 0`; `"a"` (symbol 0) < `"b"` (symbol 1). Index `2` has `from = 1 > 0`.
- **Determinism (`pdaDeterminism`):**
  - At `q0`: transition `0` reads `"a"` and transition `1` reads `"b"` (neither is $\varepsilon$, and `"a" \ne "b"`). No competition.
  - At `q1`: only one outgoing transition (`2`).
  - Competing pairs: `[]` (0 pairs).
  - `validatePda`: `[]` (0 issues).
- **Hand trace — Accepted (`"aabb"`):**
  - Step 0 (start): `(q0, pos = 0, stack = [])`
  - Step 1 (via transition `0`, read `"a"`, pop `[]`, push `["A"]`): `(q0, pos = 1, stack = ["A"])`
  - Step 2 (via transition `0`, read `"a"`, pop `[]`, push `["A"]`): `(q0, pos = 2, stack = ["A", "A"])`
  - Step 3 (via transition `1`, read `"b"`, pop `["A"]`, push `[]`): `(q1, pos = 3, stack = ["A"])`
  - Step 4 (via transition `2`, read `"b"`, pop `["A"]`, push `[]`): `(q1, pos = 4, stack = [])`
  - All 4 input symbols consumed (`pos = 4`), stack is `[]`, and `q1` is accepting $\Rightarrow$ **Accepted**.
  - Other accepted strings in the spec: `"ab"` (`(q0,0,[]) → (q0,1,[A]) → (q1,2,[])`), `"aaabbb"` (3 pushes of `A` in `q0`, then 3 pops of `A` into `q1`).
- **Hand trace — Rejected (`"aab"`):**
  - Step 0 (start): `(q0, pos = 0, stack = [])`
  - Step 1 (via transition `0`, read `"a"`): `(q0, pos = 1, stack = ["A"])`
  - Step 2 (via transition `0`, read `"a"`): `(q0, pos = 2, stack = ["A", "A"])`
  - Step 3 (via transition `1`, read `"b"`, pop `["A"]`): `(q1, pos = 3, stack = ["A"])`
  - Input is exhausted (`pos = 3`), state `q1` is accepting, but stack `["A"]` is not empty (depth 1) and no $\varepsilon$-transition exists from `q1` $\Rightarrow$ **Rejected** (`pda.sim.stack_not_empty`).
  - Other rejected strings in the spec:
    - `""` ($\varepsilon$): starts and stays at `(q0, 0, [])`; `q0` is not accepting $\Rightarrow$ **Rejected**.
    - `"a"`: `(q0, 0, []) → (q0, 1, ["A"])`; not accepting and stack non-empty $\Rightarrow$ **Rejected**.
    - `"b"`: at `(q0, 0, [])`, transition `1` needs `"A"` on top of stack, so no move is possible; 1 input symbol left $\Rightarrow$ **Rejected**.
    - `"abb"`: reaches `(q1, 2, [])` after `"ab"`, cannot read the second `"b"` because stack is empty $\Rightarrow$ **Rejected**.
    - `"abab"`: reaches `(q1, 2, [])` after `"ab"`, no transition from `q1` reads `"a"` $\Rightarrow$ **Rejected**.
    - `"ba"`: stuck at `(q0, 0, [])` because stack is empty on `"b"` $\Rightarrow$ **Rejected**.

---

### 1.3 Fixture F2: $w c w^R, w \in \{a, b\}^*$ (`dpda`)

- **Kind:** `'dpda'`
- **States:** `q0` (`id: 0`, start, not accepting), `q1` (`id: 1`, accepting)
- **Input alphabet $\Sigma$:** `["a", "b", "c"]` (`"a"` $\mapsto 0$, `"b"` $\mapsto 1$, `"c"` $\mapsto 2$)
- **Stack alphabet $\Gamma$:** `["A", "B"]` (`"A"` $\mapsto 0$, `"B"` $\mapsto 1$)
- **Transitions in engine order (`from`, `read`, `pop`, `push`, `to`):**
  - Index `0`: `q0 a / ε / A q0` $\equiv$ `{ from: 0, read: "a", pop: [], push: ["A"], to: 0 }`
  - Index `1`: `q0 b / ε / B q0` $\equiv$ `{ from: 0, read: "b", pop: [], push: ["B"], to: 0 }`
  - Index `2`: `q0 c / ε / ε q1` $\equiv$ `{ from: 0, read: "c", pop: [], push: [], to: 1 }`
  - Index `3`: `q1 a / A / ε q1` $\equiv$ `{ from: 1, read: "a", pop: ["A"], push: [], to: 1 }`
  - Index `4`: `q1 b / B / ε q1` $\equiv$ `{ from: 1, read: "b", pop: ["B"], push: [], to: 1 }`
  - *Order check:* At `from = 0`, reads are `"a"` (0) < `"b"` (1) < `"c"` (2). At `from = 1`, reads are `"a"` (0) < `"b"` (1).
- **Determinism (`pdaDeterminism`):**
  - At `q0`: transitions `0, 1, 2` read distinct input symbols `"a"`, `"b"`, `"c"`, none is $\varepsilon$.
  - At `q1`: transitions `3, 4` read distinct input symbols `"a"`, `"b"` (and pop distinct symbols `["A"]`, `["B"]`).
  - Competing pairs: `[]` (0 pairs).
  - `validatePda`: `[]` (0 issues).
- **Hand trace — Accepted (`"abcba"`):**
  - Step 0 (start): `(q0, pos = 0, stack = [])`
  - Step 1 (via transition `0`, read `"a"`, push `["A"]`): `(q0, pos = 1, stack = ["A"])`
  - Step 2 (via transition `1`, read `"b"`, push `["B"]`): `(q0, pos = 2, stack = ["B", "A"])` (leftmost `"B"` is top)
  - Step 3 (via transition `2`, read `"c"`, pop `[]`, push `[]`): `(q1, pos = 3, stack = ["B", "A"])`
  - Step 4 (via transition `4`, read `"b"`, pop `["B"]`): `(q1, pos = 4, stack = ["A"])`
  - Step 5 (via transition `3`, read `"a"`, pop `["A"]`): `(q1, pos = 5, stack = [])`
  - Input consumed (`pos = 5`), stack empty (`[]`), state `q1` accepting $\Rightarrow$ **Accepted**.
- **Hand trace — Rejected (`"abca"`):**
  - Step 0 (start): `(q0, pos = 0, stack = [])`
  - Step 1 (via transition `0`, read `"a"`): `(q0, pos = 1, stack = ["A"])`
  - Step 2 (via transition `1`, read `"b"`): `(q0, pos = 2, stack = ["B", "A"])`
  - Step 3 (via transition `2`, read `"c"`): `(q1, pos = 3, stack = ["B", "A"])`
  - At `pos = 3`, next input symbol is `"a"`, which requires transition `3` (`pop: ["A"]`), but top of stack is `"B"`. No transition can fire; 1 input symbol remains $\Rightarrow$ **Rejected** (`pda.sim.input_left`).
- **Exhaustive range check:** Over $\Sigma = \{a, b, c\}$ for lengths $0 \dots 7$, there are $\sum_{k=0}^7 3^k = \frac{3^8 - 1}{2} = 3280$ strings; F2 accepts iff the string has a single `"c"` at the middle index and the suffix after `"c"` is the reversal of the prefix before `"c"`.

---

### 1.4 Fixture F3: $w w^R$, even palindromes over $\{a, b\}$ (`ndpda`)

- **Kind:** `'ndpda'`
- **States:** `q0` (`id: 0`, start, not accepting), `q1` (`id: 1`, accepting)
- **Input alphabet $\Sigma$:** `["a", "b"]` (`"a"` $\mapsto 0$, `"b"` $\mapsto 1$)
- **Stack alphabet $\Gamma$:** `["A", "B"]` (`"A"` $\mapsto 0$, `"B"` $\mapsto 1$)
- **Transitions in engine order (`from`, `read`, `pop`, `push`, `to`):**
  - Index `0`: `q0 ε / ε / ε q1` $\equiv$ `{ from: 0, read: null, pop: [], push: [], to: 1 }`
  - Index `1`: `q0 a / ε / A q0` $\equiv$ `{ from: 0, read: "a", pop: [], push: ["A"], to: 0 }`
  - Index `2`: `q0 b / ε / B q0` $\equiv$ `{ from: 0, read: "b", pop: [], push: ["B"], to: 0 }`
  - Index `3`: `q1 a / A / ε q1` $\equiv$ `{ from: 1, read: "a", pop: ["A"], push: [], to: 1 }`
  - Index `4`: `q1 b / B / ε q1` $\equiv$ `{ from: 1, read: "b", pop: ["B"], push: [], to: 1 }`
  - *Order check:* At `from = 0`, `read: null` ($\varepsilon$, `-1`) comes before `read: "a"` (`0`), which comes before `read: "b"` (`1`). Thus `q0 ε/ε/ε q1` is transition `0`, `q0 a/ε/A q0` is transition `1`, and `q0 b/ε/B q0` is transition `2`. At `from = 1`, `read: "a"` (`0`) comes before `read: "b"` (`1`).
- **Determinism (`pdaDeterminism`):**
  - At `q0` (`from: 0`):
    - Pair `(0, 1)`: transition `0` has `read: null` ($\varepsilon$) and `pop: []`; transition `1` has `read: "a"` and `pop: []`. Since one reads $\varepsilon$ and `[]` is a prefix of `[]`, they compete $\Rightarrow$ `{ from: 0, first: 0, second: 1 }`.
    - Pair `(0, 2)`: transition `0` has `read: null` ($\varepsilon$) and `pop: []`; transition `2` has `read: "b"` and `pop: []`. Since one reads $\varepsilon$ and `[]` is a prefix of `[]`, they compete $\Rightarrow$ `{ from: 0, first: 0, second: 2 }`.
    - Pair `(1, 2)`: transition `1` reads `"a"` and transition `2` reads `"b"`. Neither is $\varepsilon$ and `"a" \ne "b"`, so they do **not** compete.
  - At `q1` (`from: 1`):
    - Pair `(3, 4)`: transition `3` reads `"a"` (`pop: ["A"]`) and transition `4` reads `"b"` (`pop: ["B"]`). They do **not** compete.
  - Competing pairs: **exactly 2**: `[{ from: 0, first: 0, second: 1 }, { from: 0, first: 0, second: 2 }]`.
- **Hand trace — Accepted (`"abba"`):**
  - Step 0 (start): `(q0, pos = 0, stack = [])`
  - Step 1 (via transition `1`, read `"a"`, push `["A"]`): `(q0, pos = 1, stack = ["A"])`
  - Step 2 (via transition `2`, read `"b"`, push `["B"]`): `(q0, pos = 2, stack = ["B", "A"])`
  - Step 3 (via transition `0`, read $\varepsilon$, pop `[]`, push `[]`): `(q1, pos = 2, stack = ["B", "A"])`
  - Step 4 (via transition `4`, read `"b"`, pop `["B"]`): `(q1, pos = 3, stack = ["A"])`
  - Step 5 (via transition `3`, read `"a"`, pop `["A"]`): `(q1, pos = 4, stack = [])`
  - Input consumed (`pos = 4`), stack empty (`[]`), state `q1` accepting $\Rightarrow$ **Accepted**.
  - Note on `""` ($\varepsilon$): `(q0, 0, []) →[t0] (q1, 0, [])` $\Rightarrow$ **Accepted**.
- **Hand trace — Rejected (`"ab"`):**
  - Level 0: `{(q0, 0, [])}`
  - Level 1: `{(q1, 0, []), (q0, 1, ["A"])}` (via `t0` and `t1`)
  - Level 2: from `(q1, 0, [])` no transition can fire (stack is empty); from `(q0, 1, ["A"])` `t0` gives `(q1, 1, ["A"])` and `t2` gives `(q0, 2, ["B", "A"])`.
  - Level 3: from `(q1, 1, ["A"])` next symbol is `"b"` which needs `"B"` on top (cannot fire); from `(q0, 2, ["B", "A"])` `t0` gives `(q1, 2, ["B", "A"])`.
  - Level 4: no further transitions. Best final configuration is `(q1, pos = 2, stack = ["B", "A"])`, where input is exhausted and `q1` is accepting, but stack has 2 symbols remaining $\Rightarrow$ **Rejected** (`pda.sim.stack_not_empty { depth: 2 }`).
- **Exhaustive range check:** Over $\Sigma = \{a, b\}$ for lengths $0 \dots 8$, there are $\sum_{k=0}^8 2^k = 511$ strings; F3 accepts iff `w.length % 2 === 0` and `w === reverse(w)`.

---

## 2. Deliberate Breaks (Shown Failing Before Restoration)

### 2.0 Tests Written First (Before Implementation)

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-document.test.ts src/lib/editor/pda-commands.test.ts src/lib/editor/pda-history.property.test.ts src/lib/editor/pda-document.wasm.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-history.property.test.ts (0 test)
 ❯ src/lib/editor/pda-document.wasm.test.ts (0 test)
 ❯ src/lib/editor/pda-commands.test.ts (0 test)
 ❯ src/lib/editor/pda-document.test.ts (0 test)

 FAIL  src/lib/editor/pda-commands.test.ts [ src/lib/editor/pda-commands.test.ts ]
Error: Cannot find module './pda-document.ts' imported from /home/Aldebaran64/webtomata/web/src/lib/editor/pda-commands.test.ts

 Test Files  4 failed (4)
      Tests  no tests
```

### 2.1 Note (1): Broken `toEnginePda` (Swapping `pop` and `push`)

Swapped `pop: [...t.push]` and `push: [...t.pop]` inside `toEnginePda(doc)` in `web/src/lib/editor/pda-document.ts`:

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-document.wasm.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-document.wasm.test.ts (5 tests | 5 failed) 77ms
   ❯ AC1: F1, F2, F3 against the real WASM engine (3)
     × F1 (a^n b^n, n >= 1, DPDA): accepts ab, aabb, aaabbb; rejects ε, a, b, aab, abb, abab, ba; 0 competing pairs; 0 issues 14ms
     × F2 (wcw^R, DPDA): matches the wcw^R predicate for every string over {a,b,c} up to length 7 (3,280 strings) and has 0 competing pairs 5ms
     × F3 (ww^R, even palindromes, NDPDA): matches the even palindrome predicate (ε included) for every string over {a,b} up to length 8 (511 strings) and has exactly 2 competing pairs 2ms
   ❯ AC2 (F4) and AC4: transition sort order and engine acceptance on random documents (2)
     × F4: for 200 random documents, doc.transitions order matches loadPda(toEnginePda(doc)).value.transitions 7ms
     × AC4: for 500 random valid documents, the engine accepts toEnginePda(doc) unchanged 18ms

 FAIL  src/lib/editor/pda-document.wasm.test.ts > AC1: F1, F2, F3 against the real WASM engine > F1 (a^n b^n, n >= 1, DPDA): accepts ab, aabb, aaabbb; rejects ε, a, b, aab, abb, abab, ba; 0 competing pairs; 0 issues
AssertionError: ab: expected false to be true // Object.is equality
```

Restored `toEnginePda`.

### 2.2 AC7 Break 1: Sort `pop` Lists by Name Instead of by Symbol Number (F4 Fails)

Changed `compareSymbolSlices` in `web/src/lib/editor/pda-document.ts` to compare symbol strings lexicographically (`a[i]! < b[i]! ? -1 : 1`) instead of by `stackAlphabet.indexOf`:

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-document.wasm.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-document.wasm.test.ts (5 tests | 2 failed) 304ms
   ❯ AC2 (F4) and AC4: transition sort order and engine acceptance on random documents (2)
     × F4: for 200 random documents, doc.transitions order matches loadPda(toEnginePda(doc)).value.transitions 29ms
     × AC4: for 500 random valid documents, the engine accepts toEnginePda(doc) unchanged 4ms

 FAIL  src/lib/editor/pda-document.wasm.test.ts > AC2 (F4) and AC4: transition sort order and engine acceptance on random documents > F4: for 200 random documents, doc.transitions order matches loadPda(toEnginePda(doc)).value.transitions
AssertionError: seed 70 transition order: expected [ Array(6) ] to deeply equal [ Array(6) ]
```

Restored `compareSymbolSlices`.

### 2.3 AC7 Break 2: Drop the "Removes Its Transitions" Rule of `removeState` (Engine Check Fails)

Removed transition filtering in `case 'removeState'` of `web/src/lib/editor/pda-commands.ts`:

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-document.wasm.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-document.wasm.test.ts (5 tests | 2 failed) 305ms
   ❯ AC2 (F4) and AC4: transition sort order and engine acceptance on random documents (2)
     × F4: for 200 random documents, doc.transitions order matches loadPda(toEnginePda(doc)).value.transitions 13ms
     × AC4: for 500 random valid documents, the engine accepts toEnginePda(doc) unchanged 5ms

 FAIL  src/lib/editor/pda-document.wasm.test.ts > AC2 (F4) and AC4: transition sort order and engine acceptance on random documents > AC4: for 500 random valid documents, the engine accepts toEnginePda(doc) unchanged
AssertionError: seed 4: expected { ok: false, error: { …(2) } } to deeply equal { ok: true, value: { …(8) } }
+   "error": {
+     "key": "machine.unknown_state",
+     "params": {
+       "state": 2,
+     },
+   },
+   "ok": false,
```

Restored `removeState`.

### 2.4 AC7 Break 3: Let `removeStackSymbol` Leave the Transitions That Use It (Engine Rejects Document)

Removed transition filtering in `case 'removeStackSymbol'` of `web/src/lib/editor/pda-commands.ts`:

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-document.wasm.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-document.wasm.test.ts (5 tests | 2 failed) 292ms
   ❯ AC2 (F4) and AC4: transition sort order and engine acceptance on random documents (2)
     × F4: for 200 random documents, doc.transitions order matches loadPda(toEnginePda(doc)).value.transitions 10ms
     × AC4: for 500 random valid documents, the engine accepts toEnginePda(doc) unchanged 11ms

 FAIL  src/lib/editor/pda-document.wasm.test.ts > AC2 (F4) and AC4: transition sort order and engine acceptance on random documents > AC4: for 500 random valid documents, the engine accepts toEnginePda(doc) unchanged
AssertionError: seed 26: expected { ok: false, error: { …(2) } } to deeply equal { ok: true, value: { …(8) } }
+   "error": {
+     "key": "machine.unknown_symbol",
+     "params": {
+       "symbol": "Z",
+     },
+   },
+   "ok": false,
```

Restored `removeStackSymbol`.

### 2.5 AC7 Break 4: Let `addTransition` Accept an Unknown Symbol (F5 Fails)

Removed `!doc.inputAlphabet.includes` and `!doc.stackAlphabet.includes` checks in `case 'addTransition'` of `web/src/lib/editor/pda-commands.ts`:

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-commands.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-commands.test.ts (11 tests | 2 failed) 106ms
   ❯ PDA transitions, F4 (engine order) and F5 (refusals) (3)
     × F5: refuses pop or push longer than 64 symbols, unknown symbol, duplicate transition, and ε as a symbol 6ms
   ❯ no-op commands and batch atomicity (2)
     × batch is atomic: if one inner command is refused, the whole batch is refused and nothing changes 1ms

 FAIL  src/lib/editor/pda-commands.test.ts > PDA transitions, F4 (engine order) and F5 (refusals) > F5: refuses pop or push longer than 64 symbols, unknown symbol, duplicate transition, and ε as a symbol
AssertionError: {"type":"addTransition","from":0,"read":"a","pop":[],"push":["Z"],"to":1}: expected true to be false // Object.is equality
```

Restored `addTransition`.

### 2.6 AC7 Break 5: Make `createPdaHistory` Use the FSM `applyCommand` (AC5 Fails)

Bound `createPdaHistory` in `web/src/lib/editor/history.ts` to the FSM `applyCommand` instead of `applyPdaCommand`:

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-history.property.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-history.property.test.ts (5 tests | 1 failed) 422ms
   ❯ PDA history property tests (seed offset 0) (5)
     × covers all 15 command types through createPdaHistory and produces non-empty states, alphabets and transitions 30ms

 FAIL  src/lib/editor/pda-history.property.test.ts > PDA history property tests (seed offset 0) > covers all 15 command types through createPdaHistory and produces non-empty states, alphabets and transitions
AssertionError: expected 0 to be greater than 150
 ❯ src/lib/editor/pda-history.property.test.ts:153:21
```

Restored `createPdaHistory`.

### 2.7 AC7 Break 6: Let `batch` Apply Half of Its Commands When One Is Refused (AC5 Fails)

Changed `if (!result.ok) return result;` in `case 'batch'` of `web/src/lib/editor/pda-commands.ts` to `if (!result.ok) return done(working);`:

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-history.property.test.ts src/lib/editor/pda-commands.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-commands.test.ts (11 tests | 1 failed) 119ms
   ❯ no-op commands and batch atomicity (2)
     × batch is atomic: if one inner command is refused, the whole batch is refused and nothing changes 7ms
 ❯ src/lib/editor/pda-history.property.test.ts (5 tests | 1 failed) 472ms
   ❯ PDA history property tests (seed offset 0) (5)
     × a moveState gesture with one coalesce key is one step, and returning to the start leaves no step 8ms

 FAIL  src/lib/editor/pda-history.property.test.ts > PDA history property tests (seed offset 0) > a moveState gesture with one coalesce key is one step, and returning to the start leaves no step
AssertionError: expected true to be false // Object.is equality
 ❯ src/lib/editor/pda-history.property.test.ts:137:23
    137|   expect(batchRes.ok).toBe(false);
```

Restored `batch`.

### 2.8 AC7 Break 7: Remove the Size Check of `parsePdaDocumentText` (F5 Fails)

Removed the `LIMITS.documentBytes` size check in `parsePdaDocumentText` of `web/src/lib/editor/pda-document.ts`:

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-document.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-document.test.ts (13 tests | 1 failed) 134ms
   ❯ F5: limits and untrusted input in parsePdaDocument and parsePdaDocumentText (7)
     × refuses "", "null", "[]", a 2 MiB text, a missing state in a transition, a duplicate symbol in an alphabet, and an extra field without throwing 13ms

 FAIL  src/lib/editor/pda-document.test.ts > F5: limits and untrusted input in parsePdaDocument and parsePdaDocumentText > refuses "", "null", "[]", a 2 MiB text, a missing state in a transition, a duplicate symbol in an alphabet, and an extra field without throwing
AssertionError: expected { ok: false, error: { …(2) } } to deeply equal { ok: false, error: { …(2) } }

- Expected
+ Received

  {
    "error": {
-     "key": "document.limit_exceeded",
+     "key": "document.invalid_file",
      "params": {
-       "limit": 1048576,
-       "what": "bytes",
+       "at": "json",
      },
    },
    "ok": false,
  }
```

Restored `parsePdaDocumentText`.

### 2.9 Break 8 (Fix Round): Ignore `push` in `pdaDocumentsEqual`

Removed `&& same(p.push, q.push, (x, y) => x === y)` from `pdaDocumentsEqual` in `web/src/lib/editor/pda-document.ts`:

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-document.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-document.test.ts (15 tests | 1 failed) 120ms
   ❯ pdaDocumentsEqual (2)
     ✓ returns true for two equal but separately built documents 1ms
     × returns false for every single-field difference 7ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/lib/editor/pda-document.test.ts > pdaDocumentsEqual > returns false for every single-field difference
AssertionError: transition push symbol: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/lib/editor/pda-document.test.ts:469:48
    467|
    468|   for (const { label, doc } of cases) {
    469|    expect(pdaDocumentsEqual(base, doc), label).toBe(false);
       |                                                ^
    470|   }
    471|  });
```

Restored `pdaDocumentsEqual`.

### 2.10 Break 9 (Fix Round): Drop the Depth Check in `batch`

Removed `depth >= LIMITS.batchDepth ||` from `case 'batch'` in `web/src/lib/editor/pda-commands.ts`:

```text
$ pnpm --filter web exec vitest run src/lib/editor/pda-commands.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ❯ src/lib/editor/pda-commands.test.ts (12 tests | 1 failed) 106ms
   ❯ no-op commands and batch atomicity (3)
     ✓ returns the exact same document reference when a command changes nothing 0ms
     ✓ batch is atomic: if one inner command is refused, the whole batch is refused and nothing changes 0ms
     × refuses nested batches deeper than LIMITS.batchDepth (8) leaving the document unchanged, and accepts 10,000 commands while refusing 10,001 9ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/lib/editor/pda-commands.test.ts > no-op commands and batch atomicity > refuses nested batches deeper than LIMITS.batchDepth (8) leaving the document unchanged, and accepts 10,000 commands while refusing 10,001
AssertionError: expected { ok: true, doc: { …(10) } } to deeply equal { ok: false, error: { …(2) } }

- Expected
+ Received

  {
-   "error": {
-     "key": "document.limit_exceeded",
-     "params": {
-       "limit": 8,
-       "what": "batch",
-     },
-   },
-   "ok": false,
+   "doc": { ... },
+   "ok": true,
  }

 ❯ src/lib/editor/pda-commands.test.ts:323:24
```

Restored `batch`.

---

## 3. Three Seeded Runs of `pda-history.property.test.ts` (AC5)

```text
$ PDA_SEED_OFFSET=0 pnpm --filter web exec vitest run src/lib/editor/pda-history.property.test.ts && PDA_SEED_OFFSET=1000 pnpm --filter web exec vitest run src/lib/editor/pda-history.property.test.ts && PDA_SEED_OFFSET=2000 pnpm --filter web exec vitest run src/lib/editor/pda-history.property.test.ts

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/editor/pda-history.property.test.ts (5 tests) 414ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  19:32:57
   Duration  657ms (tests 75%, transform 20%, import 4%, worker 1%)


 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/editor/pda-history.property.test.ts (5 tests) 420ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  19:32:58
   Duration  670ms (tests 74%, transform 21%, import 4%, worker 1%)


 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/editor/pda-history.property.test.ts (5 tests) 421ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  19:32:59
   Duration  726ms (tests 75%, transform 20%, import 4%, worker 1%)
```

---

## 4. Verification Outputs

### 4.1 Static Checks (`format:check`, `check`, `lint`, `check:strings`, `check:tokens`)

```text
$ pnpm format:check && pnpm check && pnpm lint && pnpm check:strings && pnpm check:tokens
$ pnpm --filter web format:check && cargo fmt --check
$ prettier --check .
Checking formatting...
All matched files use Prettier code style!
$ pnpm --filter web check
$ svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings
Loading svelte-check in workspace: /home/Aldebaran64/webtomata/web
Getting Svelte diagnostics...

svelte-check found 0 errors and 0 warnings
$ pnpm --filter web lint
$ eslint .
$ node tools/check-strings.mjs
ok   63 components have no hard-coded text
$ node tools/check-tokens-usage.mjs
ok   65 files use no raw colors
```

### 4.2 Unit, Property and WASM Tests (`vitest run`)

```text
$ pnpm --filter web exec vitest run

 RUN  v5.0.3 /home/Aldebaran64/webtomata/web

 ✓ src/lib/editor/interaction/editor.test.ts (41 tests) 473ms
 ✓ src/lib/editor/conversion.wasm.test.ts (49 tests) 785ms
 ✓ src/lib/editor/diagram/geometry.test.ts (38 tests) 979ms
 ✓ src/lib/share/link.test.ts (15 tests) 1310ms
 ✓ src/lib/editor/compare.wasm.test.ts (6 tests) 402ms
 ✓ src/lib/editor/commands.test.ts (26 tests) 352ms
 ✓ src/lib/questions/check.wasm.test.ts (27 tests) 497ms
 ✓ src/lib/editor/pda-document.wasm.test.ts (5 tests) 1530ms
 ✓ src/lib/editor/pda-history.property.test.ts (5 tests) 1798ms
 ✓ src/lib/grammar/grammar-text.wasm.test.ts (31 tests) 169ms
 ✓ src/lib/editor/history.property.test.ts (7 tests) 1959ms
 ✓ src/lib/editor/run.wasm.test.ts (29 tests) 175ms
 ✓ src/lib/questions/load.test.ts (32 tests) 451ms
 ✓ src/lib/engine/handlers.test.ts (20 tests) 102ms
 ✓ src/lib/editor/regex-simplify.wasm.test.ts (6 tests) 306ms
 ✓ src/lib/editor/document.wasm.test.ts (10 tests) 2116ms
 ✓ src/lib/share/files.wasm.test.ts (6 tests | 1 skipped) 235ms
 ✓ src/lib/editor/regex-conversion.wasm.test.ts (4 tests) 113ms
 ✓ src/lib/questions/grade.wasm.test.ts (13 tests) 375ms
 ✓ src/lib/editor/document.test.ts (32 tests) 227ms
 ✓ src/lib/i18n/i18n.test.ts (14 tests) 216ms
 ✓ src/lib/editor/pda-commands.test.ts (12 tests) 344ms
 ✓ src/lib/questions/summaries.test.ts (10 tests) 175ms
 ✓ src/lib/editor/regex-compile.wasm.test.ts (5 tests) 104ms
 ✓ src/lib/editor/pda-document.test.ts (15 tests) 301ms
 ✓ src/lib/engine/client.test.ts (30 tests) 58ms
 ✓ src/lib/editor/table.test.ts (22 tests) 76ms
 ✓ src/lib/share/image.test.ts (10 tests) 29ms
 ✓ src/lib/questions/question.test.ts (4 tests) 18ms
 ✓ src/lib/storage/autosave.test.ts (12 tests) 38ms
 ✓ src/lib/storage/autosave.tests-field.test.ts (9 tests) 69ms
 ✓ src/lib/storage/library.test.ts (21 tests) 44ms
 ✓ src/lib/editor/interaction/camera.test.ts (25 tests) 46ms
 ✓ src/lib/editor/tester.test.ts (11 tests) 25ms
 ✓ src/lib/questions/grade.test.ts (20 tests) 25ms
 ✓ src/lib/editor/interaction/keys.test.ts (49 tests) 19ms
 ✓ src/lib/examples/examples.test.ts (9 tests) 14ms
 ✓ src/lib/editor/interaction/editor.apply.test.ts (7 tests) 7ms
 ✓ src/lib/editor/layout-client.test.ts (9 tests) 17ms
 ✓ src/lib/editor/history.test.ts (20 tests) 18ms
 ✓ src/lib/storage/machines.test.ts (8 tests) 14ms
 ✓ src/lib/guides/load.test.ts (10 tests) 68ms
 ✓ src/lib/storage/question-work.test.ts (13 tests) 27ms
 ✓ src/lib/storage/autosave.progress.test.ts (8 tests) 10ms
 ✓ src/lib/storage/example.test.ts (6 tests) 22ms
 ✓ src/lib/questions/machine.test.ts (13 tests) 11ms
 ✓ src/lib/share/files.test.ts (11 tests) 25ms
 ✓ src/lib/questions/list.test.ts (14 tests) 14ms
 ✓ src/lib/examples/examples.wasm.test.ts (6 tests) 14ms
 ✓ src/lib/share/local-jff.test.ts (6 tests) 17ms
 ✓ src/lib/editor/interaction/editor.states.test.ts (17 tests) 21ms
 ✓ src/lib/editor/interaction/editor.link.test.ts (19 tests) 48ms
 ✓ src/lib/editor/regex-compile.test.ts (15 tests) 10ms
 ✓ src/lib/editor/test-list.test.ts (13 tests) 13ms
 ✓ src/lib/editor/regex-simplify.test.ts (12 tests) 10ms
 ✓ src/lib/lint.test.ts (2 tests) 3293ms
 ✓ src/lib/storage/progress.test.ts (13 tests) 7ms
 ✓ src/lib/share/open-file.test.ts (13 tests) 10ms
 ✓ src/lib/share/open-file.wasm.test.ts (8 tests | 1 skipped) 15ms
 ✓ src/lib/editor/regex-conversion.test.ts (13 tests) 6ms
 ✓ src/lib/editor/interaction/editor.edges.test.ts (15 tests) 16ms
 ✓ src/lib/editor/checks.test.ts (7 tests) 3ms
 ✓ src/lib/storage/tests-field.test.ts (7 tests) 8ms
 ✓ src/lib/editor/definition.test.ts (10 tests) 3ms
 ✓ src/lib/editor/interaction/label.test.ts (14 tests) 8ms
 ✓ src/lib/editor/regex-math.test.ts (8 tests) 4ms
 ✓ src/lib/editor/interaction/selection.test.ts (11 tests) 15ms
 ✓ src/lib/questions/feedback-text.test.ts (14 tests) 15ms
 ✓ src/lib/editor/panel-width.test.ts (13 tests) 3ms
 ✓ src/lib/editor/tour.test.ts (8 tests) 6ms
 ✓ src/lib/editor/interaction/canvas.test.ts (12 tests) 8ms
 ✓ src/lib/editor/compare.test.ts (11 tests) 9ms
 ✓ src/lib/editor/checker.test.ts (6 tests) 9ms
 ✓ src/lib/questions/answer.test.ts (7 tests) 15ms
 ✓ src/lib/grammar/grammar-text.test.ts (19 tests) 8ms
 ✓ src/lib/grammar/presets.test.ts (4 tests) 3ms
 ✓ src/lib/editor/panel-height.test.ts (12 tests) 5ms
 ✓ src/lib/language/language-math.test.ts (5 tests) 2ms
 ✓ src/lib/editor/layout.test.ts (16 tests) 3238ms
 ✓ src/lib/guides/list.test.ts (3 tests) 4ms
 ✓ src/lib/questions/feedback-view.test.ts (6 tests) 2ms
 ✓ src/lib/editor/conversion-text.test.ts (4 tests) 5ms
 ✓ src/lib/storage/memory.test.ts (5 tests) 2ms
 ✓ src/lib/engine/problem.test.ts (5 tests) 3ms
 ✓ src/lib/storage/migrate.test.ts (9 tests) 4ms
 ✓ src/lib/editor/panel-tab.test.ts (8 tests) 4ms
 ✓ src/lib/editor/interaction/placement.test.ts (7 tests) 4ms
 ✓ src/lib/language/presets.test.ts (2 tests) 1ms
 ✓ src/lib/editor/interaction/menu.test.ts (4 tests) 3ms
 ✓ src/lib/questions/statement-fold.test.ts (4 tests) 1ms
 ✓ src/lib/storage/titles.test.ts (3 tests) 2ms
 ✓ src/lib/editor/run-text.test.ts (7 tests) 4ms
 ✓ src/lib/seo.test.ts (1 test) 2ms
 ✓ src/lib/editor/table-grid.test.ts (4 tests) 6ms
 ✓ src/lib/questions/statement.test.ts (12 tests) 10ms
 ✓ src/lib/editor/interaction/editor.property.test.ts (4 tests) 3337ms

 Test Files  96 passed (96)
      Tests  1221 passed | 2 skipped (1223)
   Start at  20:10:02
   Duration  4.28s (tests 65%, transform 25%, import 10%)
```

### 4.3 Bundle Size Before and After (`pnpm build && pnpm size`, AC8)

**Before (baseline on `staging` at `d55d29b`):**

```text
$ pnpm size
$ node tools/check-size.mjs
ok   initial JS index.html: 81.1 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 86.0 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 80.2 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 119.4 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 119.0 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 119.0 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 119.0 KB gzip (limit 170 KB)
ok   initial JS soal.html: 81.7 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 79.5 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

**After:**

```text
$ pnpm build && pnpm size
$ node tools/check-size.mjs
ok   initial JS index.html: 81.3 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 86.2 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 80.4 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 119.7 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 119.3 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 119.3 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 119.3 KB gzip (limit 170 KB)
ok   initial JS soal.html: 81.9 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 79.7 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```

(The +0.2 KB difference across routes is from the four new `pda_document.*` i18n message strings in `id.ts` and `en.ts`, and +0.1 KB on `sandbox.html`/`soal/*.html` from the generic wrapper in `history.ts`.)

---

## 5. Notes & Observations

- **Duplicate transition handling in `addTransition`:** Matching `commands.ts` (`addTransition` in the FSM editor, which refuses duplicates with `document.duplicate_transition`), `applyPdaCommand`'s `addTransition` refuses a duplicate `(from, read, pop, push, to)` transition with `pda_document.duplicate_transition` rather than silently returning a no-op.
- **`checkPdaDocument` location:** Kept in the test support module `web/src/lib/editor/testing.ts` rather than exported from `pda-document.ts`.
- **`web/eslint.config.js` exemption:** Added `'src/lib/editor/pda-document.wasm.test.ts'` to the `no-restricted-imports` override list (the same exemption granted to all other `*.wasm.test.ts` files that load the WASM engine bindings directly in Node).
- **What was not run:** No e2e tests or Rust `cargo test` were needed because this task touches no UI routes/components and no Rust code.

---

## 6. Fix Round (PR #165 Review)

### 6.1 Root Cause of Trailing `r` Corruption in `docs/agent/PLAN.md` and `docs/ARCHITECTURE.md`

In the initial session, `sed -i s/\r$// docs/ARCHITECTURE.md docs/agent/PLAN.md ...` was executed inside `wsl.exe ... -e bash -lc '...'` without inner quotes around `s/\r$//`. Because `\r` was unquoted inside the `bash -lc` command string, bash stripped the backslash before passing the argument to `sed`, turning `s/\r$//` into `s/r$//` and stripping any literal trailing `r` at the end of a line (43 lines in `docs/agent/PLAN.md` and 2 lines in `docs/ARCHITECTURE.md`).

Both files were restored from `origin/staging` (`git checkout origin/staging -- docs/agent/PLAN.md docs/ARCHITECTURE.md`) and only the intended edits were re-applied:

```text
$ git diff origin/staging...HEAD -- docs/agent/PLAN.md docs/ARCHITECTURE.md
diff --git a/docs/ARCHITECTURE.md b/docs/ARCHITECTURE.md
index 997c88a..3cc6842 100644
--- a/docs/ARCHITECTURE.md
+++ b/docs/ARCHITECTURE.md
@@ -52,7 +52,8 @@ The machine that the user edits is a **document** (`web/src/lib/editor/`): plain
 - **Commands** are plain data (`addState`, `moveState`, `addTransition`, `removeSymbol`, `batch`, and so on). `applyCommand(doc, command)` is a pure function that gives a new document or an error message; it never throws, and a refused command changes nothing.
 - **History** (`createHistory`) keeps earlier versions of the document, so undo gives back exactly the earlier one. One gesture is one step: commands with the same `coalesce` key merge, and `seal()` ends the group. Undo covers document edits only (not selection, pan or zoom). The depth is 200 steps.
 - **Files** (`serializeDocument`, `parseDocumentText`) are read strictly, with a size limit and no unknown fields. `documentFromJff` and `jffLayout` move names and places to and from a JFLAP file (FA `<type>fa</type>` and PDA `<type>pda</type>`).
-- See ADR 0017 for the decisions, and `docs/ux/editor-interactions.md` (U3, not written yet) for how the editor uses the commands.
+- **PDA document** (`PdaDocument`, `applyPdaCommand`, `createPdaHistory`, `toEnginePda`, `fromEnginePda`) mirrors the FSM document for pushdown automata, sharing the generic undo/redo history while keeping `MachineDocument` untouched.
+- See ADR 0017 and ADR 0041 for the decisions, and `docs/ux/editor-interactions.md` (U3, not written yet) for how the editor uses the commands.
 
 ## Trust boundary
 
diff --git a/docs/agent/PLAN.md b/docs/agent/PLAN.md
index f7a6da9..6150db2 100644
--- a/docs/agent/PLAN.md
+++ b/docs/agent/PLAN.md
@@ -1873,7 +1873,7 @@ Run both AC3 proptests with `PROPTEST_CASES=1000` three times in a row and paste
 
 ## Task T-033 — PDA editor, part 1 of 5: the PDA document, its commands and its history
 
-**Status:** todo
+**Status:** done
 **Owner:** worker
 **Branch:** `task/T-033-pda-document`
 
```

### 6.2 Check That No Other File in the PR Lost a Final Letter

Checked by running `git diff -U0 origin/staging...HEAD` across every modified file in `git diff --name-only origin/staging...HEAD` (excluding `docs/agent/REPORT.md`, which is replaced per task) and inspecting every removed (`-`) line, as well as reading `docs/decisions/0041-pda-editor-document.md` in full:

- `docs/ARCHITECTURE.md`: 1 removed line (`- See ADR 0017 for the decisions...` replaced by the ADR 0017 + ADR 0041 line).
- `docs/agent/PLAN.md`: 1 removed line (`-**Status:** todo` replaced by `+**Status:** done`).
- `web/eslint.config.js`: 1 removed line (`-'src/lib/grammar/grammar-text.wasm.test.ts'` with trailing comma added).
- `web/src/lib/editor/history.ts`: 15 removed lines (all intentional genericization of `Step`, `History`, and `createHistory`).
- `web/src/lib/editor/index.ts`: 0 removed lines.
- `web/src/lib/editor/testing.ts`: 0 removed lines.
- `web/src/lib/i18n/en.ts`: 1 removed line (`-'workstation.tabs_language_aria': 'Language workstation areas'` with trailing comma added).
- `web/src/lib/i18n/id.ts`: 1 removed line (`-'workstation.tabs_language_aria': 'Navigasi area bahasa formal'` with trailing comma added).
- `docs/decisions/0041-pda-editor-document.md` and all new `web/src/lib/editor/pda-*` files: inspected in full; no line lost a trailing `r`.



