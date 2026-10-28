import { describe, expect, it } from 'vitest';
import { MAX_CHIPS, hintButton, rowText, visibleChips } from './feedback-view.ts';

const wrongs = (n: number) =>
	Array.from({ length: n }, (_, i) => ({ text: String(i), input: String(i) }));

describe('visibleChips', () => {
	it('shows a short list whole', () => {
		expect(visibleChips(wrongs(3))).toEqual({ shown: wrongs(3), more: 0 });
		expect(visibleChips([])).toEqual({ shown: [], more: 0 });
	});

	it('cuts a long list at the limit and says how many are left, shortest first', () => {
		const result = visibleChips(wrongs(MAX_CHIPS + 5));
		expect(result.shown).toHaveLength(MAX_CHIPS);
		expect(result.shown[0]).toEqual({ text: '0', input: '0' });
		expect(result.more).toBe(5);
		expect(visibleChips(wrongs(MAX_CHIPS))).toEqual({ shown: wrongs(MAX_CHIPS), more: 0 });
	});
});

describe('rowText', () => {
	it('writes the states before, the symbol and the states after', () => {
		expect(rowText({ position: 1, from: ['q2'], symbol: '1', to: ['q0'] })).toBe('q2 –1→ q0');
	});

	it('writes a set of states in braces, and no state as ∅', () => {
		expect(rowText({ position: 1, from: ['a', 'b'], symbol: '0', to: [] })).toBe('{a, b} –0→ ∅');
	});
});

describe('hintButton', () => {
	it('names the hint that comes next, and how many there are', () => {
		expect(hintButton(0, 2)).toEqual({
			key: 'feedback.hint_button',
			params: { n: 1, total: 2 }
		});
		expect(hintButton(1, 2)).toEqual({
			key: 'feedback.hint_button',
			params: { n: 2, total: 2 }
		});
	});

	it('is nothing when every hint is shown, or there are none', () => {
		expect(hintButton(2, 2)).toBeNull();
		expect(hintButton(0, 0)).toBeNull();
		expect(hintButton(5, 2)).toBeNull();
	});
});
