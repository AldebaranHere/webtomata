// English messages. The keys must be those of `id.ts`.
import type { MessageKey } from './id.ts';

export const en: Record<MessageKey, string> = {
	'app.name': 'WebTomata',
	'app.tagline': 'A tool for learning finite state machines, for Theory of Computation students.',
	'app.privacy': 'No account, no tracking.',

	'nav.skip': 'Skip to content',
	'nav.label': 'Main navigation',
	'nav.menu': 'Menu',
	'nav.sandbox': 'Sandbox',
	'nav.soal': 'Questions',
	'nav.panduan': 'Guides',

	'lang.label': 'Language',
	'lang.id': 'ID',
	'lang.en': 'EN',
	'lang.id_name': 'ID, Bahasa Indonesia',
	'lang.en_name': 'EN, English',

	'home.description':
		'A tool for learning finite state machines (DFSM, NDFSM, regular expressions) for Theory of Computation students. Free, no account.',
	'home.sandbox_hint': 'Build and run your own machines.',
	'home.soal_hint': 'Practice with calm, specific feedback.',
	'home.panduan_hint': 'Design patterns for machines, one at a time.',
	'home.engine': 'Engine version',

	'engine.crashed.title': 'The engine stopped.',
	'engine.crashed.body': 'Something went wrong while calculating. Try again.',
	'engine.timeout.title': 'The calculation took too long.',
	'engine.timeout.body':
		'The calculation was stopped after {seconds} seconds. Try a smaller machine.',
	'engine.retry': 'Try again',

	'sandbox.description': 'Build, run and convert finite state machines right in the browser.',
	'sandbox.preview': 'A preview of how a machine is drawn. The editor is coming soon.',

	'diagram.label': '{kind} with {count} state(s)',
	'diagram.start': 'start',

	'editor.canvas': 'Machine canvas',
	'editor.rail': 'Editor tools',
	'editor.tool.select': 'Select',
	'editor.tool.add_state': 'Add state',
	'editor.tool.delete': 'Delete',
	'editor.undo': 'Undo',
	'editor.redo': 'Redo',
	'editor.untitled': 'Untitled',
	'editor.count': '{count} state(s)',
	'editor.hint_empty': 'Choose Add state, then click the canvas.',
	'editor.state': 'State {name}',
	'editor.flag_start': ', start state',
	'editor.flag_accepting': ', accepting state',

	'editor.state_added': 'State {name} added.',
	'editor.deleted_state': 'State {name} deleted.',
	'editor.deleted_states': '{count} states deleted.',
	'editor.moved': '{name} moved.',
	'editor.moved_many': '{count} states moved.',
	'editor.selected_one': '{name} selected.',
	'editor.selected_many': '{count} states selected.',
	'editor.selection_cleared': 'Selection cleared.',
	'editor.undone': 'Undone.',
	'editor.redone': 'Redone.',
	'editor.refused': 'That could not be done.',
	'document.limit_exceeded': 'Limit reached: {what}, at most {limit}.',
	'soal.description': 'Practice questions on finite state machines with calm, specific feedback.',
	'panduan.description':
		'Guides to the patterns for designing DFSMs, NDFSMs and regular expressions.',

	'page.soon': 'Coming soon.',
	'page.home': 'Back to home'
};
