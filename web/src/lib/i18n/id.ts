// Indonesian messages. This file is the source of the keys: `en.ts` must have exactly these keys
// (TypeScript checks it, and i18n.test.ts checks the parameters). Terms follow docs/glossary.md.
// A parameter is written {name}.
export const id = {
	'app.name': 'WebTomata',
	'app.tagline': 'Alat belajar mesin berhingga untuk mahasiswa Teori Bahasa dan Automata.',
	'app.privacy': 'Tanpa akun, tanpa pelacakan.',

	'nav.skip': 'Lewati ke konten',
	'nav.label': 'Navigasi utama',
	'nav.menu': 'Menu',
	'nav.sandbox': 'Sandbox',
	'nav.soal': 'Soal',
	'nav.panduan': 'Panduan',

	'lang.label': 'Bahasa',
	'lang.id': 'ID',
	'lang.en': 'EN',
	'lang.id_name': 'ID, Bahasa Indonesia',
	'lang.en_name': 'EN, English',

	'home.description':
		'Alat belajar mesin berhingga (DFSM, NDFSM, ekspresi reguler) untuk mahasiswa Teori Bahasa dan Automata. Gratis, tanpa akun.',
	'home.sandbox_hint': 'Bangun dan jalankan mesin sendiri.',
	'home.soal_hint': 'Latihan dengan umpan balik yang tenang.',
	'home.panduan_hint': 'Pola merancang mesin, satu per satu.',
	'home.engine': 'Versi engine',

	'sandbox.description': 'Bangun, jalankan dan ubah mesin berhingga langsung di peramban.',
	'soal.description': 'Soal latihan mesin berhingga dengan umpan balik yang tenang dan spesifik.',
	'panduan.description': 'Panduan pola merancang DFSM, NDFSM dan ekspresi reguler.',

	'page.soon': 'Segera hadir.',
	'page.home': 'Kembali ke beranda'
} as const;

export type MessageKey = keyof typeof id;
