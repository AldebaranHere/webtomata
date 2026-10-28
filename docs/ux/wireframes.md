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
- **Phone.** A bar above the canvas with the crumbs, the line "Soal 2 dari 3", the title and the first paragraph of the statement; "Lihat soal lengkap" shows the rest and the chips ("Sembunyikan" folds them). The bar is at most 45% of the height. Then the editor as in the Sandbox.
- **The statement** is plain text: a blank line starts a paragraph and `backticks` make code. It is never shown as HTML.
- **The machine** starts with the alphabet of the question, and as an NDFSM for an NDFSM question. The title bar shows the title of the question in the language of the page. What the student builds is saved on this device for this question (one record, `soal:<id>`), kept apart from the machines of the Sandbox: the Sandbox never opens it and "Mesin saya" does not list it.
- **Saved work that cannot be read:** "Pekerjaanmu sebelumnya di soal ini tidak bisa dibaca, jadi soal dimulai dari awal. Pekerjaan lama tetap tersimpan sampai kamu mengubah mesin." (with "Tutup").
- **A `write-regex` question** shows the statement and "Kolom jawaban untuk soal ini menyusul." until Q4.
- **Not here yet:** "Periksa", the feedback, the hints (Q4), the status of the question (Q5) and "Panduan terkait" (when the guide exists).

