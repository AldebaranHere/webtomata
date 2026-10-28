// The words of the feedback of a question (Q4a), the part that has no DOM in it: which message key and
// which parameters say each part of a `Grade`. The sentences are in the message files and follow
// docs/ux/feedback-copy.md: calm, specific, and never the answer. A test reads every key listed here
// in both languages, and checks that no title is harsh and no guiding question names a fix.
import type { MessageKey } from '#lib/i18n/id.ts';
import type { Params } from '#lib/i18n/translate.ts';
import { checkItems } from '../editor/checks.ts';
import type { MachineDocument } from '../editor/document.ts';
import type { Issue } from '../engine/types.ts';
import type { Grade, GradeQuestion } from './grade.ts';

export interface Say {
	key: MessageKey;
	params: Params;
}

const say = (key: string, params: Params = {}): Say => ({ key: key as MessageKey, params });

/** Every key of the feedback, for the test that reads them in both languages. */
export const FEEDBACK_KEYS: readonly string[] = [
	'feedback.structure_title',
	'feedback.structure_hint',
	'feedback.structure_valid',
	'feedback.structure_valid_complete',
	'feedback.need_dfsm',
	'feedback.too_many_states',
	'feedback.not_minimal',
	'feedback.epsilon_not_allowed',
	'feedback.alphabet_missing',
	'feedback.alphabet_extra',
	'feedback.right_title',
	'feedback.right_detail',
	'feedback.close_title',
	'feedback.far_title',
	'feedback.detail_accepts',
	'feedback.detail_rejects',
	'feedback.detail_both',
	'feedback.far_detail',
	'feedback.stopped_title',
	'feedback.stopped_detail',
	'feedback.failed_title',
	'feedback.failed_detail',
	'feedback.list_accepted',
	'feedback.list_rejected',
	'feedback.list_none',
	'feedback.list_truncated',
	'feedback.computation_heading',
	'feedback.guide_end',
	'feedback.guide_empty_accepts',
	'feedback.guide_empty_rejects',
	'feedback.heading',
	'feedback.intro',
	'feedback.check_button',
	'feedback.check_again',
	'feedback.stale',
	'feedback.try_button',
	'feedback.chip_label',
	'feedback.here',
	'feedback.hint_button',
	'feedback.hints_heading',
	'panel.tab_feedback'
];

/** The text of one problem of the structure. The engine's own problems are those of the checks of the editor. */
export function issueText(issue: Issue, doc: MachineDocument): Say {
	if (issue.message.key.startsWith('feedback.')) {
		return say(issue.message.key, issue.message.params as Params);
	}
	const [item] = checkItems([issue], doc);
	return { key: item!.key, params: item!.params };
}

/** The title and the sentence over the problems of the structure ("look at the structure first"). */
export const structureHeading = {
	title: say('feedback.structure_title'),
	hint: say('feedback.structure_hint')
};

/** The card that says the structure is valid: shown with every verdict. */
export function structureValid(question: GradeQuestion): { title: Say; detail?: Say } {
	const complete = question.type === 'build-dfsm' && question.constraints?.complete !== false;
	return {
		title: say('feedback.structure_valid'),
		...(complete
			? {
					detail: say('feedback.structure_valid_complete', {
						symbols: question.alphabet.join(', ')
					})
				}
			: {})
	};
}

/** The title and the detail of the verdict, for a grade that is not about the structure. */
export function verdictText(grade: Exclude<Grade, { kind: 'structure' }>): {
	title: Say;
	detail?: Say;
} {
	switch (grade.kind) {
		case 'right':
			return { title: say('feedback.right_title'), detail: say('feedback.right_detail') };
		case 'stopped':
			return { title: say('feedback.stopped_title'), detail: say('feedback.stopped_detail') };
		case 'failed':
			return { title: say('feedback.failed_title'), detail: say('feedback.failed_detail') };
		case 'wrong': {
			if (grade.closeness === 'far') {
				return { title: say('feedback.far_title'), detail: say('feedback.far_detail') };
			}
			const detail =
				grade.accepted.length > 0 && grade.rejected.length > 0
					? 'feedback.detail_both'
					: grade.accepted.length > 0
						? 'feedback.detail_accepts'
						: 'feedback.detail_rejects';
			return { title: say('feedback.close_title'), detail: say(detail) };
		}
	}
}

/** The headings and the two short sentences of the lists of wrong strings. */
export const listHeadings = {
	accepted: 'feedback.list_accepted',
	rejected: 'feedback.list_rejected',
	none: 'feedback.list_none',
	truncated: 'feedback.list_truncated'
} as const;

/** A set of states as it is written in a computation: one name, a list in braces, or ∅. */
const setOf = (names: readonly string[]) =>
	names.length === 0 ? '∅' : names.length === 1 ? names[0]! : `{${names.join(', ')}}`;

/**
 * The heading over the computation of the shortest wrong string, and the one question that goes with it.
 * The question is about where the machine is after the string and whether that is what the machine must
 * remember; it never names a state to add or a transition to change. Null when there is no computation.
 */
export function guideOf(grade: Grade): { heading: Say; question: Say } | null {
	if (grade.kind !== 'wrong' || !grade.computation) return null;
	const { witness, computation } = grade;
	const heading = say('feedback.computation_heading', { string: witness.text });
	if (witness.input === '') {
		return {
			heading,
			question: say(
				computation.accepted ? 'feedback.guide_empty_accepts' : 'feedback.guide_empty_rejects'
			)
		};
	}
	return {
		heading,
		question: say('feedback.guide_end', {
			string: witness.text,
			states: setOf(computation.end)
		})
	};
}
