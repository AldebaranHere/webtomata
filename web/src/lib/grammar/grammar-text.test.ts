import { describe, expect, it } from 'vitest';
import type { Grammar } from '#lib/engine/types.ts';
import { grammarToText, nextCustomId } from './grammar-text.ts';

describe('grammar-text', () => {
	describe('grammarToText (AC1)', () => {
		it('serializes grammar with empty rule', () => {
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
			expect(grammarToText(g)).toBe('S -> a S b | λ');
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
});
