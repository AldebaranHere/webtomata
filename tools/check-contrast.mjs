// Contrast check for the design tokens (run by `pnpm check:contrast`, tested in
// check-contrast.test.mjs). It reads web/src/lib/styles/tokens.css and checks the pairs in
// contrast-pairs.mjs against WCAG 2.2: 4.5:1 for text (1.4.3) and 3:1 for graphics and the edges of
// controls (1.4.11). It also fails if a color token is in no pair and is not marked as decorative,
// so a new color cannot be added without a check.
//
// Usage: node tools/check-contrast.mjs            (a table, and exit 1 if anything fails)
//        node tools/check-contrast.mjs --markdown (the same table for docs/ux/design-system.md)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DECORATIVE, PAIRS } from './contrast-pairs.mjs';

const TOKENS_FILE = new URL('../web/src/lib/styles/tokens.css', import.meta.url);

function channels(color) {
	const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
	if (!m) throw new Error(`not a hex color: ${JSON.stringify(color)}`);
	const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

const linear = (v) => {
	const c = v / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

function luminance(color) {
	const [r, g, b] = channels(color).map(linear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio of two hex colors, from 1 to 21. */
export function contrastRatio(a, b) {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high + 0.05) / (low + 0.05);
}

/** The custom properties of a css text, as a Map. A value that is one `var()` is followed. */
export function parseTokens(css) {
	const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const raw = new Map();
	for (const [, name, value] of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
		raw.set(name, value.trim());
	}
	const resolved = new Map();
	const resolve = (name, trail = []) => {
		if (trail.includes(name)) throw new Error(`circular var(): ${[...trail, name].join(' -> ')}`);
		const value = raw.get(name);
		const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value ?? '');
		return ref ? resolve(ref[1], [...trail, name]) : value;
	};
	for (const name of raw.keys()) resolved.set(name, resolve(name));
	return resolved;
}

/** Checks each pair. A result has `ok`, `ratio` and `need`, or a `problem` for a missing token. */
export function checkContrast(tokens, pairs) {
	return pairs.map((pair) => {
		const base = { name: pair.name, fg: pair.fg, bg: pair.bg, need: pair.need };
		for (const side of [pair.fg, pair.bg]) {
			if (!tokens.has(side)) return { ...base, ok: false, problem: `unknown token ${side}` };
		}
		try {
			const ratio = contrastRatio(tokens.get(pair.fg), tokens.get(pair.bg));
			return { ...base, ok: ratio >= pair.need, ratio };
		} catch (error) {
			return { ...base, ok: false, problem: error.message };
		}
	});
}

/** The color tokens that no pair checks and that are not marked as decorative. */
export function uncheckedColorTokens(tokens, pairs, decorative) {
	const used = new Set(pairs.flatMap((p) => [p.fg, p.bg]));
	return [...tokens]
		.filter(([name, value]) => name.startsWith('--color-') && /^#[0-9a-f]{3,8}$/i.test(value))
		.map(([name]) => name)
		.filter((name) => !used.has(name) && !decorative.includes(name))
		.sort();
}

function report(tokens, markdown) {
	const results = checkContrast(tokens, PAIRS);
	const unchecked = uncheckedColorTokens(tokens, PAIRS, DECORATIVE);
	if (markdown) {
		console.log('| Pair | Colors | Ratio | Needed | Result |');
		console.log('| --- | --- | --- | --- | --- |');
		for (const r of results) {
			const colors = `\`${tokens.get(r.fg)}\` on \`${tokens.get(r.bg)}\``;
			const ratio = r.ratio === undefined ? '-' : r.ratio.toFixed(2);
			console.log(`| ${r.name} | ${colors} | ${ratio} | ${r.need} | ${r.ok ? 'pass' : 'FAIL'} |`);
		}
	} else {
		for (const r of results) {
			const shown = r.problem ?? `${r.ratio.toFixed(2)} (need ${r.need})`;
			console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${shown}  ${r.name}`);
		}
		for (const name of unchecked) console.log(`FAIL ${name} is in no contrast pair (add a pair, or mark it decorative)`);
	}
	return results.every((r) => r.ok) && unchecked.length === 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const tokens = parseTokens(readFileSync(TOKENS_FILE, 'utf8'));
	const ok = report(tokens, process.argv.includes('--markdown'));
	process.exit(ok ? 0 : 1);
}
