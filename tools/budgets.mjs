// Performance budgets from CLAUDE.md §7. Raising a number needs the human's approval.
export const SIZE_KB_GZIP = { initialJsPerRoute: 170, wasm: 250 };

const SANDBOX = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 };

export const METRICS = { lcpMs: 2500, cls: 0.1, tbtMs: 200 };

// Guide and question list pages use all four categories at 95.
const LIST = { performance: 95, accessibility: 95, 'best-practices': 95, seo: 95 };

// One row per audited route. The home page uses the sandbox budget. The other pages are
// placeholders until S4 (sandbox), Q3 (soal) and G1 (panduan); their budgets are the real ones.
export const ROUTES = [
	{ path: '/', scores: SANDBOX },
	{ path: '/sandbox', scores: SANDBOX },
	{ path: '/soal', scores: LIST },
	{ path: '/panduan', scores: LIST }
];
