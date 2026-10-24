# 0018. Browser tests with Playwright and axe, on the installed Chrome

Status: accepted

## Context
The editor (S4) needs tests that act like a user (click, type, touch) and an accessibility scan, in CI, on the production build. `CLAUDE.md` names Playwright and axe-core. We already run the production build in headless Chrome for the smoke test and Lighthouse, so the runner has Chrome.

## Decision
- **Playwright with the installed Chrome** (`channel: 'chrome'`, or `CHROME_PATH`). Playwright downloads no browser. Firefox and WebKit need a download of about 150 MB each from a CDN; we decide them at the start of M2, when there are real flows to test. Until then the tests cover Chrome only.
- **Packages** (devDependencies of `web/`, exact versions, each at least two weeks old when added): `@playwright/test` 1.64.0 and `@axe-core/playwright` 4.13.0. With their dependencies (`playwright`, `playwright-core`, `axe-core`) this adds five packages, none with an install script.
- **Two projects**: `desktop` (1440 × 900) and `phone` (Pixel 7 emulation, with touch). Every test runs in both.
- **The build is served by `tools/serve-build.mjs`**, the server of the smoke test and Lighthouse, on a fixed port (4599), started in `globalSetup`. The tests run on the production build, under the CSP of its meta tag.
- **Every test fails on a console error, an uncaught error, a failed request or an HTTP status of 400 or more** (an automatic fixture). The problems are listed after the test, so the first does not hide the others.
- **axe allows no violation** (WCAG 2.0, 2.1 and 2.2 A and AA, and best practices). A rule is never switched off to get a green run: a real exception needs a reason and a date.
- **A canary** (`axe.spec.ts`) proves that the scan fails on a missing alt text and on faint text, and passes on a good page. Without it, a scan that checks nothing would look like an accessible page.
- **One retry on CI**, for Chrome that fails to start on a busy runner. More would hide flakes.

## Consequences
- The suite is small on purpose. A new test must run 20 times in a row without a failure before it is merged.
- axe finds only part of the accessibility problems. G5 (a keyboard-only run, a screen-reader check) stays.
- Our test server is not Cloudflare (it gzips everything and sends no `_headers`). The smoke test on the deployed URL stays.
- Chrome on the runner image changes by itself. A break shows as a red run, not silently; we then pin or update Playwright.
- A real Android phone is not covered by the emulation (G4).
