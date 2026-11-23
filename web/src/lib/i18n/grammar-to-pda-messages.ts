// The CFG-to-PDA ("Ke PDA") messages. Loaded with the grammar workstation chunk instead of the
// shared dictionary in `id.ts` and `en.ts`, which is in the first-load JS of every route (T-038c,
// ADR 0050). `GrammarWorkstation.svelte` is the one importer, so these texts travel with the
// grammar chunk only.
import { addMessages } from './translate.ts';

export const grammarToPdaId = {
	'workstation.tab_topda': 'Ke PDA',
	'grammar.to_pda_tab': 'Ke PDA',
	'grammar.to_pda_method_aria': 'Metode konversi CFG ke PDA',
	'grammar.to_pda_topdown': 'Atas-bawah',
	'grammar.to_pda_bottomup': 'Bawah-atas',
	'grammar.to_pda_build': 'Buat PDA',
	'grammar.to_pda_building': 'Mengonversi…',
	'grammar.to_pda_empty': 'Masukkan tata bahasa CFG yang valid, lalu tekan Buat PDA.',
	'grammar.to_pda_step_counter': 'Langkah {current} dari {total}',
	'grammar.to_pda_added': 'Ditambah',
	'grammar.to_pda_added_so_far': 'Sudah ditambahkan',
	'grammar.to_pda_more_before': '… {count} baris sebelumnya',
	'grammar.to_pda_open': 'Buka sebagai PDA baru',
	'grammar.to_pda_title_topdown': '{name} (PDA atas-bawah)',
	'grammar.to_pda_title_bottomup': '{name} (PDA bawah-atas)',
	'grammar.to_pda_bottomup_epsilon_note':
		'Tata bahasa ini punya aturan ε: PDA bawah-atas dapat berjalan tanpa henti pada string di luar bahasa, dan simulasi akan berhenti di batasnya.',
	'grammar.to_pda_storage_failed': 'Tidak dapat menyimpan PDA baru di perangkat ini.'
} as const;

export const grammarToPdaEn: Record<keyof typeof grammarToPdaId, string> = {
	'workstation.tab_topda': 'To PDA',
	'grammar.to_pda_tab': 'To PDA',
	'grammar.to_pda_method_aria': 'CFG to PDA conversion method',
	'grammar.to_pda_topdown': 'Top-down',
	'grammar.to_pda_bottomup': 'Bottom-up',
	'grammar.to_pda_build': 'Build PDA',
	'grammar.to_pda_building': 'Converting…',
	'grammar.to_pda_empty': 'Enter a valid CFG, then press Build PDA.',
	'grammar.to_pda_step_counter': 'Step {current} of {total}',
	'grammar.to_pda_added': 'Added',
	'grammar.to_pda_added_so_far': 'Added so far',
	'grammar.to_pda_more_before': '… {count} earlier rows',
	'grammar.to_pda_open': 'Open as a new PDA',
	'grammar.to_pda_title_topdown': '{name} (top-down PDA)',
	'grammar.to_pda_title_bottomup': '{name} (bottom-up PDA)',
	'grammar.to_pda_bottomup_epsilon_note':
		'This grammar has an ε-rule: the bottom-up PDA can run without end on strings outside the language, and simulation will stop at its budget.',
	'grammar.to_pda_storage_failed': 'Could not save the new PDA on this device.'
};

addMessages('id', grammarToPdaId);
addMessages('en', grammarToPdaEn);
