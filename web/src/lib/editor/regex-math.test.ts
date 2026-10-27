import { describe, expect, it } from 'vitest';
import { mathParts, toLatex } from './regex-math.ts';
import type { MathPart } from './regex-math.ts';

const text = (parts: MathPart[]) => parts.map((p) => p.text).join('');

describe('mathParts', () => {
	it('puts * and + in the superscript, ∪ and the two constants apart, and the rest in text', () => {
		expect(mathParts('(1*0+1)+')).toEqual([
			{ kind: 'text', text: '(1' },
			{ kind: 'sup', text: '*' },
			{ kind: 'text', text: '0' },
			{ kind: 'sup', text: '+' },
			{ kind: 'text', text: '1)' },
			{ kind: 'sup', text: '+' }
		]);
		expect(mathParts('a∪ε∅')).toEqual([
			{ kind: 'text', text: 'a' },
			{ kind: 'union', text: '∪' },
			{ kind: 'symbol', text: 'ε' },
			{ kind: 'symbol', text: '∅' }
		]);
	});

	it('keeps every character, in order, so that a copy of the text is the expression', () => {
		for (const expression of [
			'(1*0+1)+',
			'a∪b*',
			'(num∪num plus)*',
			'1*00*1((0∪11*0)0*1)*',
			'a**',
			'😀+α*',
			''
		]) {
			expect(text(mathParts(expression)), expression).toBe(expression);
		}
	});

	it('keeps each superscript sign apart, and a symbol of more than one code point whole', () => {
		expect(mathParts('a**').map((p) => p.kind)).toEqual(['text', 'sup', 'sup']);
		expect(mathParts('😀*')).toEqual([
			{ kind: 'text', text: '😀' },
			{ kind: 'sup', text: '*' }
		]);
		expect(mathParts('')).toEqual([]);
	});
});

describe('toLatex', () => {
	it('writes the signs of the notation as LaTeX', () => {
		expect(toLatex('(1*0+1)+')).toBe('(1^{*}0^{+}1)^{+}');
		expect(toLatex('a∪b')).toBe('a \\cup b');
		expect(toLatex('ε∪∅')).toBe('\\varepsilon \\cup \\emptyset');
		expect(toLatex('1*00*1((0∪11*0)0*1)*')).toBe('1^{*}00^{*}1((0 \\cup 11^{*}0)0^{*}1)^{*}');
	});

	it('does not put a superscript on a superscript', () => {
		expect(toLatex('a**')).toBe('a^{*}{}^{*}');
		expect(toLatex('(a*)+')).toBe('(a^{*})^{+}');
	});

	it('writes a symbol of more than one character as one word, when spaces separate the symbols', () => {
		expect(toLatex('(num∪num plus)*')).toBe(
			'(\\mathit{num} \\cup \\mathit{num}\\,\\mathit{plus})^{*}'
		);
		// Without a space the text is one symbol for each character, as the engine reads it.
		expect(toLatex('abb')).toBe('abb');
	});

	it('escapes the characters that LaTeX treats as commands', () => {
		expect(toLatex('#$%&_{}')).toBe('\\#\\$\\%\\&\\_\\{\\}');
		expect(toLatex('\\')).toBe('\\backslash');
		// The space after the command is kept when a letter follows it.
		expect(toLatex('\\a')).toBe('\\backslash a');
		expect(toLatex('^~')).toBe('\\text{\\textasciicircum}\\text{\\textasciitilde}');
	});

	it('gives an empty text for an empty expression', () => {
		expect(toLatex('')).toBe('');
	});
});
