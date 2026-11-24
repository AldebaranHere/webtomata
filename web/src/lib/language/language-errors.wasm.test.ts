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

/**
 * The raw WASM call, for the one input that the typed client cannot send: an environment that is
 * not JSON (the client serializes its environment with `JSON.stringify`, which always makes valid
 * JSON). The answer is the same envelope that `finish` writes.
 */
function rawEnumerate(expression: string, env: string): EngineResult<unknown> {
	const answer: EngineResult<unknown> = JSON.parse(wasm.enumerateLanguage(expression, 0, 5, env));
	return answer;
}

describe('language errors wasm integration (T-028b AC4)', () => {
	const cases: {
		name: string;
		run: () => EngineResult<unknown>;
		expectedKey: MessageKey;
		expectedIdPhrase: string;
	}[] = [
		{
			name: 'a character after the expression',
			run: () => engine.enumerateLanguage('{a} &', 0, 5),
			expectedKey: 'language.error.unexpected_character',
			expectedIdPhrase: 'Karakter tak terduga pada posisi 4'
		},
		{
			name: 'a power operator without a number',
			run: () => engine.enumerateLanguage('{a}^', 0, 5),
			expectedKey: 'language.error.expected_power_number',
			expectedIdPhrase: 'Diharapkan angka setelah operator pangkat/koefisien'
		},
		{
			name: 'an exponent that does not fit in usize',
			run: () => engine.enumerateLanguage('{a}^99999999999999999999', 0, 5),
			expectedKey: 'language.error.number_too_large',
			expectedIdPhrase: 'Angka terlalu besar untuk diproses'
		},
		{
			name: 'an opening parenthesis without its closing parenthesis',
			run: () => engine.enumerateLanguage('({a}', 0, 5),
			expectedKey: 'language.error.unclosed_parenthesis',
			expectedIdPhrase: "Kurung buka '(' tidak memiliki pasangan ')'"
		},
		{
			name: 'a symbol where an expression must start',
			run: () => engine.enumerateLanguage('&', 0, 5),
			expectedKey: 'language.error.unexpected_symbol',
			expectedIdPhrase: "Simbol tak terduga: '&'"
		},
		{
			name: 'the expression ends after an operator',
			run: () => engine.enumerateLanguage('{a} ∪', 0, 5),
			expectedKey: 'language.error.unexpected_end',
			expectedIdPhrase: 'Ekspresi berakhir tiba-tiba'
		},
		{
			name: 'a set of words that is not closed',
			run: () => engine.enumerateLanguage('{a', 0, 5),
			expectedKey: 'language.error.expected_comma_or_brace',
			expectedIdPhrase: "Diharapkan ',' atau '}' dalam himpunan kata"
		},
		{
			name: 'a malformed set-builder falls back to the finite-set error',
			run: () => engine.enumerateLanguage('{ w in {a,b}* : 3#a(w) }', 0, 5),
			expectedKey: 'language.error.expected_comma_or_brace',
			expectedIdPhrase: "Diharapkan ',' atau '}' dalam himpunan kata"
		},
		{
			name: 'a reference to a language that does not exist',
			run: () => engine.enumerateLanguage('L2', 0, 5),
			expectedKey: 'language.error.undefined_reference',
			expectedIdPhrase: "Bahasa 'L2' belum didefinisikan"
		},
		{
			name: 'a language in the environment that refers to itself',
			run: () => engine.enumerateLanguage('L1', 0, 5, { L1: 'L1' }),
			expectedKey: 'language.error.cyclic_reference',
			expectedIdPhrase: "Referensi siklik terdeteksi pada 'L1'"
		},
		{
			name: 'a language in the environment that does not parse',
			run: () => engine.enumerateLanguage('{a}', 0, 5, { L1: '{' }),
			expectedKey: 'language.error.expected_comma_or_brace',
			expectedIdPhrase: "Diharapkan ',' atau '}' dalam himpunan kata"
		},
		{
			name: 'an environment that is not valid JSON',
			run: () => rawEnumerate('{a}', '{'),
			expectedKey: 'api.invalid_environment',
			expectedIdPhrase: 'Data bahasa tidak valid'
		}
	];

	for (const tc of cases) {
		it(`returns a translated id+en key with no placeholders for: ${tc.name}`, () => {
			const error = expectError(tc.run());
			expect(error.key).toBe(tc.expectedKey);
			expect(error.params.detail).toBeUndefined();
			expect(Object.hasOwn(id, error.key)).toBe(true);
			expect(Object.hasOwn(en, error.key)).toBe(true);

			const renderedId = translate('id', tc.expectedKey, error.params);
			const renderedEn = translate('en', tc.expectedKey, error.params);
			expect(renderedId).not.toContain('{');
			expect(renderedEn).not.toContain('{');
			expect(renderedId).toContain(tc.expectedIdPhrase);
		});
	}
});
