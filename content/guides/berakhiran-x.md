---
schemaVersion: 1
id: berakhiran-x
order: 1
topic: dfsm
readingMinutes: 6
cardTitle:
  id: String berakhiran x
  en: Strings ending with x
title:
  id: Cara membuat DFSM untuk string berakhiran x
  en: How to build a DFSM for strings ending with x
summary:
  id: State mengingat akhiran terpanjang yang cocok dengan awal x.
  en: Each state remembers the longest suffix read so far that is a prefix of x.
references:
  rich: ['5.2']
  sipser: ['1.1']
---

Soal "diakhiri `x`" muncul berulang. Polanya sama: setiap state mengingat sebagian akhir dari string yang sudah dibaca.

## Ide dasarnya {#ide}

Mesin tidak perlu mengingat seluruh string. Ia hanya perlu tahu satu hal: awalan `x` yang paling panjang, yang sekarang menjadi akhiran dari string yang sudah dibaca.

## Contoh: berakhiran 01 {#contoh}

Misalkan alfabet adalah `Σ = {0, 1}` dan pola yang dicari adalah `x = 01`. Awalan dari `01` adalah string kosong `ε`, `0`, dan `01`.

```machine
example: berakhiran-01
caption: "`q0`: belum ada kemajuan (akhiran yang cocok adalah `ε`). `q1`: simbol terakhir adalah `0`. `q2`: dua simbol terakhir adalah `01` (accepting state)."
```

## Langkah merancang {#langkah}

1. Tulis `x` dan semua awalannya, termasuk string kosong.
2. Buat satu state untuk setiap awalan. State untuk `x` penuh adalah accepting state.
3. Untuk setiap state dan simbol: tambahkan simbol ke awalan itu, lalu cari awalan `x` terpanjang yang menjadi akhiran hasilnya. Itu state tujuan.
4. Uji dengan string yang hampir cocok, misalnya `001` dan `011`.

## Kesalahan umum {#salah}

- Lupa transisi dari accepting state. Setelah `x` terbaca, mesin masih harus membaca simbol berikutnya.
- Mengira state harus menghitung panjang string. Yang diingat hanya sebagian akhir string.
