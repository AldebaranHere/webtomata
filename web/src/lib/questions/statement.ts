// The text of a question as the page shows it (Q3b), the part that has no DOM in it. A statement is
// plain text: a blank line starts a paragraph, and `backticks` mark code. It is turned into pieces of
// text and code, never into HTML, so that nothing in a question file can add markup to the page.
import type { Question } from './types.ts';

export type Piece = { kind: 'text' | 'code'; text: string };

/** One paragraph in pieces. A backtick that has no pair, or a pair with nothing in it, stays text. */
function piecesOf(paragraph: string): Piece[] {
	const pieces: Piece[] = [];
	let text = '';
	let i = 0;
	while (i < paragraph.length) {
		if (paragraph[i] === '`') {
			const end = paragraph.indexOf('`', i + 1);
			if (end > i + 1) {
				if (text) pieces.push({ kind: 'text', text });
				text = '';
				pieces.push({ kind: 'code', text: paragraph.slice(i + 1, end) });
				i = end + 1;
				continue;
			}
		}
		text += paragraph[i];
		i += 1;
	}
	if (text) pieces.push({ kind: 'text', text });
	return pieces;
}

/** The paragraphs of a statement. The lines of one paragraph are joined with a space. */
export function paragraphsOf(statement: string): Piece[][] {
	return statement
		.replace(/\r\n?/g, '\n')
		.split(/\n[ \t]*\n/)
		.map((paragraph) =>
			paragraph
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line !== '')
				.join(' ')
		)
		.filter((paragraph) => paragraph !== '')
		.map(piecesOf);
}

/** A chip of the question: a message key and its parameters. */
export interface Chip {
	key: string;
	params: Record<string, string | number>;
}

/**
 * The chips under the title: the type of the answer, each constraint that is not at its default, and the
 * sections of the textbooks as one chip.
 */
export function chipsOf(question: Pick<Question, 'type' | 'constraints' | 'references'>): Chip[] {
	const chips: Chip[] = [
		{
			key:
				question.type === 'build-dfsm'
					? 'soal.chip.dfsm'
					: question.type === 'build-ndfsm'
						? 'soal.chip.ndfsm'
						: 'soal.chip.regex',
			params: {}
		}
	];
	const c = question.constraints;
	if (c?.maxStates !== undefined) {
		chips.push({ key: 'soal.chip.max_states', params: { count: c.maxStates } });
	}
	if (c?.complete === false) chips.push({ key: 'soal.chip.incomplete', params: {} });
	if (c?.minimal === true) chips.push({ key: 'soal.chip.minimal', params: {} });
	if (c?.allowEpsilon === false) chips.push({ key: 'soal.chip.no_epsilon', params: {} });
	const r = question.references;
	const parts = [
		r?.rich && r.rich.length > 0 ? `Rich ${r.rich.join(', ')}` : '',
		r?.sipser && r.sipser.length > 0 ? `Sipser ${r.sipser.join(', ')}` : ''
	].filter((part) => part !== '');
	if (parts.length > 0) {
		chips.push({ key: 'soal.chip.references', params: { text: parts.join(' · ') } });
	}
	return chips;
}
