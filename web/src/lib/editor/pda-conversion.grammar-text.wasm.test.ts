// R3 of T-071: `grammarText` in `pda-conversion.ts` is one line over `grammarToText` in
// `grammar/grammar-text.ts`, which owns the format. The two names must not drift, so this test
// holds them together on the slides' wcwᴿ grammar from the real engine (RNF then CFG), on the nine
// grammar presets, and on a grammar whose body is empty.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { EngineResult, Grammar, PdaToCfg, RnfResult } from '../engine/types.ts';
import { grammarToText } from '../grammar/grammar-text.ts';
import { GRAMMAR_PRESETS } from '../grammar/presets.ts';
import { toEnginePda } from './pda-document.ts';
import { grammarText } from './pda-conversion.ts';
import { wcwrSample } from './pda-samples.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const parse = (text: string): EngineResult<Grammar> =>
	JSON.parse(wasm.parseGrammar(text)) as EngineResult<Grammar>;

describe('the two names for a grammar as text', () => {
	it('give the same text for the slides’ wcwᴿ grammar (76 rules from the real engine)', async () => {
		const rnf = JSON.parse(
			wasm.pdaToRnf(JSON.stringify(toEnginePda(wcwrSample())))
		) as EngineResult<RnfResult>;
		expect(rnf.ok).toBe(true);
		if (!rnf.ok) return;
		const cfg = JSON.parse(wasm.pdaToCfg(JSON.stringify(rnf.value.pda))) as EngineResult<PdaToCfg>;
		expect(cfg.ok).toBe(true);
		if (!cfg.ok) return;

		const text = grammarText(cfg.value.grammar);
		expect(cfg.value.grammar.rules.length).toBe(76);
		expect(text).toBe(grammarToText(cfg.value.grammar));
	});

	it('give the same text for the nine grammar presets', () => {
		expect(GRAMMAR_PRESETS).toHaveLength(9);
		for (const preset of GRAMMAR_PRESETS) {
			const parsed = parse(preset.grammar);
			expect(parsed.ok).toBe(true);
			if (!parsed.ok) continue;
			expect(grammarText(parsed.value)).toBe(grammarToText(parsed.value));
		}
	});

	it('give the same text when a body is empty', () => {
		const grammar: Grammar = {
			start: 'S',
			rules: [
				{ head: 'S', body: [] },
				{ head: 'S', body: [{ type: 'terminal', value: 'a' }] }
			]
		};
		expect(grammarText(grammar)).toBe('S -> ε | a');
		expect(grammarToText(grammar)).toBe(grammarText(grammar));
	});
});
