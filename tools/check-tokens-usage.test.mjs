// Run with `node --test "tools/*.test.mjs"`. These tests check the rule that components use design
// tokens and never raw color values (CLAUDE.md, section 6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTokenUsage } from './check-tokens-usage.mjs';

const svelte = (style, markup = '<p>hi</p>') =>
	`<script lang="ts">let x = 1;</script>\n${markup}\n<style>\n${style}\n</style>\n`;
const check = (text, name = 'web/src/lib/Example.svelte') => checkTokenUsage([{ name, text }]);

test('a component that uses tokens has no problems', () => {
	const css =
		'.a { color: var(--color-ink); background: var(--color-surface); border: 1px solid var(--color-border); }';
	assert.deepEqual(check(svelte(css)), []);
});

test('a raw color in a style block is a problem', () => {
	for (const raw of [
		'#fff',
		'#FFFFFF',
		'#2F5BD3',
		'#abcd',
		'#11223344',
		'rgb(0 0 0)',
		'rgba(0,0,0,.5)',
		'hsl(10 20% 30%)',
		'hsla(10,20%,30%,.5)'
	]) {
		const problems = check(svelte(`.a { color: ${raw}; }`));
		assert.equal(problems.length, 1, raw);
		assert.match(problems[0], /Example\.svelte/);
	}
});

test('transparent, currentColor and inherit are allowed', () => {
	assert.deepEqual(
		check(svelte('.a { background: transparent; border-color: currentColor; color: inherit; }')),
		[]
	);
});

test('a raw color in an inline style or an SVG attribute is a problem', () => {
	assert.equal(check(svelte('', '<div style="color: #ff0000">x</div>')).length, 1);
	assert.equal(check(svelte('', '<circle fill="#FFFFFF" stroke="#3B414C" />')).length, 2);
	assert.equal(
		check(svelte('', '<circle fill="var(--color-surface)" stroke="currentColor" />')).length,
		0
	);
});

test('an anchor or an entity that looks like a hex color is not a problem', () => {
	assert.deepEqual(
		check(svelte('', '<a href="#add">a</a> <a href="#face">b</a> &#169; <p id="bad">c</p>')),
		[]
	);
});

test('a color in a comment is not a problem', () => {
	assert.deepEqual(
		check(svelte('/* was #FF0000 */ .a { color: var(--color-ink); }', '<!-- #fff -->')),
		[]
	);
});

test('a plain css file is checked, and tokens.css is the one place for raw colors', () => {
	assert.equal(check('.a { color: #fff; }', 'web/src/lib/styles/base.css').length, 1);
	assert.deepEqual(check(':root { --color-ink: #16181D; }', 'web/src/lib/styles/tokens.css'), []);
});

test('colors that are not for text cannot be used as the text color', () => {
	for (const token of ['--color-warning', '--color-border', '--color-border-strong', '--color-canvas-dot']) {
		const problems = check(svelte(`.a { color: var(${token}); }`));
		assert.equal(problems.length, 1, token);
		assert.match(problems[0], /not for text/);
	}
	// The same colors are fine for a line, a fill or an outline.
	const fine = '.a { border-color: var(--color-warning); background: var(--color-warning); outline-color: var(--color-border-strong); fill: var(--color-warning); }';
	assert.deepEqual(check(svelte(fine)), []);
	// And the ink variants are fine for text.
	assert.deepEqual(check(svelte('.a { color: var(--color-warning-ink); }')), []);
	assert.deepEqual(check(svelte('.a { background-color: var(--color-warning-tint); }')), []);
});

test('the problem says the file and the line', () => {
	const [problem] = check(svelte('.a {\n  color: #fff;\n}'), 'web/src/routes/+page.svelte');
	assert.match(problem, /\+page\.svelte/);
	assert.match(problem, /line 5/);
});

function walk(dir) {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (path.includes('node_modules') || path.includes(join('lib', 'engine', 'wasm'))) return [];
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

test('the real components of the app use no raw colors', () => {
	const root = fileURLToPath(new URL('../web/src', import.meta.url));
	const files = walk(root)
		.filter((path) => /\.(svelte|css)$/.test(path))
		.map((path) => ({ name: path, text: readFileSync(path, 'utf8') }));
	assert.ok(files.length >= 2);
	assert.deepEqual(checkTokenUsage(files), []);
});
