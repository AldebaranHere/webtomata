import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '#lib/i18n/en.ts';
import { id } from '#lib/i18n/id.ts';
import type { ConversionStep } from '../engine/types.ts';
import { conversionText } from './conversion-text.ts';
import type { Names } from './conversion.ts';

const names: Names = {
	source: new Map([
		[0, 'q0'],
		[1, 'q1'],
		[2, 'q2']
	]),
	result: new Map([
		[0, '{q0, q1}'],
		[1, '∅']
	]),
	second: new Map()
};

describe('conversionText', () => {
	it('names a source state in a closure and a result state in a transition', () => {
		const closure: ConversionStep = {
			message: { key: 'determinize.closure', params: { state: 1 } },
			change: { kind: 'closure', state: 1, closure: [1, 2] }
		};
		expect(conversionText(names, closure)).toEqual({
			key: 'determinize.closure',
			params: { state: 'q1', closure: '{q1, q2}' }
		});
		const move: ConversionStep = {
			message: { key: 'determinize.transition', params: { from: 0, symbol: 'a', to: 1 } },
			change: { kind: 'transition', from: 0, symbol: 0, to: 1 }
		};
		expect(conversionText(names, move).params).toMatchObject({
			from: '{q0, q1}',
			to: '∅',
			symbol: 'a'
		});
	});

	it('names the two states and the two parts of a split', () => {
		const split: ConversionStep = {
			message: { key: 'minimize.split', params: { p: 0, q: 2, symbol: 'b' } },
			change: {
				kind: 'split',
				class: [0, 1, 2],
				kept: [0, 1],
				new: [2],
				witness: { p: 0, q: 2, symbol: 1 },
				classes: [[0, 1], [2]]
			}
		};
		expect(conversionText(names, split).params).toEqual({
			p: 'q0',
			q: 'q2',
			symbol: 'b',
			kept: '{q0, q1}',
			new: '{q2}'
		});
	});

	it('does not show a key that it does not know', () => {
		const odd: ConversionStep = {
			message: { key: 'determinize.something_new', params: {} },
			change: { kind: 'already_complete' }
		};
		expect(conversionText(names, odd).key).toBe('convert.failed');
	});

	it('has a text in both languages for every key that the conversions can send', () => {
		// The keys are read from the Rust source, so a new key cannot be added without a text.
		const read = (file: string) =>
			readFileSync(new URL(`../../../../crates/engine-core/src/${file}`, import.meta.url), 'utf8');
		const keys = new Set<string>(
			[
				'determinize.rs',
				'minimize.rs',
				'operations.rs',
				'xor.rs',
				'fsm_regex.rs',
				'regex.rs',
				'regex_simplify.rs',
				'regex_fsm.rs'
			].flatMap((file) =>
				[
					...read(file).matchAll(
						/"((?:determinize|minimize|trap|complement|union|intersection|xor|product|fsm_to_regex|regex|simplify)\.[a-z_.]+)"/g
					)
				].map((m) => m[1]!)
			)
		);
		expect(keys.size).toBeGreaterThanOrEqual(85);
		for (const key of keys) {
			expect(Object.hasOwn(id, key), `id ${key}`).toBe(true);
			expect(Object.hasOwn(en, key), `en ${key}`).toBe(true);
		}
	});
});
