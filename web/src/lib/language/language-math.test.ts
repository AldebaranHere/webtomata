import { describe, expect, it } from 'vitest';
import { formatLanguageMathTokens } from './language-math.ts';

describe('formatLanguageMathTokens', () => {
	it('formats juxtaposition powers and set difference like L1^3L2^2 - L7*', () => {
		const tokens = formatLanguageMathTokens('L1^3L2^2 - L7*');
		expect(tokens).toEqual([
			{ kind: 'ident', text: 'L1', letter: 'L', sub: '1' },
			{ kind: 'sup', text: '3' },
			{ kind: 'ident', text: 'L2', letter: 'L', sub: '2' },
			{ kind: 'sup', text: '2' },
			{ kind: 'op', text: '−' },
			{ kind: 'ident', text: 'L7', letter: 'L', sub: '7' },
			{ kind: 'sup', text: '*' }
		]);
	});

	it('formats juxtaposition concatenation L15L1', () => {
		const tokens = formatLanguageMathTokens('L15L1');
		expect(tokens).toEqual([
			{ kind: 'ident', text: 'L15', letter: 'L', sub: '15' },
			{ kind: 'ident', text: 'L1', letter: 'L', sub: '1' }
		]);
	});

	it('formats custom language C2', () => {
		const tokens = formatLanguageMathTokens('C2');
		expect(tokens).toEqual([{ kind: 'ident', text: 'C2', letter: 'C', sub: '2' }]);
	});

	it('formats set operations ∪, ∩, ⊕, ^R', () => {
		const tokens = formatLanguageMathTokens('{a, b} ∪ {c}^R ∩ {d} ⊕ {e}');
		expect(tokens.some((t) => t.kind === 'op' && t.text === '∪')).toBe(true);
		expect(tokens.some((t) => t.kind === 'sup' && t.text === 'R')).toBe(true);
		expect(tokens.some((t) => t.kind === 'op' && t.text === '∩')).toBe(true);
		expect(tokens.some((t) => t.kind === 'op' && t.text === '⊕')).toBe(true);
	});
});
