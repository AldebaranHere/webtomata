import { describe, expect, it, vi } from 'vitest';
import { en } from './en.ts';
import { id } from './id.ts';
import type { MessageKey } from './id.ts';
import { pdaId } from './pda-messages.ts';
import { grammarToPdaEn, grammarToPdaId } from './grammar-to-pda-messages.ts';

const GRAMMAR_TO_PDA_KEYS: readonly MessageKey[] = [
	'workstation.tab_topda',
	'grammar.to_pda_tab',
	'grammar.to_pda_method_aria',
	'grammar.to_pda_topdown',
	'grammar.to_pda_bottomup',
	'grammar.to_pda_build',
	'grammar.to_pda_building',
	'grammar.to_pda_empty',
	'grammar.to_pda_step_counter',
	'grammar.to_pda_added',
	'grammar.to_pda_added_so_far',
	'grammar.to_pda_more_before',
	'grammar.to_pda_open',
	'grammar.to_pda_title_topdown',
	'grammar.to_pda_title_bottomup',
	'grammar.to_pda_bottomup_epsilon_note',
	'grammar.to_pda_storage_failed'
];

const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('grammar-to-pda lazy messages (R2, ADR 0050)', () => {
	it('has identical keys in Indonesian and English', () => {
		expect(Object.keys(grammarToPdaEn).sort()).toEqual(Object.keys(grammarToPdaId).sort());
		expect(Object.keys(grammarToPdaId).sort()).toEqual([...GRAMMAR_TO_PDA_KEYS].sort());
	});

	it('is never empty and uses matching parameters in both languages', () => {
		const keys = Object.keys(grammarToPdaId) as (keyof typeof grammarToPdaId)[];
		for (const key of keys) {
			expect(grammarToPdaId[key].trim(), `id: ${key}`).not.toBe('');
			expect(grammarToPdaEn[key].trim(), `en: ${key}`).not.toBe('');
			expect(parameters(grammarToPdaEn[key]), key).toEqual(parameters(grammarToPdaId[key]));
		}
	});

	it('has no key in the shared dictionary or the PDA dictionary', () => {
		for (const key of GRAMMAR_TO_PDA_KEYS) {
			expect(Object.hasOwn(id, key), `id: ${key}`).toBe(false);
			expect(Object.hasOwn(en, key), `en: ${key}`).toBe(false);
			expect(Object.hasOwn(pdaId, key), `pdaId: ${key}`).toBe(false);
			expect(Object.hasOwn(grammarToPdaId, key), `grammarToPdaId: ${key}`).toBe(true);
		}
	});

	it('registers both languages on import without clobbering shared keys', async () => {
		vi.resetModules();
		const { translate } = await import('./translate.ts');
		expect(translate('id', 'grammar.to_pda_build')).toBe('grammar.to_pda_build');
		await import('./grammar-to-pda-messages.ts');
		expect(translate('id', 'grammar.to_pda_build')).toBe('Buat PDA');
		expect(translate('en', 'grammar.to_pda_build')).toBe('Build PDA');
		expect(translate('id', 'grammar.to_pda_step_counter', { current: 1, total: 5 })).toBe(
			'Langkah 1 dari 5'
		);
		expect(translate('en', 'grammar.to_pda_step_counter', { current: 1, total: 5 })).toBe(
			'Step 1 of 5'
		);
		expect(translate('id', 'nav.soal')).toBe('Soal');
	});
});
