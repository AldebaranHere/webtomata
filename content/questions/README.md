# Menambahkan soal / Adding a question

Setiap soal adalah satu file YAML di folder ini: `content/questions/<id>.yaml`. Siapa pun bisa menambahkan atau memperbaiki soal lewat pull request.

Every question is one YAML file in this folder: `content/questions/<id>.yaml`. Anyone can add or fix a question by pull request.

---

## Bahasa Indonesia

### 1. Aturan utama

- **Ajarkan pola, bukan jawaban tugas.** Soal harus asli: jangan menyalin atau memparafrasekan soal dari tugas, kuis, atau ujian mata kuliah mana pun (termasuk Fasilkom UI).
- **Kunci jawaban bersifat publik.** WebTomata tidak punya server backend. Saat situs dibangun, `solution` dikirim ke browser sebagai `/soal/<id>/jawaban.json` agar jawaban mahasiswa bisa diperiksa langsung di perangkatnya. Ini wajar untuk alat belajar mandiri — karena itu, jangan pernah memakai soal yang sedang dipakai untuk penilaian.
- **Gunakan istilah dari glosarium.** Lihat [`docs/glossary.md`](../../docs/glossary.md) (`state`, `start state`, `accepting state`, `dead state`, `transisi`, `string`, `alfabet`, `simbol`).

### 2. Langkah singkat

1. Salin [`_template.yaml`](_template.yaml) menjadi `content/questions/<id>.yaml`. Nama file (tanpa `.yaml`) harus sama persis dengan field `id` (huruf kecil, angka, dan tanda hubung tunggal, contoh `berakhiran-10`).
2. Biarkan baris pertama `# yaml-language-server: $schema=./schema.json` tetap ada agar editor menampilkan saran dan peringatan dari [`schema.json`](schema.json).
3. Isi semua field yang diminta, lalu jalankan pemeriksa:
   ```sh
   pnpm check:questions
   pnpm check:questions --report
   ```
   Jika kamu belum memasang Rust atau `wasm-pack`, jalankan pemeriksaan bentuk file saja (CI tetap akan menjalankan pemeriksaan penuh dengan engine):
   ```sh
   pnpm check:questions --schema-only
   ```
4. Buka satu pull request untuk soal tersebut dan centang daftar periksa di bawah.

### 3. Field di dalam file soal

Semua nilai di file YAML dibaca sebagai teks terlebih dahulu, sehingga `0110` tetap menjadi string `"0110"` (bukan angka) dan `yes` tetap `"yes"`. Jangan menggunakan anchor atau alias YAML (`&nama`, `*nama`). Ukuran file paling banyak 64 KB.

| Field           | Wajib | Penjelasan                                                                                                                                                                                                                                                                                                                            |
| --------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | Ya    | Selalu `1`.                                                                                                                                                                                                                                                                                                                           |
| `id`            | Ya    | Nama file tanpa `.yaml` (`^[a-z0-9]+(-[a-z0-9]+)*$`, maks. 64 karakter).                                                                                                                                                                                                                                                              |
| `title`         | Ya    | Judul singkat dalam `id` dan `en` (masing-masing wajib, maks. 120 karakter).                                                                                                                                                                                                                                                          |
| `statement`     | Ya    | Pernyataan soal dalam `id` (wajib) dan `en` (opsional, disarankan). Teks biasa, maks. 4.000 karakter. Gunakan `` `backtick` `` untuk simbol, string, atau rumus singkat (`Σ = {0, 1}`). Baris kosong memulai paragraf baru. Tanpa Markdown lain dan tanpa HTML.                                                                       |
| `type`          | Ya    | `build-dfsm`, `build-ndfsm`, atau `write-regex`. Untuk latihan konversi NDFSM → DFSM atau minimalisasi, gunakan `build-dfsm` dengan `constraints.minimal: true`. (Catatan: di v1, kotak jawaban untuk `write-regex` belum diaktifkan.)                                                                                                |
| `alphabet`      | Ya    | Daftar simbol, contoh `[0, 1]` atau `[a, b]`. Simbol tidak boleh mengandung spasi, koma, atau `ε`, dan tidak boleh bernama `eps`. Jika ada simbol lebih dari satu karakter (misalnya `num`), pisahkan simbol di dalam string contoh dengan spasi (`"num plus num"`).                                                                  |
| `constraints`   | Tidak | Batasan tambahan untuk jawaban mahasiswa: `maxStates` (1–100, untuk mesin apa pun; DFSM lengkap menghitung `dead state`-nya), `complete` (bawaan `true`, khusus `build-dfsm`), `minimal` (khusus `build-dfsm`, mewajibkan `complete: true`), `allowEpsilon` (bawaan `true`, khusus `build-ndfsm`). Tidak berlaku untuk `write-regex`. |
| `difficulty`    | Ya    | `1` (mudah), `2` (sedang), atau `3` (sulit).                                                                                                                                                                                                                                                                                          |
| `week`          | Ya    | Minggu silabus (`1` sampai `14`).                                                                                                                                                                                                                                                                                                     |
| `pattern`       | Ya    | Nama pola desain yang dilatih (format yang sama dengan `id`, contoh `berakhiran-x`, `hitung-mod-k`, `menebak`). Cocok dengan nama panduan di `content/guides/`.                                                                                                                                                                       |
| `references`    | Tidak | Nomor subbab buku teks, contoh `rich: ["5.2"]` dan `sipser: ["1.1"]`.                                                                                                                                                                                                                                                                 |
| `hints`         | Tidak | Paling banyak 5 petunjuk (`id`, opsional `en`, maks. 600 karakter). Ditampilkan satu per satu hanya saat mahasiswa meminta. Urutkan dari ide umum ke petunjuk yang lebih spesifik; petunjuk terakhir boleh menyebut jumlah state, tetapi jangan pernah memberikan transisi jawabannya.                                                |
| `examples`      | Ya    | `accept` dan `reject`, masing-masing berisi 2 sampai 20 string yang diterima dan ditolak oleh jawaban. Tulis string kosong sebagai `""` atau `ε`. `pnpm check:questions` menjalankan setiap string ini pada `solution`.                                                                                                               |
| `solution`      | Ya    | Kunci jawaban (lihat bagian 4). Banyak mesin berbeda bisa menjawab soal yang sama; WebTomata memeriksa jawaban mahasiswa berdasarkan ekuivalensi bahasa (`equivalent`), bukan bentuk diagramnya.                                                                                                                                      |

### 4. Menulis `solution`

Untuk soal mesin (`build-dfsm` dan `build-ndfsm`), tulis mesin dalam bentuk ringkas:

```yaml
solution:
  start: q0
  accepting: [q2]
  transitions:
    - q0 0 q0
    - q0 1 q1
    - q1 1 q1
    - q1 0 q2
    - q2 0,1 q0
```

- Setiap baris `transitions` berbentuk `"<dari> <simbol> <ke>"`.
- Beberapa simbol pada satu panah boleh digabung dengan koma tanpa spasi: `q2 0,1 q0`.
- Transisi kosong ditulis `ε` atau `eps`: `q0 eps q1`.
- Daftar `states` bersifat opsional: state dikenali otomatis dari transisi. Tambahkan `states: [q0, q1]` hanya jika kamu ingin mengatur urutannya atau ada state tanpa transisi.
- Solusi tidak boleh memiliki state yang tidak terjangkau (`unreachable`) dan harus memenuhi semua `constraints` soalnya sendiri.

Untuk `write-regex`, `solution` berupa satu string ekspresi reguler dengan notasi Rich (`∪` untuk union, `ε`, `∅`), contoh `solution: "(0∪1)*10"`.

### 5. Daftar periksa sebelum membuka pull request

- [ ] Soal ini asli (bukan dari tugas, kuis, atau ujian) dan melatih pola di `pattern`.
- [ ] `pnpm check:questions --report` lulus, dan daftar string yang diterima pada laporan sesuai dengan kalimat di `statement`.
- [ ] Semua syarat di dalam `statement` (misalnya "harus lengkap", "paling banyak 3 state", "tanpa transisi ε") sama dengan yang tertulis di `type` dan `constraints`.
- [ ] `examples.accept` dan `examples.reject` mencakup kasus batas (string kosong `""`, string 1 simbol, dan string yang hampir diterima).
- [ ] Istilah bahasa Indonesia mengikuti [`docs/glossary.md`](../../docs/glossary.md) dan nada petunjuk mengikuti [`docs/ux/feedback-copy.md`](../../docs/ux/feedback-copy.md).

---

## English

### 1. Core rules

- **Teach patterns, not homework answers.** Questions must be original: never copy or closely paraphrase a question from homework, a quiz or an exam of any course.
- **The reference solution is public.** WebTomata has no backend server. At build time, `solution` is shipped to the browser as `/soal/<id>/jawaban.json` so that student answers can be graded on the device. This is normal for a self-study tool — never add a question that is used for grading.
- **Follow the glossary.** See [`docs/glossary.md`](../../docs/glossary.md) for Indonesian terms.

### 2. Quick steps

1. Copy [`_template.yaml`](_template.yaml) to `content/questions/<id>.yaml`. The file name (without `.yaml`) must match `id` (`^[a-z0-9]+(-[a-z0-9]+)*$`).
2. Keep the first line `# yaml-language-server: $schema=./schema.json` so your editor checks the file against [`schema.json`](schema.json).
3. Fill in the fields and run the checker:
   ```sh
   pnpm check:questions
   pnpm check:questions --report
   ```
   If you do not have Rust or `wasm-pack` installed locally, run the schema check alone (CI will still run the full engine check on your pull request):
   ```sh
   pnpm check:questions --schema-only
   ```
4. Open a pull request and check the review list below.

### 3. Fields

Every value in the YAML file is read as text first, so an unquoted `0110` stays `"0110"` and `yes` stays `"yes"`. YAML anchors and aliases (`&name`, `*name`) are refused. A file may be at most 64 KB.

- **`schemaVersion`**: always `1`.
- **`id`**: matches the file name without `.yaml`.
- **`title`**: `{ id, en }` (both required, at most 120 characters each).
- **`statement`**: `{ id, en? }` (at most 4,000 characters). Plain text with `` `backtick` `` code spans and blank lines between paragraphs. No Markdown and no HTML.
- **`type`**: `build-dfsm`, `build-ndfsm` or `write-regex`. Determinize and minimize practice use `build-dfsm` with `constraints.minimal: true`. (Note: in v1 the `write-regex` answer box is not yet active.)
- **`alphabet`**: list of symbols (`[0, 1]`). No spaces, commas or `ε`, and not the reserved word `eps`. When any symbol has more than one character, separate symbols with spaces in `examples` (`"num plus num"`).
- **`constraints`** (optional): `maxStates` (1–100; a complete DFSM counts its dead state), `complete` (default `true`, `build-dfsm` only), `minimal` (`build-dfsm` only; requires `complete: true`), `allowEpsilon` (default `true`, `build-ndfsm` only).
- **`difficulty`**: `1` (easy), `2` (medium) or `3` (hard).
- **`week`**: syllabus week, `1` to `14`.
- **`pattern`**: the design pattern slug (matches a guide in `content/guides/`).
- **`references`** (optional): textbook sections, e.g. `rich: ["5.2"]`, `sipser: ["1.1"]`.
- **`hints`** (optional, at most 5): `{ id, en? }` shown one at a time on request. Move from general idea to specific; never name the transitions of the answer.
- **`examples`**: `accept` and `reject` (2 to 20 strings each; `""` or `ε` for the empty string). `pnpm check:questions` simulates every example on `solution`.
- **`solution`**: for a machine, `{ start, accepting, transitions, states? }` with transitions written `"from symbol to"` (`q0 0,1 q1`, `ε` or `eps` for ε). Every state must be reachable, and `solution` must pass `validate` and meet `constraints`. Student answers are graded by language equivalence (`equivalent`), so any equivalent machine that meets the constraints is accepted.

### 4. Pull-request checklist for a question

- [ ] The question is original and practises the pattern named in `pattern`.
- [ ] `pnpm check:questions --report` passes, and the printed accepted strings match the wording of `statement`.
- [ ] Every requirement mentioned in `statement` matches `type` and `constraints`.
- [ ] `examples.accept` and `examples.reject` cover edge cases (the empty string, single-symbol strings, near-misses).
- [ ] Terms follow [`docs/glossary.md`](../../docs/glossary.md) and hints follow [`docs/ux/feedback-copy.md`](../../docs/ux/feedback-copy.md).
