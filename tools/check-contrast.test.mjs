// Run with `node --test "tools/*.test.mjs"`. These tests check the contrast rules for the design
// tokens: the WCAG ratio, the reading of tokens.css, and that every color token is checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	checkContrast,
	contrastRatio,
	parseTokens,
	uncheckedColorTokens
} from './check-contrast.mjs';
import { DECORATIVE, PAIRS } from './contrast-pairs.mjs';

const near = (actual, expected, digits = 2) =>
	assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} is not near ${expected}`);

test('the WCAG ratio of known colors', () => {
	near(contrastRatio('#000000', '#FFFFFF'), 21, 2);
	near(contrastRatio('#FFFFFF', '#FFFFFF'), 1, 2);
	// A well known value: #767676 is the lightest gray that passes 4.5:1 on white.
	near(contrastRatio('#767676', '#FFFFFF'), 4.54, 2);
	near(contrastRatio('#16181D', '#F6F7F9'), 16.57, 2);
});

test('the ratio does not depend on the order, and short colors work', () => {
	assert.equal(contrastRatio('#FFF', '#000'), contrastRatio('#000000', '#FFFFFF'));
	assert.equal(contrastRatio('#2F5BD3', '#FFFFFF'), contrastRatio('#FFFFFF', '#2f5bd3'));
});

test('a color that is not a color is an error', () => {
	for (const bad of ['red', '#12', '#GGGGGG', 'rgb(0,0,0)', '']) {
		assert.throws(() => contrastRatio(bad, '#FFFFFF'), /color/, bad);
	}
});

test('tokens are read from custom properties, and var() is followed', () => {
	const css = `
		/* --color-fake: #000000; is a comment */
		:root {
			--color-a: #111111;
			--color-b: var(--color-a);
			--color-c: var(--color-b);
			--space-1: 0.25rem;
		}`;
	const tokens = parseTokens(css);
	assert.equal(tokens.get('--color-a'), '#111111');
	assert.equal(tokens.get('--color-b'), '#111111');
	assert.equal(tokens.get('--color-c'), '#111111');
	assert.equal(tokens.get('--space-1'), '0.25rem');
	assert.equal(tokens.has('--color-fake'), false);
});

test('a loop of var() is an error and not a hang', () => {
	assert.throws(() => parseTokens(':root { --a: var(--b); --b: var(--a); }'), /loop|circular/i);
});

test('a pair that passes, and a pair that fails, are told apart', () => {
	const tokens = parseTokens(':root { --fg: #16181D; --bg: #FFFFFF; --weak: #CCCCCC; }');
	const results = checkContrast(tokens, [
		{ name: 'good', fg: '--fg', bg: '--bg', need: 4.5 },
		{ name: 'bad', fg: '--weak', bg: '--bg', need: 4.5 },
		{ name: 'graphic', fg: '--fg', bg: '--bg', need: 3 }
	]);
	assert.deepEqual(
		results.map((r) => [r.name, r.ok]),
		[
			['good', true],
			['bad', false],
			['graphic', true]
		]
	);
	assert.ok(results[1].ratio < 4.5);
});

test('a pair that names a token that does not exist is a failure', () => {
	const tokens = parseTokens(':root { --fg: #000000; }');
	const [result] = checkContrast(tokens, [{ name: 'x', fg: '--fg', bg: '--missing', need: 4.5 }]);
	assert.equal(result.ok, false);
	assert.match(result.problem, /--missing/);
});

test('every pair in the list names two tokens and a known level', () => {
	assert.ok(PAIRS.length >= 20);
	for (const pair of PAIRS) {
		assert.ok(pair.name && pair.fg.startsWith('--') && pair.bg.startsWith('--'), pair.name);
		assert.ok([3, 4.5].includes(pair.need), `${pair.name}: need is 3 or 4.5`);
	}
	const names = PAIRS.map((p) => p.name);
	assert.equal(new Set(names).size, names.length, 'pair names are unique');
});

test('a color token that no pair checks is found', () => {
	const tokens = parseTokens(
		':root { --color-a: #000000; --color-b: #FFFFFF; --color-c: #777777; --color-line: #EEEEEE; }'
	);
	const pairs = [{ name: 'p', fg: '--color-a', bg: '--color-b', need: 4.5 }];
	assert.deepEqual(uncheckedColorTokens(tokens, pairs, ['--color-line']), ['--color-c']);
});

test('the real tokens.css passes every pair, and every color token is checked', () => {
	const css = readFileSync(new URL('../web/src/lib/styles/tokens.css', import.meta.url), 'utf8');
	const tokens = parseTokens(css);
	const failed = checkContrast(tokens, PAIRS).filter((r) => !r.ok);
	assert.deepEqual(
		failed.map((r) => `${r.name}: ${r.problem ?? r.ratio.toFixed(2)}`),
		[]
	);
	assert.deepEqual(uncheckedColorTokens(tokens, PAIRS, DECORATIVE), []);
});
