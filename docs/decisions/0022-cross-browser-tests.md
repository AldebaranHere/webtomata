# 0022. A small set of browser tests in Firefox and WebKit

Status: accepted

## Context
ADR 0018 runs the browser tests in the installed Chrome (desktop and a phone emulation) and said that Firefox and WebKit would be decided at the start of M2. The editor now has pointer and touch handling, focus handling that decides whether a box stays open, SVG geometry and a WASM engine in a worker. These are the places where engines differ. All iPhone browsers use WebKit, so a Safari-only bug reaches every iPhone user. A bug of this kind has already shown on a real Android phone (the focus taken by the mouse events after a tap), and Chrome emulation did not see it.

## Decision
- **A small set, not the whole suite.** The folder `web/e2e/cross/` holds the tests that run in every engine: the engine starts, the Sandbox opens and passes axe, two states and an edge are built and undone, the keyboard works on a state, the tool names of the phone bar fit, and a saved language survives a reload. Chrome (desktop and phone) runs them too, with all other tests. Firefox and WebKit run only this folder.
- **Two new Playwright projects:** `firefox` (desktop) and `webkit-phone` (the iPhone 13 emulation, with touch). They never use the Chrome of `CHROME_PATH`.
- **Only Playwright's own events** in these tests (no Chrome DevTools calls), so that Firefox and WebKit can run them. A touch is `tap()`.
- **A new CI job, `cross-browser`,** runs in parallel with `web`, so the total time of a pull request does not grow much. It has no secrets and read-only rights (ADR 0015). It builds the site, downloads Firefox and WebKit with `playwright install` at the Playwright version of the lockfile (1.64.0), caches them by the lockfile, and runs `pnpm test:e2e:cross`.
- **No new package.** Playwright already ships the browsers' downloader. The browsers come from Playwright's own server, only in CI and on a developer's computer that chooses to run them.
- **When a test fails in one engine,** the cause is fixed in the editor if it is small, with its own test. A bigger cause becomes an item in the roadmap, and the test is marked as an expected failure with a link to it. It is never deleted to get a green run.

## Consequences
- CI has a second job to keep green. Each engine can have its own flaky tests; the rule of ADR 0018 holds: a new test runs 20 times in a row before it is merged (10 for the cross set in WebKit while it is small).
- Playwright cannot send real touch events to Firefox or WebKit. `tap()` does not send the mouse events that follow a real tap on a phone. The tap bug of S4c-1 would not have been found here. A real iPhone and a real Android phone stay in the plan (G4, and the owner's phone tests).
- WebKit in Playwright is the engine, not iOS Safari. It finds engine bugs, not hardware or system bugs.
- On Windows, Playwright's Firefox may fail to start when the Visual C++ runtime is missing ("side-by-side configuration is incorrect"). We did not change the system settings of the computer used for this task, so Firefox ran first in CI. WebKit ran locally.
