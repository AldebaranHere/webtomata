export interface PresetGrammar {
	id: string;
	titleId: string;
	titleEn: string;
	descriptionId: string;
	descriptionEn: string;
	grammar: string;
	testStrings?: string[];
}

export const GRAMMAR_PRESETS: PresetGrammar[] = [
	{
		id: 'CNF_ORDER',
		titleId: 'Urutan Eliminasi Simbol (Fase 1-2)',
		titleEn: 'Symbol Elimination Order (Phases 1-2)',
		descriptionId:
			'Eliminasi simbol non-produktif B dan S -> A B pada Fase 2, sehingga A menjadi tak terjangkau.',
		descriptionEn:
			'Eliminate non-productive symbol B and S -> A B in Phase 2, leaving A unreachable.',
		grammar: `S -> a | A B
A -> a
B -> B b`,
		testStrings: ['a', 'b', 'ab', 'bb']
	},
	{
		id: 'CNF_NULLABLE',
		titleId: 'Variabel Nullable Majemuk (Fase 3)',
		titleEn: 'Multiple Nullable Variables (Phase 3)',
		descriptionId:
			'Banyak variabel nullable (A, B, C), simbol awal nullable, dan aturan unit B -> A.',
		descriptionEn:
			'Multiple nullable variables (A, B, C), a nullable start symbol, and unit rule B -> A.',
		grammar: `S -> A B C
A -> a A | ε
B -> b B | A
C -> c | ε`,
		testStrings: ['', 'a', 'b', 'c', 'aba', 'abac', 'bc']
	},
	{
		id: 'CNF_START_LONG',
		titleId: 'Simbol Awal Rekursif & Aturan Panjang',
		titleEn: 'Recursive Start Symbol & Long Rules',
		descriptionId:
			'Simbol awal rekursif, isolasi terminal (Fase 5), dan binarisasi aturan panjang (Fase 6).',
		descriptionEn:
			'Recursive start symbol, terminal isolation (Phase 5), and binarization of long rules (Phase 6).',
		grammar: `S -> x S y y | z`,
		testStrings: ['z', 'xzyy', 'xxzyyyy', 'xy', 'xz', 'xzy']
	},
	{
		id: 'CNF_UNIT_CHAIN',
		titleId: 'Rantai Aturan Unit (Fase 4)',
		titleEn: 'Unit Rule Chain (Phase 4)',
		descriptionId: 'Rantai aturan unit A -> B -> C pada Fase 4.',
		descriptionEn: 'Unit rule chain A -> B -> C in Phase 4.',
		grammar: `S -> A
A -> B
B -> C | b b
C -> c C | c`,
		testStrings: ['bb', 'c', 'cc', 'ccc', 'b', 'bc']
	},
	{
		id: 'CNF_SHARED_TAIL',
		titleId: 'Binarisasi Berbagi Ekor (Fase 6)',
		titleEn: 'Shared-Tail Binarization (Phase 6)',
		descriptionId: 'Aturan panjang dengan ekor bersama B C D untuk binarisasi pada Fase 6.',
		descriptionEn: 'Long rules with shared tail B C D for binarization in Phase 6.',
		grammar: `S -> a B C D | b B C D
B -> x
C -> y
D -> z`,
		testStrings: ['axyz', 'bxyz', 'xyz', 'abxyz', 'ax', 'by']
	},
	{
		id: 'CFG_PAL',
		titleId: 'Palindrom {a, b}',
		titleEn: 'Palindromes {a, b}',
		descriptionId:
			'Tata bahasa bebas konteks pembentuk semua string palindrom atas simbol a dan b.',
		descriptionEn: 'Context-free grammar generating all palindromes over symbols a and b.',
		grammar: `S -> aSa | bSb | a | b | λ`,
		testStrings: ['a', 'b', 'aba', 'abba', 'ab', 'abb']
	},
	{
		id: 'CFG_PAREN',
		titleId: 'Tanda Kurung Seimbang Dyck',
		titleEn: 'Balanced Parentheses (Dyck Language)',
		descriptionId:
			'Bahasa tanda kurung seimbang standar (Dyck Language) menggunakan kurung buka dan tutup.',
		descriptionEn:
			'Standard balanced parentheses language (Dyck language) using open and close parentheses.',
		grammar: `S -> (S)S | λ`,
		testStrings: ['()', '(())', '()()', '(()())', '(', ')(']
	},
	{
		id: 'CFG_ANBN',
		titleId: 'Bahasa a^n b^n (n >= 1)',
		titleEn: 'Language a^n b^n (n >= 1)',
		descriptionId: 'CFG kanonikal untuk bahasa non-reguler a^n b^n.',
		descriptionEn: 'Canonical CFG for the non-regular language a^n b^n.',
		grammar: `S -> aSb | ab`,
		testStrings: ['ab', 'aabb', 'aaabbb', 'aab', 'abb']
	},
	{
		id: 'CFG_EQ',
		titleId: 'Jumlah a sama dengan b (#a = #b)',
		titleEn: 'Equal Count of a and b (#a = #b)',
		descriptionId: 'CFG untuk string di mana jumlah simbol a tepat sama dengan jumlah simbol b.',
		descriptionEn: 'CFG for strings where the count of symbol a equals the count of symbol b.',
		grammar: `S -> aSbS | bSaS | λ`,
		testStrings: ['ab', 'ba', 'aabb', 'baba', 'aab', 'abb']
	}
];
