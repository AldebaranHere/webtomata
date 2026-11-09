# Task T-062 Report — PDA editor, part 11 of 12: the determinism badge and the competing pairs

Branch: `task/T-062-pda-determinism-badge`, cut from `origin/staging` at `62de20d` (the merge of
PR 198, the amended T-062 spec).

Commits:

- `a6dccd3` `feat(editor): add the determinism badge and the competing pairs` — the module and
  its two test files, the badge component, the editor wiring, the one optional table prop, the
  strings, the glossary, the e2e spec; the task set to `in-progress`.
- The last commit adds the ADR 0052, this report, the amended e2e file and sets the task to
  `done`.

**Status: ready to review.** Every verification command of the spec passed. One test of the whole
Vitest suite failed and it is not this task's: `geometry.test.ts` line 585 (`took < 1000`, measured
1307 ms) is the known T-069 timing test, which fails only while another worker shares the machine
and passes alone in 577 ms (section 7). It was not touched.

## Planner approvals during the task (2026-11-09)

The pre-flight found four things the first spec could not hold; the planner amended T-062 in PR 198
(`ccf9670`) and ruled:

1. **E4 / the edge focus — option D.** With the Definisi tab open, Tunjukkan selects the first edge
   (`aria-pressed` on its node) and announces the rows, but **the focus stays on the Tunjukkan
   button**, which keeps `aria-pressed="true"`. With the Tabel tab open the focus goes to the Dari
   field of the first marked row. No change to `interaction/editor.ts`, no `querySelector` on the
   canvas. Implemented as ruled (`PdaEditor.svelte`, `showPair`), and E4 asserts exactly this.
2. **The announcement — the badge's own live region.** An `aria-live="polite"` paragraph with the
   `sr-only` class, in the page all the time (in the `head` snippet of `PdaEditor.svelte`), with its
   text set when the button is pressed. **Never `role="status"`**, because `pda-panel` and
   `pda-table-edit` select the editor's announcer by that role. E3 asserts it by text.
3. **The request prop for a row's focus.** `{ index, field, request }`, handled by an `$effect`
   that reuses `focusRow`, plus the one optional field in `pda-table-props.ts`. That is what was
   built (`PdaRowFocus`).
4. **Both transitions reading ε take `compete_epsilon_read`**, as encoded. `pasangan bersaing` goes
   into the glossary with `TODO(review)`, and both sentence keys are marked `TODO(review)` for the
   "pop ε adalah awalan dari pop ε" wording.

Everything else in the restatement was approved as written: the eight breaks, `createDeterminism`
and how it drops a stale answer, the `head` snippet, the badge and the phone design, and the list of
files to touch and not to touch.

## 1. What changed

Under the kind switch, in both tabs, a badge reads `engine.pdaDeterminism(toEnginePda(doc))`:

| The document | The badge |
| --- | --- |
| no transition | nothing |
| no competing pair | **Deterministik**, plain text, success tone |
| NDPDA with n pairs | a disclosure button, neutral tone, `Non-deterministik · n pasangan bersaing` |
| DPDA with n pairs | a disclosure button, warning tone, `Bukan DPDA · n pasangan bersaing` |

The list under the button holds one `<li>` card per pair, in the engine's order: the state
(`q0:`), the two transitions as the diagram writes them joined by ` ↔ `, the reason sentence, and
**Tunjukkan** (44 px, `aria-pressed` on the shown pair). Under the cards, the note of the kind.
Tunjukkan selects the first edge, puts both rows into T-051's `marked` set, announces
`pda_editor.pair_selected { first, second }` in the badge's live region, and moves the focus to the
first row when the Tabel tab is open. A second press clears the marks, the edge and the message, and
the editor's announcer says `editor.selection_cleared`.

The new pure module `pda-determinism.ts`:

- `createDeterminism({ query, delayMs = 200 })` — `status()`, `pairs()`, `subscribe`, `schedule`,
  `dispose`. The same rules as `checker.ts`, which is not changed.
- `competitionReason(doc, pair)` — the sentence, from the two transitions; `null` when the pair
  names no two transitions of the document.
- `badgeModel(kind, transitions, pairs)` — tone, key, parameters, the phone's short key, and whether
  it opens a list. `null` when the document has no transition.

The head block (kind switch, badge, checks line) was repeated in the two tab snippets; it is one
`head` snippet now, rendered by both.

Files: new `pda-determinism.ts`, `pda-determinism.test.ts`, `pda-determinism.wasm.test.ts`,
`PdaDeterminismBadge.svelte`, `web/e2e/pda-determinism.spec.ts`,
`docs/decisions/0052-pda-determinism-badge.md`; edited `PdaEditor.svelte`, `PdaTableView.svelte`,
`PdaTransitionsBlock.svelte`, `pda-table-props.ts` (one optional field), `pda-messages.ts` and its
key list in `pda-messages.test.ts`, `docs/glossary.md`, `docs/agent/PLAN.md` (status),
`web/eslint.config.js` (the new WASM test in the list of files that may import the engine — the
established pattern: every `*.wasm.test.ts` is named there).

Two files were touched beyond the literal scope list, both unavoidable and named here:
`pda-table-props.ts` (the planner approved the optional prop, which lives in that file) and
`web/eslint.config.js` (without the allow-list entry the WASM test is a lint error; the list is the
only way a test may import the engine).

```
$ git diff --stat origin/staging
 docs/agent/PLAN.md                              |   2 +-
 docs/decisions/0052-pda-determinism-badge.md    |  88 +++++
 docs/glossary.md                                |   2 +
 web/e2e/pda-determinism.spec.ts                 | 448 ++++++++++++++++++++++++
 web/eslint.config.js                            |   3 +-
 web/src/lib/editor/PdaDeterminismBadge.svelte   | 215 ++++++++++++
 web/src/lib/editor/PdaEditor.svelte             | 120 ++++++-
 web/src/lib/editor/PdaTableView.svelte          |   4 +-
 web/src/lib/editor/PdaTransitionsBlock.svelte   |  18 +-
 web/src/lib/editor/pda-determinism.test.ts      | 430 +++++++++++++++++++++++
 web/src/lib/editor/pda-determinism.ts           | 165 +++++++++
 web/src/lib/editor/pda-determinism.wasm.test.ts | 194 ++++++++++
 web/src/lib/editor/pda-table-props.ts           |  16 +
 web/src/lib/i18n/pda-messages.test.ts           |  14 +-
 web/src/lib/i18n/pda-messages.ts                |  35 +-
 15 files changed, 1727 insertions(+), 27 deletions(-)
```

Every protected file is unchanged:

```
unchanged  web/src/lib/editor/checker.ts
unchanged  web/src/lib/editor/KindSwitch.svelte
unchanged  web/src/lib/editor/SidePanel.svelte
unchanged  web/src/lib/editor/EditorCanvas.svelte
unchanged  web/src/lib/editor/diagram/DiagramDrawing.svelte
unchanged  web/src/lib/editor/Editor.svelte
unchanged  web/src/lib/editor/TableView.svelte
unchanged  web/src/lib/editor/table-props.ts
unchanged  web/src/lib/i18n/id.ts
unchanged  web/src/lib/i18n/en.ts
unchanged  crates/
```

## 2. The pre-flight (the four checks the spec asked for, before any code)

Run with the real engine and the real functions; the throwaway test that produced the pairs was
deleted before the first commit (`pda-determinism.wasm.test.ts` is the permanent form of it).

**(a) The pairs of `pdaDeterminism`.** Both kinds, through `loadPda` → `fromEnginePda` →
`pdaDeterminism`:

| Machine | kind | `doc.transitions` (labels) | pairs |
| --- | --- | --- | --- |
| G | dpda, ndpda | `ε/ε/ε`, `a/ε/A`, `b/A/ε`, `b/A/ε` | `{0,0,1}` `{0,0,2}` |
| J | dpda, ndpda | `a/A/ε`, `a/AB/ε` | `{0,0,1}` |
| K | dpda, ndpda | `ε/AB/ε`, `a/A/ε` | `{0,0,1}` |
| F | dpda, ndpda | `a/ε/A`, `b/A/ε`, `b/A/ε` | `[]` |
| empty | dpda, ndpda | — | `[]` |

`doc.transitions[i]` was deep-equal to the engine's `transitions[i]` for all six pairs, so `first`
and `second` are indices into `doc.transitions`. **Nothing differs from F1 to F5.** Two facts the
spec does not say, both proved: the engine's `determinism` never reads `kind` (`crates/engine-core/
src/pda.rs:317`), so both kinds give the same pairs and only the badge's tone depends on the kind;
and `determinism` `break`s when `from` changes (`pda.rs:326`), so it is only correct on a list
sorted by `from`, which `sort_unstable()` on load (`pda.rs:171`) and `comparePdaTransitions`
guarantee.

**(b) `competitionReason` against the sentence parameters.**

| Pair | t1 | t2 | Key | Params |
| --- | --- | --- | --- | --- |
| G (0,1) | `ε/ε/ε` | `a/ε/A` | `compete_epsilon_read` | `{pop1:'ε', pop2:'ε'}` |
| G (0,2) | `ε/ε/ε` | `b/A/ε` | `compete_epsilon_read` | `{pop1:'ε', pop2:'A'}` |
| J (0,1) | `a/A/ε` | `a/AB/ε` | `compete_same_read` | `{read:'a', pop1:'A', pop2:'AB'}` |
| K (0,1) | `ε/AB/ε` | `a/A/ε` | `compete_epsilon_read` | `{pop1:'A', pop2:'AB'}` (swapped) |

That is F1, F2 and F3 word for word. Both reading ε takes the ε key: ε is not a symbol (`first.read
!== null && first.read === second.read` is the same-read test).

**(c) The tokens and the contrast guard.** The badge needs `--color-success-tint`/`-ink`,
`--color-neutral-tint`/`-ink`, `--color-warning-tint`/`-ink`. `tools/check-contrast.mjs` reads
`web/src/lib/styles/tokens.css` and the `PAIRS` of `tools/contrast-pairs.mjs`, and fails when a
colour token is in no pair and is not `DECORATIVE` (`--color-border`, `--color-canvas-dot`). All
three pairs already exist and pass, so **no pair had to be added**:

```
ok   7.02 (need 4.5)  Success ink on success tint
ok   8.99 (need 4.5)  Neutral ink on neutral tint (chips)
ok   8.40 (need 4.5)  Warning ink on warning tint
```

**(d) The focus, the clear method, and the row.** The edge node is
`<g class="edge-node" data-edge="0>1" role="button" tabindex="0" aria-pressed=…>`
(`diagram/DiagramDrawing.svelte:161`), reachable in tests as `g.edge-node[data-edge="0>1"]`;
`EditorCanvas.svelte:201` finds it, and `:747` focuses it only when `view.focus.edge` changes, which
happens in exactly one private place (`interaction/editor.ts:389`, `closeLabel`). `EditorCanvas`
exports one function (`zoom`, `:173`). The method that clears the selection is **`clearSelection()`**
(`editor.ts:512`), and it does clear the edge: `editor.ts:250` `if (patch.selection !== undefined &&
patch.edge === undefined) state.edge = null;`. A row already has `focusRow(index, field)` in
`PdaTransitionsBlock.svelte:81`, which focuses `.f-<field>` inside `tbody tr.row[index]`; rows are
keyed by `keyOf(transition)` (`:47`, `{#each rows as row (row.key)}` at `:213`). This is why the
amendment's option D was possible and option A was not needed.

**(e) The size baseline** (a clean build of `origin/staging` in `~/tmp/t062-baseline`, removed):

```
ok   initial JS index.html: 81.5 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 124.7 KB gzip (limit 170 KB)
ok   initial JS soal.html: 83.7 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 82.3 KB gzip (limit 170 KB)
```
The PDA chunk (the one file holding `pda-sheet` and `tidak memeriksa stack`):
`_app/immutable/chunks/Or7COJGt.js`, **raw 22,069 / gzip 7,745**.

**(f) The selectors the head block could break.** The kind switch: `getByRole('radio', { name:
'DPDA', exact: true })` and `'NDPDA'` (`pda-panel:149`, `:254`; `pda-messages:68`, `:91`). The checks
line: `side.getByText('Mesin ini lengkap.')`, `side.getByText('Belum ada start state.')`,
`side.getByText(/transisi baris 1 dan 2 dari q0 bersaing/i)`, `side.getByText('Engine berhenti.')`,
`side.getByRole('button', { name: 'Coba lagi' })`. The table: `panel(page).locator('.transitions')`
→ `tbody tr`, `tbody tr[aria-current="true"]` (`pda-table-edit:12`, `:502`). One more thing this
found: `page.getByRole('status')` matches exactly one element today, the editor's `Announcer` (the
toast is `role="group"`), which is why the badge's live region is not `role="status"` (approval 2).

## 3. U — `pda-determinism.test.ts`, 21 tests

```
 ✓ src/lib/editor/pda-determinism.test.ts (21 tests) 42ms
```
U1 the transitions of G, J and K are in the order the plan numbers the rows; U2–U3 F1 (equal pops,
and the empty pop first); U4 F2; U5 F3 (the swap, with the document's own pops checked first);
U6 both reading ε; U7 a pair that names no transition has no sentence; U8–U12 F5 and the
boundaries of the model (0, 1 and 2 pairs; 0 transitions gives `null`); U13 one change is one
request after 200 ms and not before; U14 a burst is one request, for the last document; U15 a new
document hides the old pairs at once; U16 an answer that arrives late is dropped; U17 an answer that
arrives before the newer debounce is dropped; U18 a failed answer; U19 a rejecting query; U20
`dispose` stops the waiting request and later ones; U21 an answer after `dispose` changes nothing.

## 4. The pairs of the real engine — `pda-determinism.wasm.test.ts`, 5 tests

This is note 3 for the worker ("write one test that proves `doc.transitions[i]` is the engine's
`transitions[i]`"), kept as a permanent test instead of a throwaway:

```
 ✓ src/lib/editor/pda-determinism.wasm.test.ts (5 tests) 78ms
```
WC1 G gives the two pairs of the plan in both kinds; WC2 J and K give one each, F and an empty PDA
give none; WC3 the two indices name two transitions that leave the pair's state; WC4 the rows the
panel marks are rows 1–2 and 1–3 of G; WC5 the sentences of the real pairs are F1, F2 and F3.

## 5. E — `web/e2e/pda-determinism.spec.ts`

```
$ pnpm --filter web exec playwright test pda-determinism --project=desktop
  11 passed, 1 skipped
$ pnpm --filter web exec playwright test pda-determinism --project=phone
  23 passed, 1 skipped (both projects together)
```
E1 the four cases (no transition: no badge; F: **Deterministik** in the success tone and not a
button; G neutral as an NDPDA and warning as a DPDA, in both tabs), and with every transition
deleted the badge goes too; E2 the disclosure (closed at the start, `aria-expanded`, the two cards
with their sentences, both notes, Enter and Space); E3 Tunjukkan in the Tabel tab (first edge
`aria-pressed`, rows 1 and 2 `aria-current`, focus on row 1's Dari field, the announcement, and a
second press clears everything, with `Pilihan dibatalkan.` from the editor); E4 the same in the
Definisi tab (edge pressed, focus stays on the button, no table, the same announcement); E5 an edit
that removes the pair gives **Deterministik** and forgets the shown pair, and an edit that adds a
competing row to F gives one pair with its sentence; E6 two quick edits with the engine held at the
door end on the badge of the last document; E7 the phone at 360 px (short visible text, full
`aria-label`, 44 px targets, no sideways overflow, both tones) and axe in the four badge states.

**E8** is T-051's own E8, run unedited in the same pass:
```
✓  64 [desktop] › e2e/pda-panel.spec.ts:601:2 › E8: Timing of engine worker request › the engine
    worker is requested after the first draw, not before (2.0s)
```

One fixed wait needed a reason: E1's "no badge with no transition" waits 500 ms after the last
deletion, because the badge is only rendered once the engine's answer is back and a *negative*
assertion has nothing to wait for. The engine is already loaded by then, so the answer takes a few
milliseconds.

## 6. The eight breaks, each run on the final code

Each break was applied to the committed code, run, and restored; `git diff` is the break itself.

| # | The line that was changed | Fails |
| --- | --- | --- |
| B1 | `pda-determinism.ts`: `tone: 'warning',` ↔ `tone: 'neutral',` in the two branches of `badgeModel` | E1, `pda-determinism.spec.ts:147` — `Expected pattern: /tone-neutral/  Received string: "badge tone-warning …"` |
| B2 | `pda-determinism.ts`: `params: { count: pairs },` → `{ count: pairs + 1 },` | E1, `pda-determinism.spec.ts:145` — `Expected: "Non-deterministik · 2 pasangan bersaing"  Received: "Non-deterministik · 3 pasangan bersaing"` |
| B3 | `PdaEditor.svelte`: `marked = new Set([pair.first, pair.second]);` → `[pair.first + 1, pair.second + 1]` | E3, `pda-determinism.spec.ts:242` — `aria-current` on `tbody tr` first: `Expected: "true"  Received: ""` |
| B4 | `pda-determinism.ts`: the line `if (mine !== sequence || disposed) return;` after the `await` deleted | U16 `pda-determinism.test.ts:340` — `expected [ …(2) ] to deeply equal [ { from: +0, first: +0, second: 1 } ]`; U17 and U21 also fail |
| B5 | `PdaEditor.svelte`: `editor.clearSelection();` deleted from the second press | E3, `pda-determinism.spec.ts:260` — `g.edge-node[data-edge="0>1"]`: `Expected: "false"  Received: "true"` |
| B6 | `pda-determinism.ts`: `const swapped = isPrefix(second.pop, first.pop) && …;` → `const swapped = false;` | U5 `pda-determinism.test.ts:139` — `pop1: "AB"` / `pop2: "A"` instead of `"A"` / `"AB"`; WC5 also fails |
| B7 | `pda-determinism.ts`: `if (transitions === 0) return null;` deleted | E1, `pda-determinism.spec.ts:150` — `.pda-determinism`: `Expected: 0  Received: 1`; U11 also fails |
| B8 | `PdaDeterminismBadge.svelte`: `aria-label={full}` deleted | E7 phone, `pda-determinism.spec.ts:379` — `aria-label`: `Expected: "Non-deterministik · 2 pasangan bersaing"  Received: ""` |

Two of them needed a second pass, and this is the finding:

- **B7 first did not fail E1.** The empty-machine assertion ran before the engine's first answer,
  so a badge that ignores the transition count still had no badge to show at that moment. E1 now
  deletes every transition of F and waits for the answer (section 5), and B7 fails it. U11 caught
  B7 from the start.
- **B4 does not fail E6, and cannot.** E6's final state is the same with or without the sequence
  check, because one engine worker answers its questions in the order it was asked: the late answer
  is always the older one, and the last answer is always the newest document. Out-of-order answers
  are the fake query's job, and U16, U17 and U21 fail with B4 exactly as AC4 asks ("U fails").
  E6 still proves its own rule: with the engine held at the door, no badge is shown while
  `checking`, and the badge that finally appears is the last document's.

## 7. The gate

```
$ pnpm format:check
All matched files use Prettier code style!
$ pnpm lint
$ eslint .            (no output: clean)
$ pnpm check
svelte-check found 0 errors and 0 warnings
$ pnpm check:strings
ok   75 components have no hard-coded text
$ pnpm check:tokens
ok   77 files use no raw colors
$ pnpm check:contrast
ok   4.27 (need 3)  Border strong on surface (input edge)
ok   3.98 (need 3)  Border strong on ground (input edge)
$ pnpm test:tools
ℹ pass 138  ℹ fail 0
```

`pnpm test:web` (the whole Vitest suite, run alone):

```
 Test Files  1 failed | 114 passed (115)
      Tests  1 failed | 1360 passed | 3 skipped (1364)
```
The one failure is not this task's:
```
 FAIL  src/lib/editor/diagram/geometry.test.ts > the whole drawing > draws the worst case, 600
       random edges across 200 states, in well under a second (96 ms measured)
AssertionError: expected 1307.4892849999999 to be less than 1000
 ❯ src/lib/editor/diagram/geometry.test.ts:585:16
```
That is the known T-069 test (DECISIONS 2026-11-09: "both runs failed in `geometry.test.ts` … 1304
and 1983 ms (96 ms on a quiet machine)"), failing because two workers share the machine. Run alone,
with nothing else on the machine:
```
 ✓ src/lib/editor/diagram/geometry.test.ts (44 tests) 577ms
      Tests  44 passed (44)
```
It was not touched.

**Sizes (AC3).** Clean build of the branch, same machine, against the baseline of section 2(e):

```
ok   initial JS index.html: 81.5 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 124.7 KB gzip (limit 170 KB)
ok   initial JS soal.html: 83.7 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 82.3 KB gzip (limit 170 KB)
ok   layout worker …/layout.worker-DvXNapDG.js: 15.6 KB gzip (limit 40 KB)
ok   wasm …/engine_wasm_bg-VlyrwV86.wasm: 237.0 KB gzip (limit 250 KB)
```
Every route is byte-for-byte the same as the baseline (0.0 KB, the gate is 0.1 KB). The PDA chunk:
baseline `Or7COJGt.js` **22,069 raw / 7,745 gzip** → after `CBTSgDAV.js` **28,291 raw / 9,798 gzip**
(+6,222 raw, +2,053 gzip), all of it in the lazy PDA chunk, as the spec requires.

**The specs of the area** (AC2), all unedited:

```
$ playwright test pda-determinism pda-panel pda-editor pda-storage pda-messages pda-table-edit
  switcher editor-checks editor-panel editor-table --project=desktop
  64 passed, 21 skipped (1.2m)
$ playwright test pda-determinism pda-panel pda-editor pda-storage pda-messages pda-table-edit
  --project=phone
  43 passed, 9 skipped (49.2s)
$ playwright test pda-storage --project=webkit-phone
  6 passed (8.0s)
```

**Repeats** (the new spec, desktop and phone): 5 times each →
```
115 passed (3.9m)     0 failed, 0 flaky
```
and the tests that touch the worker and touch (E1's empty machine, E6, the phone E7) 5 more times
each, reaching 10 →
```
25 passed (1.1m)      0 failed
```

## 8. The deepening pass

**New exports.**

- `createDeterminism` — needed by `PdaEditor.svelte`; the type `Determinism` describes it.
- `competitionReason` — needed by `PdaDeterminismBadge.svelte`. It could be private to the badge,
  but the sentence is a rule of the definition, not a layout: it is tested on its own (U2–U7), and
  that is why it is exported.
- `badgeModel` — needed by `PdaEditor.svelte` (the badge is a `$derived` there, so the badge
  component does not know about the kind and the counts).
- Types `DeterminismStatus`, `BadgeTone`, `BadgeModel` — the return types of the three functions.
- `PdaRowFocus`, `PdaTableField` — the one optional prop and the five column names. `PdaTableField`
  replaced the local `keyof typeof COLUMN` in `PdaTransitionsBlock.svelte` (`COLUMN` is now
  `satisfies Record<PdaTableField, MessageKey>`), so one fact lives in one place instead of two
  unions that must agree.

Is any of it a duplicate of something that exists? `Determinism` has the shape of `Checker`, and
that is deliberate: the two are the same rule (a debounce, a sequence number, a dispose) on a
different answer. They were not merged because `checker.ts` is shared with the FSM and typed for
`Issue[]` — the spec and ADR 0052 name that as the reason, and the alternative (generalising it)
needs FSM tests and belongs to a task of its own. Inside the new code, nothing is written twice: the
badge's text comes from `badgeModel`, the card's label comes from `transitionLabel` (not a second
formatter), and the pop strings come from `formatStackSeq` and `stackSeparator`.

`PdaDeterminismBadge.svelte` exports nothing. The live region is not a prop of the badge but lives
in `PdaEditor.svelte`'s `head` snippet, so it is in the page even before the first pair exists
(approval 2).

**The interface is smaller than the work behind it:** three functions and their types (about 30
lines of signatures) carry 165 lines of module, 215 lines of component and the engine's rules.
There is no test-only export and no export that a caller does not use.

**Casts: zero.** No `any`, no `@ts-ignore`, no `as`. The one place where a type could have been
bypassed — the answer of the engine, which is `{ ok: true, value } | { ok: false, error }` — is
narrowed with `answer.ok`.

## 9. The keys

Twelve new keys, all in `pda-messages.ts` in both languages, none in `id.ts`/`en.ts`:

| Key | id | en |
| --- | --- | --- |
| `pda_editor.badge_deterministic` | Deterministik | Deterministic |
| `pda_editor.badge_nondeterministic {count}` | Non-deterministik · {count} pasangan bersaing | Non-deterministic · {count} competing pairs |
| `pda_editor.badge_nondeterministic_short {count}` | Non-det. · {count} | Non-det. · {count} |
| `pda_editor.badge_not_dpda {count}` | Bukan DPDA · {count} pasangan bersaing | Not a DPDA · {count} competing pairs |
| `pda_editor.badge_not_dpda_short {count}` | Bukan DPDA · {count} | Not a DPDA · {count} |
| `pda_editor.compete_same_read {read,pop1,pop2}` | Keduanya membaca {read}, dan pop {pop1} adalah awalan dari pop {pop2}. | Both read {read}, and pop {pop1} is a prefix of pop {pop2}. |
| `pda_editor.compete_epsilon_read {pop1,pop2}` | Salah satunya tidak membaca input, dan pop {pop1} adalah awalan dari pop {pop2}. | One of them reads no input, and pop {pop1} is a prefix of pop {pop2}. |
| `pda_editor.compete_show` | Tunjukkan | Show |
| `pda_editor.note_ndpda_ok` | Pada NDPDA ini boleh. Pada DPDA setiap pasangan menjadi kesalahan. | On an NDPDA this is allowed. In a DPDA every pair becomes an error. |
| `pda_editor.note_dpda_no` | Pada DPDA ini tidak boleh. Ubah salah satu transisi, atau pilih NDPDA. | In a DPDA this is not allowed. Change one of the transitions, or choose NDPDA. |
| `pda_editor.pair_selected {first,second}` | Baris {first} dan {second} ditunjukkan. | Rows {first} and {second} are shown. |

`badge_not_dpda_short` is the one key the spec's list did not name: the spec says the phone's text
for a DPDA is `Bukan DPDA · {count} ▾`, which needs a short form of its own ("any other that you
need … say which"). `pda-messages.test.ts`'s `PDA_KEYS` grew by the twelve, which the spec allows
("its test if a key list is tested").

The glossary gained: pasangan bersaing (competing pair), deterministik, non-deterministik, Bukan
DPDA — all `TODO(review)`, and both sentence keys are marked `TODO(review)` for the reason the
planner gave (equal pops read strangely).

## 10. Out of scope, for a later task

- **T-070** (already proposed): the competing edges dashed in a DPDA and the selection stroke on the
  second edge of a pair-of-pairs that shares an edge. Both need `DiagramDrawing.svelte` and
  `EditorCanvas.svelte`, which the FSM shares.
- **The `aria-label` and the phone's short text.** The design asks for an `aria-label` with the full
  sentence while the visible text is `Non-det. · 2`. Axe's `label-content-name-mismatch` would be
  the rule that objects (the visible words are not in the accessible name). It does **not** fire:
  measured on the phone project with the plain spans (no `aria-hidden`) it passes, which is why the
  spans carry no `aria-hidden` and the markup is exactly the design's. If a later axe version
  starts reporting it, the fix is to shorten the visible text to a prefix of the sentence
  (`Non-deterministik · 2`), a one-line change in `pda-messages.ts`.
- **`checker.ts` and the badge could share one scheduler** if a third query ever appears; today
  merging them would mean a change in a file the FSM shares for no behaviour change.
- **A fixed 500 ms wait** in E1 (section 5) is the only place where the new tests wait for nothing
  in particular. It exists for a negative assertion; if a test-only hook on the query's `status` is
  ever acceptable, it could go.
