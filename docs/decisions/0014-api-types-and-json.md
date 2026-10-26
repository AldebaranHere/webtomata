# 0014. Engine API: JSON conventions and TypeScript types

Status: accepted

## Context

The web app calls the engine through WASM and reads results as data. The Rust types and the TypeScript types must not drift apart, because a wrong field name gives `undefined` in the browser and no error. `engine-core` must stay free of browser code.

## Decision

- **One JSON convention.** Field names are camelCase, as in the machine file (`schemaVersion`). The tag of an enum (`result`, `kind`) and the names of its variants are snake_case (`"result": "finished"`, `"kind": "not_accepting"`). Results that can stop have the shape `{ "result": "finished", … }` or `{ "result": "stopped", "reason": …, "partialTrace": … }`.
- **A machine always serializes as the machine file.** `Fsm` implements `Serialize` through the same wire type as `to_json`, so a machine has one format everywhere (files, share links, results). In TypeScript it is the type `Machine`.
- **Budgets come in as JSON** with camelCase names. A missing field keeps its default, and an unknown field is an error, so a misspelled budget is never ignored silently. In TypeScript the web client uses `Partial<…Budget>`.
- **TypeScript types come from the Rust types with `ts-rs` 12.0.1** (MIT; its only normal dependency is `thiserror`). It is an optional dependency of `engine-core`, behind the feature `ts`. The WASM build does not use the feature, so the types cost 0 bytes and `engine-core` has no browser code. `pnpm build:types` runs the test `ts_export`, which writes `web/src/lib/engine/types.ts`. The file is generated, git-ignored and skipped by Prettier and ESLint. `pnpm build:wasm` runs `build:types`, so CI generates it before `pnpm check`.
- **Tests keep the two sides together.** `json_shapes.rs` checks the field names and nesting of every result type. `ts_export.rs` checks that the generated types contain every type and the same names, and that no snake_case field or `bigint` slipped in. `pnpm check` compiles `web/` against the file.
- `tsify` (the example in `CLAUDE.md`) was not used: it needs `wasm-bindgen` in the crate that owns the types, so it would put browser code in `engine-core` or need a copy of each type in `engine-wasm`.

## Consequences

- A change to a Rust result type changes the TypeScript type, and the web build breaks and not the user.
- Numbers that are `i64` in Rust (message parameters) are `number` in TypeScript; they are small by construction.
- Budget fields are required in the generated type (`ts-rs` does not make `serde(default)` fields optional), so callers use `Partial`.

## Part 2: the functions and the client

- **The API lives in `engine-core::api`**, not in `engine-wasm`. Each function takes JSON or plain text and returns one JSON text. `engine-wasm` only adds `wasm-bindgen` (one line for each function). So every function is tested natively with `cargo test`, the types stay in one crate, and `engine-core` still has no browser code.
- **One envelope** for every answer: `{"ok":true,"value":…}` or `{"ok":false,"error":<message>}`. Errors in the input, in a budget, in an alphabet and in a layout are messages (`api.invalid_budget`, `api.invalid_alphabet`, `api.invalid_layout`), never exceptions. A property test feeds random text to every function and checks that it answers with an envelope.
- **Results carry names.** `simulate` returns the tokenized input as names. `equivalent` returns the witness and the wrong-string lists as names in the alphabet of the candidate. A test runs the witness on both machines, with the reference alphabet in another order, to prove that no number is looked up in the wrong alphabet.
- **Limits** on every input text (see ARCHITECTURE.md), so that a huge paste cannot exhaust memory before a budget applies.
- **The golden samples** are real answers of every function, written into `types.ts` as `export const sampleX = {…} satisfies EngineResult<T>;`. A type that drifts from the JSON fails `pnpm check`.
- **The worker treats any exception as a crash.** With `panic = "abort"`, a panic or a stack overflow is a trap that throws into JavaScript but leaves the worker running, and the WASM memory may be in a broken state. So the worker reports `crashed` and closes itself, and the client discards it and starts a new one on the next call. Late answers of a discarded worker are ignored.
- **Web budgets** are smaller than the engine defaults: simulate 10,000 steps, determinize 500 states, minimize 20,000 steps, equivalent 20,000 pairs, regexToFsm 500 states, fsmToRegex 500 nodes, simplify 500 checks and 5,000 steps, intersection 500 states. A call can pass its own budget.
- **Vitest 5.0.3** (MIT, no install scripts) is added to `web/`, as the decided stack says. It runs the client tests with a fake worker, a test that runs every handler through the real WASM module, and a test that the ESLint rule `svelte/no-at-html-tags` stays on.
- **Measured:** the `.wasm` file is 163 KB gzip (budget 250 KB); initial JS is 31 KB gzip. A smoke test in a real browser called all 17 functions, forced a crash and recovered, and canceled a call in flight.

## Consequences of part 2

- A function that the UI needs and the API lacks is added in `engine-core::api`, with a test, and appears in `types.ts` by itself.
- Memory in the WASM module never shrinks. A later task may recycle the worker after a very big call.
