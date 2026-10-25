# Berkontribusi / Contributing

## Bahasa Indonesia

Terima kasih sudah ingin membantu WebTomata. Proyek ini gratis, open source (AGPL-3.0), tanpa akun dan tanpa pelacakan.

- Kami mengikuti [tata tertib](CODE_OF_CONDUCT.md): sopan dan sabar, terutama kepada pemula.
- Satu pull request untuk satu perubahan kecil. Jelaskan apa dan mengapa.
- Gunakan [Conventional Commits](https://www.conventionalcommits.org/), contoh `feat(engine): ...` atau `fix(editor): ...`.
- Perubahan pada engine harus disertai tes. Perbaikan bug dimulai dari tes yang gagal.
- Teks untuk pengguna harus lewat i18n (`id` dan `en`). Istilah mengikuti [docs/glossary.md](docs/glossary.md).
- Jangan menambahkan dependensi baru tanpa alasan yang jelas dan tanpa diskusi di issue lebih dulu.
- Soal dan panduan harus asli: jangan menyalin dari tugas, kuis, atau ujian mata kuliah mana pun.
- Contoh mesin adalah satu file JSON di `content/examples/` (lihat contoh yang ada; sebuah tes memeriksa setiap string di dalamnya dengan engine). Contoh harus berupa pola, bukan jawaban tugas.
- Jangan menyalin kode dari JFLAP atau proyek lain yang lisensinya tidak sesuai AGPL-3.0.
- Jangan pernah mengunggah rahasia, kunci API, atau file buku teks dan materi kuliah.

## English

Thanks for helping. WebTomata is free, open source (AGPL-3.0), with no accounts and no tracking.

- We follow the [code of conduct](CODE_OF_CONDUCT.md): be polite and patient, especially with beginners.
- One small change per pull request, with a clear what and why.
- Use Conventional Commits (`feat(engine): ...`, `fix(editor): ...`).
- Engine changes need tests; a bug fix starts with a failing test.
- User-facing text goes through i18n (`id` and `en`); terms follow `docs/glossary.md`.
- Open an issue before adding a dependency.
- Questions and guides must be original: never copied from homework, quizzes or exams.
- An example machine is one JSON file in `content/examples/` (copy an existing one; a test runs every string in it through the engine). An example is a pattern, never an answer to homework.
- Never copy code from JFLAP or any project whose license is incompatible with AGPL-3.0.
- Never commit secrets, API keys, or textbook and course files.

## Menjalankan proyek / Running the project

Requirements: Rust (stable, via `rustup`), Node 24.21.x (see `.nvmrc`), pnpm 12.14 (`packageManager` in `package.json`).

```
cargo test
pnpm install
pnpm build
```

## Pemeriksaan kode / Code checks

| Command | What it runs |
| --- | --- |
| `pnpm lint:rust` | `cargo fmt --check` and `cargo clippy -D warnings` |
| `pnpm lint` | ESLint (web) |
| `pnpm format:check` / `pnpm format` | Prettier check / fix (web) |
| `pnpm check` | `svelte-check` with TypeScript strict |
| `pnpm test` | `cargo test` |
| `pnpm size` | gzip budgets: initial JS per page and `.wasm` (after a build) |
| `pnpm lighthouse` | Lighthouse mobile scores and metrics on the build (needs Chrome) |
| `pnpm verify` | all of the above plus `pnpm build` |

Run `pnpm verify` before opening a pull request.

`pnpm build` also builds the WASM engine first (needs `wasm-pack`: `cargo install wasm-pack --locked`). `pnpm test:wasm` runs the engine tests under Node.

## Deploy

Merges to `main` deploy to Cloudflare; pull requests from this repository get a preview URL. `node tools/check-headers.mjs <url>` checks the security headers and CSP of any deployed URL. See `docs/decisions/0002-deploy-cloudflare-workers.md`.
