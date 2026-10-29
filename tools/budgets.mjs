// Performance budgets from CLAUDE.md §7. Raising a number needs the human's approval.
// `layoutWorker`: the layout library (dagre) in its own worker file, loaded only when auto layout is used.
export const SIZE_KB_GZIP = {
	initialJsPerRoute: 170,
	wasm: 250,
	layoutWorker: 40
};

// A name that is inside the layout library and nowhere else. It must not be in the first load of a page.
export const LAYOUT_LIBRARY_MARKER = 'nestingEdge';

const SANDBOX = {
	performance: 90,
	accessibility: 95,
	'best-practices': 95,
	seo: 90
};

export const METRICS = { lcpMs: 2500, cls: 0.1, tbtMs: 200 };

// Guide and question list pages use all four categories at 95.
const LIST = {
	performance: 95,
	accessibility: 95,
	'best-practices': 95,
	seo: 95
};

// One row per audited route. The home page uses the sandbox budget. The other pages are
// placeholders until S4 (sandbox), Q3 (soal) and G1 (panduan); their budgets are the real ones.
export const ROUTES = [
	{ path: '/', scores: SANDBOX },
	{ path: '/sandbox', scores: SANDBOX },
	{ path: '/soal', scores: LIST },
	// The page of a question has the editor, so it has the budget of the sandbox.
	{ path: '/soal/berakhiran-10', scores: SANDBOX },
	{ path: '/panduan', scores: LIST },
	{ path: '/panduan/berakhiran-x', scores: LIST },
	{ path: '/tentang', scores: LIST }
];
