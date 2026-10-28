# Glosarium / Glossary

Indonesian terms used in the UI and guides. Source: the ToC slides, quizzes and exams of Fasilkom UI (based on Rich). The owner confirmed the terms below on 2026-10-24. The lecturer will see this page in task C2.

**The rule.** The slides mix English and Indonesian, even for one idea. So the UI uses the English word where the slides use English for a technical noun (state, start state, accepting state, dead state, string, configuration). It uses Indonesian for sentences, verbs and words that have a settled Indonesian term (alfabet, simbol, bahasa, transisi, komplemen, irisan, ekuivalen). An entry marked `TODO(review)` is not shown in M1 and still needs a decision.

| English (Rich)               | Indonesian (UI)          | Notes                                                                                                                                                            |
| ---------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| finite state machine (FSM)   | mesin berhingga (FSM)    | Slides say "mesin" and "FSM".                                                                                                                                    |
| deterministic FSM (DFSM)     | DFSM                     | Keep the abbreviation.                                                                                                                                           |
| nondeterministic FSM (NDFSM) | NDFSM                    | Slides write "nondeterminisme".                                                                                                                                  |
| state                        | state                    | Never "status" (the first wireframes used it; the slides use "state" more, and the exams do not use "status").                                                   |
| active state                 | state aktif              |                                                                                                                                                                  |
| start state                  | start state              | The arrow in the diagram is labelled "mulai".                                                                                                                    |
| accepting state              | accepting state          |                                                                                                                                                                  |
| dead state                   | dead state               | The same as a trap state. JFLAP says "trap state"; the course says "dead state". Use "dead state" only.                                                          |
| unreachable state            | state unreachable        |                                                                                                                                                                  |
| self-loop                    | self-loop                |                                                                                                                                                                  |
| alphabet                     | alfabet                  |                                                                                                                                                                  |
| symbol                       | simbol                   | Can be multi-character in this tool.                                                                                                                             |
| string                       | string                   | Not "untai".                                                                                                                                                     |
| empty string (ε)             | string kosong (ε)        |                                                                                                                                                                  |
| language                     | bahasa                   |                                                                                                                                                                  |
| transition                   | transisi                 |                                                                                                                                                                  |
| ε-transition                 | transisi ε               |                                                                                                                                                                  |
| transition function (δ)      | fungsi transisi          | DFSM.                                                                                                                                                            |
| transition relation (Δ)      | relasi transisi          | NDFSM.                                                                                                                                                           |
| configuration                | konfigurasi              | Element of K × Σ*.                                                                                                                                               |
| initial configuration        | konfigurasi awal         |                                                                                                                                                                  |
| yields-in-one-step           | yields-in-one-step       | Slides keep the English name.                                                                                                                                    |
| accept / reject              | menerima / menolak       | "diterima" for the passive form.                                                                                                                                 |
| computation                  | komputasi                | The sequence of configurations of a run. The UI says "komputasi" for a simulation run, not "jejak".                                                              |
| engine                       | engine                   | The part that does the calculations (the WASM module). Kept in English because "mesin" already means the machine that the student draws. TODO(review)            |
| step (of an algorithm)       | langkah                  | The UI says "langkah" for a step of a conversion.                                                                                                                |
| regular expression           | ekspresi reguler (regex) | "regex" is fine in short labels.                                                                                                                                 |
| regular language             | bahasa reguler           |                                                                                                                                                                  |
| union                        | union                    | Slides write "union" (not "gabungan").                                                                                                                           |
| intersection                 | irisan                   |                                                                                                                                                                  |
| complement                   | komplemen                |                                                                                                                                                                  |
| concatenation                | konkatenasi              |                                                                                                                                                                  |
| Kleene star                  | Kleene star              |                                                                                                                                                                  |
| ε-closure                    | ε-closure                |                                                                                                                                                                  |
| complete DFSM                | DFSM lengkap             | Every state has a transition on every symbol.                                                                                                                    |
| minimal DFSM                 | DFSM minimal             |                                                                                                                                                                  |
| minimization                 | minimalisasi             | Buttons use the verb: "Minimalkan DFSM". The slides spell the noun three ways (minimalisasi, minimisasi, "minimalization"). TODO(review): ask the lecturer (C2). |
| NDFSM → DFSM                 | Konversi NDFSM ke DFSM   | Do not use "determinisasi".                                                                                                                                      |
| rip state                    | rip state                | State elimination in FSM → regex.                                                                                                                                |
| equivalence class            | kelas ekuivalen          | "ekuivalen", not "ekivalen".                                                                                                                                     |
| equivalent machines          | mesin ekuivalen          |                                                                                                                                                                  |
| distinguishable strings      | distinguishable          | TODO(review): not shown before M2. Keep the English word, as in the slides.                                                                                      |
| witness string               | string pembeda           | Our own term: the shortest string that one machine accepts and the other rejects.                                                                                |
| start arrow label            | mulai                    |                                                                                                                                                                  |

## Words of the interface

No course source. These come from the wireframes and stay unless the owner or the lecturer asks for a change: Sandbox, Soal, Panduan, Pilih, Hapus, Urungkan, Ulangi, Tambah state, Tambah transisi, Tata letak otomatis, Simulasi, Tabel, Definisi, Konversi, Coba contoh, Tersimpan di perangkat ini.

Added in S4d-1, with no source yet (`TODO(review)`: the owner or the lecturer may change them): Pas (fit the machine in the view; from the wireframes), Perbesar and Perkecil (zoom in and out), Perbesaran (zoom), Atur ke 100% (reset the zoom).

Added in S6-2, with no source yet (`TODO(review)`: the owner or the lecturer may change them): Jalankan (run), Jeda (pause), Langkah berikutnya / Langkah sebelumnya (next / previous step), Kembali ke awal (back to the start), String masukan (input string), Diterima / Ditolak (accepted / rejected).

Added in S6-3, with no source yet (`TODO(review)`): Uji banyak string (test many strings), Tambah string (add a string), Tidak bisa dijalankan (cannot run), Dihentikan (stopped).

Added in X1, with no source yet (`TODO(review)`): Coba contoh (try an example), Mulai dari kanvas kosong (start from an empty canvas), Tur 1 menit (one-minute tour), Berikutnya / Kembali / Lewati / Selesai (next / back / skip / done), Buka Panduan (open the guides), Tanpa judul (untitled).

Added in S5-1, with no source yet (`TODO(review)`): Panel, Tab panel, Jenis mesin (machine type), Definisi formal (formal definition), himpunan state (the set of states), himpunan accepting state, fungsi transisi (the transition function), relasi transisi (the transition relation), Salin / Tersalin (copy / copied).

Added in S5-2, with no source yet (`TODO(review)`): Ubah lebar panel (resize the panel), Tabel transisi (transition table), Terima (the column of accepting states in the table; "accept" in English), belum ada (none yet), lebih dari satu tujuan (more than one target), + State, Tambah simbol (add a symbol), Simbol baru (new symbol), Tambah… (add…).

Added in S9, with no source yet (`TODO(review)`): Tata letak otomatis (auto layout; the name is from the wireframes).

Added in S7-1, with no source yet (`TODO(review)`): Konversi (conversion), Mulai (start), Tambah dead state (add a dead state; "dead state" follows the rule above, not "jebakan"), Langkah n dari N (step n of N), Ke awal / Mundur / Putar / Maju / Ke hasil (to the start / back / play / forward / to the result), Hasil / Sumber (result / source), Buka sebagai mesin baru (open as a new machine), Tutup (close), Kelas saat ini (the classes now).

Added in S7-2a, with no source yet (`TODO(review)`): Komplemen (complement; the glossary has "komplemen"), Gabungan (union), Gabungkan dengan (join with), Pilih mesin lain (choose another machine), alfabetnya beda (different alphabet).
Added in S7-2b, with no source yet (`TODO(review)`): Irisan (intersection; the glossary has "irisan"), Tahap n dari 7 (stage n of 7), dilewati (skipped), Irisan dengan (intersect with).

Added in S7-2c, with no source yet (`TODO(review)`): XOR (the symmetric difference; the row says "XOR" and the hint "Selisih simetris"; Rich says "symmetric difference"), mesin produk (the product machine; Rich: cross-product machine), pasangan state (a pair of states), kedua mesin ekuivalen (the two machines are equivalent).

Added in S7-3 (`TODO(review)`): "Mesin → regex" (FSM → regex; Rich: `fsmtoregex`), label (the expression on the path between two states), "Naikkan batas" (raise the limit), "Salin" (copy), "Notasi Rich" (Rich notation).

Also in S7-3b (`TODO(review)`): "Regex → NDFSM" (Rich: `regextofsm`), "Alfabet: ..." (the alphabet that the page reads from the expression), "Sisipkan" (insert, for the buttons of the operators), the sentences of the steps (they use the glossary terms union, konkatenasi and Kleene star), and the messages about a mistake in an expression ("tidak punya pasangan", "belum lengkap").

Also in S7-3c (`TODO(review)`): "Sederhanakan" (simplify; Rich section 6.4), "identitas" (identity), "Pakai di Sederhanakan" (use in Simplify), "Sekarang" (the expression now), and the sentences of the 17 rules (`simplify.*`). The sentences write each identity in Rich's notation and then say it in words.

Also in S7-4a (`TODO(review)`): the sentences of `concat_star_plus` and `union_plus_absorb` (they say "bintangnya digabung menjadi plus" and "plus menjadi bintang").

Also in S7-4b (`TODO(review)`): "Sederhanakan lewat mesin" (simplify through the machine), "mesin minimal" (the minimal DFSM), "bagian" (a part of an expression: a symbol or an operator, the unit of its size), and the four sentences `via_machine.*`.

Also in S7-5 (`TODO(review)`): "Salin LaTeX" (copy LaTeX) and "Pratinjau" (preview).

Added in S10b-1 (`TODO(review)`): "Bagikan" (share), "tautan" (link), "Salin tautan" (copy link), "dimampatkan" (compressed) and the sentences of `share.*`.

Also in S10b-2 (`TODO(review)`): "Unduh" (download), "simpan sebagai file" (save as a file), "alfabet" in the note about the `.jff`, and the sentences of `share.*` about files.

Also in S10b-3 (`TODO(review)`): "Buka file" (open a file), "rangkaian state" (a chain of states, in the note about a label of several symbols), "bertipe" (of the type) and the sentences of `import.*` and `jff.*`.
