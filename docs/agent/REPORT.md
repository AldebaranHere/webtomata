# T-082 — Dependency refresh: the seven audit findings of 2026-11-23

Branch `task/T-082-audit-deps`, cut from `origin/staging` at `1b7fc81` (PR 234, the amended spec).
Status: `done`. **Not pushed:** awaiting owner review.

## 1. What changed

| File | Change |
| --- | --- |
| `web/package.json` | `@sveltejs/adapter-static` `^4.0.0` → `^4.0.1`; `@sveltejs/kit` `^3.1.0` → `^3.1.1` (the only two lines that change). |
| `pnpm-lock.yaml` | Pinned to `@sveltejs/kit@3.1.1`, `@sveltejs/adapter-static@4.0.1`, `minimatch@11.0.5`. |
| `pnpm-workspace.yaml` | One `overrides` entry, `minimatch: 11.0.5`, with the comment that gives the date, the reason and when to remove it. |
| `Cargo.lock` | `rustix` 1.1.5 → 1.1.6 (version and checksum only; `tempfile` is its one dependent). |
| `docs/agent/DECISIONS.md` | One entry: the override, and the two-week habit as a snapshot. |
| `docs/agent/PLAN.md` | Status `in-progress` in the first commit, `done` in the last. |
| `docs/agent/REPORT.md` | This report. |

Three commits, as AC6 asks:

```
2919bf7 chore(deps): move @sveltejs/kit to 3.1.1 and adapter-static to 4.0.1
3fc5c09 chore(deps): override minimatch to 11.0.5
(tip)   chore(deps): move rustix to 1.1.6
```

The third commit is the tip of the branch; a commit cannot carry its own hash, so it is named by its
message here and by `HEAD` in `PLAN.md`.

## 2. The chosen versions (AC2)

Day of work 2026-11-23 UTC ⇒ **cutoff 2026-11-09** (a publish on 2026-11-09 is exactly 14 days old).
Command: `pnpm view <pkg> time --json`, filtered by age.

| Package | Chosen | Published (UTC) | Age | Why this and not a newer one |
| --- | --- | --- | --- | --- |
| `@sveltejs/kit` | **3.1.1** | 2026-10-29T23:48:42Z | 24 d | 3.2.0 is 2026-11-10 (12 d), 3.2.1/3.3.0/3.3.1 are 2026-11-17 (5 d), 3.4.0 is 2026-11-18 (4 d). |
| `@sveltejs/adapter-static` | **4.0.1** | 2026-10-29T23:53:05Z | 24 d | It is the newest 4.x; 4.0.0 is 2026-10-01. |
| `minimatch` | **11.0.5** | 2026-11-05T23:30:59Z | 17 d | 11.0.6 and 11.0.7 are 2026-11-10 (12 d), 11.0.8 is 2026-11-11 (11 d), 11.0.9 is 2026-11-16 (6 d). |

The dependency update pulled two transitive changes as well; both are older than the cutoff, so the
habit holds for them too: `legacy-javascript` 0.0.3 → 0.0.4 (2026-10-23, 30 d) and
`@isaacs/nonrecursive-glob-match` 1.1.0 added (2026-11-05, 17 d, a dependency of `minimatch` 11).

**The `minimatch` order, and which step applied.** (a) A newer `eslint` or `@eslint/config-array`
that is two weeks old and already needs `minimatch` 11: **unavailable.** The newest two-week-old
`eslint` (10.14.0, 2026-10-30) still declares `minimatch ^10.2.6` and `@eslint/config-array ^0.23.5`;
the first `@eslint/config-array` that wants 11 is 0.23.6 (2026-11-13, 9 d, too young), and
`eslint` 10.15.0 is also 2026-11-13. (b) **Applied:** an exact `overrides` entry. (c) Not needed.

## 3. F1 — `pnpm audit` before and after

Before (on `staging` at `1b7fc81`):

```
$ pnpm audit
7 vulnerabilities found
Severity: 5 moderate | 2 high
EXIT=1
```

Final tree:

```
$ pnpm audit
No known vulnerabilities found
EXIT=0

$ pnpm audit --prod
No known vulnerabilities found
EXIT=0
```

The intermediate state is honest: commit 1 closes six of the seven and leaves
`1 vulnerabilities found / Severity: 1 moderate` (the `minimatch` one), which commit 2 closes.
`pnpm audit --prod` is clean at every step.

## 4. F2 — frozen lockfile and no new exclusion

```
$ pnpm install --frozen-lockfile
Scope: all 2 workspace projects
✓ Lockfile passes supply-chain policies (verified 3s ago)
Lockfile is up to date, resolution step is skipped
Done in 1.1s using pnpm v12.14.0
EXIT=0
```

```
$ grep -n minimumReleaseAgeExclude pnpm-workspace.yaml || echo "gone"
gone
```

`git diff pnpm-workspace.yaml` is the override and its comment and nothing else:

```
@@ -14,6 +14,13 @@ allowBuilds:
 overrides:
   undici: 7.30.1
+  # minimatch 10.2.6 reaches us through eslint, @eslint/config-array and
+  # @typescript-eslint/typescript-estree, and GHSA-g3hv-75wg-m249 is fixed in 11.0.1. ...
+  minimatch: 11.0.5
```

No plain `pnpm install` was run at any point. The lockfile was regenerated with
`pnpm install --lockfile-only` and then materialised with `pnpm install --frozen-lockfile`.

## 5. F3 — the site is the same

`pnpm build && pnpm size` pass, and every route moved by **+9 bytes** gzip (limit 102):

```
route                                                      before    after   delta
_app/immutable/workers/assets/engine_wasm_bg-*.wasm        242582   242582       0
index.html                                                  83867    83876      +9
panduan.html                                                83016    83025      +9
panduan/berakhiran-x.html                                   89399    89408      +9
sandbox.html                                               124870   124879      +9
soal.html                                                   84510    84519      +9
soal/berakhiran-10.html                                    124209   124218      +9
soal/jumlah-a-genap.html                                   124209   124218      +9
soal/mengandung-101.html                                   124209   124218      +9
tentang.html                                                82314    82323      +9
```

`pnpm size` on the final tree:

```
ok   initial JS index.html: 81.9 KB gzip (limit 170 KB)
ok   initial JS panduan/berakhiran-x.html: 87.3 KB gzip (limit 170 KB)
ok   initial JS panduan.html: 81.1 KB gzip (limit 170 KB)
ok   initial JS sandbox.html: 122.0 KB gzip (limit 170 KB)
ok   initial JS soal/berakhiran-10.html: 121.3 KB gzip (limit 170 KB)
ok   initial JS soal/jumlah-a-genap.html: 121.3 KB gzip (limit 170 KB)
ok   initial JS soal/mengandung-101.html: 121.3 KB gzip (limit 170 KB)
ok   initial JS soal.html: 82.5 KB gzip (limit 170 KB)
ok   initial JS tentang.html: 80.4 KB gzip (limit 170 KB)
ok   layout worker _app/immutable/workers/layout.worker-*.js: 15.6 KB gzip (limit 40 KB)
ok   wasm _app/immutable/workers/assets/engine_wasm_bg-*.wasm: 236.9 KB gzip (limit 250 KB)
```

The byte counts are measured with the same rule as `tools/check-size.mjs` (sum of the gzip sizes of
the `.js` each page loads first), printed in bytes because `pnpm size` rounds to 0.1 KB.

## 6. F4 — the named checks

```
$ pnpm lint
$ pnpm --filter web lint
$ eslint .
EXIT=0

$ pnpm check
svelte-check found 0 errors and 0 warnings
EXIT=0

$ pnpm test:web
 Test Files  122 passed (122)
      Tests  1427 passed | 3 skipped (1430)
EXIT=0

$ pnpm --filter web exec playwright test editor-bar-phone pda-editor pda-panel pda-files pda-library editor-layout switcher --project=desktop --project=phone
  32 skipped
  86 passed (2.4m)
EXIT=0
```

The 32 skips are the specs' own project guards (desktop-only cases under `phone`, phone cases under
`desktop`), not failures.

## 7. F5 — the override lints the same files

```
$ (cd web && npx eslint . --format json) → files: 408      # with minimatch 11.0.5
$ (cd web && npx eslint . --format json) → files: 408      # baseline on staging
```

`pnpm lint` prints no count, so the count comes from the JSON formatter.

## 8. AC5 — the versions are pinned, not just "audit is quiet"

```
$ grep -nE "^  '?@sveltejs/kit@|^  '?@sveltejs/adapter-static@|^  minimatch@" pnpm-lock.yaml
991:  '@sveltejs/adapter-static@4.0.1':
996:  '@sveltejs/kit@3.1.1':
1688:  minimatch@11.0.5:
3500:  minimatch@11.0.5:

$ grep -c "@sveltejs/kit@3.4.0" pnpm-lock.yaml   → 0
$ grep -c "minimatch@10" pnpm-lock.yaml          → 0
```

This fixture can fail: in the pre-flight scratch copy, where the ranges were raised and a plain
lockfile update was run, the same grep found `'@sveltejs/kit@3.4.0':` — a four-day-old package that
`pnpm audit` accepts. That is exactly the case AC5 exists to catch.

## 9. The `rustix` commit

```
$ cargo update -p rustix --precise 1.1.6
    Updating crates.io index
    Updating rustix v1.1.5 -> v1.1.6
```

`Cargo.lock` changes only that package (version and checksum); `rustix` reaches us through
`tempfile` and is not in `fuzz/Cargo.lock`. On the pinned toolchain
(`1.100.0-x86_64-unknown-linux-gnu`, `rustc 1.100.0 (0ef1bc386 2026-11-09)`):

```
$ cargo audit
    Scanning Cargo.lock for vulnerabilities (107 crate dependencies)
EXIT=0                      # before: "Warning: unsound rustix 1.1.5 ... warning: 1 allowed warning found"

$ cargo test
test binaries: 35, total passed: 478, 0 failed
EXIT=0
```

## 10. AC6 — three commits, each green

| Commit | `pnpm install --frozen-lockfile` | `pnpm lint` | `pnpm audit` |
| --- | --- | --- | --- |
| 1. kit + adapter-static | pass | pass | **1 moderate left** (the `minimatch` finding) |
| 2. `minimatch` override | pass | pass (408 files) | clean |
| 3. `rustix` | pass | pass | clean; `cargo audit` clean |

Commit 1 cannot be audit-clean and also leave the `minimatch` finding for its own commit; the task is
the series. `pnpm lint`, `pnpm check`, `pnpm test:web` and the build are green at every commit. The
CI `audit` job runs on the pull request as a whole, not per commit, and it is not a required check.

## 11. AC3 — the diff is the scope

```
$ git diff --stat origin/staging      # taken just before this report was written
 Cargo.lock              |  4 ++--
 docs/agent/DECISIONS.md |  9 +++++++++
 docs/agent/PLAN.md      |  2 +-
 pnpm-lock.yaml          | 51 ++++++++++++++++++++++++++++---------------------
 pnpm-workspace.yaml     |  7 +++++++
 web/package.json        |  4 ++--
 6 files changed, 50 insertions(+), 27 deletions(-)
```

`docs/agent/REPORT.md` (this file) is the seventh and last file, added by the third commit. No source
file changed; `web/package.json` changes two version ranges and nothing else.

## 12. What was not run, and why

- **AC4 (CI on the PR)** waits for the push; it cannot exist locally.
- The full e2e suite and Lighthouse were not run: AGENTS.md forbids the full suite on a laptop and
  F4 names the area's specs instead.
- The `firefox` and `webkit-phone` projects were not run: F4 asks for `phone` and `desktop`, and no
  source changed.
- A real phone and the live site are the owner's.

## 13. Deepening pass

- **New exports / public interface members:** none. No TypeScript, Svelte or Rust source changed.
- **Casts added:** zero.
- **Duplication:** none introduced. The `undici` comment style is reused, not copied into a helper.
- **The interface is smaller than the work behind it:** the work is three lines of configuration plus
  the lockfiles; the reviewable surface is `web/package.json` (two ranges), one `overrides` entry and
  one `Cargo.lock` version.

## 14. Worth the planner's eye

- The two-week habit is still **not enforced** (pnpm checks one day, non-strict). The lockfile is the
  pin; a later `pnpm update` can move all three packages to versions younger than two weeks without
  any check failing. Recorded in `DECISIONS.md`; a `minimumReleaseAge` of 20160 is the owner's
  separate decision.
- `pnpm-lock.yaml` carries `minimatch` in two places (the package entry and the snapshot), so the
  AC5 grep prints two lines for it. That is the lockfile's normal shape, not a second version.
