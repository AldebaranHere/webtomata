# 0012. Differential tests against `automata-lib`

Status: accepted

## Context

The engine must never give a wrong answer. Our own tests use reference code that we wrote, so a wrong idea can be in both the engine and its test. A second program that other people wrote and use gives an independent check.

## Decision

- The reference is the Python package `automata-lib` 9.2.0 (MIT). Its dependencies are pinned in `tools/requirements.txt` (`networkx`, `frozendict`, `typing-extensions`, `cached-method`). Each is at least two weeks old. It is a dev-only tool and never ships.
- `tools/gen_fixtures.py` makes 100 random cases each for `determinize` (NFAs with ε, 1 to 7 states), `minimize` (DFAs, 1 to 8 states) and `equivalent` (pairs of DFAs, equal and different). The seed is fixed and the states are numbered by discovery from the start state, so the same versions give the same files on any computer (checked with three hash seeds).
- The fixtures are committed in `crates/engine-core/tests/fixtures/`. `cargo test` and CI need no Python.
- The Rust test compares **languages** with `equivalent`, not state names or numbers, because the two programs name states in different ways. For `minimize` it also compares the number of states, which is the same for every minimal DFSM of a language. It also compares 20 strings per machine with `automata-lib`'s verdicts, and checks that every witness is accepted by exactly one machine.
- Python is not part of CI. A person who changes the script makes the fixtures again and commits them.

## Consequences

- A difference between the engine and `automata-lib` fails a normal test. It is then checked by hand against Rich's definition before anyone changes a test.
- Both programs use the DFSM and NFSM definitions of the textbooks, so this check does not find a mistake in how the course teaches a method. The step traces are not compared, only the results.
