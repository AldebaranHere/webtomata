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

	// One from L11 - L22: Powers & Difference with Star
	{
		id: 'L11',
		name: 'Pangkat & Selisih Star (L1³ L2² - L7*)',
		formula: 'L1^3L2^2 - L7*',
		descriptionId: 'Konkatenasi L1 pangkat 3 dan L2 pangkat 2 dikurangi L7 bintang',
		descriptionEn: 'L1 cubed concatenated with L2 squared minus L7 star'
	},

	// One from L23 - L34: Star Difference with Union Star
	{
		id: 'L23',
		name: 'Selisih Star Gabungan (L7* - L8(L1 ∪ L2)*)',
		formula: 'L7* - L8(L1 ∪ L2)*',
		descriptionId: 'L7 bintang dikurangi L8 dikonkatenasikan (L1 gabungan L2) bintang',
		descriptionEn: 'L7 star minus L8 concatenated with (L1 union L2) star'
	},

	// One from L35 - L46: Reversal and Star
	{
		id: 'L35',
		name: 'Pembalikan & Bintang ((L6)^R L1*)',
		formula: '(L6)^R L1*',
		descriptionId: 'L6 pembalikan string dikonkatenasikan L1 bintang',
		descriptionEn: 'L6 reversed concatenated with L1 star'
	},

	// One from L47 - L54: Count Predicates
	{
		id: 'L47',
		name: 'Predikat Hitungan 3#a(w) ≥ 5#b(w) + 3',
		formula: '{ w in {a, b}* : 3#a(w) >= 5#b(w) + 3 }',
		descriptionId: 'Tiga kali jumlah a minimal lima kali jumlah b ditambah 3',
		descriptionEn: 'Three times number of a is at least five times number of b plus 3'
	},

	// One from L55 - L58: Prefix Invariants
	{
		id: 'L55',
		name: 'Invarian Awalan (3#a(v) ≥ 6#b(v))',
		formula: '{ w in {a, b}* : ∀v ∈ prefix(w). (3#a(v) >= 6#b(v)) }',
		descriptionId: 'Pada setiap awalan v, 3#a(v) minimal 6#b(v)',
		descriptionEn: 'For every prefix v, 3#a(v) is at least 6#b(v)'
	},

	// One from L59 - L62: Suffix Invariants
	{
		id: 'L59',
		name: 'Invarian Akhiran (3#a(v) ≥ 6#b(v))',
		formula: '{ w in {a, b}* : ∀v ∈ suffix(w). (3#a(v) >= 6#b(v)) }',
		descriptionId: 'Pada setiap akhiran v, 3#a(v) minimal 6#b(v)',
		descriptionEn: 'For every suffix v, 3#a(v) is at least 6#b(v)'
	}
];
