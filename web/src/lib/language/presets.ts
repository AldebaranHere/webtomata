export interface PresetLanguage {
	id: string;
	name: string;
	formula: string;
	descriptionId: string;
	descriptionEn: string;
}

export const PRESETS: PresetLanguage[] = [
	// L1 - L6: Finite sets of words
	{
		id: 'L1',
		name: 'Himpunan Hingga {ab, aca, b, ccab}',
		formula: '{ab, aca, b, ccab}',
		descriptionId: 'Himpunan 4 kata hingga dengan simbol a, b, c',
		descriptionEn: 'Finite set of 4 words over a, b, c'
	},
	{
		id: 'L2',
		name: 'Himpunan Hingga {ac, c, bab, bcaa}',
		formula: '{ac, c, bab, bcaa}',
		descriptionId: 'Himpunan 4 kata hingga dengan simbol a, b, c',
		descriptionEn: 'Finite set of 4 words over a, b, c'
	},
	{
		id: 'L3',
		name: 'Himpunan Hingga {bb, bac, a, cbab}',
		formula: '{bb, bac, a, cbab}',
		descriptionId: 'Himpunan 4 kata hingga dengan simbol a, b, c',
		descriptionEn: 'Finite set of 4 words over a, b, c'
	},
	{
		id: 'L4',
		name: 'Himpunan Hingga {ca, aab, b, caac}',
		formula: '{ca, aab, b, caac}',
		descriptionId: 'Himpunan 4 kata hingga dengan simbol a, b, c',
		descriptionEn: 'Finite set of 4 words over a, b, c'
	},
	{
		id: 'L5',
		name: 'Himpunan Hingga {bc, c, bca, cbac}',
		formula: '{bc, c, bca, cbac}',
		descriptionId: 'Himpunan 4 kata hingga dengan simbol a, b, c',
		descriptionEn: 'Finite set of 4 words over a, b, c'
	},
	{
		id: 'L6',
		name: 'Himpunan Hingga {aa, bba, a, cbac}',
		formula: '{aa, bba, a, cbac}',
		descriptionId: 'Himpunan 4 kata hingga dengan simbol a, b, c',
		descriptionEn: 'Finite set of 4 words over a, b, c'
	},

	// L7 - L10: Pair sets of words
	{
		id: 'L7',
		name: 'Himpunan Hingga {ab, bc}',
		formula: '{ab, bc}',
		descriptionId: 'Himpunan 2 kata hingga',
		descriptionEn: 'Finite set of 2 words'
	},
	{
		id: 'L8',
		name: 'Himpunan Hingga {ba, ac}',
		formula: '{ba, ac}',
		descriptionId: 'Himpunan 2 kata hingga',
		descriptionEn: 'Finite set of 2 words'
	},
	{
		id: 'L9',
		name: 'Himpunan Hingga {ab, ca}',
		formula: '{ab, ca}',
		descriptionId: 'Himpunan 2 kata hingga',
		descriptionEn: 'Finite set of 2 words'
	},
	{
		id: 'L10',
		name: 'Himpunan Hingga {ac, cb}',
		formula: '{ac, cb}',
		descriptionId: 'Himpunan 2 kata hingga',
		descriptionEn: 'Finite set of 2 words'
	},

	// L11 - L22: Powers & Difference with Star
	{
		id: 'L11',
		name: 'Pangkat & Selisih Star (L1³ L2² - L7*)',
		formula: 'L1^3L2^2 - L7*',
		descriptionId: 'Konkatenasi L1 pangkat 3 dan L2 pangkat 2 dikurangi L7 bintang',
		descriptionEn: 'L1 cubed concatenated with L2 squared minus L7 star'
	},
	{
		id: 'L12',
		name: 'Pangkat & Selisih Star (L2³ L3² - L8*)',
		formula: 'L2^3L3^2 - L8*',
		descriptionId: 'Konkatenasi L2 pangkat 3 dan L3 pangkat 2 dikurangi L8 bintang',
		descriptionEn: 'L2 cubed concatenated with L3 squared minus L8 star'
	},
	{
		id: 'L13',
		name: 'Pangkat & Selisih Star (L3³ L4² - L9*)',
		formula: 'L3^3L4^2 - L9*',
		descriptionId: 'Konkatenasi L3 pangkat 3 dan L4 pangkat 2 dikurangi L9 bintang',
		descriptionEn: 'L3 cubed concatenated with L4 squared minus L9 star'
	},
	{
		id: 'L14',
		name: 'Pangkat & Selisih Star (L4³ L5² - L10*)',
		formula: 'L4^3L5^2 - L10*',
		descriptionId: 'Konkatenasi L4 pangkat 3 dan L5 pangkat 2 dikurangi L10 bintang',
		descriptionEn: 'L4 cubed concatenated with L5 squared minus L10 star'
	},
	{
		id: 'L15',
		name: 'Pangkat & Selisih Star (L5³ L6² - L7*)',
		formula: 'L5^3L6^2 - L7*',
		descriptionId: 'Konkatenasi L5 pangkat 3 dan L6 pangkat 2 dikurangi L7 bintang',
		descriptionEn: 'L5 cubed concatenated with L6 squared minus L7 star'
	},
	{
		id: 'L16',
		name: 'Pangkat & Selisih Star (L6³ L1² - L8*)',
		formula: 'L6^3L1^2 - L8*',
		descriptionId: 'Konkatenasi L6 pangkat 3 dan L1 pangkat 2 dikurangi L8 bintang',
		descriptionEn: 'L6 cubed concatenated with L1 squared minus L8 star'
	},
	{
		id: 'L17',
		name: 'Pangkat & Selisih Star (L6³ L5² - L9*)',
		formula: 'L6^3L5^2 - L9*',
		descriptionId: 'Konkatenasi L6 pangkat 3 dan L5 pangkat 2 dikurangi L9 bintang',
		descriptionEn: 'L6 cubed concatenated with L5 squared minus L9 star'
	},
	{
		id: 'L18',
		name: 'Pangkat & Selisih Star (L5³ L4² - L10*)',
		formula: 'L5^3L4^2 - L10*',
		descriptionId: 'Konkatenasi L5 pangkat 3 dan L4 pangkat 2 dikurangi L10 bintang',
		descriptionEn: 'L5 cubed concatenated with L4 squared minus L10 star'
	},
	{
		id: 'L19',
		name: 'Pangkat & Selisih Star (L4³ L3² - L7*)',
		formula: 'L4^3L3^2 - L7*',
		descriptionId: 'Konkatenasi L4 pangkat 3 dan L3 pangkat 2 dikurangi L7 bintang',
		descriptionEn: 'L4 cubed concatenated with L3 squared minus L7 star'
	},
	{
		id: 'L20',
		name: 'Pangkat & Selisih Star (L3³ L2² - L8*)',
		formula: 'L3^3L2^2 - L8*',
		descriptionId: 'Konkatenasi L3 pangkat 3 dan L2 pangkat 2 dikurangi L8 bintang',
		descriptionEn: 'L3 cubed concatenated with L2 squared minus L8 star'
	},
	{
		id: 'L21',
		name: 'Pangkat & Selisih Star (L2³ L1² - L9*)',
		formula: 'L2^3L1^2 - L9*',
		descriptionId: 'Konkatenasi L2 pangkat 3 dan L1 pangkat 2 dikurangi L9 bintang',
		descriptionEn: 'L2 cubed concatenated with L1 squared minus L9 star'
	},
	{
		id: 'L22',
		name: 'Pangkat & Selisih Star (L1³ L6² - L10*)',
		formula: 'L1^3L6^2 - L10*',
		descriptionId: 'Konkatenasi L1 pangkat 3 dan L6 pangkat 2 dikurangi L10 bintang',
		descriptionEn: 'L1 cubed concatenated with L6 squared minus L10 star'
	},

	// L23 - L34: Star Difference with Union Star
	{
		id: 'L23',
		name: 'Selisih Star Gabungan (L7* - L8(L1 ∪ L2)*)',
		formula: 'L7* - L8(L1 ∪ L2)*',
		descriptionId: 'L7 bintang dikurangi L8 dikonkatenasikan (L1 gabungan L2) bintang',
		descriptionEn: 'L7 star minus L8 concatenated with (L1 union L2) star'
	},
	{
		id: 'L24',
		name: 'Selisih Star Gabungan (L8* - L9(L2 ∪ L3)*)',
		formula: 'L8* - L9(L2 ∪ L3)*',
		descriptionId: 'L8 bintang dikurangi L9 dikonkatenasikan (L2 gabungan L3) bintang',
		descriptionEn: 'L8 star minus L9 concatenated with (L2 union L3) star'
	},
	{
		id: 'L25',
		name: 'Selisih Star Gabungan (L9* - L10(L3 ∪ L4)*)',
		formula: 'L9* - L10(L3 ∪ L4)*',
		descriptionId: 'L9 bintang dikurangi L10 dikonkatenasikan (L3 gabungan L4) bintang',
		descriptionEn: 'L9 star minus L10 concatenated with (L3 union L4) star'
	},
	{
		id: 'L26',
		name: 'Selisih Star Gabungan (L10* - L7(L4 ∪ L5)*)',
		formula: 'L10* - L7(L4 ∪ L5)*',
		descriptionId: 'L10 bintang dikurangi L7 dikonkatenasikan (L4 gabungan L5) bintang',
		descriptionEn: 'L10 star minus L7 concatenated with (L4 union L5) star'
	},
	{
		id: 'L27',
		name: 'Selisih Star Gabungan (L7* - L8(L5 ∪ L6)*)',
		formula: 'L7* - L8(L5 ∪ L6)*',
		descriptionId: 'L7 bintang dikurangi L8 dikonkatenasikan (L5 gabungan L6) bintang',
		descriptionEn: 'L7 star minus L8 concatenated with (L5 union L6) star'
	},
	{
		id: 'L28',
		name: 'Selisih Star Gabungan (L8* - L9(L6 ∪ L1)*)',
		formula: 'L8* - L9(L6 ∪ L1)*',
		descriptionId: 'L8 bintang dikurangi L9 dikonkatenasikan (L6 gabungan L1) bintang',
		descriptionEn: 'L8 star minus L9 concatenated with (L6 union L1) star'
	},
	{
		id: 'L29',
		name: 'Selisih Star Gabungan (L9* - L10(L1 ∪ L3)*)',
		formula: 'L9* - L10(L1 ∪ L3)*',
		descriptionId: 'L9 bintang dikurangi L10 dikonkatenasikan (L1 gabungan L3) bintang',
		descriptionEn: 'L9 star minus L10 concatenated with (L1 union L3) star'
	},
	{
		id: 'L30',
		name: 'Selisih Star Gabungan (L10* - L7(L2 ∪ L4)*)',
		formula: 'L10* - L7(L2 ∪ L4)*',
		descriptionId: 'L10 bintang dikurangi L7 dikonkatenasikan (L2 gabungan L4) bintang',
		descriptionEn: 'L10 star minus L7 concatenated with (L2 union L4) star'
	},
	{
		id: 'L31',
		name: 'Selisih Star Gabungan (L7* - L8(L3 ∪ L5)*)',
		formula: 'L7* - L8(L3 ∪ L5)*',
		descriptionId: 'L7 bintang dikurangi L8 dikonkatenasikan (L3 gabungan L5) bintang',
		descriptionEn: 'L7 star minus L8 concatenated with (L3 union L5) star'
	},
	{
		id: 'L32',
		name: 'Selisih Star Gabungan (L8* - L9(L4 ∪ L6)*)',
		formula: 'L8* - L9(L4 ∪ L6)*',
		descriptionId: 'L8 bintang dikurangi L9 dikonkatenasikan (L4 gabungan L6) bintang',
		descriptionEn: 'L8 star minus L9 concatenated with (L4 union L6) star'
	},
	{
		id: 'L33',
		name: 'Selisih Star Gabungan (L9* - L10(L5 ∪ L1)*)',
		formula: 'L9* - L10(L5 ∪ L1)*',
		descriptionId: 'L9 bintang dikurangi L10 dikonkatenasikan (L5 gabungan L1) bintang',
		descriptionEn: 'L9 star minus L10 concatenated with (L5 union L1) star'
	},
	{
		id: 'L34',
		name: 'Selisih Star Gabungan (L10* - L7(L6 ∪ L2)*)',
		formula: 'L10* - L7(L6 ∪ L2)*',
		descriptionId: 'L10 bintang dikurangi L7 dikonkatenasikan (L6 gabungan L2) bintang',
		descriptionEn: 'L10 star minus L7 concatenated with (L6 union L2) star'
	},

	// L35 - L46: Reversal and Star
	{
		id: 'L35',
		name: 'Pembalikan & Bintang ((L6)^R L1*)',
		formula: '(L6)^R L1*',
		descriptionId: 'L6 pembalikan string dikonkatenasikan L1 bintang',
		descriptionEn: 'L6 reversed concatenated with L1 star'
	},
	{
		id: 'L36',
		name: 'Pembalikan & Bintang ((L5)^R L2*)',
		formula: '(L5)^R L2*',
		descriptionId: 'L5 pembalikan string dikonkatenasikan L2 bintang',
		descriptionEn: 'L5 reversed concatenated with L2 star'
	},
	{
		id: 'L37',
		name: 'Pembalikan & Bintang ((L4)^R L3*)',
		formula: '(L4)^R L3*',
		descriptionId: 'L4 pembalikan string dikonkatenasikan L3 bintang',
		descriptionEn: 'L4 reversed concatenated with L3 star'
	},
	{
		id: 'L38',
		name: 'Pembalikan & Bintang ((L3)^R L4*)',
		formula: '(L3)^R L4*',
		descriptionId: 'L3 pembalikan string dikonkatenasikan L4 bintang',
		descriptionEn: 'L3 reversed concatenated with L4 star'
	},
	{
		id: 'L39',
		name: 'Pembalikan & Bintang ((L2)^R L5*)',
		formula: '(L2)^R L5*',
		descriptionId: 'L2 pembalikan string dikonkatenasikan L5 bintang',
		descriptionEn: 'L2 reversed concatenated with L5 star'
	},
	{
		id: 'L40',
		name: 'Pembalikan & Bintang ((L1)^R L6*)',
		formula: '(L1)^R L6*',
		descriptionId: 'L1 pembalikan string dikonkatenasikan L6 bintang',
		descriptionEn: 'L1 reversed concatenated with L6 star'
	},
	{
		id: 'L41',
		name: 'Pembalikan & Bintang ((L4)^R L1*)',
		formula: '(L4)^R L1*',
		descriptionId: 'L4 pembalikan string dikonkatenasikan L1 bintang',
		descriptionEn: 'L4 reversed concatenated with L1 star'
	},
	{
		id: 'L42',
		name: 'Pembalikan & Bintang ((L3)^R L2*)',
		formula: '(L3)^R L2*',
		descriptionId: 'L3 pembalikan string dikonkatenasikan L2 bintang',
		descriptionEn: 'L3 reversed concatenated with L2 star'
	},
	{
		id: 'L43',
		name: 'Pembalikan & Bintang ((L2)^R L3*)',
		formula: '(L2)^R L3*',
		descriptionId: 'L2 pembalikan string dikonkatenasikan L3 bintang',
		descriptionEn: 'L2 reversed concatenated with L3 star'
	},
	{
		id: 'L44',
		name: 'Pembalikan & Bintang ((L1)^R L4*)',
		formula: '(L1)^R L4*',
		descriptionId: 'L1 pembalikan string dikonkatenasikan L4 bintang',
		descriptionEn: 'L1 reversed concatenated with L4 star'
	},
	{
		id: 'L45',
		name: 'Pembalikan & Bintang ((L6)^R L5*)',
		formula: '(L6)^R L5*',
		descriptionId: 'L6 pembalikan string dikonkatenasikan L5 bintang',
		descriptionEn: 'L6 reversed concatenated with L5 star'
	},
	{
		id: 'L46',
		name: 'Pembalikan & Bintang ((L5)^R L6*)',
		formula: '(L5)^R L6*',
		descriptionId: 'L5 pembalikan string dikonkatenasikan L6 bintang',
		descriptionEn: 'L5 reversed concatenated with L6 star'
	},

	// L47 - L54: Count Predicates
	{
		id: 'L47',
		name: 'Predikat Hitungan 3#a(w) ≥ 5#b(w) + 3',
		formula: '{ w in {a, b}* : 3#a(w) >= 5#b(w) + 3 }',
		descriptionId: 'Tiga kali jumlah a minimal lima kali jumlah b ditambah 3',
		descriptionEn: 'Three times number of a is at least five times number of b plus 3'
	},
	{
		id: 'L48',
		name: 'Predikat Hitungan 3#a(w) ≥ 5#b(w) + 3',
		formula: '{ w in {a, b}* : 3#a(w) >= 5#b(w) + 3 }',
		descriptionId: 'Tiga kali jumlah a minimal lima kali jumlah b ditambah 3',
		descriptionEn: 'Three times number of a is at least five times number of b plus 3'
	},
	{
		id: 'L49',
		name: 'Predikat Hitungan 3#a(w) ≥ 5#b(w) + 3',
		formula: '{ w in {a, b}* : 3#a(w) >= 5#b(w) + 3 }',
		descriptionId: 'Tiga kali jumlah a minimal lima kali jumlah b ditambah 3',
		descriptionEn: 'Three times number of a is at least five times number of b plus 3'
	},
	{
		id: 'L50',
		name: 'Predikat Hitungan 3#a(w) ≥ 5#b(w) + 3',
		formula: '{ w in {a, b}* : 3#a(w) >= 5#b(w) + 3 }',
		descriptionId: 'Tiga kali jumlah a minimal lima kali jumlah b ditambah 3',
		descriptionEn: 'Three times number of a is at least five times number of b plus 3'
	},
	{
		id: 'L51',
		name: 'Predikat Hitungan 5#b(w) ≥ 3#a(w) + 2',
		formula: '{ w in {a, b}* : 5#b(w) >= 3#a(w) + 2 }',
		descriptionId: 'Lima kali jumlah b minimal tiga kali jumlah a ditambah 2',
		descriptionEn: 'Five times number of b is at least three times number of a plus 2'
	},
	{
		id: 'L52',
		name: 'Predikat Hitungan 5#b(w) ≥ 3#a(w) + 2',
		formula: '{ w in {a, b}* : 5#b(w) >= 3#a(w) + 2 }',
		descriptionId: 'Lima kali jumlah b minimal tiga kali jumlah a ditambah 2',
		descriptionEn: 'Five times number of b is at least three times number of a plus 2'
	},
	{
		id: 'L53',
		name: 'Predikat Hitungan 5#b(w) ≥ 3#a(w) + 2',
		formula: '{ w in {a, b}* : 5#b(w) >= 3#a(w) + 2 }',
		descriptionId: 'Lima kali jumlah b minimal tiga kali jumlah a ditambah 2',
		descriptionEn: 'Five times number of b is at least three times number of a plus 2'
	},
	{
		id: 'L54',
		name: 'Predikat Hitungan 5#b(w) ≥ 3#a(w) + 2',
		formula: '{ w in {a, b}* : 5#b(w) >= 3#a(w) + 2 }',
		descriptionId: 'Lima kali jumlah b minimal tiga kali jumlah a ditambah 2',
		descriptionEn: 'Five times number of b is at least three times number of a plus 2'
	},

	// L55 - L58: Prefix Invariants
	{
		id: 'L55',
		name: 'Invarian Awalan (3#a(v) ≥ 6#b(v))',
		formula: '{ w in {a, b}* : ∀v ∈ prefix(w). (3#a(v) >= 6#b(v)) }',
		descriptionId: 'Pada setiap awalan v, 3#a(v) minimal 6#b(v)',
		descriptionEn: 'For every prefix v, 3#a(v) is at least 6#b(v)'
	},
	{
		id: 'L56',
		name: 'Invarian Awalan (4#a(v) ≥ 5#b(v))',
		formula: '{ w in {a, b}* : ∀v ∈ prefix(w). (4#a(v) >= 5#b(v)) }',
		descriptionId: 'Pada setiap awalan v, 4#a(v) minimal 5#b(v)',
		descriptionEn: 'For every prefix v, 4#a(v) is at least 5#b(v)'
	},
	{
		id: 'L57',
		name: 'Invarian Awalan (3#b(v) ≥ 6#a(v))',
		formula: '{ w in {a, b}* : ∀v ∈ prefix(w). (3#b(v) >= 6#a(v)) }',
		descriptionId: 'Pada setiap awalan v, 3#b(v) minimal 6#a(v)',
		descriptionEn: 'For every prefix v, 3#b(v) is at least 6#a(v)'
	},
	{
		id: 'L58',
		name: 'Invarian Awalan (4#b(v) ≥ 5#a(v))',
		formula: '{ w in {a, b}* : ∀v ∈ prefix(w). (4#b(v) >= 5#a(v)) }',
		descriptionId: 'Pada setiap awalan v, 4#b(v) minimal 5#a(v)',
		descriptionEn: 'For every prefix v, 4#b(v) is at least 5#a(v)'
	},

	// L59 - L62: Suffix Invariants
	{
		id: 'L59',
		name: 'Invarian Akhiran (3#a(v) ≥ 6#b(v))',
		formula: '{ w in {a, b}* : ∀v ∈ suffix(w). (3#a(v) >= 6#b(v)) }',
		descriptionId: 'Pada setiap akhiran v, 3#a(v) minimal 6#b(v)',
		descriptionEn: 'For every suffix v, 3#a(v) is at least 6#b(v)'
	},
	{
		id: 'L60',
		name: 'Invarian Akhiran (4#a(v) ≥ 5#b(v))',
		formula: '{ w in {a, b}* : ∀v ∈ suffix(w). (4#a(v) >= 5#b(v)) }',
		descriptionId: 'Pada setiap akhiran v, 4#a(v) minimal 5#b(v)',
		descriptionEn: 'For every suffix v, 4#a(v) is at least 5#b(v)'
	},
	{
		id: 'L61',
		name: 'Invarian Akhiran (3#b(v) ≥ 6#a(v))',
		formula: '{ w in {a, b}* : ∀v ∈ suffix(w). (3#b(v) >= 6#a(v)) }',
		descriptionId: 'Pada setiap akhiran v, 3#b(v) minimal 6#a(v)',
		descriptionEn: 'For every suffix v, 3#b(v) is at least 6#a(v)'
	},
	{
		id: 'L62',
		name: 'Invarian Akhiran (4#b(v) ≥ 5#a(v))',
		formula: '{ w in {a, b}* : ∀v ∈ suffix(w). (4#b(v) >= 5#a(v)) }',
		descriptionId: 'Pada setiap akhiran v, 4#b(v) minimal 5#a(v)',
		descriptionEn: 'For every suffix v, 4#b(v) is at least 5#a(v)'
	}
];
