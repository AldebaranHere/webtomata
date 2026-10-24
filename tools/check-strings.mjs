// Fails if a Svelte component has text for the user that is not a message: literal text in the
// markup, a literal in an attribute that people or screen readers read (aria-label, alt, title,
// placeholder, the description of the page), or a string literal in braces. Every user-facing
// string goes through i18n (CLAUDE.md, section 6), so the text lives in web/src/lib/i18n.
//
// Text without a Latin letter (·, →, ε, numbers) is allowed. The script and the style are not read.
// Usage: node tools/check-strings.mjs   (reads web/src/**/*.svelte)
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The Svelte compiler is a dependency of web/, not of the repository root.
const { parse } = createRequire(new URL('../web/package.json', import.meta.url))('svelte/compiler');

// Latin letters only: the Greek letters of the theory (ε, Σ, δ) are symbols, not words.
const HAS_LETTER = /\p{Script=Latin}/u;
const READ_BY_PEOPLE = new Set([
	'aria-label',
	'aria-description',
	'aria-placeholder',
	'aria-roledescription',
	'alt',
	'title',
	'placeholder'
]);

/** The string literals that an expression can give as text: `"a"`, `c ? "a" : "b"`, `x || "a"`. */
function literalsOf(expression) {
	switch (expression?.type) {
		case 'Literal':
			return typeof expression.value === 'string' ? [expression.value] : [];
		case 'TemplateLiteral':
			return expression.quasis.map((q) => q.value.cooked ?? '');
		case 'ConditionalExpression':
			return [...literalsOf(expression.consequent), ...literalsOf(expression.alternate)];
		case 'LogicalExpression':
			return [...literalsOf(expression.left), ...literalsOf(expression.right)];
		default:
			return [];
	}
}

/** The text parts of an attribute value (`true`, a tag, or a list of text and tags). */
function attributeTexts(value) {
	if (value === true) return [];
	return (Array.isArray(value) ? value : [value]).flatMap((part) =>
		part.type === 'Text'
			? [part.data]
			: part.type === 'ExpressionTag'
				? literalsOf(part.expression)
				: []
	);
}

const isObject = (value) => typeof value === 'object' && value !== null;

/** Is this `<meta>` one whose content is shown (the description, an Open Graph or Twitter card)? */
function metaIsShown(element) {
	const name = element.attributes.find(
		(a) => a.type === 'Attribute' && (a.name === 'name' || a.name === 'property')
	);
	const text = name ? attributeTexts(name.value).join('') : '';
	return text === 'description' || /^(og|twitter):/.test(text);
}

/** Finds the text in one component that is not a message. Returns `{ line, text }` for each. */
export function findHardCodedStrings(source) {
	const found = [];
	const add = (start, text) => {
		const line = source.slice(0, start).split('\n').length;
		found.push({ line, text: text.trim().replace(/\s+/g, ' ') });
	};

	const walk = (node) => {
		if (Array.isArray(node)) return node.forEach(walk);
		if (!isObject(node)) return;
		if (node.type === 'Text') {
			if (HAS_LETTER.test(node.data)) {
				// Point at the first letter, not at the whitespace before it.
				add(node.start + node.data.search(/\S/), node.data);
			}
			return;
		}
		if (node.type === 'ExpressionTag') {
			for (const text of literalsOf(node.expression))
				if (HAS_LETTER.test(text)) add(node.start, text);
			return;
		}
		if (node.type === 'RegularElement' || node.type === 'SvelteElement') {
			for (const attribute of node.attributes) {
				if (attribute.type !== 'Attribute') continue;
				const shown =
					READ_BY_PEOPLE.has(attribute.name) ||
					(node.name === 'meta' && attribute.name === 'content' && metaIsShown(node));
				if (!shown) continue;
				for (const text of attributeTexts(attribute.value)) {
					if (HAS_LETTER.test(text)) add(attribute.start, text);
				}
			}
		}
		// The template only: the script (`instance`, `module`) and the style (`css`) are not read.
		for (const key of [
			'fragment',
			'nodes',
			'consequent',
			'alternate',
			'body',
			'children',
			'pending',
			'then',
			'catch',
			'fallback',
			'key'
		]) {
			if (key in node) walk(node[key]);
		}
	};

	walk(parse(source, { modern: true }).fragment);
	return found;
}

function svelteFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : svelteFiles(path);
		return entry.name.endsWith('.svelte') ? [path] : [];
	});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const root = fileURLToPath(new URL('..', import.meta.url));
	const files = svelteFiles(join(root, 'web/src'));
	let failed = 0;
	for (const file of files) {
		for (const { line, text } of findHardCodedStrings(readFileSync(file, 'utf8'))) {
			console.log(`FAIL ${relative(root, file).replaceAll('\\', '/')}:${line}: "${text}"`);
			failed++;
		}
	}
	if (failed > 0) {
		console.log(
			`${failed} text(s) are not messages. Move each one to web/src/lib/i18n (id.ts and en.ts).`
		);
		process.exit(1);
	}
	console.log(`ok   ${files.length} components have no hard-coded text`);
}
