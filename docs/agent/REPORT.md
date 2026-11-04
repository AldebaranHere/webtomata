# Report: T-015 Toggle "versi panjang / versi ringkas" in the CNF stepper

## 1. Hand Derivations

The user required hand derivations recorded in `REPORT.md` before any test runs for:
1. **Grammar R1**: $S \to x B y \mid z B y \mid z B \mid x$ with $B \to x$.
2. **Grammar R2**: $S \to a C$ with $C \to c \mid a$ (must not reuse $C$).
3. **Grammar R3a**: The T-010 flow grammar (`SIX_PHASE_GRAMMAR`: $S \to a S b \mid A \mid U$, $A \to B$, $B \to b B \mid \lambda$, $U \to U c$).
4. **Grammar R3b**: A grammar with truly identical traces: $S \to a S b \mid c$ ($L(R3b) = \{a^n c b^n \mid n \ge 0\}$).

---

### Grammar R1
- **Alphabet**: $\{x, y, z\}$
- **Variables**: $\{S, B\}$
- **Start**: $S$
- **Rules**:
  - $S \to x B y \mid z B y \mid z B \mid x$
  - $B \to x$
- **Language**:
  - $S \to x \implies x$
  - $S \to z B \implies z x$
  - $S \to x B y \implies x x y$
  - $S \to z B y \implies z x y$
  - $L(R1) = \{x, xxy, zxy, zx\}$

#### Phase 1: Unreachable Rules (`grammar.cnf.phase_unreachable`)
- Reachable from $S$: $\{S, B\}$.
- Removed: 0 rules.
- Added: 0 rules.
- Rules remaining: 5.
- `note_key`: `None`.

#### Phase 2: Non-productive Rules (`grammar.cnf.phase_nonproductive`)
- Productive: $B \to x$ ($B$), $S \to x$ ($S$).
- Unreachable after pruning: none.
- Removed: 0 rules.
- Added: 0 rules.
- Rules remaining: 5.
- `note_key`: `None`.

#### Phase 3: $\varepsilon$-Rules (`grammar.cnf.phase_epsilon`)
- Nullable variables: none.
- Start symbol nullable? No $\implies S_0$ is not added.
- Removed: 0 rules.
- Added: 0 rules.
- Rules remaining: 5.
- `note_key`: `None`.

#### Phase 4: Unit Rules (`grammar.cnf.phase_unit`)
- Unit rules: none.
- Removed: 0 rules.
- Added: 0 rules.
- Rules remaining: 5.
- `note_key`: `None`.

#### Phase 5: Mixed Rules (`grammar.cnf.phase_mixed`)
Rules entering Phase 5 (5 rules):
- $S \to x B y$ (length 3, terminals $x, y$)
- $S \to z B y$ (length 3, terminals $z, y$)
- $S \to z B$ (length 2, terminal $z$)
- $S \to x$ (length 1, single terminal)
- $B \to x$ (length 1, single terminal)

##### Versi Panjang (`short_version = false`)
- Generates fresh variables $T_x \to x$, $T_y \to y$, $T_z \to z$.
- Removed (3 rules): $S \to x B y$, $S \to z B y$, $S \to z B$.
- Added (6 rules): $S \to T_x B T_y$, $S \to T_z B T_y$, $S \to T_z B$, $T_x \to x$, $T_y \to y$, $T_z \to z$.
- Total rules after Phase 5: $5 - 3 + 6 = 8$ rules:
  - $S \to T_x B T_y \mid T_z B T_y \mid T_z B \mid x$
  - $B \to x$
  - $T_x \to x$
  - $T_y \to y$
  - $T_z \to z$
- `note_key`: `None`.

##### Versi Ringkas (`short_version = true`)
- Variable reuse candidate check:
  - $B$: only rule is $B \to x$. Qualifies for terminal $x$!
  - $S$: has 4 rules. Does not qualify.
- Terminal $x$ reuses $B$ ($B \to x$). No $T_x$ is created.
- Terminal $y$: no existing variable qualifies $\implies T_y \to y$.
- Terminal $z$: no existing variable qualifies $\implies T_z \to z$.
- Rewritten rules:
  - $S \to x B y \implies S \to B B T_y$
  - $S \to z B y \implies S \to T_z B T_y$
  - $S \to z B \implies S \to T_z B$
- Removed (3 rules): $S \to x B y$, $S \to z B y$, $S \to z B$.
- Added (5 rules): $S \to B B T_y$, $S \to T_z B T_y$, $S \to T_z B$, $T_y \to y$, $T_z \to z$.
- Total rules after Phase 5: $5 - 3 + 5 = 7$ rules:
  - $S \to B B T_y \mid T_z B T_y \mid T_z B \mid x$
  - $B \to x$
  - $T_y \to y$
  - $T_z \to z$
- `note_key`: At least one terminal reused an existing variable ($x$ reused $B$) $\implies$ `Some("grammar.cnf.phase_mixed.note_short")`.

#### Phase 6: Long Rules (`grammar.cnf.phase_long`)

##### Versi Panjang (`short_version = false`)
- Rules of length $\ge 3$: $S \to T_x B T_y$ and $S \to T_z B T_y$.
- Without helper sharing:
  - $S \to T_x B T_y \implies S \to T_x X_1, X_1 \to B T_y$
  - $S \to T_z B T_y \implies S \to T_z X_2, X_2 \to B T_y$
- Removed (2 rules): $S \to T_x B T_y$, $S \to T_z B T_y$.
- Added (4 rules): $S \to T_x X_1$, $S \to T_z X_2$, $X_1 \to B T_y$, $X_2 \to B T_y$.
- Total rules after Phase 6: $8 - 2 + 4 = 10$ rules.
- `note_key`: `None`.
- Language: CYK accepts $\{x, xxy, zxy, zx\}$.

##### Versi Ringkas (`short_version = true`)
- Rules of length $\ge 3$: $S \to B B T_y$ and $S \to T_z B T_y$.
- Both share the tail pair $(B, T_y)$.
- With helper sharing:
  - Pair $(B, T_y)$ cached as helper $X \to B T_y$.
  - $S \to B B T_y \implies S \to B X$
  - $S \to T_z B T_y \implies S \to T_z X$
- Removed (2 rules): $S \to B B T_y$, $S \to T_z B T_y$.
- Added (3 rules): $S \to B X$, $S \to T_z X$, $X \to B T_y$.
- Total rules after Phase 6: $7 - 2 + 3 = 8$ rules.
- `note_key`: At least one helper was shared ($X$ used by both $S \to B X$ and $S \to T_z X$) $\implies$ `Some("grammar.cnf.phase_long.note_short")`.
- Language: CYK accepts $\{x, xxy, zxy, zx\}$.

---

### Grammar R2 (Must not reuse)
- **Alphabet**: $\{a, c\}$
- **Variables**: $\{S, C\}$
- **Start**: $S$
- **Rules**:
  - $S \to a C$
  - $C \to c \mid a$
- **Language**: $\{ac, aa\}$.

#### Phases 1 to 4:
- Phase 1: All reachable $\{S, C\}$. Removed: 0, Added: 0. Rules: 3.
- Phase 2: All productive. Removed: 0, Added: 0. Rules: 3.
- Phase 3: No $\varepsilon$ rules. Removed: 0, Added: 0. Rules: 3. `note_key`: `None`.
- Phase 4: No unit rules. Removed: 0, Added: 0. Rules: 3.

#### Phase 5: Mixed Rules (`grammar.cnf.phase_mixed`)
- Mixed rule: $S \to a C$ (length 2, terminal $a$).
- Terminal rules: $C \to c$, $C \to a$.
- Check reuse for terminal $a$:
  - $C$ has two rules in the grammar ($C \to c$ and $C \to a$).
  - A variable is only reusable if its **sole rule in the grammar** is $V \to a$.
  - Reusing $C$ for $a$ would turn $S \to a C$ into $S \to C C$, which would generate $\{cc, ca, ac, aa\}$, altering the language.
  - Thus, $C$ must NOT be reused.
- Both Versi Panjang and Versi Ringkas:
  - Create new helper $T_a \to a$.
  - $S \to a C \implies S \to T_a C$.
  - Removed (1 rule): $S \to a C$.
  - Added (2 rules): $S \to T_a C$, $T_a \to a$.
  - Total rules after Phase 5: $3 - 1 + 2 = 4$ rules ($S \to T_a C$, $C \to c$, $C \to a$, $T_a \to a$).
  - `note_key`: `None` in both versions (no terminal reused an existing variable).

#### Phase 6: Long Rules (`grammar.cnf.phase_long`)
- No rules with length $\ge 3$.
- Both Versi Panjang and Versi Ringkas:
  - Removed: 0.
  - Added: 0.
  - Total rules after Phase 6: 4 rules.
  - `note_key`: `None`.
- Final grammar accepts $\{ac, aa\}$.

---

### Grammar R3a: The T-010 Flow Grammar (`SIX_PHASE_GRAMMAR`)
- **Rules**:
  - $S \to a S b \mid A \mid U$
  - $A \to B$
  - $B \to b B \mid \lambda$
  - $U \to U c$

#### Phases 1 to 5:
Identical in both versions:
- **Phase 1: Unreachable**: None removed. (7 rules).
- **Phase 2: Non-productive**: $U$ non-productive. Removed: $S \to U$, $U \to U c$ (2 rules). Added: 0. (5 rules).
- **Phase 3: $\varepsilon$-Rules**: $B \to \lambda$ removed. Since $S \Rightarrow^* \lambda$, start symbol is nullable $\implies S_0 \to S \mid \lambda$ added. $B \to b$ and $S \to a b$ added. Removed: 1 rule, Added: 4 rules. (8 rules). `note_key`: `Some("grammar.cnf.phase_epsilon.note")`.
- **Phase 4: Unit Rules**: Unit rules $S_0 \to S$, $A \to B$, $S \to A$ removed. Removed: 3 rules, Added: 8 rules. (13 rules).
- **Phase 5: Mixed Rules**:
  - Variables entering Phase 5: $S_0, S, A, B$.
  - None has only a single production $V \to c$.
  - In both Versi Panjang and Versi Ringkas:
    - No existing variable qualifies for reuse.
    - $T_a \to a$ and $T_b \to b$ created.
    - Removed: 8 rules.
    - Added: 10 rules.
    - Total rules after Phase 5: 15 rules.
    - `note_key`: `None`.

#### Phase 6: Long Rules
Rules of length $\ge 3$ entering Phase 6:
- $S_0 \to T_a S T_b$ (length 3)
- $S \to T_a S T_b$ (length 3)

##### Versi Panjang (`short_version = false`):
- Each rule gets a fresh helper:
  - $S_0 \to T_a S T_b \implies S_0 \to T_a X$, $X \to S T_b$
  - $S \to T_a S T_b \implies S \to T_a X_1$, $X_1 \to S T_b$
- Removed (2 rules): $S_0 \to T_a S T_b$, $S \to T_a S T_b$.
- Added (4 rules): $S_0 \to T_a X$, $S \to T_a X_1$, $X \to S T_b$, $X_1 \to S T_b$.
- Total rules after Phase 6: $15 - 2 + 4 = 17$ rules.
- `note_key`: `None`.

##### Versi Ringkas (`short_version = true`):
- Both rules share the identical tail pair $(S, T_b)$!
- Cache pair $(S, T_b) \to X$:
  - $S_0 \to T_a S T_b \implies S_0 \to T_a X$
  - $S \to T_a S T_b \implies S \to T_a X$
  - Helper rule $X \to S T_b$ is added once!
- Removed (2 rules): $S_0 \to T_a S T_b$, $S \to T_a S T_b$.
- Added (3 rules): $S_0 \to T_a X$, $S \to T_a X$, $X \to S T_b$.
- Total rules after Phase 6: $15 - 2 + 3 = 16$ rules.
- `note_key`: `Some("grammar.cnf.phase_long.note_short")` because helper $X$ is shared between two rules.
- Both final grammars accept the same language (CYK oracle up to length 8 over $\{a,b,c\}$).

---

### Grammar R3b: Truly Identical Traces
- **Rules**:
  - $S \to a S b \mid c$
- **Language**: $\{a^n c b^n \mid n \ge 0\}$
- $S$ has two rules, so no existing variable qualifies to be reused for $a, b, c$.
- Only one long rule ($S \to a S b$) exists, so there is no twin rule to share with.

#### Hand Derivation for R3b (both versions identical across all six phases):
- **Phase 1: Unreachable**: Reachable $\{S\}$. Removed: 0, Added: 0. Rules: 2 ($S \to a S b \mid c$). `note_key`: `None`.
- **Phase 2: Non-productive**: $S$ productive ($S \to c$). Removed: 0, Added: 0. Rules: 2. `note_key`: `None`.
- **Phase 3: $\varepsilon$-Rules**: No $\varepsilon$ rules. $S$ not nullable. Removed: 0, Added: 0. Rules: 2. `note_key`: `None`.
- **Phase 4: Unit Rules**: No unit rules. Removed: 0, Added: 0. Rules: 2. `note_key`: `None`.
- **Phase 5: Mixed Rules**:
  - $S$ has two rules, so it cannot be reused.
  - $T_a \to a$ and $T_b \to b$ created. ($c$ is length 1, no helper needed).
  - $S \to a S b \implies S \to T_a S T_b$.
  - Removed (1 rule): $S \to a S b$.
  - Added (3 rules): $S \to T_a S T_b$, $T_a \to a$, $T_b \to b$.
  - Total rules after Phase 5: $2 - 1 + 3 = 4$ rules ($S \to T_a S T_b \mid c$, $T_a \to a$, $T_b \to b$).
  - `note_key`: `None` in both versions.
- **Phase 6: Long Rules**:
  - Single rule with length $\ge 3$: $S \to T_a S T_b$.
  - No twin rule exists to share helpers.
  - $S \to T_a S T_b \implies S \to T_a X$, $X \to S T_b$.
  - Removed (1 rule): $S \to T_a S T_b$.
  - Added (2 rules): $S \to T_a X$, $X \to S T_b$.
  - Total rules after Phase 6: $4 - 1 + 2 = 5$ rules ($S \to T_a X \mid c$, $X \to S T_b$, $T_a \to a$, $T_b \to b$).
  - `note_key`: `None` in both versions.
- Both versions give the exact same six phases and no notes.
- Both accept $a^n c b^n$ (CYK oracle up to length 8 over $\{a, b, c\}$).
