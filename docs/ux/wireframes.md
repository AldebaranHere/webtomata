# Wireframes

The approved wireframes for v1 (task U1), as screenshots, with the decisions behind them. The owner approved them on 2026-10-24. Build screens to match them. If a screen is missing or unclear, ask; do not invent a layout (`CLAUDE.md` section 6).

How to read them:

- They are static pictures with sample data. The machines, counts and times are examples. `[Judul soal 2]` and `[Judul soal 3]` are placeholders for questions that do not exist yet.
- Words follow [`glossary.md`](../glossary.md) ("state", not "status"). Colors, type and sizes follow [`design-system.md`](design-system.md). What each editor action does is in [`editor-interactions.md`](editor-interactions.md).
- The sources (one HTML file per screen) are private, in `MD_FILES/wireframes-src/`. The screenshots were rendered from them with headless Chrome.

## Screens

| Screen                      | Laptop (1440 px)                                                 | Phone (390 px)                                                | Built by   |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- | ---------- |
| Sandbox                     | [sandbox-laptop](wireframes/sandbox-laptop.png)                  | [sandbox-phone](wireframes/sandbox-phone.png)                 | S1, S4, S6 |
| First run (empty Sandbox)   | [first-run-laptop](wireframes/first-run-laptop.png)              | [first-run-phone](wireframes/first-run-phone.png)             | X1         |
| Mesin saya (saved machines) | [my-machines-laptop](wireframes/my-machines-laptop.png) (dialog) | [my-machines-phone](wireframes/my-machines-phone.png) (sheet) | S10a, S10b |
| Soal                        | [soal-laptop](wireframes/soal-laptop.png)                        | [soal-phone](wireframes/soal-phone.png)                       | Q3, Q4     |
| Panduan, list               | [guides-laptop](wireframes/guides-laptop.png)                    | [guides-phone](wireframes/guides-phone.png)                   | G1         |
| Panduan, one guide          | [guide-laptop](wireframes/guide-laptop.png)                      | [guide-phone](wireframes/guide-phone.png)                     | G1, G2     |

![Sandbox, laptop](wireframes/sandbox-laptop.png)

![Sandbox, phone](wireframes/sandbox-phone.png)

![First run, laptop](wireframes/first-run-laptop.png)

![First run, phone](wireframes/first-run-phone.png)

![Mesin saya, laptop](wireframes/my-machines-laptop.png)

![Mesin saya, phone](wireframes/my-machines-phone.png)

![Soal, laptop](wireframes/soal-laptop.png)

![Soal, phone](wireframes/soal-phone.png)

![Panduan list, laptop](wireframes/guides-laptop.png)

![Panduan list, phone](wireframes/guides-phone.png)

![One guide, laptop](wireframes/guide-laptop.png)

![One guide, phone](wireframes/guide-phone.png)

## Decisions

1. **Words.** "State" everywhere: tool names, menus, messages. A step-by-step run is a "komputasi", a step of a conversion is a "langkah" (not "jejak"). See the glossary.
2. **Name.** The product is shown as "WebTomata" in the header.
3. **No notation switch in v1.** The header has no "Notasi" select. Rich notation only; labels live in message files so a switch can come later.
4. **Machine type.** The "DFSM ▾" chip is a control, not a label. The user picks DFSM or NDFSM (default DFSM). A wrong choice shows calm validation messages and never blocks editing.
5. **ε on the phone.** There is no permanent ε button in the dock (it has four tools: Pilih, State, Transisi, Hapus). The "Ketik ε" button lives in the label field's own bar and shows only while a label field is open. On the laptop, ε is typed as `eps`, the character `ε`, or Ctrl+E. `E` alone is not a shortcut.
6. **Tapping the canvas.** "Ketuk kanvas = state baru" holds in the State tool. In Pilih, a tap on empty canvas clears the selection.
7. **Saved machines.** "Mesin saya (n)" in the header opens a list: open, rename, duplicate, export `.jff`, delete, new, import. The footer says plainly that clearing site data deletes the machines, and that export is the backup.
8. **Compare.** The button says "Bandingkan dengan mesin ini" and is in the regex form of the Konversi tab (S8; see editor-interactions.md). Comparing with another saved machine is not in v1.
9. **First run.** An empty Sandbox shows "Coba contoh" (four examples, one click each), "Mulai dari kanvas kosong", "Buka file .jff atau JSON", an optional "Tur 1 menit", and the line "Tanpa akun, tanpa pelacakan". The "Mesin saya" button shows a count when machines are saved.
10. **Feedback panel.** Structure check, verdict, the two wrong-string lists, then the computation of the shortest wrong string. No numbers on the sections: the order is the structure. The wording follows U4.
11. **Panduan.** The list has topic filters (Semua, DFSM, NDFSM, Regex, Operasi) and cards by pattern, each with its number of linked questions and reading time. A guide has a reading column of about 68 characters, a contents list (a "Isi" button on the phone), one read-only machine with "Buka di editor", steps, common mistakes, linked questions and a next link. Guide pages need almost no JavaScript apart from the embed.
12. **Targets.** Every tap target is at least 44 × 44 px (`--target-min`), including the zoom control, the tabs and the wrong-string chips.
13. **Zoom.** The laptop zoom control has "−", the percentage, "+" and "Pas" (fit). The phone zooms by pinching and has no zoom control.

## Open questions

These do not block M1. Each has an owner task.

1. **Selecting several items on touch** is not in v1 (U5 decides after the first usability round).
2. **The one-minute tour.** The first-run screen links to it, but its steps are not designed. X1 writes them, shortest possible, and the owner approves them.
3. **The example machines** in "Coba contoh": X1 ships three (Berakhiran 01, Jumlah a genap, a union through ε); the regex example of the wireframe joins with S7, and "Buka file .jff atau JSON" with S10b. They must be patterns, never course homework.
4. **Section numbers** "Rich 5.2 · Sipser 1.1" come from the first wireframes and are not verified. Check them in G3 and Q6 before they ship.
5. **Question titles** in the guide ("Soal terkait") are placeholders until Q6.
6. **Screens not drawn yet:** (the Soal list page was drawn and approved on 2026-10-29; see below), (the Tabel and Definisi tabs were drawn and approved on 2026-10-26; see editor-interactions.md), (the Konversi tab and the conversion step view were drawn and approved on 2026-10-26; see editor-interactions.md), the "compare with regex" view (S8), and error and stopped states of the engine (S2). Each needs a wireframe before its task starts, and the owner approves it.
7. **The word "Sandbox"** has no course source. It stays unless the owner or the lecturer asks for an Indonesian word.
8. **Sorting and size of the guide list.** Six cards fit; a longer list may need a search box. Decide in G3.

## Soal list page (Q3a, approved on 2026-10-29)

- **The page.** A heading "Soal", one sentence ("Latihan membuat mesin dan ekspresi reguler. Kamu mengerjakannya di editor, dan hasilnya diperiksa di perangkatmu."), the filters, the count ("12 soal", a live region), and a grid of cards (about 16 rem wide, as many as fit).
- **Filters.** Three groups of chips, one choice in each, with "Semua" for none: Minggu (the weeks that some question has), Jenis (Buat DFSM, Buat NDFSM, Tulis regex) and Tingkat (Mudah, Sedang, Sulit). Native radio buttons, so the keyboard and a screen reader work as they should. Chips are 44 px high. The choice is kept in the address (`?minggu=1&jenis=build-dfsm&tingkat=2`); a value that is not known is ignored.
- **A card** shows "Minggu 1 · Pola: berakhiran x", the title (in the language of the page), the type as a tag and the difficulty. The status "selesai" comes with Q5. The cards are in the order of the syllabus: the earlier week first, then the easier question. A card becomes a link to the question with Q3b.
- **Phone.** Under 48 rem the filters leave the page; a button "Filter (n)" (n is the number of filters that are set) opens a sheet from the bottom with the three groups, "Hapus filter", "Tutup" and "Terapkan". Nothing applies before "Terapkan", and "Tutup" leaves the list as it was.
- **Empty states.** No questions at all: "Belum ada soal." No match: "Tidak ada soal yang cocok dengan filter ini." with "Hapus filter".

## The page of a question (Q3b, plan approved on 2026-10-29)

The layout is the approved wireframe of Soal (`soal-laptop.png`, `soal-phone.png`), without the feedback part (Q4).

- **Laptop.** Left column of 22 rem: "Soal › Minggu 1" (a link back to the list), "Soal 2 dari 3 · Pola: berakhiran x", the title, the statement, and the chips (the type of the answer, each constraint that is not at its default, the textbook sections as one chip). Next to it the editor: the canvas, and the panel with the tabs Simulasi, Tabel and Definisi. There is no Konversi tab, share button, list of machines or tour on this page.
- **Phone (changed on 2026-10-29, after the phone test of PR 91).** A bar above the canvas that can be hidden. **Closed (the first time): one line**, the title (cut with an ellipsis if it is long) and the button "Lihat soal" (44 px), about 53 px high, so that the canvas and the panel have the room (the statement used to take 45% of the height). **Open:** the crumbs, "Soal 2 dari 3 · Pola: …", the title, the whole statement and the chips, with the button "Sembunyikan soal"; at most half of the height, and it scrolls inside itself. The choice is remembered on this device (`webtomata.question.open`; a blocked storage means hidden) and is the same for every question. A laptop always shows the statement in its column and has no button. Then the editor as in the Sandbox.
- **The statement** is plain text: a blank line starts a paragraph and `backticks` make code. It is never shown as HTML.
- **The machine** starts with the alphabet of the question, and as an NDFSM for an NDFSM question. The title bar shows the title of the question in the language of the page. What the student builds is saved on this device for this question (one record, `soal:<id>`), kept apart from the machines of the Sandbox: the Sandbox never opens it and "Mesin saya" does not list it.
- **Saved work that cannot be read:** "Pekerjaanmu sebelumnya di soal ini tidak bisa dibaca, jadi soal dimulai dari awal. Pekerjaan lama tetap tersimpan sampai kamu mengubah mesin." (with "Tutup").
- **A `write-regex` question** shows the statement and "Kolom jawaban untuk soal ini menyusul." until Q4.
- **Not here yet:** the status of the question came with Q5, below, and the pattern links to `/panduan/<pattern>` when the guide exists (G1, below). (The feedback and the hints came with Q4b, below.)

## The feedback of a question (Q4b, plan approved on 2026-10-29)

The tab "Umpan balik" and the hints, from the approved Soal wireframe and `docs/ux/feedback-copy.md`. Wording is that guide's.

- **The tab.** A fourth tab of the panel, **first** in the row (Umpan balik, Simulasi, Tabel, Definisi), and the one that is open when the page opens. It is only on the page of a machine question; the Sandbox does not have it. The panel keeps it in the page, so a result is not lost when the student looks at another tab.
- **The button** "Periksa jawaban" (after the first check, "Periksa lagi") is at the top of the tab, 44 px, with the one-line intro "Bangun mesinmu, lalu periksa. Hasilnya muncul di sini." until there is a result. While the engine works it says "Memeriksa…". The solution file is fetched only then.
- **The result**, in a live region, in this order, each part only when it applies:
  1. **Structure.** If it is not sound: a neutral card "Lihat dulu strukturnya." with a line for each problem (the checks of the editor, or "Soal ini meminta DFSM…", "Soal ini membatasi n state…", "…mesin minimal…", "…transisi ε…", the alphabet) and "Setelah bagian ini sesuai dengan soal, periksa lagi." **There is no verdict until it is sound.** If it is sound: one line, "**Struktur valid.** Setiap state punya transisi untuk 0, 1.", shown **after the verdict** (changed on 2026-10-29: the verdict comes first, so that it is in view in a small panel).
  2. **Verdict (first when the structure is sound).** A card with a title and a detail: "Tepat." (success tint); "Belum tepat, tapi sudah dekat." (the shortest wrong string has at most 4 symbols, the two lists at most 5 strings together, not cut) or "Belum tepat." (warning tint); "Pemeriksaan dihentikan." (the engine stopped); "Pemeriksaan belum bisa dijalankan." (no answer file or engine).
  3. **Two lists** of wrong strings as chips (44 px, at most 8 and then "dan n lainnya"), shortest first: "Diterima mesinmu, padahal seharusnya ditolak" and "Ditolak mesinmu, padahal seharusnya diterima"; an empty list says "Tidak ada. Bagian ini sudah benar."; a cut list says so. A chip runs that string in Simulasi.
  4. **The shortest wrong string:** "Komputasi string terpendek yang salah: …", the lines of the computation as in Simulasi with the last one marked "← di sini", one guiding question ("Setelah 10, mesinmu ada di q0. Apakah itu yang perlu diingat mesin?"; for the empty string, "Pada string kosong, mesinmu menerima/menolak. Apakah itu yang diminta soal?") and "Coba di Simulasi", which opens Simulasi with that string at its first step.
- **A result that is old.** When the machine changes after a check, the result stays and a note says "Mesinmu sudah berubah. Periksa lagi untuk hasil terbaru."
- **The hints** are in the left column ("Petunjuk"; on a phone, behind "Lihat soal"): none are shown at first, and "Tampilkan petunjuk berikutnya (1 dari 2)" shows the next one. A shown hint stays while the page is open; another question starts closed. They are never opened by themselves.
- **A regular expression question** has no Umpan balik until its answer box exists.

## Progress on the questions (Q5, plan approved on 2026-10-29)

- **On the list `/soal`.** Under the intro: "Progres: 1 dari 4 soal selesai" (a live region), and, when there is any progress, a quiet button "Atur ulang progres". It is shown only when the browser keeps data (with no storage there is nothing to show). Each card has a chip after the type and the level: "**Selesai**" (success tint) or "**Sudah dicoba**" (neutral); a question that was never checked has none.
- **On the page of a question.** The meta line ends with the status: "Soal 2 dari 3 · Pola: berakhiran x · Selesai".
- **What counts.** _Sudah dicoba_: at least one check that said something about the machine (a verdict, or a problem of the structure). _Selesai_: at least one check that said "Tepat.", for good: changing the machine later does not take it back (we keep the time of the first solve and the number of checks). A check that was stopped or could not run counts as nothing, and opening a question without checking it is not an attempt.
- **Reset.** "Atur ulang progres" asks once more in a box under the line: "Hapus progres semua soal? Mesinmu tidak ikut dihapus." with "Ya, hapus" (it removes the progress from every question record and announces "Progres dihapus.") and "Batal". The machines that the student built stay.
- **Not in Q5:** a filter by status, progress by week, a reset for one question, any account or sync.

## Guide pipeline and pages (G1, G2, plan approved on 2026-10-29)

The list `/panduan` and the guide page `/panduan/[id]` match `guides-laptop.png`, `guides-phone.png`, `guide-laptop.png`, and `guide-phone.png`.

- **Guide files.** Markdown files in `content/guides/<id>.md` with YAML frontmatter validated at build time against `content/guides/schema.json` (`schemaVersion: 1`, `id`, `order`, `topic`, `readingMinutes`, `cardTitle`, `title`, `summary`, optional `references`). The Markdown body is parsed at build time into typed blocks (intro paragraphs, `## Heading {#id}` sections, paragraphs, ordered and unordered lists, fenced ```` ```machine ```` embed blocks, and inline `code` spans) and rendered with Svelte templates, never `{@html}`.
- **Machine embeds (G2).** A fenced ```` ```machine ```` YAML block inside a section either names an example in `content/examples/<id>.json` (`example: <id>`) or defines a standalone machine (`title`, `kind`, `alphabet`, `states`, `start`, `accepting`, `transitions`) with an optional `caption`. `<MachineEmbed>` renders a `<figure>` with a dotted-grid card, the read-only SVG diagram (`DiagramView`), a 44 px **"Buka di editor"** link (`/sandbox?example=<id>` or `/sandbox#m1u=...`), and `<figcaption>`. The Sandbox opens `?example=<id>` on mount and cleans the query parameter from the address.
- **The list `/panduan`.** Heading "Panduan", one-line intro, topic filter chips (`Semua`, `DFSM`, `NDFSM`, `Regex`, `Operasi`; native radio inputs, 44 px high, synced with `?topik=<topic>` in the address), and a 2-column grid of guide cards (1 column on phones). Each card links to `/panduan/<id>` and shows the topic pill, `cardTitle`, `summary`, and `{questions} soal terkait · {minutes} menit`. When no guides match a topic, an empty state offers "Tampilkan semua".
- **A guide page `/panduan/[id]`.**
  - **Laptop.** Sticky left table-of-contents sidebar (`Di halaman ini`) listing the guide's sections plus `Soal terkait` when matching questions exist, and a 68-ch reading column with breadcrumbs (`Panduan › <Topik>`), meta row (`<Topik> · <n> menit baca · <Referensi>`), `<h1>`, lead paragraph, numbered/headed sections, `Soal terkait` card linking to `/soal/<id>` for every question whose `pattern === guide.id`, and a previous/next guide pager at the bottom.
  - **Phone.** Under 60 rem, the sidebar hides and a top bar shows `← Semua panduan` and an `Isi ▾` button (`aria-expanded`, 44 px) that toggles a dropdown menu of section links (closing on link click or `Escape`).
- **Question → Guide link.** On `/soal/[id]`, when a guide with `id === question.pattern` exists, `Pola: <pattern>` in the meta line links to `/panduan/<pattern>`.
- **SEO & sharing.** Every route sets Open Graph `<meta property="og:*">` tags (`og:title`, `og:description`, `og:type`, `og:locale`), and `/sitemap.xml` is prerendered at build time with `/`, `/sandbox`, `/soal`, `/panduan`, `/tentang`, every `/soal/<id>`, and every `/panduan/<id>`.

## About page and footer (D1, 2026-10-29)

The `/tentang` page and the site footer (`SiteFooter.svelte`) provide project identity, textbook and notation alignment, privacy commitments, open-source licenses, and reporting links.

- **The `/tentang` page.** Prerendered static page with `<h1>` "Tentang WebTomata", lead summary, and sections for:
  - What WebTomata is (Indonesian-first interactive FSM learning tool for Theory of Computation).
  - Textbooks & notation (Elaine Rich default, Michael Sipser cross-references).
  - Privacy commitment ("Tanpa akun, tanpa pelacakan"; 100% in-browser client execution with WebAssembly; no cookies, tracking scripts, or telemetry).
  - Licenses (AGPL-3.0 for software source code, CC BY-SA 4.0 for educational content in `content/`).
  - Academic integrity (original pattern-based problems, never copied from active course homework/exams).
  - Bug reporting (links to GitHub repository, issues, and contributing guide).
- **The site footer (`SiteFooter.svelte`).** Rendered on all document/prose routes (`/`, `/soal`, `/panduan`, `/panduan/[id]`, `/tentang`). Displays WebTomata branding, tagline, links to `/tentang` and GitHub, and license/privacy notices. Full-screen canvas apps (`/sandbox` and `/soal/[id]`) omit the footer to preserve full-height `100dvh` workspace, with `/tentang` linked in the `<SiteHeader>` navigation and phone drawer menu.
