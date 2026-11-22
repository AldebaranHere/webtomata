# 0060. A pinned Rust toolchain

Status: accepted

## Context

`rust-toolchain.toml` said `channel = "stable"`, and every clone and every CI job read that file, so a new
stable release changed the compiler with no change of ours. It happened twice. On 2026-11-18, clippy
1.100.0 added a lint that the code did not satisfy and the `rust` job went red on pull requests 217 and
218; T-079 (merged as `a6edc9b`) made the code clean under 1.99.1 and 1.100.0. The owner decided on
2026-11-18 to pin, so that a compiler change is a deliberate pull request.

## Decision

1. **The pin.** `rust-toolchain.toml` says `channel = "1.100.0"` (not a date, not `1.100`), with the same
   `targets = ["wasm32-unknown-unknown"]` and `components = ["rustfmt", "clippy"]` as before. Every clone
   and every CI job reads the same file.
2. **A guard.** `tools/check-rust-toolchain.test.mjs`, run by `pnpm test:tools` (which CI runs), reads the
   file as TOML would: it strips `#` comments, accepts white space around `=` and either quote style,
   requires exactly one `channel` (none fails, it does not pass), and then requires `^\d+\.\d+\.\d+$` on
   the value. Its message names the file and the bump procedure. It guards the channel only: a dropped
   `targets` or `components` entry is not caught; that is checked once by hand when the pin is written.
3. **A bump is one small pull request.** The five steps are in `CONTRIBUTING.md` ("Bumping the Rust
   version"): change the version; run `rustup show` once; run `cargo clippy --all-targets -- -D warnings`,
   `cargo test` and `pnpm build:wasm`; fix the new lints in the same pull request; open one pull request.
   The requirement line and the procedure say "the exact version in `rust-toolchain.toml`" and never write
   the number, so the file stays the one source of truth. Nothing is scheduled or automated.
   `CLAUDE.md` section 3 names the file instead of "stable".
4. **No workflow change.** The step `rustup show active-toolchain || rustup toolchain install` honours the
   pin, including the file's `targets` and `components`: the first command itself installs a missing pinned
   toolchain and adds a missing target or component to an installed one (both were proved locally, on a
   throwaway 1.98.0 pin and on an installed 1.100.0 without the wasm std). rustup marks this auto-install
   as deprecated; if a later rustup turns it into a hard error, the `||` fallback runs, and a no-argument
   `rustup toolchain install` installs the *active* toolchain and reads the same file (also proved). The
   same step appears seven times (five jobs of `ci.yml`, `deploy.yml`, `audit.yml`); all read this file.
5. **One local step, once.** A 1.100.0 installed before this change has no wasm std, so
   `cargo build --target wasm32-unknown-unknown` fails `E0463` until `rustup show` runs once (it adds the
   file's target). The bump procedure has that line; the owner and both workers run it once after merging.

## Consequences

- Every clone and every CI job now use 1.100.0; a compiler change is one deliberate pull request, and the
  `rust` job no longer goes red on its own.
- The `rust` job never prints `rustc 1.100.0`. The line that proves the pin is
  `1.100.0-x86_64-unknown-linux-gnu (overridden by '…/rust-toolchain.toml')`; a runner without the pinned
  version also logs `info: syncing channel updates …` and `the active toolchain … has been installed`.
- A runner image whose stable differs from 1.100.0 downloads the toolchain in every job (rust-cache does
  not cache toolchains). That is the price of a compiler that cannot move by itself.
- `fuzz.yml` is unchanged: `cargo +nightly fuzz` still runs on nightly, but its `cargo install cargo-fuzz`
  runs at the repository root and therefore uses the pinned 1.100.0, which rustup auto-installs in that
  job. Accepted; the runtime target is still nightly.
- The guard covers the channel only; `targets`/`components` are not guarded.
- Reversible: `git revert` returns the channel to `stable`, and the guard test goes with it. Nothing in the
  documents or the file formats changes.
