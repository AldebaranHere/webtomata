import { describe, expect, it } from 'vitest';
import { WORKSTATION_MODES, readMode } from './workstation-mode.ts';

describe('readMode', () => {
	it('matches the F1 fixture oracle exactly', () => {
		// ('?mode=pda', null) -> 'pda'
		expect(readMode('?mode=pda', null)).toBe('pda');

		// ('?mode=pda', 'grammar') -> 'pda' (query wins)
		expect(readMode('?mode=pda', 'grammar')).toBe('pda');

		// ('', 'pda') -> 'pda'
		expect(readMode('', 'pda')).toBe('pda');

		// ('?mode=xyz', 'pda') -> 'pda' (invalid query falls back to saved)
		expect(readMode('?mode=xyz', 'pda')).toBe('pda');

		// ('?mode=', 'language') -> 'language'
		expect(readMode('?mode=', 'language')).toBe('language');

		// ('', 'tm') -> 'fsm'
		expect(readMode('', 'tm')).toBe('fsm');

		// ('', null) -> 'fsm'
		expect(readMode('', null)).toBe('fsm');

		// ('?mode=PDA', null) -> 'fsm' (case sensitive)
		expect(readMode('?mode=PDA', null)).toBe('fsm');

		// ('?mode=pda&mode=fsm', null) -> 'pda' (first one wins)
		expect(readMode('?mode=pda&mode=fsm', null)).toBe('pda');

		// ('?mode=fsm', 'pda') -> 'fsm'
		expect(readMode('?mode=fsm', 'pda')).toBe('fsm');

		// each alone gives itself
		for (const mode of WORKSTATION_MODES) {
			expect(readMode(`?mode=${mode}`, null)).toBe(mode);
			expect(readMode('', mode)).toBe(mode);
		}
	});

	it('never throws and always returns one of the four modes on random strings', () => {
		const chars = [
			'a',
			'b',
			'c',
			'p',
			'd',
			'f',
			's',
			'm',
			't',
			'?',
			'&',
			'=',
			'%',
			' ',
			'1',
			'2',
			'3',
			'\uD800',
			'\uDFFF',
			'A',
			'Z',
			'\n',
			'\0'
		];
		const randString = (len: number, seed: number) => {
			let s = '';
			let x = seed;
			for (let i = 0; i < len; i++) {
				x = (x * 1664525 + 1013904223) >>> 0;
				s += chars[x % chars.length];
			}
			return s;
		};

		for (let i = 0; i < 1000; i++) {
			const query = randString(i % 50, i);
			const saved = i % 5 === 0 ? null : randString(i % 20, i + 42);
			const result = readMode(query, saved);
			expect(WORKSTATION_MODES).toContain(result);
		}

		// Adversarial large string
		const hugeQuery = `?${'a'.repeat(500000)}&mode=pda&${'b'.repeat(500000)}`;
		expect(readMode(hugeQuery, null)).toBe('pda');
	});
});
