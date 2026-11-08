// The PDA messages. They are loaded with the PDA mode instead of the shared dictionary in `id.ts`
// and `en.ts`, which is in the first-load JS of every route (task T-063, ADR 0050). The import
// registers both languages in `translate.ts`; `PdaWorkstation.svelte` is the one importer, so these
// texts travel with the PDA chunk only.
import { addMessages } from './translate.ts';

export const pdaId = {
	'kind.dpda': 'DPDA',
	'kind.ndpda': 'NDPDA',
	'pda_editor.edge_more': '+ {count} lagi',
	'pda_editor.form_title': 'Transisi di antara {from} dan {to}',
	'pda_editor.col_read': 'Baca',
	'pda_editor.col_pop': 'Pop',
	'pda_editor.col_push': 'Push',
	'pda_editor.field_label': 'Baris {n}, {field}',
	'pda_editor.row_delete': 'Hapus baris {n}',
	'pda_editor.add_row': '+ Transisi lain di antara {from} dan {to}',
	'pda_editor.label_hint': 'Kiri = puncak stack. Pop ε tidak memeriksa stack.',
	'pda_editor.save': 'Simpan',
	'pda_editor.cancel': 'Batal',
	'pda_editor.menu_edit': 'Ubah transisi',
	'pda_editor.read_one_symbol':
		'Satu baris membaca satu simbol. Untuk ‘{text}’: buat dua baris, atau tambahkan ‘{text}’ ke alfabet input di tab Tabel.',
	'pda_check.no_accepting_state': 'Belum ada accepting state.',
	'pda_check.duplicate_transition': 'Dari {state}, ada transisi yang sama lebih dari satu kali.',
	'pda_check.pop_never_pushed':
		'Dari {state}, transisi mengambil simbol {symbol} dari stack, tetapi tidak ada transisi yang pernah menaruhnya.',
	'pda_check.competing_transitions':
		'Pada DPDA, transisi baris {first} dan {second} dari {state} bersaing.',
	'pda_check.accepting_state_free_move':
		'Pada DPDA, state {state} adalah accepting state tetapi memiliki transisi yang tidak membaca input dan tidak mem-pop stack.',
	'pda_editor.col_from': 'Dari',
	'pda_editor.col_to': 'Ke',
	'pda_editor.table_title': 'Transisi ({count})',
	'pda_editor.table_empty': 'Belum ada transisi.',
	'pda_editor.definition_hint': 'Kiri = puncak stack. ε pada pop: tidak memeriksa stack.'
} as const;

export const pdaEn: Record<keyof typeof pdaId, string> = {
	'kind.dpda': 'DPDA',
	'kind.ndpda': 'NDPDA',
	'pda_editor.edge_more': '+ {count} more',
	'pda_editor.form_title': 'Transitions between {from} and {to}',
	'pda_editor.col_read': 'Read',
	'pda_editor.col_pop': 'Pop',
	'pda_editor.col_push': 'Push',
	'pda_editor.field_label': 'Row {n}, {field}',
	'pda_editor.row_delete': 'Delete row {n}',
	'pda_editor.add_row': '+ Another transition between {from} and {to}',
	'pda_editor.label_hint': 'Left = top of stack. Pop ε does not check stack.',
	'pda_editor.save': 'Save',
	'pda_editor.cancel': 'Cancel',
	'pda_editor.menu_edit': 'Edit transitions',
	'pda_editor.read_one_symbol':
		'One row reads one symbol. For ‘{text}’: make two rows, or add ‘{text}’ to the input alphabet in the Table tab.',
	'pda_check.no_accepting_state': 'No accepting state yet.',
	'pda_check.duplicate_transition':
		'From {state}, there is more than one copy of the same transition.',
	'pda_check.pop_never_pushed':
		'From {state}, a transition pops symbol {symbol} from the stack, but no transition ever pushes it.',
	'pda_check.competing_transitions':
		'In a DPDA, transitions on rows {first} and {second} from {state} compete.',
	'pda_check.accepting_state_free_move':
		'In a DPDA, state {state} is an accepting state but has a transition that reads nothing and pops nothing.',
	'pda_editor.col_from': 'From',
	'pda_editor.col_to': 'To',
	'pda_editor.table_title': 'Transitions ({count})',
	'pda_editor.table_empty': 'No transitions yet.',
	'pda_editor.definition_hint': 'Leftmost = top of stack. ε on pop: does not inspect the stack.'
};

addMessages('id', pdaId);
addMessages('en', pdaEn);
