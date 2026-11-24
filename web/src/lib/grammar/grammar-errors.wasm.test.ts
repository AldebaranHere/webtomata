import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import { createSyncEngine } from '../engine/handlers.ts';
import type { EngineApi } from '../engine/protocol.ts';
import type { EngineResult, Message } from '../engine/types.ts';
import { en } from '../i18n/en.ts';
import { id } from '../i18n/id.ts';
import type { MessageKey } from '../i18n/id.ts';
import { translate } from '../i18n/translate.ts';

let engine: EngineApi;

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
	engine = createSyncEngine(wasm);
});

function expectError<T>(res: EngineResult<T>): Message {
	expect(res.ok).toBe(false);
	if (res.ok) throw new Error('expected engine error');
	return res.error;
}

describe('grammar errors wasm integration (T-028 AC4)', () => {
	const cases: {
		name: string;
		run: () => EngineResult<unknown>;
		expectedKey: MessageKey;
		expectedIdPhrase: string;
	}[] = [
		{
			name: 'grammar with no rules',
			run: () => engine.parseGrammar(''),
			expectedKey: 'grammar.error.empty',
			expectedIdPhrase: 'tidak memiliki aturan produksi'
		},
		{
			name: 'line without an arrow',
			run: () => engine.parseGrammar('S a b'),
			expectedKey: 'grammar.error.no_arrow',
			expectedIdPhrase: 'pemisah panah'
		},
		{
			name: 'empty rule head',
			run: () => engine.parseGrammar('-> a'),
			expectedKey: 'grammar.error.empty_head',
			expectedIdPhrase: 'tidak boleh kosong'
		},
		{
			name: 'rule with 11 nullable variables',
			run: () => engine.transformToCnf('S -> A A A A A A A A A A A\nA -> ε', false),
			expectedKey: 'grammar.error.too_many_nullable',
			expectedIdPhrase: 'terlalu banyak variabel nullable'
		},
		{
			name: 'cykParse on a grammar not in CNF',
			run: () => engine.cykParse('S -> a b', 'ab'),
			expectedKey: 'grammar.error.not_cnf',
			expectedIdPhrase: 'Bentuk Normal Chomsky'
		},
		{
			name: 'CYK input one longer than the limit (101 chars)',
			run: () => engine.cykParse('S -> a', 'a'.repeat(101)),
			expectedKey: 'grammar.cyk_input_too_long',
			expectedIdPhrase: 'String terlalu panjang untuk diuji'
		}
	];

	for (const tc of cases) {
		it(`returns a translated id+en key with no placeholders for: ${tc.name}`, () => {
			const error = expectError(tc.run());
			expect(error.key).toBe(tc.expectedKey);
			expect(error.params.detail).toBeUndefined();
			expect(Object.hasOwn(id, error.key)).toBe(true);
			expect(Object.hasOwn(en, error.key)).toBe(true);

			const renderedId = translate('id', error.key as MessageKey, error.params);
			const renderedEn = translate('en', error.key as MessageKey, error.params);
			expect(renderedId).not.toContain('{');
			expect(renderedEn).not.toContain('{');
			expect(renderedId).toContain(tc.expectedIdPhrase);
		});
	}
});
