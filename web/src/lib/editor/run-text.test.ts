import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '#lib/i18n/en.ts';
import { id } from '#lib/i18n/id.ts';
import type { RunView } from './run.ts';
import { refusalText, stepText, stoppedText, verdictText } from './run-text.ts';

const view = (patch: Partial<RunView>): RunView => ({
	input: [],
	index: 0,
	position: 0,
	active: [0],
	taken: [],
	rows: [],
	verdict: undefined,
	atStart: true,
	atEnd: true,
	playing: false,
	...patch
});

describe('the words of a run', () => {
	it('counts the place of an unknown symbol from 1', () => {
		expect(
			refusalText({ key: 'input.unknown_symbol', params: { symbol: '2', position: 2 } })
		).toEqual({ key: 'input.unknown_symbol', params: { symbol: '2', position: 3 } });
	});

	it('has a calm sentence for a refusal that it does not know', () => {
		expect(refusalText({ key: 'api.something_new', params: {} }).key).toBe('sim.refused_other');
		expect(refusalText(undefined).key).toBe('sim.refused_other');
		expect(refusalText({ key: 'sim.no_start_state', params: {} }).key).toBe('sim.no_start_state');
	});

	it('says why the budget stopped a run', () => {
		expect(stoppedText('max_steps').key).toBe('sim.stopped_max_steps');
		expect(stoppedText('max_configurations').key).toBe('sim.stopped_max_configurations');
		expect(stoppedText('max_pairs').key).toBe('sim.stopped_other');
	});

	it('has no verdict before the last step, and none for a stopped run', () => {
		expect(verdictText(view({}))).toBeUndefined();
		const stopped = verdictText(view({ verdict: { kind: 'stopped', reason: 'max_steps' } }));
		expect(stopped?.title).toBeUndefined();
		expect(stopped?.detail?.key).toBe('sim.stopped_max_steps');
	});

	it('says why a string was rejected', () => {
		expect(verdictText(view({ verdict: { kind: 'accepted' } }))).toEqual({
			title: { key: 'run.accepted', params: {} }
		});
		expect(verdictText(view({ verdict: { kind: 'rejected' }, active: [] }))?.detail?.key).toBe(
			'run.rejected_dead'
		);
		expect(verdictText(view({ verdict: { kind: 'rejected' }, active: [1] }))?.detail?.key).toBe(
			'run.rejected_end'
		);
	});

	it('maps the step messages of the engine', () => {
		expect(stepText({ key: 'sim.start', params: { states: 'q0' } }).key).toBe('sim.start');
		expect(stepText({ key: 'sim.read', params: { symbol: 'a' } }).key).toBe('sim.read');
		expect(stepText({ key: 'sim.no_states', params: {} }).key).toBe('sim.no_states');
	});

	it('has a text in both languages for every key that the engine can send for a simulation', () => {
		// The keys are read from the Rust source, so a new key cannot be added without a text.
		const read = (file: string) =>
			readFileSync(new URL(`../../../../crates/engine-core/src/${file}`, import.meta.url), 'utf8');
		const keys = new Set<string>([
			...[...read('simulate.rs').matchAll(/"((?:sim|input)\.[a-z_]+)"/g)].map((m) => m[1]!),
			...[...read('fsm.rs').matchAll(/"(input\.[a-z_]+)"/g)].map((m) => m[1]!)
		]);
		expect(keys.size).toBeGreaterThanOrEqual(5);
		// The API turns the text into symbols first, so the engine's own "unknown symbol" never
		// reaches the page; the calm fallback sentence covers it.
		keys.delete('sim.unknown_symbol');
		for (const key of keys) {
			expect(Object.hasOwn(id, key), `id ${key}`).toBe(true);
			expect(Object.hasOwn(en, key), `en ${key}`).toBe(true);
		}
	});
});
