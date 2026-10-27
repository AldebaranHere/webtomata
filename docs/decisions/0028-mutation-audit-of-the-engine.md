# 0028. The mutation audit of the engine

Date: 2026-10-28. Status: accepted (a one-time audit, repeated after big changes of the engine; not a check of CI).

## Why

The tests of the engine are many (unit, property, differential against `automata-lib`, exhaustive against references written in the tests). A test suite that passes says little about how good it is: a test can pass for a code that is wrong. A mutation audit asks a different question. A tool changes the code of the engine in a small way, one change at a time (a `>` becomes `>=`, a `+` becomes `*`, a function returns a constant, an arm of a `match` is deleted), runs the tests, and reports the changes that **no test noticed** (the "survivors"). Each survivor is a part of the engine that the tests do not pin down.

## How

`cargo-mutants` 27.1.0, in WSL, on a copy of the repository (it is a developer tool, not a dependency of the project). 611 changes of `crates/engine-core/src`; 168 do not compile (they are "unviable" and say nothing), so 443 were tried against the whole test suite.

Two things made the run fail until they were fixed, and they are worth knowing for the next run:

- Each parallel job copies the tree. The default place is `/tmp`, a small tmpfs in WSL (3.9 GB), and the run stopped with "No space left on device". `TMPDIR=$HOME/tmp` moves it to the disk.
- A change can make a test allocate without end (one did: 4 GB in a second), and with three jobs the kernel killed everything. Test programs now run under `prlimit --as=3 GB` through Cargo's runner (`CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUNNER='prlimit --as=3221225472 --'`), and `-j 2` is enough. (WSL stopped answering once, after the memory ran out: `wsl --shutdown` brings it back.)

```
export TMPDIR=$HOME/tmp
export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUNNER='prlimit --as=3221225472 --'
cargo mutants -p engine-core -j 2 --no-shuffle -o ~/mutants-out/all
cargo mutants -p engine-core -j 2 --iterate -o ~/mutants-out/all   # to go on after a stop
```

The whole run takes about 1.5 hours on a laptop with 12 cores and 8 GB for WSL.

## Result

Of the 443 changes that compile, **396 were caught by the tests at once**, 1 was stopped by the timeout (the changed loop never ended, which is a way of being caught) and **46 survived**. Everything that survived was read.

**26 were real gaps, closed by 20 new tests** (`crates/engine-core/tests/boundaries.rs`; each test names the change of the code that it catches):

- limits that are exactly reached: the biggest machine file and the biggest `.jff` file are read, one byte more is not; a label of `max_nodes` parts is allowed (at the start and after a state is removed); a label of several characters in a `.jff` file adds states up to 2,000 and not past it;
- a budget that is passed to a stage: the number of visits of the list of wrong strings; the number of states of `determinize` in the route through the machine;
- the number of checks of `simplify` is really counted;
- the symbol that is named by the witness of a split in `minimize` is the first on which the two groups differ;
- the part that is kept, and the part that is removed, in the message of a star that swallows another;
- the new start state and the new accepting state of state elimination are added only when they are needed;
- a symbol outside the alphabet is found inside every kind of part of an expression;
- the places of the states in the `.jff` writer: the grid of six in a row, a place that is not a number, the states of a long label on the line between its ends, a tab or a new line in a name;
- the list of problems of `validate` stops at its limit with one marker.

**20 survive on purpose**, and each is not a gap in the tests of the engine:

| Where                             | Change                                                       | Why it is not a gap                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ts.rs` (11)                      | the generator of the TypeScript types returns a constant     | This code runs only with the feature `ts`, which the audit does not turn on; the types are checked by `pnpm build:types` and by `svelte-check` of the page, which does not compile if a type is wrong. |
| `operations.rs:417`, `xor.rs:202` | the cap `max_states.min(MAX_STATES)` is taken away           | The callee caps again (`determinize` and the product do the same `min`). The line is redundant defence; it was kept.                                                                                   |
| `equivalence.rs:278`              | `>=` into `<` in the early exit of the list of wrong strings | The early exit only saves work: the lists are the same.                                                                                                                                                |
| `validate.rs:35`                  | `is_full` always false                                       | Same: it is an early exit, and `push` ignores what is past the limit.                                                                                                                                  |
| `jff.rs:258`                      | the arm for `>` in `escape` is taken away                    | `>` may stand as it is in an attribute of XML.                                                                                                                                                         |
| `regex.rs:66`                     | the arm for star and plus in `write` is taken away           | The level of a star would be the level of an atom, and no place asks for the difference: the arm is redundant.                                                                                         |
| `regex.rs:295`                    | the guard `tok.token == Token::Close` is always true         | After the parser has read an expression, the only token that can be left is a closing parenthesis, so the other branch cannot be reached (it is defence).                                              |
| `regex_simplify.rs:225`           | `\|\|` into `&&` in `included`                               | `∅` is never asked about (the rule for `∅` in a union goes first), and the answer is the same when it is.                                                                                              |
| `regex_simplify.rs:402`           | `+` into `*` in the index of the part that goes in `α*α*`    | The two parts are equal, so which of them goes gives the same expression.                                                                                                                              |

The score is **423 of 443** (95.5%) of the changes that compile, or 97.9% if the 11 of the generator of types are left out.

## What follows

- Run the audit again after a big change of the engine, and read what survives. It is not a check of CI: it is too slow, and a gate on it would slow every pull request.
- The tests that every pull request runs stay short: the exhaustive tests of `regex_oracle.rs` use small sizes there and bigger ones with `WEBTOMATA_EXHAUSTIVE=1` (see `tools/README.md`).
- The redundant lines in the table could be taken out one day; the audit says which they are.
