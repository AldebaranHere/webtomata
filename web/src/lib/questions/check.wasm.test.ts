// The checks that need the engine, against the real WASM module (build it with `pnpm build:wasm`).
// Like document.wasm.test.ts, this is one of the tests that import the module.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import { createSyncEngine } from '../engine/handlers.ts';
import type { EngineApi } from '../engine/protocol.ts';
import { acceptedStrings, checkQuestion, stringsInProperOrder } from './check.ts';
import { createSchemaValidator, parseQuestionFile } from './load.ts';
import { BASE, KITCHEN_SINK_DFSM, KITCHEN_SINK_NDFSM } from './testing.ts';
import type { Question } from './types.ts';

let engine: EngineApi;
let schema: ReturnType<typeof createSchemaValidator>;

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
	engine = createSyncEngine(wasm);
	schema = createSchemaValidator(
		JSON.parse(
			readFileSync(new URL('../../../../content/questions/schema.json', import.meta.url), 'utf8')
		)
	);
});

/** The base question with some text replaced. It must still pass the schema. */
function question(...edits: [string, string][]): Question {
	let text = BASE;
	for (const [from, to] of edits) {
		if (!text.includes(from)) throw new Error(`the base has no "${from}"`);
		text = text.replace(from, to);
	}
	const { question: parsed, problems } = parseQuestionFile(text, schema);
	if (!parsed) throw new Error(`the test question is not valid: ${JSON.stringify(problems)}`);
	return parsed;
}

/** The base question as a write-regex question with this solution. */
function regexQuestion(solution: string): Question {
	const text = BASE.replace('type: build-dfsm', 'type: write-regex').replace(
		/solution:[\s\S]*$/,
		`solution: ${JSON.stringify(solution)}\n`
	);
	const { question: parsed, problems } = parseQuestionFile(text, schema);
	if (!parsed) throw new Error(`the test question is not valid: ${JSON.stringify(problems)}`);
	return parsed;
}

const check = (q: Question) => checkQuestion(q, engine).map((p) => `${p.path}: ${p.message}`);

describe('a question that is right', () => {
	it('has no problem (a DFSM, an NDFSM with ε, a regular expression)', () => {
		expect(check(question())).toEqual([]);
		const ndfsm = question(
			['type: build-dfsm', 'type: build-ndfsm'],
			[/q0 0 q0[\s\S]*q2 1 q1/.exec(BASE)![0], 'q0 ε q1\n    - q1 0,1 q2\n    - q2 0 q2'],
			['accept: [10, 0110]', 'accept: [0, 1]'],
			['reject: ["", 01]', 'reject: ["", 11]']
		);
		expect(check(ndfsm)).toEqual([]);
		expect(check(regexQuestion('(0∪1)*10'))).toEqual([]);
	});

	it('is also the case for the questions that have every field (the samples of the schema test)', () => {
		for (const sample of [KITCHEN_SINK_DFSM, KITCHEN_SINK_NDFSM]) {
			expect(check(sample as Question), sample.id).toEqual([]);
		}
	});

	it('is also the case for the template, whose examples and solution agree', () => {
		const text = readFileSync(
			new URL('../../../../content/questions/_template.yaml', import.meta.url),
			'utf8'
		);
		const { question: template } = parseQuestionFile(text, schema);
		expect(check(template!)).toEqual([]);
	});

	it('takes ε and the empty string as the same example', () => {
		const q = question();
		q.examples.reject = ['ε', '01'];
		expect(check(q)).toEqual([]);
	});
});

describe('the machine of the solution', () => {
	it('says which transition is missing in a DFSM, by the names of the states', () => {
		const q = question(['    - q1 0 q2\n', '']);
		expect(check(q)).toContain('solution: the state q1 has no transition on 0');
	});

	it('accepts a missing transition when the question says complete: false', () => {
		const q = question(
			['    - q1 0 q2\n', ''],
			['pattern: berakhiran-x\n', 'pattern: berakhiran-x\nconstraints:\n  complete: false\n']
		);
		// The answer is partial, so the example "10" no longer reaches the accepting state.
		q.examples.accept = ['0110', '1110'].map((s) => s);
		expect(check(q).filter((p) => p.includes('no transition'))).toEqual([]);
	});

	it('says that a DFSM has two transitions on one symbol', () => {
		const q = question(['    - q1 1 q1\n', '    - q1 1 q1\n    - q1 1 q2\n']);
		expect(check(q).some((p) => p.includes('more than one transition on 1'))).toBe(true);
	});

	it('says that a DFSM has an ε-transition', () => {
		const q = question(['    - q1 1 q1\n', '    - q1 ε q1\n    - q1 1 q1\n']);
		expect(check(q).some((p) => p.includes('ε-transition'))).toBe(true);
	});

	it('says which state cannot be reached', () => {
		const q = question(['  start: q0\n', '  states: [q0, q1, q2, q9]\n  start: q0\n']);
		const found = check(q);
		expect(found).toContain('solution: the state q9 cannot be reached from the start state');
	});

	it('passes on the problems of the short form, with their path', () => {
		const q = question(['q0 0 q0', 'q0 2 q0']);
		expect(check(q)).toEqual([
			'solution.transitions[0]: the symbol "2" is not in the alphabet (0, 1)'
		]);
	});
});

describe('the constraints', () => {
	const constraints = (lines: string) =>
		question(['pattern: berakhiran-x\n', `pattern: berakhiran-x\nconstraints:\n${lines}`]);

	it('maxStates: says how many states there are', () => {
		expect(check(constraints('  maxStates: 2\n'))).toEqual([
			'solution: the solution has 3 states, but maxStates is 2'
		]);
		expect(check(constraints('  maxStates: 3\n'))).toEqual([]);
	});

	it('minimal: says how many states the minimal DFSM has', () => {
		// "ends with 10" needs three states, so the base solution is minimal.
		expect(check(constraints('  minimal: true\n'))).toEqual([]);
		// The same language with a state that repeats q0: four states, three needed.
		const padded = question(
			['pattern: berakhiran-x\n', 'pattern: berakhiran-x\nconstraints:\n  minimal: true\n'],
			['    - q2 0 q0\n', '    - q2 0 q3\n    - q3 0 q3\n    - q3 1 q1\n']
		);
		padded.solution = {
			...(padded.solution as object),
			transitions: [
				'q0 0 q0',
				'q0 1 q1',
				'q1 0 q2',
				'q1 1 q1',
				'q2 0 q3',
				'q2 1 q1',
				'q3 0 q3',
				'q3 1 q1'
			]
		} as Question['solution'];
		padded.solution = { ...(padded.solution as object), accepting: ['q2'] } as Question['solution'];
		expect(check(padded)).toEqual([
			'solution: the solution has 4 states, but the minimal DFSM has 3'
		]);
	});

	it('allowEpsilon: false refuses an ε-transition in an NDFSM', () => {
		const q = question(
			['type: build-dfsm', 'type: build-ndfsm'],
			['pattern: berakhiran-x\n', 'pattern: berakhiran-x\nconstraints:\n  allowEpsilon: false\n'],
			['    - q1 1 q1\n', '    - q1 1 q1\n    - q1 ε q0\n']
		);
		expect(check(q)).toContain(
			'solution.transitions[4]: the question does not allow ε-transitions'
		);
	});
});

describe('a regular expression', () => {
	const regex = (text: string) => check(regexQuestion(text));

	it('says where the expression has a mistake', () => {
		expect(regex('(0∪1')[0]).toContain('solution: the regular expression');
		expect(regex('(0∪1')[0]).toContain('position');
	});

	it('says that a symbol is not in the alphabet', () => {
		expect(regex('(0∪2)*')[0]).toContain('"2"');
	});

	it('checks the examples against the language of the expression', () => {
		expect(regex('(0∪1)*1')).toContain(
			'examples.accept[0]: "10" is rejected by the solution, but the question says it must be accepted'
		);
	});
});

describe('the examples', () => {
	it('says which example to accept is rejected, and which to reject is accepted', () => {
		const q = question();
		q.examples = { accept: ['10', '11'], reject: ['110', '01'] };
		expect(check(q)).toEqual([
			'examples.accept[1]: "11" is rejected by the solution, but the question says it must be accepted',
			'examples.reject[0]: "110" is accepted by the solution, but the question says it must be rejected'
		]);
	});

	it('says which example has a symbol that is not in the alphabet', () => {
		const q = question();
		q.examples = { accept: ['10', '1x0'], reject: ['01', '0'] };
		const found = check(q);
		expect(found).toHaveLength(1);
		expect(found[0]).toContain('examples.accept[1]');
		expect(found[0]).toContain('"x"');
	});

	it('does not run the examples when the machine itself is wrong', () => {
		const q = question(['q0 0 q0', 'q0 2 q0']);
		q.examples = { accept: ['11', '12'], reject: ['10', '0'] };
		expect(check(q)).toHaveLength(1);
	});
});

describe('when the engine cannot answer', () => {
	it('is a problem, and not a pass, when minimize stops (it could not be verified)', () => {
		const fake: EngineApi = {
			...engine,
			minimize: () => ({
				ok: true,
				value: { result: 'stopped', reason: 'max_steps', partialTrace: [] }
			})
		};
		const q = question([
			'pattern: berakhiran-x\n',
			'pattern: berakhiran-x\nconstraints:\n  minimal: true\n'
		]);
		const found = checkQuestion(q, fake).map((p) => p.message);
		expect(found).toEqual([
			'the engine stopped before it could tell whether the solution is minimal (max_steps)'
		]);
	});

	it('is a problem when simulate stops', () => {
		const fake: EngineApi = {
			...engine,
			simulate: () => ({
				ok: true,
				value: {
					input: [],
					simulation: { result: 'stopped', reason: 'max_steps', partialTrace: [] }
				}
			})
		};
		const found = checkQuestion(question(), fake);
		expect(found).toHaveLength(4);
		expect(found[0]!.message).toContain('too long to check');
	});
});

describe('the report', () => {
	it('lists the strings in proper order: by length, then in the order of the alphabet', () => {
		expect(stringsInProperOrder(['0', '1'], 3, 100).map((s) => s.join(''))).toEqual([
			'',
			'0',
			'1',
			'00',
			'01',
			'10',
			'11',
			'000',
			'001',
			'010',
			'011',
			'100',
			'101',
			'110',
			'111'
		]);
	});

	it('stops at the cap', () => {
		expect(stringsInProperOrder(['a', 'b', 'c'], 10, 20)).toHaveLength(20);
	});

	it('lists the accepted strings of the solution, shortest first', () => {
		const q = question();
		expect(acceptedStrings(q, engine, { maxLength: 4, cap: 200, limit: 5 })).toEqual({
			accepted: ['10', '010', '110', '0010', '0110'],
			checked: 22
		});
	});

	it('writes ε for the empty string', () => {
		const q = question();
		q.solution = (q.solution as { start: string }) && {
			start: 'a',
			accepting: ['a'],
			transitions: ['a 0,1 a']
		};
		expect(acceptedStrings(q, engine, { maxLength: 1, cap: 10, limit: 2 }).accepted).toEqual([
			'ε',
			'0'
		]);
	});

	it('separates multi-character symbols by a space, as the engine reads them', () => {
		const q = question(['alphabet: [0, 1]', 'alphabet: [num, plus]']);
		q.solution = {
			start: 'a',
			accepting: ['b'],
			transitions: ['a num b', 'a plus a', 'b num b', 'b plus b']
		};
		q.examples = { accept: ['num', 'plus num'], reject: ['plus', ''] };
		expect(check(q)).toEqual([]);
		expect(acceptedStrings(q, engine, { maxLength: 2, cap: 20, limit: 3 }).accepted).toEqual([
			'num',
			'num num',
			'num plus'
		]);
	});
});

describe('the result is the same every time', () => {
	it('gives the same problems in the same order', () => {
		const q = question();
		q.examples = { accept: ['11', '12'], reject: ['110', '1x'] };
		expect(JSON.stringify(checkQuestion(q, engine))).toBe(JSON.stringify(checkQuestion(q, engine)));
	});
});
