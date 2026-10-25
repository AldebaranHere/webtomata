import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { id } from '../i18n/id.ts';
import { en } from '../i18n/en.ts';
import type { Issue } from '../engine/types.ts';
import { CHECK_KEYS, checkItems, flagsOf, summaryOf } from './checks.ts';
import { documentFrom } from './diagram/samples.ts';

const doc = documentFrom({
	alphabet: ['a', 'b'],
	states: [
		[100, 100, 'q0'],
		[300, 100, 'Akhir'],
		[500, 100, 'q2']
	],
	start: 0,
	accepting: [1],
	transitions: [[0, 'a', 1]]
});

const issue = (
	severity: Issue['severity'],
	key: string,
	params: Issue['message']['params'] = {}
): Issue => ({
	severity,
	message: { key, params }
});

describe('checkItems', () => {
	it('gives each issue a text key, the names of the states, and the states it is about', () => {
		const items = checkItems(
			[
				issue('error', 'fsm.no_start_state'),
				issue('error', 'dfsm.missing_transition', { state: 1, symbol: 'b' }),
				issue('error', 'dfsm.duplicate_transition', { state: 0, symbol: 'a' }),
				issue('error', 'dfsm.epsilon_transition', { from: 0, to: 2 }),
				issue('warning', 'fsm.unreachable_state', { state: 2 })
			],
			doc
		);
		expect(items).toEqual([
			{ severity: 'error', key: 'check.no_start_state', params: {}, states: [] },
			{
				severity: 'error',
				key: 'check.missing_transition',
				params: { state: 'Akhir', symbol: 'b' },
				states: [1]
			},
			{
				severity: 'error',
				key: 'check.duplicate_transition',
				params: { state: 'q0', symbol: 'a' },
				states: [0]
			},
			{
				severity: 'error',
				key: 'check.epsilon_transition',
				params: { from: 'q0', to: 'q2' },
				states: [0, 2]
			},
			{ severity: 'warning', key: 'check.unreachable_state', params: { state: 'q2' }, states: [2] }
		]);
	});

	it('an issue about a state that is gone (a stale answer) shows its number, and has no state to mark', () => {
		const [item] = checkItems([issue('warning', 'fsm.unreachable_state', { state: 99 })], doc);
		expect(item).toMatchObject({ params: { state: '99' }, states: [] });
	});

	it('a key that the page does not know is shown with its code, not hidden', () => {
		const [item] = checkItems([issue('error', 'fsm.something_new', { x: 1 })], doc);
		expect(item).toEqual({
			severity: 'error',
			key: 'check.other',
			params: { code: 'fsm.something_new' },
			states: []
		});
	});

	it('the list that was cut by the engine says how many it shows', () => {
		const [item] = checkItems([issue('warning', 'fsm.too_many_issues', { limit: 1000 })], doc);
		expect(item).toMatchObject({ key: 'check.too_many_issues', params: { limit: 1000 } });
	});
});

describe('flagsOf and summaryOf', () => {
	const items = checkItems(
		[
			issue('warning', 'fsm.unreachable_state', { state: 1 }),
			issue('error', 'dfsm.missing_transition', { state: 1, symbol: 'b' }),
			issue('warning', 'fsm.unreachable_state', { state: 2 })
		],
		doc
	);

	it('marks each state once, an error winning over a warning', () => {
		expect([...flagsOf(items)]).toEqual([
			[1, 'error'],
			[2, 'warning']
		]);
	});

	it('counts errors and warnings', () => {
		expect(summaryOf(items)).toEqual({ errors: 1, warnings: 2, total: 3 });
		expect(summaryOf([])).toEqual({ errors: 0, warnings: 0, total: 0 });
	});
});

describe('the texts', () => {
	it('every key that the engine can send for a check has a text in both languages', () => {
		// The keys are read from the Rust source, so a new check cannot be added without a text.
		const source = readFileSync(
			new URL('../../../../crates/engine-core/src/validate.rs', import.meta.url),
			'utf8'
		);
		const keys = [...new Set([...source.matchAll(/"((?:fsm|dfsm)\.[a-z_]+)"/g)].map((m) => m[1]!))];
		expect(keys.length).toBeGreaterThanOrEqual(6);
		for (const key of keys) {
			const text = CHECK_KEYS[key];
			expect(text, key).toBeDefined();
			expect(Object.hasOwn(id, text!), `id ${text}`).toBe(true);
			expect(Object.hasOwn(en, text!), `en ${text}`).toBe(true);
		}
	});
});
