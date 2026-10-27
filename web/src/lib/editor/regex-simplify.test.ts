import { describe, expect, it } from 'vitest';
import type { ConversionStep, EngineResult, RegexOutcome } from '../engine/types.ts';
import { markPart, runSimplify, simplifyFrameAt } from './regex-simplify.ts';
import type { SimplifyEngine, SimplifyRun } from './regex-simplify.ts';

const step = (key: string, expression: string, params: Record<string, string>): ConversionStep => ({
	message: { key, params },
	change: { kind: 'expression', expression }
});

// a∪∅ → a, then (a)(εb) → ab … the engine's texts for "(a∪∅)(εb)".
const trace: ConversionStep[] = [
	step('simplify.union_empty', 'a(εb)', { before: 'a∪∅', after: 'a' }),
	step('simplify.concat_epsilon', 'ab', { before: 'εb', after: 'b' })
];
const run: SimplifyRun = { text: '(a∪∅)(εb)', regex: 'ab', route: 'plain', trace };

describe('markPart', () => {
	it('cuts the whole in three at the first place of the part', () => {
		expect(markPart('a(εb)', 'a')).toEqual({ before: '', part: 'a', after: '(εb)' });
		expect(markPart('ab*c', 'b*')).toEqual({ before: 'a', part: 'b*', after: 'c' });
	});

	it('marks the first place when the part is there more than once', () => {
		expect(markPart('a∪a', 'a')).toEqual({ before: '', part: 'a', after: '∪a' });
	});

	it('gives null for a part that is not there or is empty', () => {
		expect(markPart('ab', '(a∪b)')).toBeNull();
		expect(markPart('ab', '')).toBeNull();
	});
});

describe('simplifyFrameAt', () => {
	it('has the whole expression after the step, with the new part marked', () => {
		const frame = simplifyFrameAt(run, 1);
		expect(frame.expression).toBe('ab');
		expect(frame.marked).toEqual({ before: 'a', part: 'b', after: '' });
		expect(simplifyFrameAt(run, 0).marked).toEqual({ before: '', part: 'a', after: '(εb)' });
	});

	it('clamps the index, and shows no mark when the part is not found', () => {
		expect(simplifyFrameAt(run, 99).step).toBe(trace[1]);
		expect(simplifyFrameAt(run, -3).step).toBe(trace[0]);
		const odd: SimplifyRun = {
			...run,
			trace: [step('simplify.star_star', 'a*', { before: '(a*)*', after: '(a*)' })]
		};
		expect(simplifyFrameAt(odd, 0).marked).toBeNull();
	});
});

describe('runSimplify', () => {
	const asked: [string, string[]][] = [];
	const through: [string, string[]][] = [];
	const engineOf = (answer: EngineResult<RegexOutcome>): SimplifyEngine => ({
		simplify: async (text, alphabet) => {
			asked.push([text, alphabet]);
			return answer;
		},
		simplifyViaMachine: async (text, alphabet) => {
			through.push([text, alphabet]);
			return answer;
		}
	});
	const done: EngineResult<RegexOutcome> = {
		ok: true,
		value: { result: 'finished', regex: 'ab', trace }
	};

	it('sends the text with the alphabet of the text, and finishes with the steps', async () => {
		asked.length = 0;
		const outcome = await runSimplify(engineOf(done), '(a∪∅)(εb)');
		expect(asked).toEqual([['(a∪∅)(εb)', ['a', 'b']]]);
		expect(outcome).toMatchObject({ kind: 'finished', run: { regex: 'ab', text: '(a∪∅)(εb)' } });
	});

	it('asks the engine for the route through the machine, and keeps the route in the run', async () => {
		asked.length = 0;
		through.length = 0;
		const outcome = await runSimplify(engineOf(done), '(a∪∅)(εb)', 'machine');
		expect(through).toEqual([['(a∪∅)(εb)', ['a', 'b']]]);
		expect(asked).toEqual([]);
		expect(outcome).toMatchObject({ kind: 'finished', run: { route: 'machine', regex: 'ab' } });
		expect(await runSimplify(engineOf(done), 'ab')).toMatchObject({ run: { route: 'plain' } });
	});

	it('never says "unchanged" for the route through the machine, which always has a step', async () => {
		const kept: EngineResult<RegexOutcome> = {
			ok: true,
			value: {
				result: 'finished',
				regex: 'ab',
				trace: [
					{
						message: { key: 'via_machine.kept_original', params: {} },
						change: { kind: 'expression', expression: 'ab' }
					}
				]
			}
		};
		expect(await runSimplify(engineOf(kept), 'ab', 'machine')).toMatchObject({
			kind: 'finished',
			run: { regex: 'ab' }
		});
	});

	it('says "unchanged" when no identity applies', async () => {
		const same: EngineResult<RegexOutcome> = {
			ok: true,
			value: { result: 'finished', regex: 'ab', trace: [] }
		};
		expect(await runSimplify(engineOf(same), 'ab')).toEqual({ kind: 'unchanged' });
	});

	it('does not call the engine for an empty text', async () => {
		asked.length = 0;
		expect(await runSimplify(engineOf(done), ' ')).toMatchObject({
			kind: 'refused',
			key: 'regex.empty'
		});
		expect(asked).toEqual([]);
	});

	it('shows a mistake in the expression with the position from 1, and any other error calmly', async () => {
		const mistake: EngineResult<RegexOutcome> = {
			ok: false,
			error: { key: 'regex.unbalanced_parenthesis', params: { position: 0 } }
		};
		expect(await runSimplify(engineOf(mistake), '(a')).toEqual({
			kind: 'refused',
			key: 'regex.unbalanced_parenthesis',
			params: { position: 1 }
		});
		const other: EngineResult<RegexOutcome> = {
			ok: false,
			error: { key: 'simplify.unknown_symbol', params: { symbol: 3 } }
		};
		expect(await runSimplify(engineOf(other), 'a')).toMatchObject({
			kind: 'refused',
			key: 'convert.failed'
		});
	});

	it('names the reason when the engine stops', async () => {
		const stopped = (reason: 'max_steps' | 'max_checks'): EngineResult<RegexOutcome> => ({
			ok: true,
			value: { result: 'stopped', reason, partialTrace: [] }
		});
		expect(await runSimplify(engineOf(stopped('max_checks')), 'a')).toMatchObject({
			kind: 'stopped',
			key: 'convert.stopped_steps'
		});
	});
});
