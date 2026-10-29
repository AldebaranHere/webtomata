# 0030. Content license, About page and site footer

Date: 2026-10-29

## Context

WebTomata's software source code is licensed under the GNU Affero General Public License v3.0 (`AGPL-3.0-only`), recorded in `LICENSE` and declared in `package.json`.

In milestone M4 (task D1), the project requires:
1. A clear license for educational content (`content/questions/` and `content/guides/`).
2. An "Tentang" (/tentang) page explaining the project, course context, textbook references, privacy pledge, and how to report issues.
3. A site-wide footer linking to the About page, source repository, licenses, and privacy statement.
4. A rule in `CONTRIBUTING.md` preventing contributions from copying university course homework, quizzes, or exams.

Code licenses like the AGPL are designed for executable software and compilers, not educational curriculum or explanatory prose. Contributors and educators need to know their rights when reading, sharing, adapting, or submitting questions and guides.

## Decision

1. **Content License:**
   All questions in `content/questions/` and guides in `content/guides/` are licensed under the **Creative Commons Attribution-ShareAlike 4.0 International License (`CC BY-SA 4.0`)**.
   - Anyone may share and adapt the educational material for learning, teaching, or research.
   - Attribution must be given to WebTomata (`https://webtomata.pages.dev` or repository).
   - Adaptations must be distributed under the same license (`ShareAlike`), preserving copyleft principles aligned with AGPL-3.0 for software.

2. **The `/tentang` Page:**
   A prerendered static page at `/tentang` providing:
   - What WebTomata is: an Indonesian-first interactive web tool for Theory of Computation (ToC) students (Fasilkom UI).
   - Textbook references: Elaine Rich (*Automata, Computability and Complexity*) as default notation and Michael Sipser (*Introduction to the Theory of Computation*).
   - Privacy commitment: *"Tanpa akun, tanpa pelacakan"* (100% in-browser client execution via WebAssembly; no cookies, no tracking scripts, no third-party telemetry).
   - Licensing terms: AGPL-3.0 for software, CC BY-SA 4.0 for content.
   - Issue reporting: link to GitHub Issues for reporting incorrect automata grading or UI bugs.

3. **Site Footer & Navigation:**
   - A semantic `<SiteFooter>` component rendered on all document/prose routes (`/`, `/soal`, `/panduan`, `/panduan/[id]`, `/tentang`).
   - The full-height canvas routes (`/sandbox` and `/soal/[id]`) remain clean `100dvh` without an intrusive bottom footer; instead, `/tentang` is linked from `<SiteHeader>` navigation and menu drawers so it is reachable everywhere.
   - `/tentang` is added to `/sitemap.xml`.

4. **Contribution Ethics:**
   `CONTRIBUTING.md` states plainly that all questions and guides must be original and must never copy or closely paraphrase active course homework, quizzes, or exams.

## Consequences

- Educational content is openly reusable with copyleft protections matching the software.
- Students and teachers can verify licensing and privacy promises directly from `/tentang`.
- No tracking scripts or analytics cookies are added, maintaining zero-telemetry integrity.
- Page bundle size remains well within the 170 KB limit and Lighthouse budgets.

