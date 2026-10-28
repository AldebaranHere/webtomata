# WebTomata

**[webtomata.aldebaran26adhitya.workers.dev](https://webtomata.aldebaran26adhitya.workers.dev/)**

![WebTomata: a DFSM that accepts the strings ending in 01, run on the string 0101, with the active state on the diagram, the computation, and a list of test strings](docs/img/screenshot.png)

## ENGLISH

WebTomata is a free, open-source web tool for learning finite state machines, in **Indonesian first** (English too). It is made for students of Theory of Computation at any Indonesian computer science program. It runs in the browser, on a phone as well as a laptop, and nothing you build leaves your device.

**Status.** WebTomata is in development. The Sandbox is finished; practice questions and guides are being built next. The launch target is about 1 February 2027.

**What you can do today (in the Sandbox)**

- Build a DFSM or an NDFSM (with ε-transitions) by tapping or clicking: states, transitions, start and accepting states. Undo and redo everything. Edit the same machine as a diagram, a transition table, or a formal definition.
- See what is wrong with a machine in calm words (a missing transition, an unreachable state).
- Run a string step by step. The active states light up on the diagram (all of them for an NDFSM), the edge just taken is marked, and the computation is listed. Test many strings at once.
- Convert and combine machines, each as a step-by-step animation that follows the textbook: NDFSM → DFSM, minimization, complement, union, intersection, XOR, and adding a dead state. Every result opens as a new machine, so yours is never changed.
- Work with regular expressions: regular expression → NDFSM, FSM → regular expression (state elimination), and "Sederhanakan" (simplify) with named identities, also through the minimal machine. The notation is drawn as a book writes it.
- Compare your machine with a regular expression: you get a verdict, the strings that your machine gets wrong on both sides, and the computation of the shortest wrong string.
- Lay a machine out automatically, share it as a link, save it as a `.jff` file (JFLAP), a JSON file, an SVG or a PNG, and open `.jff` and JSON files. `.jff` files for grammars, PDAs and Turing machines are not supported yet and say so.
- Open an example in one click, or take a one-minute tour. Close the tab and come back: your machines are saved on your device, in a list ("Mesin saya").

**What it is not yet.** It is not a replacement for JFLAP for the whole course. On the way, in this order: practice questions with feedback (Soal), guides on design patterns (Panduan), and offline use. After the finite-state part, the plan is to cover the rest of the course in the order of the slides: grammars, pushdown automata, Turing machines, and the tools for proofs. Each of them starts only when the owner names it.

**Principles**

- No account, no cookies, no tracking, no server of ours. Everything runs in your browser and is saved on your device.
- The engine is written in Rust and runs in the browser as WebAssembly. A wrong answer would destroy trust, so it is tested hard.
- It teaches patterns, not homework answers. Examples and questions are original.
- Free forever, on free hosting.

**Help**

- Found a mistake, or want an example added? Read [CONTRIBUTING.md](CONTRIBUTING.md). Terms follow the [glossary](docs/glossary.md); how it is built is in [ARCHITECTURE](docs/ARCHITECTURE.md) and in the [decisions](docs/decisions/).
- Found a security problem? Please do not open a public issue: see [SECURITY.md](SECURITY.md).

## BAHASA INDONESIA

WebTomata adalah alat web gratis dan open source untuk belajar mesin berhingga (finite state machine), **berbahasa Indonesia lebih dulu** (bahasa Inggris juga ada). Alat ini dibuat untuk mahasiswa mata kuliah Teori Komputasi (Teori Bahasa dan Automata) di program studi ilmu komputer mana pun di Indonesia. Alat ini berjalan di peramban, di ponsel maupun laptop, dan apa pun yang kamu buat tidak keluar dari perangkatmu.

**Status.** WebTomata masih dalam pengembangan. Sandbox sudah selesai; soal latihan dan panduan sedang dibuat berikutnya. Target peluncuran sekitar 1 Februari 2027.

**Yang bisa kamu lakukan sekarang (di Sandbox)**

- Membuat DFSM atau NDFSM (dengan transisi ε) dengan mengetuk atau mengeklik: state, transisi, start state, dan accepting state. Semua bisa diurungkan dan diulangi. Mesin yang sama bisa diubah sebagai diagram, tabel transisi, atau definisi formal.
- Melihat apa yang kurang dari sebuah mesin, dengan kata-kata yang tenang (transisi yang belum ada, state yang tidak bisa dicapai).
- Menjalankan satu string langkah demi langkah. State yang aktif menyala di diagram (semuanya untuk NDFSM), transisi yang baru dipakai ditandai, dan komputasinya dicatat. Banyak string bisa diuji sekaligus.
- Mengubah dan menggabungkan mesin, masing-masing sebagai animasi langkah demi langkah yang mengikuti buku teks: NDFSM → DFSM, minimalisasi, komplemen, gabungan, irisan, XOR, dan menambah dead state. Setiap hasil dibuka sebagai mesin baru, jadi mesinmu tidak pernah berubah.
- Bekerja dengan ekspresi reguler: ekspresi reguler → NDFSM, FSM → ekspresi reguler (eliminasi state), dan "Sederhanakan" dengan identitas yang disebut satu per satu, juga lewat mesin minimal. Notasinya digambar seperti di buku.
- Membandingkan mesinmu dengan ekspresi reguler: kamu tahu apakah keduanya sama, melihat string yang salah di kedua sisi, dan komputasi string terpendek yang salah.
- Menata letak mesin secara otomatis, membagikannya sebagai tautan, menyimpannya sebagai berkas `.jff` (JFLAP), berkas JSON, SVG, atau PNG, dan membuka berkas `.jff` dan JSON. Berkas `.jff` untuk tata bahasa, PDA, dan mesin Turing belum didukung dan akan diberi tahu.
- Membuka contoh dengan satu klik, atau mengikuti tur satu menit. Menutup tab dan kembali lagi: mesinmu tersimpan di perangkatmu, dalam daftar "Mesin saya".

**Yang belum ada.** Alat ini belum menggantikan JFLAP untuk seluruh mata kuliah. Yang menyusul, berurutan: soal latihan dengan umpan balik (Soal), panduan pola perancangan (Panduan), dan pemakaian tanpa internet. Setelah bagian mesin berhingga, rencananya seluruh mata kuliah ikut dicakup sesuai urutan slide: tata bahasa, pushdown automata, mesin Turing, dan alat untuk pembuktian. Masing-masing baru dimulai setelah pemilik menyebutkannya.

**Prinsip**

- Tanpa akun, tanpa cookie, tanpa pelacakan, tanpa server milik kami. Semuanya berjalan di peramban dan tersimpan di perangkatmu.
- Engine ditulis dengan Rust dan berjalan di peramban sebagai WebAssembly. Jawaban yang salah merusak kepercayaan, jadi engine diuji dengan keras.
- Mengajarkan pola, bukan jawaban tugas. Contoh dan soal dibuat sendiri.
- Gratis selamanya, di hosting gratis.

**Bantuan**

- Menemukan kesalahan, atau ingin menambah contoh? Baca [CONTRIBUTING.md](CONTRIBUTING.md). Istilah mengikuti [glosarium](docs/glossary.md); cara pembuatannya ada di [ARCHITECTURE](docs/ARCHITECTURE.md) dan di [keputusan-keputusan](docs/decisions/).
- Menemukan masalah keamanan? Jangan membuka issue publik: lihat [SECURITY.md](SECURITY.md).

## Lisensi / License

[AGPL-3.0](LICENSE).
