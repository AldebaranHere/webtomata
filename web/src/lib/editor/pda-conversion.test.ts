import { describe, expect, it } from 'vitest';
import type {
	EngineResult,
	Grammar,
	Pda,
	PdaCfgStep,
	PdaToCfg,
	RnfResult,
	RnfStep
} from '../engine/types.ts';
import { pdaDocumentsEqual, toEnginePda } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { wcwrSample } from './pda-samples.ts';
import {
	canDraw,
	conversionTitle,
	createPdaConverter,
	grammarText,
	rnfDocument,
	rnfLayout,
	ruleText,
	rulesWindow,
	variableLabels
} from './pda-conversion.ts';

const RNF_TRANSITION = { from: 2, read: null, pop: [], push: ['#'], to: 0 };
const RNF_ACCEPT = { from: 1, read: null, pop: ['#'], push: [], to: 3 };

function rnfResult(): RnfResult {
	const start: RnfStep = {
		removed: null,
		added: [RNF_TRANSITION],
		message: { key: 'pda.rnf.start', params: {} }
	};
	const accept: RnfStep = {
		removed: null,
		added: [RNF_ACCEPT],
		message: { key: 'pda.rnf.accept', params: { state: 1 } }
	};
	const expand: RnfStep = {
		removed: { from: 0, read: 'a', pop: [], push: ['A'], to: 0 },
		added: [{ from: 0, read: 'a', pop: ['A'], push: ['A', 'A'], to: 0 }],
		message: { key: 'pda.rnf.expand', params: { from: 0, to: 0 } }
	};
	return {
		pda: {
			schemaVersion: 1,
			kind: 'ndpda',
			inputAlphabet: ['a', 'b', 'c'],
			stackAlphabet: ['A', 'B', '#'],
			states: [0, 1, 2, 3],
			start: 2,
			accepting: [3],
			transitions: [RNF_TRANSITION, RNF_ACCEPT, expand.added[0]!]
		},
		newStates: [
			{ id: 2, name: "s'" },
			{ id: 3, name: 'a' }
		],
		steps: [start, accept, expand]
	};
}

function splitResult(): RnfResult {
	const start: RnfStep = {
		removed: null,
		added: [{ from: 2, read: null, pop: [], push: ['#'], to: 0 }],
		message: { key: 'pda.rnf.start', params: {} }
	};
	const accept: RnfStep = {
		removed: null,
		added: [{ from: 1, read: null, pop: ['#'], push: [], to: 3 }],
		message: { key: 'pda.rnf.accept', params: { state: 1 } }
	};
	const split: RnfStep = {
		removed: { from: 0, read: 'b', pop: ['A', 'A'], push: [], to: 1 },
		added: [
			{ from: 0, read: null, pop: ['A'], push: [], to: 4 },
			{ from: 4, read: 'b', pop: ['A'], push: [], to: 1 }
		],
		message: { key: 'pda.rnf.split', params: { from: 0, to: 1, pops: 2 } }
	};
	return {
		pda: {
			schemaVersion: 1,
			kind: 'ndpda',
			inputAlphabet: ['a', 'b'],
			stackAlphabet: ['A', '#'],
			states: [0, 1, 2, 3, 4],
			start: 2,
			accepting: [3],
			transitions: [start.added[0]!, accept.added[0]!, ...split.added]
		},
		newStates: [
			{ id: 2, name: "s'" },
			{ id: 3, name: 'a' },
			{ id: 4, name: 'v1' }
		],
		steps: [start, accept, split]
	};
}

function splitSample(): PdaDocument {
	return {
		schemaVersion: 1,
		title: 'split',
		kind: 'ndpda',
		inputAlphabet: ['a', 'b'],
		stackAlphabet: ['A'],
		states: [
			{ id: 0, name: 'p', x: 180, y: 200 },
			{ id: 1, name: 'q', x: 440, y: 200 }
		],
		start: 0,
		accepting: [1],
		transitions: [{ from: 0, read: 'b', pop: ['A', 'A'], push: [], to: 1 }],
		nextStateId: 2
	};
}

function cfgResult(): PdaToCfg {
	const grammar: Grammar = {
		start: 'S',
		rules: [
			{ head: 'S', body: [{ type: 'nonTerminal', value: 'V_0g0p0' }] },
			{
				head: 'V_0g0p0',
				body: [
					{ type: 'terminal', value: 'a' },
					{ type: 'nonTerminal', value: 'V_0g0p0' }
				]
			}
		]
	};
	const steps: PdaCfgStep[] = [
		{
			added: [grammar.rules[0]!],
			message: { key: 'pda_cfg.start', params: {} }
		},
		{
			added: [grammar.rules[1]!],
			message: { key: 'pda_cfg.push_none', params: { from: 0, to: 0 } }
		}
	];
	return {
		grammar,
		variables: [
			{ name: 'V_0g0p0', from: 0, stack: 'A', to: 0 },
			{ name: 'V_0g0p1', from: 0, stack: 'A', to: 1 }
		],
		steps
	};
}

const ok = <T>(value: T): EngineResult<T> => ({ ok: true, value });

function engineOf(options?: {
	rnf?: EngineResult<RnfResult>;
	cfg?: EngineResult<PdaToCfg>;
	onCfg?: (pda: Pda) => void;
}) {
	return {
		pdaToRnf: async () => options?.rnf ?? ok(rnfResult()),
		pdaToCfg: async (pda: Pda) => {
			options?.onCfg?.(pda);
			return options?.cfg ?? ok(cfgResult());
		}
	};
}

describe('rnfLayout', () => {
	it('keeps the source positions and puts s-prime and a 260 units out', () => {
		const layout = rnfLayout(wcwrSample(), rnfResult());
		const at = (id: number) => layout.find((state) => state.id === id)!;
		expect(at(0)).toMatchObject({ id: 0, name: 'q0', x: 180, y: 200 });
		expect(at(1)).toMatchObject({ id: 1, name: 'q1', x: 440, y: 200 });
		expect(at(2)).toMatchObject({ id: 2, name: "s'", x: -80, y: 200 });
		expect(at(3)).toMatchObject({ id: 3, name: 'a', x: 700, y: 200 });
		expect(new Set(layout.map((state) => state.id))).toEqual(new Set([0, 1, 2, 3]));
	});

	it('returns every state of RnfResult.pda, including a split state on a row below', () => {
		const layout = rnfLayout(splitSample(), splitResult());
		const at = (id: number) => layout.find((state) => state.id === id)!;
		expect(at(4)).toMatchObject({ id: 4, name: 'v1', x: 180, y: 400 });
		expect(new Set(layout.map((state) => state.id))).toEqual(new Set([0, 1, 2, 3, 4]));
	});

	it('never puts two states at the same place', () => {
		const layout = rnfLayout(splitSample(), splitResult());
		for (let i = 0; i < layout.length; i++) {
			for (let j = i + 1; j < layout.length; j++) {
				const a = layout[i]!;
				const b = layout[j]!;
				expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.name} and ${b.name}`).toBeGreaterThanOrEqual(
					200
				);
			}
		}
	});
});

describe('the opened RNF machine', () => {
	it('is RnfResult.pda, with the source positions and the new title', () => {
		const source = wcwrSample();
		const result = rnfResult();
		const doc = rnfDocument(source, result, 'wcwR (RNF)');
		expect(doc.title).toBe('wcwR (RNF)');
		expect(doc.states.map((state) => state.id)).toEqual([0, 1, 2, 3]);
		expect(doc.states.find((state) => state.id === 2)).toMatchObject({
			name: "s'",
			x: -80,
			y: 200
		});
		expect(doc.states.find((state) => state.id === 3)).toMatchObject({ name: 'a', x: 700, y: 200 });
		expect(doc.start).toBe(result.pda.start);
		expect(doc.accepting).toEqual(result.pda.accepting);
		expect(doc.transitions.length).toBe(result.pda.transitions.length);
		expect(toEnginePda(doc).states).toEqual(result.pda.states);
	});

	it('leaves the source document untouched', async () => {
		const source = wcwrSample();
		const before = JSON.stringify(source);
		const converter = createPdaConverter({ engine: engineOf(), currentDoc: () => source });
		await converter.start(source);
		await converter.toGrammar();
		expect(JSON.stringify(source)).toBe(before);
		expect(pdaDocumentsEqual(source, wcwrSample())).toBe(true);
		converter.dispose();
	});
});

describe('grammar text and rule text', () => {
	it('writes one line per head, start first, and keeps every rule', () => {
		const text = grammarText(cfgResult().grammar);
		expect(text).toBe('S -> V_0g0p0\nV_0g0p0 -> a V_0g0p0');
	});

	it('writes an empty body as epsilon', () => {
		const grammar: Grammar = {
			start: 'S',
			rules: [
				{ head: 'S', body: [] },
				{ head: 'S', body: [{ type: 'terminal', value: 'a' }] }
			]
		};
		expect(grammarText(grammar)).toBe('S -> ε | a');
	});

	it('names a variable from PdaToCfg.variables and the state names', () => {
		const source = wcwrSample();
		const result = rnfResult();
		const doc = rnfDocument(source, result, '');
		const cfg = cfgResult();
		const labels = variableLabels(doc, cfg);
		expect(labels('V_0g0p0')).toBe('<q0,A,q0>');
		expect(labels('V_0g0p1')).toBe('<q0,A,q1>');
		expect(labels('S')).toBe('S');
		expect(ruleText(cfg.grammar.rules[0]!, labels)).toBe('S → <q0,A,q0>');
		expect(ruleText({ head: 'V_0g0p0', body: [] }, labels)).toBe('<q0,A,q0> → ε');
	});

	it('shows the engine name when the variable is not in the result', () => {
		const labels = variableLabels(rnfDocument(wcwrSample(), rnfResult(), ''), cfgResult());
		expect(labels('V_9g9p9')).toBe('V_9g9p9');
	});
});

describe('titles and the canvas limit', () => {
	it('clamps the base so the whole title fits the document limit', () => {
		const title = conversionTitle('x'.repeat(100), 'RNF', 'Untitled');
		expect(title.length).toBeLessThanOrEqual(100);
		expect(title.endsWith(' (RNF)')).toBe(true);
		expect(title.startsWith('x')).toBe(true);
	});

	it('uses the fallback when the source title is empty', () => {
		expect(conversionTitle('   ', 'CFG', 'Untitled')).toBe('Untitled (CFG)');
	});

	it('draws only a result of at most 30 states and 150 transitions', () => {
		expect(canDraw(30, 150)).toBe(true);
		expect(canDraw(31, 150)).toBe(false);
		expect(canDraw(30, 151)).toBe(false);
	});
});

describe('the 50-row window', () => {
	const rules = (count: number) =>
		Array.from({ length: count }, (_, i): Grammar['rules'][number] => ({
			head: `V${i}`,
			body: []
		}));

	it('shows 49 and 50 rows in full and windows 51', () => {
		expect(rulesWindow(rules(49))).toEqual({ shown: rules(49), hidden: 0 });
		expect(rulesWindow(rules(50))).toEqual({ shown: rules(50), hidden: 0 });
		const window = rulesWindow(rules(51));
		expect(window.hidden).toBe(1);
		expect(window.shown.length).toBe(50);
		expect(window.shown[0]!.head).toBe('V1');
	});
});

describe('the converter', () => {
	it('starts stage 1, walks its steps, and leaves stage 2 disabled until it has a result', async () => {
		const source = wcwrSample();
		const converter = createPdaConverter({ engine: engineOf(), currentDoc: () => source });
		await converter.start(source);
		const first = converter.view()!;
		expect(first.stage).toBe(1);
		expect(first.total).toBe(3);
		expect(first.hasRnf).toBe(true);
		expect(first.hasCfg).toBe(false);
		expect(first.frame.sentence).toEqual({ key: 'pda.rnf.start', params: {} });
		expect(first.canvas?.doc?.states.length).toBe(4);
		converter.toStage(2);
		expect(converter.view()!.stage).toBe(1);
		converter.play();
		expect(converter.view()!.playing).toBe(true);
		converter.pause();
		expect(converter.view()!.playing).toBe(false);
		converter.go(2);
		expect(converter.view()!.frame.sentence.key).toBe('pda.rnf.expand');
		expect(converter.view()!.atEnd).toBe(true);
		converter.dispose();
	});

	it('maps the numeric state of a step sentence to the state name', async () => {
		const source = wcwrSample();
		const converter = createPdaConverter({ engine: engineOf(), currentDoc: () => source });
		await converter.start(source);
		converter.go(1);
		expect(converter.view()!.frame.sentence).toEqual({
			key: 'pda.rnf.accept',
			params: { state: 'q1' }
		});
		converter.dispose();
	});

	it('runs stage 2 on the RNF result and shows its rules', async () => {
		const source = wcwrSample();
		let sent: Pda | undefined;
		const converter = createPdaConverter({
			engine: engineOf({ onCfg: (pda) => (sent = pda) }),
			currentDoc: () => source
		});
		await converter.start(source);
		await converter.toGrammar();
		const view = converter.view()!;
		expect(view.stage).toBe(2);
		expect(view.total).toBe(2);
		expect(view.hasCfg).toBe(true);
		expect(view.rules).toEqual([cfgResult().grammar.rules[0]]);
		converter.go(1);
		expect(converter.view()!.rules).toEqual(cfgResult().grammar.rules);
		expect(view.frame.sentence.key).toBe('pda_convert.start_rule');
		expect(sent?.states).toEqual([0, 1, 2, 3]);
		expect(sent?.start).toBe(2);
		converter.dispose();
	});

	it('keeps stage 1 visible when stage 2 is refused', async () => {
		const source = wcwrSample();
		const converter = createPdaConverter({
			engine: engineOf({
				cfg: { ok: false, error: { key: 'pda_cfg.terminal_not_readable', params: { symbol: 'A' } } }
			}),
			currentDoc: () => source
		});
		await converter.start(source);
		await converter.toGrammar();
		expect(converter.view()!.stage).toBe(1);
		expect(converter.stage2Refusal()).toEqual({
			key: 'pda_cfg.terminal_not_readable',
			params: { symbol: 'A' }
		});
		expect(converter.view()!.hasCfg).toBe(false);
		converter.dispose();
	});

	it('shows a refusal and no stepper', async () => {
		const source = wcwrSample();
		const converter = createPdaConverter({
			engine: engineOf({
				rnf: { ok: false, error: { key: 'pda.rnf.no_start_state', params: {} } }
			}),
			currentDoc: () => source
		});
		await converter.start(source);
		expect(converter.status()).toBe('refused');
		expect(converter.view()).toBeUndefined();
		expect(converter.refusal()?.key).toBe('pda.rnf.no_start_state');
		converter.dispose();
	});

	it('drops an RNF answer that arrives after close', async () => {
		const source = wcwrSample();
		let resolve: (value: EngineResult<RnfResult>) => void = () => {};
		const engine = {
			pdaToRnf: () => new Promise<EngineResult<RnfResult>>((done) => (resolve = done)),
			pdaToCfg: async () => ok(cfgResult())
		};
		const converter = createPdaConverter({ engine, currentDoc: () => source });
		const pending = converter.start(source);
		converter.close();
		resolve(ok(rnfResult()));
		await pending;
		expect(converter.view()).toBeUndefined();
		expect(converter.status()).toBe('idle');
		converter.dispose();
	});

	it('drops an RNF answer that arrives after the document changed', async () => {
		const source = wcwrSample();
		let current = source;
		let resolve: (value: EngineResult<RnfResult>) => void = () => {};
		const engine = {
			pdaToRnf: () => new Promise<EngineResult<RnfResult>>((done) => (resolve = done)),
			pdaToCfg: async () => ok(cfgResult())
		};
		const converter = createPdaConverter({ engine, currentDoc: () => current });
		const pending = converter.start(source);
		current = { ...source, title: 'edited' };
		resolve(ok(rnfResult()));
		await pending;
		expect(converter.view()).toBeUndefined();
		converter.dispose();
	});

	it('opens the RNF document and the grammar text of the finished run', async () => {
		const source = wcwrSample();
		const converter = createPdaConverter({ engine: engineOf(), currentDoc: () => source });
		await converter.start(source);
		const doc = converter.rnfDocument('opened');
		expect(doc?.title).toBe('opened');
		expect(doc?.states.length).toBe(4);
		await converter.toGrammar();
		expect(converter.grammarText()).toBe(grammarText(cfgResult().grammar));
		converter.dispose();
	});
});
