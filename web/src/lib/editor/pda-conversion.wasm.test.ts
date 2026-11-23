// The Konversi tab against the real WASM engine (`pnpm build:wasm`): the slides' wcwᴿ (RNF and
// CFG), the expansion fixture F-ONE, the split fixture F-SPLIT and the no-start fixture F-NOSTART.
// The fake-engine cases of the model live in `pda-conversion.test.ts`.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { EngineResult, Grammar, Pda, PdaToCfg, RnfResult } from '../engine/types.ts';
import { pdaDocumentFrom } from './pda-samples.ts';
import { parsePdaDocument, serializePdaDocument, toEnginePda } from './pda-document.ts';
import type { PdaDocument } from './pda-document.ts';
import { wcwrSample } from './pda-samples.ts';
import {
	createPdaConverter,
	grammarText,
	rnfDocument,
	rnfLayout,
	ruleText,
	variableLabels
} from './pda-conversion.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const real = {
	pdaToRnf: async (pda: Pda): Promise<EngineResult<RnfResult>> =>
		JSON.parse(wasm.pdaToRnf(JSON.stringify(pda))) as EngineResult<RnfResult>,
	pdaToCfg: async (pda: Pda): Promise<EngineResult<PdaToCfg>> =>
		JSON.parse(wasm.pdaToCfg(JSON.stringify(pda))) as EngineResult<PdaToCfg>
};

function one(): PdaDocument {
	return pdaDocumentFrom({
		title: 'one',
		kind: 'dpda',
		inputAlphabet: ['a'],
		stackAlphabet: ['A', 'B', 'C'],
		states: [
			[180, 200, 'p'],
			[440, 200, 'q']
		],
		start: 0,
		accepting: [1],
		transitions: [[0, 'a', [], ['A', 'B', 'C'], 1]]
	});
}

function split(): PdaDocument {
	return pdaDocumentFrom({
		title: 'split',
		kind: 'ndpda',
		inputAlphabet: ['a', 'b'],
		stackAlphabet: ['A'],
		states: [
			[180, 200, 'p'],
			[440, 200, 'q']
		],
		start: 0,
		accepting: [1],
		transitions: [[0, 'b', ['A', 'A'], [], 1]]
	});
}

const noStart = (): PdaDocument => ({
	...pdaDocumentFrom({
		title: 'no start',
		kind: 'dpda',
		inputAlphabet: ['a'],
		stackAlphabet: ['A'],
		states: [[180, 200, 'q0']],
		accepting: [0],
		transitions: []
	}),
	start: null
});

function converterFor(doc: PdaDocument) {
	return createPdaConverter({ engine: real, currentDoc: () => doc });
}

const transitionMultiset = (pda: Pda): string[] =>
	pda.transitions.map((transition) => JSON.stringify(transition)).sort();
const ruleMultiset = (grammar: Grammar): string[] =>
	grammar.rules.map((rule) => JSON.stringify(rule)).sort();
const bodyVariables = (grammar: Grammar): string[] =>
	[
		...new Set(
			grammar.rules.flatMap((rule) =>
				rule.body.filter((symbol) => symbol.type === 'nonTerminal').map((symbol) => symbol.value)
			)
		)
	].sort();
const heads = (grammar: Grammar): string[] =>
	[...new Set(grammar.rules.map((rule) => rule.head))].sort();
const headBodyIntersection = (grammar: Grammar): string[] => {
	const headSet = new Set(heads(grammar));
	return bodyVariables(grammar).filter((name) => headSet.has(name));
};

describe('F-WCW: the slides machine', () => {
	it('stage 1 has five steps, and its result is the opened machine', async () => {
		const doc = wcwrSample();
		const converter = converterFor(doc);
		await converter.start(doc);
		const view = converter.view()!;
		expect(view.stage).toBe(1);
		expect(view.total).toBe(5);
		expect(converter.status()).toBe('ready');

		const rnf = await real.pdaToRnf(toEnginePda(doc));
		expect(rnf.ok).toBe(true);
		if (!rnf.ok) return;
		const opened = rnfDocument(doc, rnf.value, 'wcwR (RNF)');
		const back = toEnginePda(opened);
		expect(opened.title).toBe('wcwR (RNF)');
		expect(back.start).toBe(rnf.value.pda.start);
		expect(back.accepting).toEqual(rnf.value.pda.accepting);
		expect(back.states).toEqual(rnf.value.pda.states);
		expect(transitionMultiset(back)).toEqual(transitionMultiset(rnf.value.pda));
		expect(parsePdaDocument(JSON.parse(serializePdaDocument(opened))).ok).toBe(true);

		const layout = rnfLayout(doc, rnf.value);
		expect(layout.find((state) => state.id === 2)).toMatchObject({ x: -80, y: 200 });
		expect(layout.find((state) => state.id === 3)).toMatchObject({ x: 700, y: 200 });
		converter.dispose();
	});

	it('stage 2 runs on the RNF result and reaches 76 rules in 14 steps', async () => {
		const doc = wcwrSample();
		let sent: Pda | undefined;
		const engine = {
			pdaToRnf: real.pdaToRnf,
			pdaToCfg: async (pda: Pda) => {
				sent = pda;
				return real.pdaToCfg(pda);
			}
		};
		const converter = createPdaConverter({ engine, currentDoc: () => doc });
		await converter.start(doc);
		await converter.toGrammar();
		const view = converter.view()!;
		expect(view.stage).toBe(2);
		expect(view.total).toBe(14);
		expect(view.hasCfg).toBe(true);
		expect(view.rules.length).toBe(1);
		expect(sent?.start).not.toBe(toEnginePda(doc).start);

		converter.go(13);
		const last = converter.view()!;
		expect(last.rules.length).toBe(76);
		expect(last.atEnd).toBe(true);
		expect(last.frame.sentence.key).toBe('pda_cfg.push_none');

		const cfg = await real.pdaToCfg(sent!);
		expect(cfg.ok).toBe(true);
		if (!cfg.ok) return;
		const text = grammarText(cfg.value.grammar);
		const parsed = JSON.parse(wasm.parseGrammar(text)) as EngineResult<Grammar>;
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.value.rules.length).toBe(cfg.value.grammar.rules.length);
		expect(ruleMultiset(parsed.value)).toEqual(ruleMultiset(cfg.value.grammar));
		expect(heads(parsed.value)).toEqual(heads(cfg.value.grammar));
		expect(bodyVariables(parsed.value)).toEqual(bodyVariables(cfg.value.grammar));
		expect(headBodyIntersection(parsed.value)).toEqual(headBodyIntersection(cfg.value.grammar));
		expect(headBodyIntersection(parsed.value).length).toBe(20);

		// The check of AC5: the body references the same variables as the engine grammar, not
		// the pretty names (the engine grammar itself has variables that never appear as a head).
		expect(
			bodyVariables(cfg.value.grammar).filter((name) => !heads(cfg.value.grammar).includes(name))
		).toEqual([
			'V_1gep0',
			'V_1gep3',
			'V_3g0p0',
			'V_3g0p1',
			'V_3g0p3',
			'V_3g1p0',
			'V_3g1p1',
			'V_3g1p3',
			'V_3g2p0',
			'V_3g2p1',
			'V_3g2p3',
			'V_3gep0',
			'V_3gep1'
		]);

		const labels = variableLabels(converter.rnfDocument()!, cfg.value);
		expect(ruleText(cfg.value.grammar.rules[0]!, labels)).toBe('S → <q0,#,a>');
		converter.dispose();
	});
});

describe('F-SPLIT', () => {
	it('walks the split step, places v1 below p, and reaches 17 rules in 5 steps', async () => {
		const doc = split();
		const converter = converterFor(doc);
		await converter.start(doc);
		expect(converter.view()!.total).toBe(3);
		converter.go(2);
		expect(converter.view()!.frame.sentence.key).toBe('pda.rnf.split');
		expect(converter.view()!.frame.removed.length).toBe(1);
		expect(converter.view()!.frame.added.length).toBe(2);

		const rnf = await real.pdaToRnf(toEnginePda(doc));
		expect(rnf.ok).toBe(true);
		if (!rnf.ok) return;
		const layout = rnfLayout(doc, rnf.value);
		expect(layout.find((state) => state.id === 4)).toMatchObject({ x: 180, y: 400 });

		await converter.toGrammar();
		const view = converter.view()!;
		expect(view.total).toBe(5);
		converter.go(4);
		expect(converter.view()!.rules.length).toBe(17);
		converter.dispose();
	});
});

describe('F-ONE', () => {
	it('shows the expansion step and its 4 added transitions', async () => {
		const doc = one();
		const converter = converterFor(doc);
		await converter.start(doc);
		expect(converter.view()!.total).toBe(3);
		converter.go(2);
		const frame = converter.view()!.frame;
		expect(frame.sentence.key).toBe('pda.rnf.expand');
		expect(frame.removed.length).toBe(1);
		expect(frame.added.length).toBe(4);
		converter.dispose();
	});
});

describe('F-NOSTART', () => {
	it('shows the calm refusal and no stepper', async () => {
		const doc = noStart();
		const converter = converterFor(doc);
		await converter.start(doc);
		expect(converter.status()).toBe('refused');
		expect(converter.view()).toBeUndefined();
		expect(converter.refusal()?.key).toBe('pda.rnf.no_start_state');
		converter.dispose();
	});
});

describe('stage 2 is refused on the source PDA, not on the RNF result', () => {
	it('the engine refuses the source and accepts the RNF result', async () => {
		const doc = wcwrSample();
		const source = await real.pdaToCfg(toEnginePda(doc));
		expect(source.ok).toBe(false);
		const rnf = await real.pdaToRnf(toEnginePda(doc));
		expect(rnf.ok).toBe(true);
		if (!rnf.ok) return;
		const result = await real.pdaToCfg(rnf.value.pda);
		expect(result.ok).toBe(true);
	});
});
