import { describe, expect, it } from 'vitest';
import { ANSWER_BYTE_LIMIT, answerFileOf, loadAnswer } from './answer.ts';

const solution = { start: 'q0', accepting: ['q1'], transitions: ['q0 0 q1'] };
const good = { schemaVersion: 1, solution };

const respond = (body: string, status = 200) =>
	(async () => new Response(body, { status })) as unknown as typeof fetch;

describe('answerFileOf', () => {
	it('is the version and the solution of a machine question, and nothing else', () => {
		expect(
			answerFileOf({
				type: 'build-dfsm',
				solution,
				examples: { accept: ['1'], reject: ['0'] }
			} as never)
		).toEqual(good);
		expect(
			Object.keys(
				answerFileOf({ type: 'build-ndfsm', solution, hints: [{ id: 'x' }] } as never)!
			).sort()
		).toEqual(['schemaVersion', 'solution']);
	});

	it('is null for a regular expression question, which has no machine to compare yet', () => {
		expect(answerFileOf({ type: 'write-regex', solution: '(0∪1)*' })).toBeNull();
	});
});

describe('loadAnswer', () => {
	it('reads the solution of the answer file', async () => {
		expect(await loadAnswer('/soal/q/jawaban.json', respond(JSON.stringify(good)))).toEqual({
			ok: true,
			value: { solution }
		});
	});

	it('keeps the optional list of states', async () => {
		const withStates = { schemaVersion: 1, solution: { ...solution, states: ['q0', 'q1'] } };
		const result = await loadAnswer('/x', respond(JSON.stringify(withStates)));
		expect(result.ok && result.value.solution.states).toEqual(['q0', 'q1']);
	});

	it('is an error for a file that is missing, not JSON, or not a solution', async () => {
		for (const [name, body, status] of [
			['404', 'not found', 404],
			['not json', '{no', 200],
			['empty', '', 200],
			['an array', '[]', 200],
			['no solution', JSON.stringify({ schemaVersion: 1 }), 200],
			['a newer version', JSON.stringify({ schemaVersion: 2, solution }), 200],
			['a regex', JSON.stringify({ schemaVersion: 1, solution: '(0∪1)*' }), 200],
			['no start', JSON.stringify({ schemaVersion: 1, solution: { ...solution, start: 3 } }), 200],
			[
				'bad transitions',
				JSON.stringify({ schemaVersion: 1, solution: { ...solution, transitions: [1] } }),
				200
			],
			[
				'bad accepting',
				JSON.stringify({ schemaVersion: 1, solution: { ...solution, accepting: 'q1' } }),
				200
			]
		] as const) {
			const result = await loadAnswer('/x', respond(body, status));
			expect(result.ok, name).toBe(false);
			expect(!result.ok && result.error.key, name).toBe('feedback.answer_unusable');
		}
	});

	it('is an error for a file that is too big, before it is parsed', async () => {
		const big = JSON.stringify({ ...good, padding: 'x'.repeat(ANSWER_BYTE_LIMIT) });
		const result = await loadAnswer('/x', respond(big));
		expect(!result.ok && result.error.key).toBe('feedback.answer_unusable');
	});

	it('is an error, and does not throw, when the request fails', async () => {
		const failing = (async () => {
			throw new TypeError('offline');
		}) as unknown as typeof fetch;
		const result = await loadAnswer('/x', failing);
		expect(!result.ok && result.error.key).toBe('feedback.answer_unusable');
	});
});
