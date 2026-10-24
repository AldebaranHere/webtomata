// Checks the rule that components use design tokens and never raw color values (CLAUDE.md,
// section 6). Run by `pnpm check:tokens`, tested in check-tokens-usage.test.mjs.
//
// It looks for a hex color (#fff, #2F5BD3) or a color function (rgb, rgba, hsl, hsla, hwb, lab,
// lch, oklab, oklch) in the places where a color can be written: a css file, the <style> block of
// a component, and the attributes style, fill, stroke, stop-color, flood-color, color and
// background. `tokens.css` is the one file that may hold raw colors. `transparent`,
// `currentColor` and `inherit` are fine.
//
// It checks one more rule of the design (docs/ux/design-system.md): the colors for lines and fills
// (`--color-warning`, the borders and the canvas dots) are not allowed as the text color, because
// they are below 4.5:1 on white. Warning text uses `--color-warning-ink`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOKENS_FILE = 'styles/tokens.css';
const RAW_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g;
// The colors for lines and fills may not be the text color (below 4.5:1 on white).
const NOT_FOR_TEXT =
	/(?<![\w-])color\s*:\s*var\(\s*(--color-(?:warning|border|border-strong|canvas-dot))\s*[,)]/g;
const COLOR_ATTRIBUTE =
	/\b(?:style|fill|stroke|stop-color|flood-color|color|background|background-color)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Replaces comments with spaces, so that the line numbers stay the same. */
function withoutComments(text) {
	const blank = (m) => m.replace(/[^\n]/g, ' ');
	return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/<!--[\s\S]*?-->/g, blank);
}

/** The parts of a file where a color can be written, as `{ start, text }`. */
function regions(name, text) {
	if (name.endsWith('.css')) return [{ start: 0, text }];
	const found = [];
	for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
		found.push({ start: m.index + m[0].indexOf(m[1]), text: m[1] });
	}
	for (const m of text.matchAll(COLOR_ATTRIBUTE)) {
		const value = m[1] ?? m[2];
		found.push({ start: m.index + m[0].indexOf(value), text: value });
	}
	return found;
}

/** `files` is a list of `{ name, text }`. Returns the problems, each with the file and the line. */
export function checkTokenUsage(files) {
	const problems = [];
	for (const { name, text } of files) {
		if (name.replace(/\\/g, '/').endsWith(TOKENS_FILE)) continue;
		const clean = withoutComments(text);
		for (const region of regions(name, clean)) {
			const lineOf = (index) => clean.slice(0, region.start + index).split('\n').length;
			for (const m of region.text.matchAll(RAW_COLOR)) {
				const line = lineOf(m.index);
				problems.push(`${name}, line ${line}: raw color ${m[0]} (use a token from tokens.css)`);
			}
			for (const m of region.text.matchAll(NOT_FOR_TEXT)) {
				const line = lineOf(m.index);
				problems.push(`${name}, line ${line}: ${m[1]} is not for text (use ${m[1]}-ink for text)`);
			}
		}
	}
	return problems;
}

function walk(dir) {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (path.includes('node_modules') || path.includes(join('lib', 'engine', 'wasm'))) return [];
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const root = fileURLToPath(new URL('../web/src', import.meta.url));
	const files = walk(root)
		.filter((path) => /\.(svelte|css)$/.test(path))
		.map((path) => ({ name: path, text: readFileSync(path, 'utf8') }));
	const problems = checkTokenUsage(files);
	for (const problem of problems) console.log(`FAIL ${problem}`);
	if (problems.length === 0) console.log(`ok   ${files.length} files use no raw colors`);
	process.exit(problems.length === 0 ? 0 : 1);
}
