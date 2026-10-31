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
		grammar: `S -> AD | FBa
A -> aAd | aD | a
D -> aD | B | λ
B -> bBccc | bBcccc | bBccccc | λ
E -> aFbA
F -> bE
C -> BSbb`,
		testStrings: ['a', 'ad', 'aad', 'bccc']
	},
	{
		id: 'CNF03',
		title: 'CNF 03 (HW05 Fasilkom UI)',
		description: 'Banyak variabel nullable (A, B, C, D) dan eliminasi simbol tak terjangkau.',
		grammar: `S -> ABCD | DaAE
A -> aAa | a | λ
B -> bB | λ
C -> cC | λ
D -> dDd | d | λ
E -> bCaaA
F -> bAa | ba`,
		testStrings: ['a', 'b', 'c', 'd', 'ad', 'dada']
	},
	{
		id: 'CNF04',
		title: 'CNF 04 (HW05 Fasilkom UI)',
		description: 'Kombinasi aturan panjang S -> A B C F dan simbol awal rekursif di RHS.',
		grammar: `S -> ABCF | SaDa
A -> aAa | a | λ
B -> bB | λ
C -> cCc | c | λ
D -> dDa | bD
E -> dFa | SaB
F -> dF | λ`,
		testStrings: ['a', 'b', 'c', 'd', 'abc', 'adada']
	},
	{
		id: 'CNF05',
		title: 'CNF 05 (HW05 Fasilkom UI)',
		description: 'Simbol rekursif, variabel nullable, dan binarisasi aturan panjang.',
		grammar: `S -> ABEF | SDa
A -> aA | λ
B -> bBb | b | λ
C -> aBaA | Sc
D -> DcA | bDa
E -> cE | λ
F -> dFd | d | λ`,
		testStrings: ['a', 'b', 'c', 'd', 'abcd', 'bb']
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
