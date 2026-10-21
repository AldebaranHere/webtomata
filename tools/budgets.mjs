// Performance budgets from CLAUDE.md §7. Raising a number needs the human's approval.
export const SIZE_KB_GZIP = { initialJsPerRoute: 170, wasm: 250 };

const SANDBOX = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 };

export const METRICS = { lcpMs: 2500, cls: 0.1, tbtMs: 200 };

// Guide and question list pages will use all four categories at 95 when they exist.
// One row per audited route. `/` is a placeholder and uses the sandbox budget until S1.
export const ROUTES = [{ path: '/', scores: SANDBOX }];
