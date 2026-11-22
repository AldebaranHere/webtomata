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
	'pda_editor.definition_hint': 'Kiri = puncak stack. ε pada pop: tidak memeriksa stack.',
	'pda_editor.alphabet_input': 'Alfabet input Σ',
	'pda_editor.alphabet_stack': 'Alfabet stack Γ',
	'pda_editor.add_transition': '+ Tambah transisi',
	'pda_editor.state_delete': 'Hapus state {name}',
	'pda_editor.state_removed': 'State {name} dihapus, beserta {count} transisi.',
	'pda_editor.row_duplicate': 'Transisi itu sudah ada di baris {n}.',
	'pda_editor.row_added': 'Baris {n} ditambahkan.',
	'pda_editor.row_changed': 'Baris {n} diubah.',
	'pda_editor.row_removed': 'Baris {n} dihapus.',
	'pda_editor.symbol_reserved': 'Nama simbol tidak boleh berisi spasi atau koma.',
	// The determinism badge (T-062). The phone's text is short, and the button's aria-label is the
	// full text. "pasangan bersaing" is in the glossary with TODO(review).
	'pda_editor.badge_deterministic': 'Deterministik',
	'pda_editor.badge_nondeterministic': 'Non-deterministik · {count} pasangan bersaing',
	'pda_editor.badge_nondeterministic_short': 'Non-det. · {count}',
	'pda_editor.badge_not_dpda': 'Bukan DPDA · {count} pasangan bersaing',
	'pda_editor.badge_not_dpda_short': 'Bukan DPDA · {count}',
	// TODO(review): a true sentence that reads strangely when the two pops are the same ("pop ε
	// adalah awalan dari pop ε"). The design's wording, kept until the owner rewrites it.
	'pda_editor.compete_same_read':
		'Keduanya membaca {read}, dan pop {pop1} adalah awalan dari pop {pop2}.',
	'pda_editor.compete_epsilon_read':
		'Salah satunya tidak membaca input, dan pop {pop1} adalah awalan dari pop {pop2}.',
	'pda_editor.compete_show': 'Tunjukkan',
	'pda_editor.note_ndpda_ok': 'Pada NDPDA ini boleh. Pada DPDA setiap pasangan menjadi kesalahan.',
	'pda_editor.note_dpda_no':
		'Pada DPDA ini tidak boleh. Ubah salah satu transisi, atau pilih NDPDA.',
	'pda_editor.pair_selected': 'Baris {first} dan {second} ditunjukkan.',
	// The first-run card (T-073): one title and one line for each sample of T-033, and the chip comes
	// from `kind.dpda` / `kind.ndpda`. TODO(review): "palindrom" and "penanda" (docs/glossary.md).
	'pda_first.anbn_title': 'aⁿbⁿ (n ≥ 1)',
	'pda_first.anbn_description': 'n huruf a, lalu n huruf b (n ≥ 1)',
	'pda_first.wcwr_title': 'wcwᴿ',
	'pda_first.wcwr_description': 'palindrom dengan penanda c di tengah',
	'pda_first.wwr_title': 'wwᴿ',
	'pda_first.wwr_description': 'kata dan kebalikannya, panjangnya genap',
	// The download dialog (T-075). The failure keys are in the shared dictionary; only these travel
	// with the PDA chunk.
	'pda_files.open_button': 'Unduh mesin ini sebagai file',
	'pda_files.dialog_title': 'Unduh PDA ini',
	'pda_files.close': 'Tutup',
	'pda_files.note':
		'File .jff bisa dibuka di JFLAP. JSON menyimpan semuanya, termasuk simbol yang lebih dari satu karakter.',
	'pda_files.download_jff': 'Unduh .jff (JFLAP)',
	'pda_files.download_json': 'Unduh JSON',
	'pda_files.saved': 'File {name} diunduh.',
	// The Simulasi tab (T-038a). The stack is a column, top at the top; the peak is the number of
	// configurations alive at one BFS level (glossary: both terms are TODO(review)).
	'pda_sim.stack': 'Stack (puncak di atas)',
	'pda_sim.stack_top': '← puncak',
	'pda_sim.stack_empty': 'kosong',
	'pda_sim.stack_more': '… {count} lagi',
	'pda_sim.state': 'State: {name}',
	'pda_sim.stack_row': 'stack: {stack}',
	'pda_sim.peak': 'Konfigurasi bersamaan terbanyak: {count}',
	'pda_sim.peak_help': 'Banyaknya komputasi yang hidup di satu tingkat BFS. DPDA selalu 1.',
	'pda_sim.explored': 'Dijelajahi: {count} konfigurasi',
	'pda_sim.shown_accepted': 'Yang ditunjukkan: komputasi yang menerima (satu jalur).',
	'pda_sim.shown_furthest': 'Yang ditunjukkan: komputasi yang paling jauh (satu jalur).',
	'pda_sim.stopped_max_steps': 'Dihentikan: batas langkah tercapai.',
	'pda_sim.stopped_max_configurations': 'Dihentikan: batas konfigurasi tercapai.',
	'pda_sim.stopped_max_stack': 'Dihentikan: batas kedalaman stack tercapai.',
	'pda_sim.stopped_other': 'Dihentikan: komputasi ini terlalu besar untuk dijalankan di sini.',
	'pda_sim.step_announce':
		'Langkah {position} dari {total}: state {state}, stack {stack}, puncak {top}',
	'pda_sim.column_string': 'String',
	'pda_sim.column_result': 'Hasil',
	'pda_sim.column_peak': 'Puncak',
	'pda_sim.run_row': 'Jalankan {string}'
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
	'pda_editor.definition_hint': 'Leftmost = top of stack. ε on pop: does not inspect the stack.',
	'pda_editor.alphabet_input': 'Input alphabet Σ',
	'pda_editor.alphabet_stack': 'Stack alphabet Γ',
	'pda_editor.add_transition': '+ Add transition',
	'pda_editor.state_delete': 'Delete state {name}',
	'pda_editor.state_removed': 'The state {name} was removed, with {count} transition(s).',
	'pda_editor.row_duplicate': 'That transition is already in row {n}.',
	'pda_editor.row_added': 'Row {n} was added.',
	'pda_editor.row_changed': 'Row {n} was changed.',
	'pda_editor.row_removed': 'Row {n} was removed.',
	'pda_editor.symbol_reserved': 'A symbol name cannot contain spaces or commas.',
	'pda_editor.badge_deterministic': 'Deterministic',
	'pda_editor.badge_nondeterministic': 'Non-deterministic · {count} competing pairs',
	'pda_editor.badge_nondeterministic_short': 'Non-det. · {count}',
	'pda_editor.badge_not_dpda': 'Not a DPDA · {count} competing pairs',
	'pda_editor.badge_not_dpda_short': 'Not a DPDA · {count}',
	'pda_editor.compete_same_read': 'Both read {read}, and pop {pop1} is a prefix of pop {pop2}.',
	'pda_editor.compete_epsilon_read':
		'One of them reads no input, and pop {pop1} is a prefix of pop {pop2}.',
	'pda_editor.compete_show': 'Show',
	'pda_editor.note_ndpda_ok': 'On an NDPDA this is allowed. In a DPDA every pair becomes an error.',
	'pda_editor.note_dpda_no':
		'In a DPDA this is not allowed. Change one of the transitions, or choose NDPDA.',
	'pda_editor.pair_selected': 'Rows {first} and {second} are shown.',
	'pda_first.anbn_title': 'aⁿbⁿ (n ≥ 1)',
	'pda_first.anbn_description': 'n letters a, then n letters b (n ≥ 1)',
	'pda_first.wcwr_title': 'wcwᴿ',
	'pda_first.wcwr_description': 'a palindrome with a marker c in the middle',
	'pda_first.wwr_title': 'wwᴿ',
	'pda_first.wwr_description': 'a word and its reverse, of even length',
	'pda_files.open_button': 'Download this machine as a file',
	'pda_files.dialog_title': 'Download this PDA',
	'pda_files.close': 'Close',
	'pda_files.note':
		'The .jff file opens in JFLAP. JSON keeps everything, including symbols of more than one character.',
	'pda_files.download_jff': 'Download .jff (JFLAP)',
	'pda_files.download_json': 'Download JSON',
	'pda_files.saved': 'The file {name} was downloaded.',
	// The Simulasi tab (T-038a).
	'pda_sim.stack': 'Stack (top at the top)',
	'pda_sim.stack_top': '← top',
	'pda_sim.stack_empty': 'empty',
	'pda_sim.stack_more': '… {count} more',
	'pda_sim.state': 'State: {name}',
	'pda_sim.stack_row': 'stack: {stack}',
	'pda_sim.peak': 'Peak concurrent configurations: {count}',
	'pda_sim.peak_help': 'The number of computations alive at one BFS level. A DPDA is always 1.',
	'pda_sim.explored': 'Explored: {count} configurations',
	'pda_sim.shown_accepted': 'Shown: the accepting computation (one path).',
	'pda_sim.shown_furthest': 'Shown: the furthest computation (one path).',
	'pda_sim.stopped_max_steps': 'Stopped: the step limit was reached.',
	'pda_sim.stopped_max_configurations': 'Stopped: the configuration limit was reached.',
	'pda_sim.stopped_max_stack': 'Stopped: the stack depth limit was reached.',
	'pda_sim.stopped_other': 'Stopped: this computation is too big to run here.',
	'pda_sim.step_announce': 'Step {position} of {total}: state {state}, stack {stack}, top {top}',
	'pda_sim.column_string': 'String',
	'pda_sim.column_result': 'Result',
	'pda_sim.column_peak': 'Peak',
	'pda_sim.run_row': 'Run {string}'
};

addMessages('id', pdaId);
addMessages('en', pdaEn);
