import { describe, expect, it } from 'vitest';
import type { Grammar, Production } from '#lib/engine/types.ts';
import { translate } from '#lib/i18n/translate.ts';
import { computeCnfTitle, formatRuleDisplay, grammarToText, nextCustomId } from './grammar-text.ts';

describe('grammar-text', () => {
	describe('grammarToText (AC1)', () => {
		it('serializes grammar with empty rule using ε by default', () => {
			const g: Grammar = {
				start: 'S',
				rules: [
					{
						head: 'S',
						body: [
							{ type: 'terminal', value: 'a' },
							{ type: 'nonTerminal', value: 'S' },
							{ type: 'terminal', value: 'b' }
						]
					},
					{
						head: 'S',
						body: []
					}
				]
			};
			expect(grammarToText(g)).toBe('S -> a S b | ε');
		});

		it('supports custom emptySymbol when specified', () => {
			const g: Grammar = {
				start: 'S',
				rules: [
					{
						head: 'S',
						body: [
							{ type: 'terminal', value: 'a' },
							{ type: 'nonTerminal', value: 'S' },
							{ type: 'terminal', value: 'b' }
						]
					},
					{
						head: 'S',
						body: []
					}
				]
			};
			expect(grammarToText(g, 'λ')).toBe('S -> a S b | λ');
		});

		it('does not invent S -> ε for a start symbol with no rules', () => {
			const g: Grammar = {
				start: 'S',
				rules: []
			};
			expect(grammarToText(g)).toBe('');
		});

		it('serializes grammar with start symbol S_0 and helpers T_a, X1', () => {
			const g: Grammar = {
				start: 'S_0',
				rules: [
					{
						head: 'S_0',
						body: [
							{ type: 'nonTerminal', value: 'T_a' },
							{ type: 'nonTerminal', value: 'X1' }
						]
					},
					{
						head: 'T_a',
						body: [{ type: 'terminal', value: 'a' }]
					},
					{
						head: 'X1',
						body: [{ type: 'terminal', value: 'b' }]
					}
				]
			};
			expect(grammarToText(g)).toBe('S_0 -> T_a X1\nT_a -> a\nX1 -> b');
		});

		it('serializes grammar with two-digit helper X10 next to a digit terminal', () => {
			const g: Grammar = {
				start: 'S',
				rules: [
					{
						head: 'S',
						body: [
							{ type: 'nonTerminal', value: 'X10' },
							{ type: 'terminal', value: '0' }
						]
					},
					{
						head: 'X10',
						body: [{ type: 'terminal', value: '1' }]
					}
				]
			};
			expect(grammarToText(g)).toBe('S -> X10 0\nX10 -> 1');
		});
	});

	describe('nextCustomId (AC7)', () => {
		it('returns G1 when existing list is empty', () => {
			expect(nextCustomId([])).toBe('G1');
		});

		it('returns G2 when G1 exists', () => {
			expect(nextCustomId([{ id: 'G1' }])).toBe('G2');
		});

		it('returns G1 when G1 is deleted and G2 is kept', () => {
			expect(nextCustomId([{ id: 'G2' }])).toBe('G1');
		});

		it('returns the first available hole in IDs', () => {
			expect(nextCustomId([{ id: 'G1' }, { id: 'G3' }])).toBe('G2');
			expect(nextCustomId([{ id: 'G1' }, { id: 'G2' }, { id: 'G4' }])).toBe('G3');
		});

		it('ignores non-standard custom IDs', () => {
			expect(nextCustomId([{ id: 'custom-foo' }])).toBe('G1');
		});
	});

	describe('formatRuleDisplay (AC3)', () => {
		it('formats rule S → T_a S T_b with spaces between symbols', () => {
			const rule: Production = {
				head: 'S',
				body: [
					{ type: 'nonTerminal', value: 'T_a' },
					{ type: 'nonTerminal', value: 'S' },
					{ type: 'nonTerminal', value: 'T_b' }
				]
			};
			expect(formatRuleDisplay(rule)).toBe('S → T_a S T_b');
		});

		it('formats rule with empty body as S → λ', () => {
			const rule: Production = {
				head: 'S',
				body: []
			};
			expect(formatRuleDisplay(rule)).toBe('S → λ');
		});

		it('formats body with 1 symbol without extra spaces', () => {
			const rule: Production = {
				head: 'S',
				body: [{ type: 'terminal', value: 'a' }]
			};
			expect(formatRuleDisplay(rule)).toBe('S → a');
		});

		it('formats body with 2 symbols separated by one space', () => {
			const rule: Production = {
				head: 'S',
				body: [
					{ type: 'nonTerminal', value: 'A' },
					{ type: 'nonTerminal', value: 'B' }
				]
			};
			expect(formatRuleDisplay(rule)).toBe('S → A B');
		});

		it('formats body with 3 symbols separated by one space between each', () => {
			const rule: Production = {
				head: 'S',
				body: [
					{ type: 'terminal', value: 'a' },
					{ type: 'nonTerminal', value: 'B' },
					{ type: 'terminal', value: 'c' }
				]
			};
			expect(formatRuleDisplay(rule)).toBe('S → a B c');
		});
	});

	describe('computeCnfTitle (AC4)', () => {
		it('generates "<name> (CNF)" if not present', () => {
			expect(computeCnfTitle('Grammar 1', [])).toBe('Grammar 1 (CNF)');
		});

		it('generates "<name> (CNF 2)" if "<name> (CNF)" is present', () => {
			expect(computeCnfTitle('Grammar 1', [{ title: 'Grammar 1 (CNF)' }])).toBe(
				'Grammar 1 (CNF 2)'
			);
		});

		it('increments counter sequentially if (CNF 2) exists', () => {
			expect(
				computeCnfTitle('Grammar 1', [{ title: 'Grammar 1 (CNF)' }, { title: 'Grammar 1 (CNF 2)' }])
			).toBe('Grammar 1 (CNF 3)');
		});
	});

	describe('custom grammar titles (AC4)', () => {
		it('formats default custom grammar title using translated key in id and en', () => {
			expect(translate('id', 'grammar.default_custom_title', { id: 'G1' })).toBe('Tata Bahasa G1');
			expect(translate('en', 'grammar.default_custom_title', { id: 'G1' })).toBe('Grammar G1');
			expect(translate('id', 'grammar.default_custom_title', { id: 'G2' })).toBe('Tata Bahasa G2');
			expect(translate('en', 'grammar.default_custom_title', { id: 'G2' })).toBe('Grammar G2');
		});
	});
});
