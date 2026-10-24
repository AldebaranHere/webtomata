# Architecture

WebTomata is a static site. Everything runs in the visitor's browser; there is no server, database or account.

```mermaid
flowchart LR
  subgraph Browser
    UI["Svelte UI (main thread)"] -- "typed messages" --> W["Engine worker"]
    W --> E["engine-wasm (WASM)"]
    E --> C["engine-core (Rust)"]
    UI --> S[("IndexedDB: saved machines")]
  end
  CDN["Cloudflare static assets"] -- "HTML, JS, .wasm, content" --> Browser
```

## Layers

| Layer | Where | Rule |
| --- | --- | --- |
| `engine-core` | `crates/engine-core` | Pure Rust, no browser or OS code, no `unsafe`. Returns data and message keys, never sentences. Its `api` module is the API for the web app: text in, one JSON envelope out. |
| `engine-wasm` | `crates/engine-wasm` | Thin `wasm-bindgen` layer: one line for each function of `engine_core::api`. |
| Engine client | `web/src/lib/engine` | Only `worker.ts` imports the WASM package (ESLint enforces it). The UI talks to the worker through `client.ts`, which is typed with `types.ts` (generated from the Rust types). |
| UI | `web/src` | SvelteKit, prerendered by `adapter-static`. |
| Content | `content/` | Questions and guides as plain files, compiled at build time. |

## Engine API

One WASM call for each user action. Every function takes text and returns one text, in the same envelope: `{ "ok": true, "value": … }` or `{ "ok": false, "error": <message> }`. Bad input never throws. Details are in ADR 0014 and in the doc comment of `crates/engine-core/src/api.rs`.

| Group | Functions (JavaScript names) |
| --- | --- |
| Machines | `loadMachine`, `validate`, `nondeterministicStates`, `addTrapState` |
| Run | `simulate(machine, input, budget?)` |
| Conversions | `determinize`, `minimize`, `equivalent(candidate, reference, budget?)` |
| Regular expressions | `regexToFsm(text, alphabet, budget?)`, `fsmToRegex`, `simplify(text, alphabet, budget?)` |
| Closure | `complement`, `union`, `intersection` |
| JFLAP | `importJff(xml)`, `exportJff(machine, layout)` |
| Other | `version` |

- **Machines** are the machine file (`schemaVersion` 1). **Budgets** are partial JSON objects: a missing field keeps the default, and an unknown field is an error. The web client adds smaller budgets than the engine defaults (`WEB_BUDGETS` in `client.ts`) so that a cheap phone does not work for long.
- **Strings come with names.** `simulate` returns the input as symbol names, and `equivalent` returns the witness and the wrong-string lists as names in the alphabet of the candidate, so the UI never looks up a number in the wrong alphabet.
- **Limits** apply to every input: machine and `.jff` files 1 MiB, regular expressions 1,000 characters, simulation input 100,000 bytes, budget text 4,096 bytes.
- **The types** in `web/src/lib/engine/types.ts` are generated (`pnpm build:types`, run by `pnpm build:wasm`) and are not committed. The file also holds golden samples, real answers of every function written as constants that must fit their types, so `pnpm check` fails if a Rust type and the JSON drift apart.
- **A crash does not freeze the app.** Any exception in the worker (a WASM trap, an unknown call) makes the worker report a crash and close. The client then fails the waiting calls with `EngineCrashed`, and the next call starts a new worker. `engine.cancel()` ends the worker the same way (`EngineCancelled`). Saved machines live on the main thread and in IndexedDB, so they are not affected.

## Trust boundary

- **Trusted:** our own code and build output served from the same origin.
- **Untrusted:** anything a user can import or open: `.jff` and JSON files, share-link fragments. These are validated for size and structure before use (E10, S10).
- **No user data leaves the device.** Machines are saved in IndexedDB and shared only as a URL fragment (`#...`), which browsers never send to a server.
- **CSP** (set per `docs/decisions/0002-deploy-cloudflare-workers.md`): scripts only from `'self'` plus `'wasm-unsafe-eval'` and one hash for SvelteKit's inline bootstrap script.

## Build and deploy

`pnpm build` runs `wasm-pack` (release, `wasm-opt -Oz`) and then `vite build` into `web/build/`. CI checks formatting, lint, types, tests, size budgets and Lighthouse budgets (`tools/budgets.mjs`). Merges to `main` deploy `web/build/` to Cloudflare; pull requests get a preview URL.

## Performance and benchmarks

Budgets are in `CLAUDE.md` §7 and enforced in CI. The `.wasm` file with the full API is about 163 KB gzip (budget 250 KB).

### Engine benchmarks (E13)

**How to run them.** `cargo bench -p engine-core` times `determinize`, `minimize` and `equivalent` natively with Criterion (`crates/engine-core/benches/engine.rs`). `pnpm build:wasm` and then `node tools/bench-wasm.mjs` time the same machines through the WASM module in Node, as the worker calls it: the machine as JSON text in, the answer as JSON text out. `cargo test -p engine-core --benches` runs each case once, and checks that every case finishes with the size that its family promises. Benchmarks do not run in CI, because shared runners are too noisy.

**The numbers are indicative, for this one computer.** Measured on 2026-10-24, on commit `b3c4f9f` plus the benchmark files: Intel Core i7-1255U (a hybrid CPU: 2 fast P-cores with 4 threads, and 8 slow E-cores), 16 GB, Windows 11, mains power, the Balanced power plan, Rust 1.99.1 (the benchmark uses the release settings of the workspace, `opt-level = "z"`, as the shipped engine does), Node 24.21.0. Other programs were running (7–35% CPU).

- **Pinned runs.** Unpinned runs on this CPU were 1.5 to 3 times slower and often differed by 3 times between two runs a few minutes apart (Windows moves the thread between P-cores and E-cores). So the tables use runs pinned to two P-core threads with high priority, **two runs each, both values shown**. Even then, some cases differ by 30 to 60% between the two runs, so read each number as "about", and a difference of less than 50% between two cases as "the same".
- **A phone is slower.** WASM through the API took about 1.2 to 2 times the native time, and a mid-range Android phone is typically several times slower than a laptop CPU. We did not measure a phone. Do not read these numbers as a promise for phones.

| What is timed | 10 states | 100 states | 500 states |
| --- | --- | --- | --- |
| `determinize`: NFA "ends in n−1 a's", n states in, n out | 40 – 46 µs | 0.93 – 1.5 ms | 23 – 30 ms |
| `minimize`: random complete DFSM, 3 symbols | 57 – 61 µs | 2.3 – 2.4 ms | 50 – 59 ms |
| `minimize`: chain of n states, already minimal (about n rounds of splitting) | 40 – 49 µs | 2.0 ms | 48 – 54 ms |
| `equivalent`: a counter modulo n and the same machine renumbered (the whole product is explored) | 28 – 33 µs | 0.35 – 0.47 ms | 1.4 ms |
| `equivalent`: a counter modulo n and modulo n+2 (a witness is found, and up to 5 wrong strings of length ≤ 8 are listed per side) | 0.38 – 0.39 ms | 0.77 – 0.86 ms | 2.0 – 2.1 ms |

| `determinize`: "the k-th symbol from the end is a" (k+1 states in, 2^k out) | k = 6 (64 states) | k = 8 (256 states) | k = 10 (1,024 states) |
| --- | --- | --- | --- |
| Native | 0.16 – 0.21 ms | 0.78 – 0.85 ms | 4.2 – 4.4 ms |
| WASM through the API, in Node | 0.58 – 0.68 ms | 3.0 – 3.1 ms | 12 – 13 ms |

WASM through the API, in Node, for the same cases as the first table:

| What is timed | 10 states | 100 states | 500 states |
| --- | --- | --- | --- |
| `determinize` ends_with_a | 0.15 – 0.16 ms | 2.4 – 2.6 ms | 41 – 42 ms |
| `minimize` random | 0.27 – 0.31 ms | 5.6 – 6.0 ms | 82 – 85 ms |
| `minimize` chain | 0.15 – 0.18 ms | 4.3 – 5.6 ms | 87 – 103 ms |
| `equivalent` same language | 0.08 ms | 0.72 – 0.74 ms | 3.6 – 4.0 ms |
| `equivalent` different | 0.42 – 0.52 ms | 1.2 – 1.3 ms | 4.4 – 4.6 ms |

A check in the real browser (Chromium, not pinned) gave 41 ms for `determinize` ends_with_a 500 and 95 ms for `minimize` random 500, so Node is a fair stand-in for Chrome.

**What the numbers show**
- `determinize` and `minimize` grow roughly with the square of the number of states (5 times more states take about 20 times longer). `equivalent` grows roughly in step with the number of state pairs, so it is cheap.
- The worst case of subset construction is limited by `MAX_STATES`: k = 10 (1,024 states) takes about 4 ms natively, so the 2,000-state limit is not a time problem.
- **A slow case, found while checking the web budgets.** `minimize` on a chain of 2,000 states (the largest machine the engine accepts) took about 2.0 s through WASM on this computer, and the web budget `maxSteps: 20000` did not stop it, because the number of trace steps does not bound the running time. On a phone this could take many seconds. A student can cancel the call (`engine.cancel()`), and the machines in a course are far smaller (the table above shows 500 states in under 0.1 s), but a very large imported file could hit this. This is not fixed in E13. Options for a later task: a faster implementation that keeps Rich's trace, or a smaller limit on the machine size for `minimize` in the web client.
- **`fsmToRegex` and the budget `maxNodes: 500`.** Time is not the limit here: every call took under 4 ms. Machines of textbook size (up to 12 states with few transitions) finish within 500 nodes, but a dense random machine of 6 states already stops at 500, and the engine default of 2,000 nodes finishes up to about 10 states (an expression of about 1,800 characters, which no student can read). The budget is a bound on readability, not on time.
- The other web budgets from E12 hold: `determinize` stops at 500 states after about 100 ms, and `equivalent` needs about 10 ms for 2,000 pairs, so 20,000 pairs is about 0.1 s.

