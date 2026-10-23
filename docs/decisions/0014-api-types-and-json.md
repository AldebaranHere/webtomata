# 0014. Engine API: JSON conventions and TypeScript types

Status: accepted (the WASM functions and the client follow in the second part of E12)

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
