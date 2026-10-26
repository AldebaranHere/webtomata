# 0021. The format of a question, and how CI checks it

Status: accepted

## Context

Questions and guides are plain files that anyone can add by pull request (`CLAUDE.md`). A question holds a statement, a reference solution and constraints. The site (Q3 and Q4) will read these files at build time and check a student's answer against them. A wrong question reaches students as a wrong verdict, which destroys trust, so CI must catch every mistake that a machine can catch. Authors are students and lecturers, not only programmers.

## Decision

- **One YAML file per question** in `content/questions/<id>.yaml`. The name of the file is the id. A file whose name starts with `_` is a template and is skipped. `schemaVersion: 1`; an unknown version is refused with a clear message, and an old version is never broken (a new one comes with a migration).
- **`content/questions/schema.json` is the contract** (JSON Schema draft 7). Each file starts with a `# yaml-language-server: $schema=./schema.json` line, so editors give autocompletion and red marks. The types in `web/src/lib/questions/types.ts` are written by hand; `question.test.ts` checks that a file with every field passes the schema and that the fields of the types equal the fields of the schema.
- **Fields:** `id`, `title` and `statement` (`id`, optional `en`), `type` (`build-dfsm`, `build-ndfsm`, `write-regex`), `alphabet`, optional `constraints`, `difficulty` (1 to 3), `week` (1 to 14), `pattern` (the guide that teaches it), optional `references` (`rich`, `sipser`), optional `hints` (at most 5), `examples` (at least 2 to accept and 2 to reject) and `solution`. Determinize and minimize practice are `build-dfsm` questions with `minimal: true`.
- **Constraints:** `maxStates` (1 to 100) for any machine; `complete` (default true) and `minimal` for `build-dfsm`; `allowEpsilon` (default true) for `build-ndfsm`; none for `write-regex`. `minimal` needs `complete`, because the minimal DFSM is counted with its dead state.
- **The file is read as text.** A YAML reader that guesses types turns an unquoted `0110` into the number 110 without any error, and `yes` into a boolean. The file is parsed with YAML's failsafe schema (everything is a string), and the JSON Schema converts only the fields that it declares as numbers or booleans. Anchors, aliases and tags are refused (a few lines of aliases can expand to gigabytes), a file is at most 64 KB, and the schema limits every length and count.
- **A short form for machines.** The solution of a machine question is `start`, `accepting`, `transitions` and optionally `states`, with transitions written `from symbol to` (`q0 0,1 q1`; `ε` or `eps` for ε). It is easy to write and to review in a diff, unlike the engine's JSON. `machine.ts` turns it into an engine machine, with the names of the states so that a message can name a state.
- **Statement text is plain text** with `backtick` code spans. No Markdown and no HTML, so a question file can never inject markup.
- **The check (`pnpm check:questions`, in CI after the WASM build)** has two parts. The shape (schema, the id equals the file name) needs no engine; `--schema-only` runs only this, for contributors without Rust. The rest runs on the real WASM engine: the solution loads and validates (any issue, also an unreachable state, is a problem), meets `maxStates`, `minimal` (compared with the engine's `minimize`; a stopped `minimize` is a problem, never a pass) and `allowEpsilon`, a regular expression parses with the alphabet, and every example is accepted or rejected as the file says. `--report` prints the first strings that each solution accepts, so that a reviewer can compare them with the statement.
- **What CI cannot check** is that the solution matches the sentence of the statement, and that the question is original (principle 7). The mitigations are the required examples, the report, `pattern` being required (it pushes toward pattern questions), and the pull-request checklist that Q7 adds.
- **Code layout:** the logic is erasable TypeScript with relative imports in `web/src/lib/questions/` (the site will reuse it in Q3 and Q4), and Node runs it directly from `tools/check-questions.mjs`. Two build-time dev dependencies, never in the browser: `yaml` 2.9.1 and `ajv` 8.20.0 (exact pins, more than two weeks old, no install scripts).
- **No real question yet.** Tests use fixtures. `content/questions/` holds the schema and `_template.yaml` until the owner writes the first questions (Q6). The existence of the guide named by `pattern` is checked from G1 on.

## Consequences

- A contributor without Rust or WSL (this includes the owner's Windows laptop) can run only `--schema-only` locally; the full check runs in CI, so its messages must be clear. They name the file, the line and the field.
- Adding a field means changing the schema, the types and the kitchen-sink samples together; the tests fail otherwise.
- The format fixes "one reference machine per question". Many different machines are correct, and Q4 compares by language (`equivalent`), not by shape, so this is not a limit for answers.
