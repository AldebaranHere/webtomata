import { describe, expect, it, vi } from 'vitest';
import { en } from './en.ts';
import { id } from './id.ts';
import type { MessageKey } from './id.ts';
import { pdaEn, pdaId } from './pda-messages.ts';

// The 25 keys that T-063 moves out of the shared dictionary, the 11 that T-061 adds (docs/agent/PLAN.md,
// T-061: the editable Tabel tab), and the six of the first-run card (T-073).
const PDA_KEYS: readonly MessageKey[] = [
	'kind.dpda',
	'kind.ndpda',
	'pda_editor.edge_more',
	'pda_editor.form_title',
	'pda_editor.col_read',
	'pda_editor.col_pop',
	'pda_editor.col_push',
	'pda_editor.field_label',
	'pda_editor.row_delete',
	'pda_editor.add_row',
	'pda_editor.label_hint',
	'pda_editor.save',
	'pda_editor.cancel',
	'pda_editor.menu_edit',
	'pda_editor.read_one_symbol',
	'pda_editor.col_from',
	'pda_editor.col_to',
	'pda_editor.table_title',
	'pda_editor.table_empty',
	'pda_editor.definition_hint',
	'pda_check.no_accepting_state',
	'pda_check.duplicate_transition',
	'pda_check.pop_never_pushed',
	'pda_check.competing_transitions',
	'pda_check.accepting_state_free_move',
	'pda_editor.alphabet_input',
	'pda_editor.alphabet_stack',
	'pda_editor.add_transition',
	'pda_editor.state_delete',
	'pda_editor.state_removed',
	'pda_editor.row_duplicate',
	'pda_editor.row_added',
	'pda_editor.row_changed',
	'pda_editor.row_removed',
	'pda_editor.symbol_reserved',
	'document.duplicate_symbol',
	// The determinism badge (T-062).
	'pda_editor.badge_deterministic',
	'pda_editor.badge_nondeterministic',
	'pda_editor.badge_nondeterministic_short',
	'pda_editor.badge_not_dpda',
	'pda_editor.badge_not_dpda_short',
	'pda_editor.compete_same_read',
	'pda_editor.compete_epsilon_read',
	'pda_editor.compete_show',
	'pda_editor.note_ndpda_ok',
	'pda_editor.note_dpda_no',
	'pda_editor.pair_selected',
	// The first-run card (T-073).
	'pda_first.anbn_title',
	'pda_first.anbn_description',
	'pda_first.wcwr_title',
	'pda_first.wcwr_description',
	'pda_first.wwr_title',
	'pda_first.wwr_description',
	// The download dialog (T-075).
	'pda_files.open_button',
	'pda_files.dialog_title',
	'pda_files.close',
	'pda_files.note',
	'pda_files.download_jff',
	'pda_files.download_json',
	'pda_files.saved'
];

const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('the PDA messages', () => {
	it('U1: have the same keys in Indonesian and English', () => {
		expect(Object.keys(pdaEn).sort()).toEqual(Object.keys(pdaId).sort());
		expect(Object.keys(pdaId).sort()).toEqual([...PDA_KEYS].sort());
	});

	it('U2: are never empty, and use the same parameters in both languages', () => {
		const keys = Object.keys(pdaId) as (keyof typeof pdaId)[];
		for (const key of keys) {
			expect(pdaId[key].trim(), `id: ${key}`).not.toBe('');
			expect(pdaEn[key].trim(), `en: ${key}`).not.toBe('');
			expect(parameters(pdaEn[key]), key).toEqual(parameters(pdaId[key]));
		}
	});

	it('U3: are not in the shared dictionary, and no key is in both', () => {
		for (const key of PDA_KEYS) {
			expect(Object.hasOwn(id, key), `id: ${key}`).toBe(false);
			expect(Object.hasOwn(en, key), `en: ${key}`).toBe(false);
			expect(Object.hasOwn(pdaId, key), `pda: ${key}`).toBe(true);
		}
		expect(Object.keys(pdaId).filter((key) => Object.hasOwn(id, key))).toEqual([]);
	});

	// U4 to U6 read the registry, so they get their own copy of it: Vitest runs with
	// `isolate: false`, and another test file may have imported the module already.
	it('U4: a key that is not registered yet gives the key itself, not undefined', async () => {
		vi.resetModules();
		const { translate } = await import('./translate.ts');
		expect(translate('id', 'pda_editor.save')).toBe('pda_editor.save');
		expect(translate('en', 'pda_check.no_accepting_state')).toBe('pda_check.no_accepting_state');
	});

	it('U5: after the import, both languages give the text, with the parameters filled', async () => {
		vi.resetModules();
		const { translate } = await import('./translate.ts');
		await import('./pda-messages.ts');
		expect(translate('id', 'pda_editor.save')).toBe('Simpan');
		expect(translate('en', 'pda_editor.save')).toBe('Save');
		expect(translate('id', 'pda_editor.table_title', { count: 3 })).toBe('Transisi (3)');
		expect(translate('en', 'pda_editor.table_title', { count: 3 })).toBe('Transitions (3)');
	});

	it('U6: registering the PDA messages does not remove the keys that were there', async () => {
		vi.resetModules();
		const { translate } = await import('./translate.ts');
		await import('./pda-messages.ts');
		expect(translate('id', 'nav.soal')).toBe('Soal');
		expect(translate('en', 'nav.soal')).toBe('Questions');
	});
});
