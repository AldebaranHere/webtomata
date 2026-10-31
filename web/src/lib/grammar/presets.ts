export interface PresetGrammar {
	id: string;
	title: string;
	description: string;
	grammar: string;
	testStrings?: string[];
}

export const GRAMMAR_PRESETS: PresetGrammar[] = [
	{
		id: 'CNF01',
		title: 'CNF 01 (HW05 Fasilkom UI)',
		description: 'Eliminasi simbol unproductive (E, F) dan pembersihan aturan kosong/unit.',
		grammar: `S -> A D | F B a
A -> a A d | a D | a
D -> a D | B | λ
B -> b B c c c | b B c c c c | b B c c c c c | λ
E -> a F b A
F -> b E
C -> B S b b`,
		testStrings: ['a', 'ad', 'aad', 'bccc']
	},
	{
		id: 'CNF03',
		title: 'CNF 03 (HW05 Fasilkom UI)',
		description: 'Banyak variabel nullable (A, B, C, D) dan eliminasi simbol tak terjangkau.',
		grammar: `S -> A B C D | D a A E
A -> a A a | a | λ
B -> b B | λ
C -> c C | λ
D -> d D d | d | λ
E -> b C a a A
F -> b A a | b a`,
		testStrings: ['a', 'b', 'c', 'd', 'ad', 'dada']
	},
	{
		id: 'CNF04',
		title: 'CNF 04 (HW05 Fasilkom UI)',
		description: 'Kombinasi aturan panjang S -> A B C F dan simbol awal rekursif di RHS.',
		grammar: `S -> A B C F | S a D a
A -> a A a | a | λ
B -> b B | λ
C -> c C c | c | λ
D -> d D a | b D
E -> d F a | S a B
F -> d F | λ`,
		testStrings: ['a', 'b', 'c', 'd', 'abc', 'adada']
	},
	{
		id: 'CNF05',
		title: 'CNF 05 (HW05 Fasilkom UI)',
		description: 'Simbol rekursif, variabel nullable, dan binarisasi aturan panjang.',
		grammar: `S -> A B E F | S D a
A -> a A | λ
B -> b B b | b | λ
C -> a B a A | S c
D -> D c A | b D a
E -> c E | λ
F -> d F d | d | λ`,
		testStrings: ['a', 'b', 'c', 'd', 'abcd', 'bb']
	},
	{
		id: 'CFG_PAL',
		title: 'Palindrom {a, b}',
		description: 'Tata bahasa bebas konteks pembentuk semua string palindrom atas simbol a dan b.',
		grammar: `S -> a S a | b S b | a | b | λ`,
		testStrings: ['a', 'b', 'aba', 'abba', 'ab', 'abb']
	},
	{
		id: 'CFG_PAREN',
		title: 'Tanda Kurung Seimbang Dyck',
		description:
			'Bahasa tanda kurung seimbang standar (Dyck Language) menggunakan kurung buka dan tutup.',
		grammar: `S -> ( S ) S | λ`,
		testStrings: ['()', '(())', '()()', '(()())', '(', ')(']
	},
	{
		id: 'CFG_ANBN',
		title: 'Bahasa a^n b^n (n >= 1)',
		description: 'CFG kanonikal untuk bahasa non-reguler a^n b^n.',
		grammar: `S -> a S b | a b`,
		testStrings: ['ab', 'aabb', 'aaabbb', 'aab', 'abb']
	},
	{
		id: 'CFG_EQ',
		title: 'Jumlah a sama dengan b (#a = #b)',
		description: 'CFG untuk string di mana jumlah simbol a tepat sama dengan jumlah simbol b.',
		grammar: `S -> a S b S | b S a S | λ`,
		testStrings: ['ab', 'ba', 'aabb', 'baba', 'aab', 'abb']
	}
];
