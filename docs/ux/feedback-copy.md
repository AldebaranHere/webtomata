# Feedback copy guide (U4)

How WebTomata talks when a student's answer is not yet right. It covers the feedback panel of **Soal** (Q4) and the messages of the editor (checks, runs). It is a guide for writing, not a list of finished strings: the strings live in `web/src/lib/i18n/id.ts` and `en.ts`, and every new one follows the rules here.

Status: **draft for the owner's review.** Each Indonesian sentence below is a proposal and is marked `TODO(review)` in `docs/glossary.md` until the owner confirms it. Do not invent a term: use `docs/glossary.md`.

## 1. The voice

1. **Calm.** A wrong answer is a normal step of learning. No red, no capitals, no "SALAH", no exclamation marks. The warning color is for the wrong part only (`docs/ux/design-system.md`).
2. **Specific.** Name the state, the symbol or the string. "State q2 belum punya transisi untuk simbol 1." beats "Mesin belum lengkap."
3. **Short.** One idea in one sentence. At most two sentences in a card.
4. **Never the answer.** Say what is wrong and where to look. Never say which transition to add, which state to make accepting, or what the regex is. A hint may name the *idea* (for example "ingat simbol terakhir"), never the *machine*.
5. **One question, not a lecture.** For a wrong trace, end with one guiding question that points at the pattern.
6. **Second person, informal and polite.** "Mesinmu", "kamu". Same register as the rest of the site.
7. **The same words everywhere.** "state", "start state", "accepting state", "transisi", "string", "diterima", "ditolak". These are the terms of the glossary.

## 2. The order of the feedback panel (Q4)

Each part is shown only when it applies, in this order. No numbers on the parts.

| Part | Shown when | Tone |
| --- | --- | --- |
| Structure check | The machine breaks a rule of its type or of the question (for example "harus DFSM", "maksimal 4 state") | A neutral card with the facts. It never says "wrong". |
| Verdict | The structure is valid | One title sentence, then one detail sentence. |
| Two lists | The language is not right | Two short headings and chips of strings, shortest first. |
| Shortest wrong string | The language is not right | The computation as lines, the wrong step marked, and one guiding question. |
| Hint | The student asks | One hint at a time, in order. Never open by itself. |

## 3. Patterns and drafts

### 3.1 Structure check

Pattern: **what is missing or too much, where, nothing about the fix.**

| Case | Indonesian (draft, `TODO(review)`) | English |
| --- | --- | --- |
| Valid | "Struktur valid. Setiap state punya transisi untuk {symbols}." | "The structure is valid. Every state has a transition for {symbols}." |
| Not the required type | "Soal ini meminta DFSM. Mesinmu punya transisi ε." | "This question asks for a DFSM. Your machine has an ε-transition." |
| Too many states | "Soal ini membatasi {max} state. Mesinmu punya {count}." | "This question allows {max} states. Your machine has {count}." |
| Not minimal | "Soal ini meminta mesin minimal. Masih ada state yang bisa digabung." | "This question asks for a minimal machine. Some states can still be merged." |
| No start state | "Belum ada start state." | "There is no start state yet." |

### 3.2 Verdict

Pattern: **tell how close it is, never how wrong it is.**

| Case | Title (draft) | Detail (draft) |
| --- | --- | --- |
| Right | "Tepat." | "Mesinmu menerima semua string yang diminta dan menolak yang lain." |
| A few strings wrong | "Belum tepat, tapi sudah dekat." | "Mesinmu menolak beberapa string yang seharusnya diterima." / "…menerima beberapa string yang seharusnya ditolak." |
| Many strings wrong | "Belum tepat." | "Mesinmu berbeda dari bahasa yang diminta pada banyak string. Coba jalankan string pendek dulu." |
| The check was stopped | "Pemeriksaan dihentikan." | "Mesinmu terlalu besar untuk diperiksa di sini. Coba sederhanakan." |

"Dekat" is chosen by the engine's lists, not by feeling: use "dekat" only when the lists are short (a few strings) and the shortest wrong string has at most 4 symbols.

### 3.3 The two lists

Headings say who gets it wrong, in the same words as the compare feature (S8):

- "Diterima mesinmu, padahal seharusnya ditolak"
- "Ditolak mesinmu, padahal seharusnya diterima"

An empty list says "Tidak ada. Bagian ini sudah benar." (a result, not an apology). A cut list says "Daftar ini dipotong, jadi bukan semua string yang berbeda." The empty string is written ε.

### 3.4 The shortest wrong string

Pattern: **show the computation, mark the step, ask one question.**

1. Heading: "Komputasi string terpendek yang salah: {string}".
2. The lines of the computation, with the last step marked ("← di sini").
3. One guiding question that names the *role* of a state, not the state to add. Draft: "Setelah {prefix}, simbol terakhir adalah {symbol}. State mana yang mengingat 'baru saja membaca {symbol}'?"

A guiding question must be answerable by looking at the machine. It must fit the pattern of the question (`pattern` in the question file): the question text for each pattern is written with the guide of that pattern (G3), not here.

### 3.5 Hints

- A hint is a short sentence about the *idea* of the pattern. "State cukup mengingat dua simbol terakhir yang penting, bukan seluruh string."
- Hints go from general to specific. The last hint may name the number of states, never the transitions.
- The button says "Tampilkan petunjuk berikutnya (1 dari 3)". A hint never opens by itself, and a shown hint stays.

## 4. Words to avoid

| Avoid | Why | Use |
| --- | --- | --- |
| "SALAH", "Gagal", "Error" | Alarming | "Belum tepat" |
| "Seharusnya kamu menambahkan…" | Gives the answer | A question about the role of the state |
| "Mudah", "tinggal", "cukup" about the task | Makes a student who is stuck feel slow | Say nothing about the difficulty |
| "Maaf", "sayangnya" | The site did nothing wrong | State the fact |
| Praise that is too big ("Hebat sekali!") | The answer is expected | "Tepat." |
| An exclamation mark on any system sentence | Shouting | A full stop |

## 5. For each new message

Before a message is added, check:

1. Is it one of the cases above? If not, write the case here first.
2. Does it name the place (state, symbol, string)?
3. Does it avoid the answer?
4. Is it at most two short sentences, with no exclamation mark?
5. Is every term in the glossary? If not, add it with `TODO(review)` and tell the owner.
6. Are there both `id` and `en` texts?
7. Does a test read the key, so that the engine's message key and the text cannot drift apart?

## 6. What Q4 adds

Q4 adds the keys under `feedback.*` for the cases above and checks that each of them has `id` and `en` text that follows this guide. That is the "done when" of U4.
