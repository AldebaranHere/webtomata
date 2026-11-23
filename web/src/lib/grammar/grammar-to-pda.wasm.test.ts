import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import { createSyncEngine } from '../engine/handlers.ts';
import type { EngineApi } from '../engine/protocol.ts';
import {
	parsePdaDocument,
	serializePdaDocument,
	type PdaTransitionEntry
} from '../editor/pda-document.ts';
import { transitionLabel } from '../editor/diagram/pda-diagram.ts';
import {
	buildConvertedPdaDocument,
	formatStepTransition,
	showBottomUpEpsilonNote
} from './grammar-to-pda.ts';

let engine: EngineApi;

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
	engine = createSyncEngine(wasm);
});

const F_ANBN = 'S -> a S b | ε';
const F_EXPR = 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | x';
const F_BAD_CLASH = 'S -> a<a>';
const F_BAD_LONG = `S -> ${'a'.repeat(65)}`;

function transitionKey(t: PdaTransitionEntry): string {
	return `${t.from}|${t.read ?? ''}|${t.pop.join(',')}|${t.push.join(',')}|${t.to}`;
}

describe('grammar-to-pda.wasm (real engine)', () => {
	it('converts F-ANBN top-down: 5 transitions, valid PdaDocument, exact transition multiset (B3, B4)', () => {
		const res = engine.cfgToPdaTopdown(F_ANBN);
		expect(res.ok).toBe(true);
		if (!res.ok) return;

		expect(res.value.states).toEqual([
			{ id: 0, name: 'p' },
			{ id: 1, name: 'q' }
		]);
		expect(res.value.steps).toHaveLength(5);
		expect(res.value.pda.transitions).toHaveLength(5);

		const doc = buildConvertedPdaDocument(res.value, 'a^n b^n (PDA atas-bawah)');
		const parsed = parsePdaDocument(JSON.parse(serializePdaDocument(doc)));
		expect(parsed.ok).toBe(true);

		// Every step's transition matches the engine's pda.transitions as a multiset (Flaw 5)
		const stepKeys = res.value.steps.map((s) => transitionKey(s.transition)).sort();
		const pdaKeys = res.value.pda.transitions.map(transitionKey).sort();
		const docKeys = doc.transitions.map(transitionKey).sort();
		expect(stepKeys).toEqual(pdaKeys);
		expect(docKeys).toEqual(pdaKeys);

		// States positioned without overlap
		expect(doc.states[0]).toEqual({ id: 0, name: 'p', x: 200, y: 220 });
		expect(doc.states[1]).toEqual({ id: 1, name: 'q', x: 620, y: 220 });

		// Step labels use PDA diagram slash notation
		const rows = res.value.steps.map((s, i) =>
			formatStepTransition(doc, res.value.states, s.transition, i)
		);
		expect(rows.map((r) => r.label)).toEqual([
			'ε / ε / S',
			'ε / S / aSb',
			'ε / S / ε',
			'a / a / ε',
			'b / b / ε'
		]);
	});

	it('converts F-ANBN bottom-up: 5 transitions, valid PdaDocument, ε-note applies (B3, B6)', () => {
		const parsedGrammar = engine.parseGrammar(F_ANBN);
		expect(parsedGrammar.ok).toBe(true);
		if (!parsedGrammar.ok) return;
		expect(showBottomUpEpsilonNote('bottomup', parsedGrammar.value)).toBe(true);
		expect(showBottomUpEpsilonNote('topdown', parsedGrammar.value)).toBe(false);

		const res = engine.cfgToPdaBottomup(F_ANBN);
		expect(res.ok).toBe(true);
		if (!res.ok) return;

		expect(res.value.steps).toHaveLength(5);
		expect(res.value.pda.transitions).toHaveLength(5);

		const doc = buildConvertedPdaDocument(res.value, 'a^n b^n (PDA bawah-atas)');
		const stepKeys = res.value.steps.map((s) => transitionKey(s.transition)).sort();
		const pdaKeys = res.value.pda.transitions.map(transitionKey).sort();
		const docKeys = doc.transitions.map(transitionKey).sort();
		expect(stepKeys).toEqual(pdaKeys);
		expect(docKeys).toEqual(pdaKeys);

		const rows = res.value.steps.map((s, i) =>
			formatStepTransition(doc, res.value.states, s.transition, i)
		);
		expect(rows.map((r) => r.label)).toEqual([
			'a / ε / a',
			'b / ε / b',
			'ε / bSa / S',
			'ε / ε / S',
			'ε / S / ε'
		]);
	});

	it('converts F-EXPR in both methods with operators and multi-symbol pushes', () => {
		for (const method of ['topdown', 'bottomup'] as const) {
			const res =
				method === 'topdown' ? engine.cfgToPdaTopdown(F_EXPR) : engine.cfgToPdaBottomup(F_EXPR);
			expect(res.ok).toBe(true);
			if (!res.ok) return;

			const doc = buildConvertedPdaDocument(res.value, `Expr (${method})`);
			const parsed = parsePdaDocument(JSON.parse(serializePdaDocument(doc)));
			expect(parsed.ok).toBe(true);
			expect(doc.transitions).toHaveLength(res.value.pda.transitions.length);

			for (const step of res.value.steps) {
				const label = transitionLabel(doc, step.transition);
				expect(label).toContain(' / ');
			}
		}
	});

	it('refuses F-BAD (symbol clash and 65-symbol RHS limit) cleanly in both methods', () => {
		for (const method of ['topdown', 'bottomup'] as const) {
			const call = method === 'topdown' ? engine.cfgToPdaTopdown : engine.cfgToPdaBottomup;

			const clash = call(F_BAD_CLASH);
			expect(clash.ok).toBe(false);
			if (clash.ok) throw new Error('expected symbol_clash refusal');
			expect(clash.error.key).toBe('pda.cfg.symbol_clash');
			expect(clash.error.params.symbol).toBe('a');

			const tooLong = call(F_BAD_LONG);
			expect(tooLong.ok).toBe(false);
			if (tooLong.ok) throw new Error('expected limit_exceeded refusal');
			expect(tooLong.error.key).toBe('machine.limit_exceeded');
			expect(tooLong.error.params.what).toBe('pda_string');
			expect(tooLong.error.params.limit).toBe(64);
		}
	});
});
