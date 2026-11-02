export interface PresetGrammar {
	id: string;
	title: string;
	description: string;
	grammar: string;
	testStrings?: string[];
}

export const GRAMMAR_PRESETS: PresetGrammar[] = [
	{
		id: 'CNF_ORDER',
		title: 'Urutan Eliminasi Simbol (Fase 4)',
		description:
			'Eliminasi simbol non-produktif B dan S -> A B terlebih dahulu, sehingga A menjadi tidak terjangkau.',
		grammar: `S -> a | A B
A -> a
B -> B b`,
		testStrings: ['a', 'b', 'ab', 'bb']
	},
	{
		id: 'CNF_NULLABLE',
		title: 'Variabel Nullable Majemuk (Fase 2)',
		description:
			'Banyak variabel nullable (A, B, C), simbol awal nullable, dan aturan unit B -> A.',
		grammar: `S -> A B C
A -> a A | ε
B -> b B | A
C -> c | ε`,
		testStrings: ['', 'a', 'b', 'c', 'aba', 'abac', 'bc']
	},
	{
		id: 'CNF_START_LONG',
		title: 'Simbol Awal Rekursif & Aturan Panjang',
		description:
			'Simbol awal di ruas kanan (Fase 1), isolasi terminal (Fase 5), dan binarisasi aturan panjang (Fase 6).',
		grammar: `S -> x S y y | z`,
		testStrings: ['z', 'xzyy', 'xxzyyyy', 'xy', 'xz', 'xzy']
	},
	{
		id: 'CNF_UNIT_CHAIN',
		title: 'Rantai Aturan Unit (Fase 3)',
		description:
			'Rantai unit A -> B -> C dengan pembersihan variabel A dan B yang menjadi tak terjangkau.',
		grammar: `S -> A
A -> B
B -> C | b b
C -> c C | c`,
		testStrings: ['bb', 'c', 'cc', 'ccc', 'b', 'bc']
	},
	{
		id: 'CNF_SHARED_TAIL',
		title: 'Binarisasi Berbagi Ekor (Fase 6)',
		description: 'Aturan panjang dengan ekor bersama B C D untuk binarisasi pada Fase 6.',
		grammar: `S -> a B C D | b B C D
B -> x
C -> y
D -> z`,
		testStrings: ['axyz', 'bxyz', 'xyz', 'abxyz', 'ax', 'by']
	},
	{
		id: 'CFG_PAL',
		title: 'Palindrom {a, b}',
		description: 'Tata bahasa bebas konteks pembentuk semua string palindrom atas simbol a dan b.',
		grammar: `S -> aSa | bSb | a | b | λ`,
		testStrings: ['a', 'b', 'aba', 'abba', 'ab', 'abb']
	},
	{
		id: 'CFG_PAREN',
		title: 'Tanda Kurung Seimbang Dyck',
		description:
			'Bahasa tanda kurung seimbang standar (Dyck Language) menggunakan kurung buka dan tutup.',
		grammar: `S -> (S)S | λ`,
		testStrings: ['()', '(())', '()()', '(()())', '(', ')(']
	},
	{
		id: 'CFG_ANBN',
		title: 'Bahasa a^n b^n (n >= 1)',
		description: 'CFG kanonikal untuk bahasa non-reguler a^n b^n.',
		grammar: `S -> aSb | ab`,
		testStrings: ['ab', 'aabb', 'aaabbb', 'aab', 'abb']
	},
	{
		id: 'CFG_EQ',
		title: 'Jumlah a sama dengan b (#a = #b)',
		description: 'CFG untuk string di mana jumlah simbol a tepat sama dengan jumlah simbol b.',
		grammar: `S -> aSbS | bSaS | λ`,
		testStrings: ['ab', 'ba', 'aabb', 'baba', 'aab', 'abb']
	}
];
