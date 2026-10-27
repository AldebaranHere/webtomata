#!/usr/bin/env python3
"""Makes the fixtures for the differential tests (E11).

The Python package `automata-lib` is the reference. For each random machine it gives the
correct answer, and the Rust tests in `crates/engine-core/tests/differential.rs` compare the
engine with that answer. The seed is fixed, so the same command gives the same files.

Usage (from the repository root):
    python -m venv .venv-fixtures
    .venv-fixtures/bin/pip install -r tools/requirements.txt     (Scripts/ on Windows)
    .venv-fixtures/bin/python tools/gen_fixtures.py
"""

import json
import random
from pathlib import Path

from automata.fa.dfa import DFA
from automata.fa.nfa import NFA

OUT = Path(__file__).resolve().parent.parent / "crates/engine-core/tests/fixtures"
SEED = 20270201
COUNT = 100
STRINGS = 20
MAX_STRING_LENGTH = 8


def order_key(name):
    """Only names that are plain strings are ever compared; sets are reached by discovery."""
    return name if isinstance(name, str) else ""


def machine_json(kind, symbols, states, start, finals, edges):
    """The engine's JSON format (schemaVersion 1). `edges` holds (from, symbol or None, to)."""
    # State names can be sets, which have no stable order. Number the states by discovery
    # from the start state, with the symbols in order, so that the same machine always gives
    # the same file. States that cannot be reached come last, by name.
    order = [start]
    seen = {start}
    for state in order:
        for a, on, b in sorted(
            (e for e in edges if e[0] == state), key=lambda e: (e[1] or "", order_key(e[2]))
        ):
            if b not in seen:
                seen.add(b)
                order.append(b)
    order += sorted((s for s in states if s not in seen), key=order_key)
    ids = {name: i for i, name in enumerate(order)}
    return {
        "schemaVersion": 1,
        "kind": kind,
        "alphabet": list(symbols),
        "states": sorted(ids.values()),
        "start": ids[start],
        "accepting": sorted(ids[f] for f in finals),
        "transitions": [
            {"from": ids[a], "on": on, "to": ids[b]}
            for a, on, b in sorted(edges, key=lambda e: (ids[e[0]], e[1] or "", ids[e[2]]))
        ],
    }


def dfa_json(dfa):
    edges = [
        (s, sym, t) for s, row in dfa.transitions.items() for sym, t in row.items()
    ]
    return machine_json(
        "dfsm",
        sorted(dfa.input_symbols),
        dfa.states,
        dfa.initial_state,
        dfa.final_states,
        edges,
    )


def nfa_json(nfa):
    edges = [
        (s, sym or None, t)
        for s, row in nfa.transitions.items()
        for sym, targets in row.items()
        for t in targets
    ]
    return machine_json(
        "ndfsm",
        sorted(nfa.input_symbols),
        nfa.states,
        nfa.initial_state,
        nfa.final_states,
        edges,
    )


def random_symbols(rng):
    return ["a", "b", "c"][: rng.randint(1, 3)]


def random_dfa(rng, symbols):
    names = [f"q{i}" for i in range(rng.randint(1, 8))]
    return DFA(
        states=set(names),
        input_symbols=set(symbols),
        transitions={s: {c: rng.choice(names) for c in symbols} for s in names},
        initial_state=names[0],
        final_states={s for s in names if rng.random() < 0.4},
    )


def random_nfa(rng, symbols):
    names = [f"q{i}" for i in range(rng.randint(1, 7))]
    transitions = {s: {} for s in names}
    for s in names:
        for c in symbols + [""]:
            width = rng.choice([0, 0, 1, 1, 2]) if c else rng.choice([0, 0, 0, 1])
            targets = {rng.choice(names) for _ in range(width)}
            if targets:
                transitions[s][c] = targets
    return NFA(
        states=set(names),
        input_symbols=set(symbols),
        transitions=transitions,
        initial_state=names[0],
        final_states={s for s in names if rng.random() < 0.4},
    )


def random_strings(rng, symbols):
    return [
        [rng.choice(symbols) for _ in range(rng.randint(0, MAX_STRING_LENGTH))]
        for _ in range(STRINGS)
    ]


def with_verdicts(rng, machine, symbols):
    strings = random_strings(rng, symbols)
    return strings, [machine.accepts_input("".join(s)) for s in strings]


def determinize_cases(rng):
    cases = []
    for _ in range(COUNT):
        symbols = random_symbols(rng)
        nfa = random_nfa(rng, symbols)
        strings, accepts = with_verdicts(rng, nfa, symbols)
        cases.append(
            {
                "input": nfa_json(nfa),
                "expected": dfa_json(DFA.from_nfa(nfa)),
                "strings": strings,
                "accepts": accepts,
            }
        )
    return cases


def minimize_cases(rng):
    cases = []
    for _ in range(COUNT):
        symbols = random_symbols(rng)
        dfa = random_dfa(rng, symbols)
        minimal = dfa.minify()
        strings, accepts = with_verdicts(rng, dfa, symbols)
        cases.append(
            {
                "input": dfa_json(dfa),
                "expected": dfa_json(minimal),
                "expectedStates": len(minimal.states),
                "strings": strings,
                "accepts": accepts,
            }
        )
    return cases


def other_dfa(rng, dfa, symbols):
    """A second machine: often the same language, sometimes a small change."""
    pick = rng.choice(["same", "minimal", "flip", "random"])
    if pick == "same":
        return dfa
    if pick == "minimal":
        return dfa.minify()
    if pick == "flip":
        state = rng.choice(sorted(dfa.states))
        finals = set(dfa.final_states) ^ {state}
        return DFA(
            states=dfa.states,
            input_symbols=dfa.input_symbols,
            transitions=dfa.transitions,
            initial_state=dfa.initial_state,
            final_states=finals,
        )
    return random_dfa(rng, symbols)


def equivalence_cases(rng):
    cases = []
    for _ in range(COUNT):
        symbols = random_symbols(rng)
        first = random_dfa(rng, symbols)
        second = other_dfa(rng, first, symbols)
        strings = random_strings(rng, symbols)
        cases.append(
            {
                "first": dfa_json(first),
                "second": dfa_json(second),
                "equivalent": first == second,
                "firstAccepts": [first.accepts_input("".join(s)) for s in strings],
                "secondAccepts": [second.accepts_input("".join(s)) for s in strings],
                "strings": strings,
            }
        )
    return cases


def other_nfa(rng, nfa, symbols):
    """A second NFA: often the same language, sometimes a small change."""
    pick = rng.choice(["same", "dfa", "random", "random"])
    if pick == "same":
        return nfa
    if pick == "dfa":
        return DFA.from_nfa(nfa)
    return random_nfa(rng, symbols)


def as_dfa(machine):
    return machine if isinstance(machine, DFA) else DFA.from_nfa(machine)


def machine_of(machine):
    return dfa_json(machine) if isinstance(machine, DFA) else nfa_json(machine)


def random_pair(rng, symbols):
    """Two machines of either kind with the same alphabet; often the same language."""
    kind = rng.choice(["dfa-dfa", "nfa-nfa", "dfa-nfa"])
    if kind == "dfa-dfa":
        first = random_dfa(rng, symbols)
        return first, other_dfa(rng, first, symbols)
    if kind == "nfa-nfa":
        first = random_nfa(rng, symbols)
        return first, other_nfa(rng, first, symbols)
    return random_dfa(rng, symbols), random_nfa(rng, symbols)


def pair_case(rng, symbols, first, second, result, combine):
    """One case of an operation on two machines. The reference `result` is made minimal and
    complete: `^`, `|` and `&` give a partial DFA with the trap state taken away, and the engine's
    machines are complete, so the numbers of states would differ by the trap state. The verdicts
    of the two machines that were given, and `combine` of them, are a reference that does not use
    the operation of the package at all."""
    result = result.minify().to_complete()
    strings = random_strings(rng, symbols)
    first_accepts = [first.accepts_input("".join(s)) for s in strings]
    second_accepts = [second.accepts_input("".join(s)) for s in strings]
    return {
        "first": machine_of(first),
        "second": machine_of(second),
        "expected": dfa_json(result),
        "expectedStates": len(result.states),
        "empty": result.isempty(),
        "strings": strings,
        "accepts": [combine(a, b) for a, b in zip(first_accepts, second_accepts)],
        "firstAccepts": first_accepts,
        "secondAccepts": second_accepts,
    }


def pair_cases(operation, combine):
    """The cases of an operation on two machines: `operation(a, b)` is the reference."""

    def make(rng):
        cases = []
        for _ in range(COUNT):
            symbols = random_symbols(rng)
            first, second = random_pair(rng, symbols)
            result = operation(as_dfa(first), as_dfa(second))
            cases.append(pair_case(rng, symbols, first, second, result, combine))
        return cases

    return make


# XOR (the symmetric difference) of two machines: the reference is `a ^ b` of automata-lib. A string is
# in the XOR exactly when one machine accepts it and the other does not.
xor_cases = pair_cases(lambda a, b: a ^ b, lambda a, b: a != b)
# Union and intersection of two machines of either kind: `a | b` and `a & b`.
union_cases = pair_cases(lambda a, b: a | b, lambda a, b: a or b)
intersection_cases = pair_cases(lambda a, b: a & b, lambda a, b: a and b)


def complement_cases(rng):
    """Complement of a complete DFA: the reference is `~a` of automata-lib."""
    cases = []
    for _ in range(COUNT):
        symbols = random_symbols(rng)
        machine = random_dfa(rng, symbols)
        reference = (~machine).minify().to_complete()
        strings = random_strings(rng, symbols)
        accepts = [machine.accepts_input("".join(s)) for s in strings]
        cases.append(
            {
                "input": dfa_json(machine),
                "expected": dfa_json(reference),
                "expectedStates": len(reference.states),
                "empty": reference.isempty(),
                "strings": strings,
                "accepts": [not a for a in accepts],
                "inputAccepts": accepts,
            }
        )
    return cases


def random_regex(rng, symbols, depth):
    """A random regular expression as a tree: ("eps",), ("sym", c), ("union", a, b), ("concat", a, b),
    ("star", a) or ("plus", a). The empty set is not made: the package has no way to write it."""
    if depth == 0 or rng.random() < 0.25:
        return ("eps",) if rng.random() < 0.15 else ("sym", rng.choice(symbols))
    kind = rng.choice(["union", "concat", "star", "plus", "concat", "union"])
    if kind in ("star", "plus"):
        return (kind, random_regex(rng, symbols, depth - 1))
    return (kind, random_regex(rng, symbols, depth - 1), random_regex(rng, symbols, depth - 1))


def regex_text(node, ours):
    """The tree as text, with a parenthesis around every compound part, so that no rule of precedence
    is needed: in Rich's notation (`ε`, `∪`) for the engine, and in the syntax of the package (`()`, `|`)."""
    kind = node[0]
    if kind == "eps":
        return "ε" if ours else "()"
    if kind == "sym":
        return node[1]
    if kind in ("star", "plus"):
        return f"({regex_text(node[1], ours)})" + ("*" if kind == "star" else "+")
    left, right = regex_text(node[1], ours), regex_text(node[2], ours)
    if kind == "union":
        return f"({left}{'∪' if ours else '|'}{right})"
    return f"({left}{right})"


def regex_cases(rng):
    """Regular expression → NFA: the reference is `NFA.from_regex` of automata-lib, made a minimal complete DFA."""
    cases = []
    while len(cases) < COUNT:
        symbols = random_symbols(rng)
        tree = random_regex(rng, symbols, 4)
        nfa = NFA.from_regex(regex_text(tree, False), input_symbols=set(symbols))
        reference = DFA.from_nfa(nfa).minify().to_complete()
        strings = random_strings(rng, symbols)
        cases.append(
            {
                "text": regex_text(tree, True),
                "alphabet": sorted(symbols),
                "expected": dfa_json(reference),
                "expectedStates": len(reference.states),
                "empty": reference.isempty(),
                "strings": strings,
                "accepts": [nfa.accepts_input("".join(w)) for w in strings],
            }
        )
    return cases


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, make in [
        ("determinize", determinize_cases),
        ("minimize", minimize_cases),
        ("equivalence", equivalence_cases),
        ("xor", xor_cases),
        ("union", union_cases),
        ("intersection", intersection_cases),
        ("complement", complement_cases),
        ("regex", regex_cases),
    ]:
        rng = random.Random(f"{SEED}-{name}")
        cases = make(rng)
        text = json.dumps({"cases": cases}, separators=(",", ":"), sort_keys=True)
        (OUT / f"{name}.json").write_text(text + "\n", encoding="utf-8", newline="\n")
        print(f"{name}: {len(cases)} cases")


if __name__ == "__main__":
    main()
