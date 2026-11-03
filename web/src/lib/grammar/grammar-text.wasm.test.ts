import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import { createSyncEngine } from '../engine/handlers.ts';
import type { EngineApi } from '../engine/protocol.ts';
import type { Grammar, Production, Symbol } from '../engine/types.ts';
import { GRAMMAR_PRESETS } from './presets.ts';
import { grammarToText } from './grammar-text.ts';

let engine: EngineApi;

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
	engine = createSyncEngine(wasm);
});

function rulesEqual(r1: Production[], r2: Production[]): boolean {
	if (r1.length !== r2.length) return false;
	const format = (r: Production) =>
		`${r.head}->${r.body.map((s) => `${s.type}:${s.value}`).join(',')}`;
	const s1 = r1.map(format).sort();
	const s2 = r2.map(format).sort();
	return s1.every((v, i) => v === s2[i]);
}

/** Simple deterministic Pseudo-Random Number Generator (Linear Congruential Generator). */
function createLcg(seed = 1337) {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

describe('grammar-text.wasm round-trip (AC2 & AC5)', () => {
	describe('presets direct and CNF round-trip', () => {
		for (const preset of GRAMMAR_PRESETS) {
			it(`round-trips preset ${preset.id} directly`, () => {
				const parseRes = engine.parseGrammar(preset.grammar);
				expect(parseRes.ok).toBe(true);
				if (!parseRes.ok) return;

				const orig = parseRes.value;
				// Production default path uses ε by default
				const text = grammarToText(orig);
				const round = engine.parseGrammar(text);
				expect(round.ok).toBe(true);
				if (round.ok) {
					expect(round.value.start).toBe(orig.start);
					expect(rulesEqual(round.value.rules, orig.rules)).toBe(true);
				}
			});

			if (preset.id !== 'CFG_PAREN') {
				it(`round-trips CNF result of preset ${preset.id}`, () => {
					for (const shareHelpers of [false, true]) {
						const cnfRes = engine.transformToCnf(preset.grammar, shareHelpers);
						expect(cnfRes.ok).toBe(true);
						if (!cnfRes.ok) return;

						const cnf = cnfRes.value.finalGrammar;
						const text = grammarToText(cnf);
						const round = engine.parseGrammar(text);
						expect(round.ok).toBe(true);
						if (round.ok) {
							expect(round.value.start).toBe(cnf.start);
							expect(rulesEqual(round.value.rules, cnf.rules)).toBe(true);
						}
					}
				});
			}
		}

		it.fails('round-trips CNF result of CFG_PAREN (known until T-026)', () => {
			// known until T-026: Phase 5 helper variable T_( contains non-alphanumeric char
			// which crates/engine-core/src/grammar/parser.rs rejects on the RHS.
			const preset = GRAMMAR_PRESETS.find((p) => p.id === 'CFG_PAREN')!;
			const cnfRes = engine.transformToCnf(preset.grammar, false);
			expect(cnfRes.ok).toBe(true);
			if (!cnfRes.ok) return;

			const cnf = cnfRes.value.finalGrammar;
			const text = grammarToText(cnf);
			const round = engine.parseGrammar(text);
			expect(round.ok).toBe(true);
			if (!round.ok) return;
			expect(rulesEqual(round.value.rules, cnf.rules)).toBe(true);
		});
	});

	describe('seeded generator: 200 random grammars round-trip', () => {
		it('preserves start symbol and rule sets across 200 seeded grammars using default grammarToText', () => {
			const rand = createLcg(42);
			const nonTerminals = ['S', 'A', 'B', 'C', 'S0', 'T_a', 'X1', 'X10'];
			const terminals = ['a', 'b', 'c', '0', '1'];

			for (let i = 0; i < 200; i++) {
				const start = 'S';
				const rules: Production[] = [];
				const heads = [start, ...nonTerminals.slice(1, 2 + Math.floor(rand() * 4))];

				for (const head of heads) {
					const altCount = 1 + Math.floor(rand() * 3);
					for (let a = 0; a < altCount; a++) {
						const bodyLen = Math.floor(rand() * 4); // 0 to 3 symbols
						const body: Symbol[] = [];
						for (let b = 0; b < bodyLen; b++) {
							if (rand() < 0.5) {
								const nt = nonTerminals[Math.floor(rand() * nonTerminals.length)]!;
								body.push({ type: 'nonTerminal', value: nt });
							} else {
								const t = terminals[Math.floor(rand() * terminals.length)]!;
								body.push({ type: 'terminal', value: t });
							}
						}
						rules.push({ head, body });
					}
				}

				const grammar: Grammar = { start, rules };
				// Default grammarToText() with no extra arguments writes ε for empty bodies
				const text = grammarToText(grammar);
				const roundRes = engine.parseGrammar(text);

				expect(roundRes.ok).toBe(true);
				if (roundRes.ok) {
					expect(roundRes.value.start).toBe(grammar.start);
					expect(rulesEqual(roundRes.value.rules, grammar.rules)).toBe(true);
				}
			}
		});
	});

	describe('CNF idempotence (AC5)', () => {
		const idempotentPresets = [
			'CNF_ORDER',
			'CNF_NULLABLE',
			'CNF_START_LONG',
			'CNF_UNIT_CHAIN',
			'CNF_SHARED_TAIL',
			'CFG_PAL',
			'CFG_ANBN',
			'CFG_EQ'
		];

		for (const presetId of idempotentPresets) {
			it(`is idempotent on preset ${presetId}`, () => {
				const preset = GRAMMAR_PRESETS.find((p) => p.id === presetId)!;
				const cnf1 = engine.transformToCnf(preset.grammar, false);
				expect(cnf1.ok).toBe(true);
				if (!cnf1.ok) return;

				const text = grammarToText(cnf1.value.finalGrammar);
				const cnf2 = engine.transformToCnf(text, false);
				expect(cnf2.ok).toBe(true);
				if (!cnf2.ok) return;

				expect(cnf2.value.finalGrammar.start).toBe(cnf1.value.finalGrammar.start);
				expect(rulesEqual(cnf2.value.finalGrammar.rules, cnf1.value.finalGrammar.rules)).toBe(true);
			});
		}

		it.fails('is idempotent on preset CFG_PAREN (known until T-026)', () => {
			// known until T-026: Phase 5 helper variable T_( contains non-alphanumeric char
			// which crates/engine-core/src/grammar/parser.rs rejects on the RHS.
			const preset = GRAMMAR_PRESETS.find((p) => p.id === 'CFG_PAREN')!;
			const cnf1 = engine.transformToCnf(preset.grammar, false);
			expect(cnf1.ok).toBe(true);
			if (!cnf1.ok) return;

			const text = grammarToText(cnf1.value.finalGrammar);
			const cnf2 = engine.transformToCnf(text, false);
			expect(cnf2.ok).toBe(true);
			if (!cnf2.ok) return;

			expect(cnf2.value.finalGrammar.start).toBe(cnf1.value.finalGrammar.start);
			expect(rulesEqual(cnf2.value.finalGrammar.rules, cnf1.value.finalGrammar.rules)).toBe(true);
		});
	});
});
