import { describe, expect, it } from 'vitest';
import { documentFrom } from '../editor/diagram/samples.ts';
import { message } from '../editor/document.ts';
import { id as idMessages } from '#lib/i18n/id.ts';
import { en as enMessages } from '#lib/i18n/en.ts';
import {
	FEEDBACK_KEYS,
	guideOf,
	issueText,
	listHeadings,
	structureValid,
	verdictText
} from './feedback-text.ts';
import type { Grade } from './grade.ts';

type Wrong = Extract<Grade, { kind: 'wrong' }>;
const wrong = (over: Partial<Wrong> = {}): Wrong => ({
	kind: 'wrong',
	closeness: 'close',
	witness: { text: '10', input: '10' },
	accepted: [],
	rejected: [{ text: '10', input: '10' }],
	truncated: false,
	computation: {
		rows: [
			{ position: 1, from: ['a'], symbol: '1', to: ['b'] },
			{ position: 2, from: ['b'], symbol: '0', to: ['a'] }
		],
		end: ['a'],
		accepted: false
	},
	...over
});

describe('every key of the feedback has a text in both languages', () => {
	it('is in id and en', () => {
		expect(FEEDBACK_KEYS.length).toBeGreaterThan(20);
		for (const key of FEEDBACK_KEYS) {
			expect(Object.hasOwn(idMessages, key), `id: ${key}`).toBe(true);
			expect(Object.hasOwn(enMessages, key), `en: ${key}`).toBe(true);
		}
	});
});

describe('verdictText', () => {
	it('says "Tepat." for a right answer', () => {
		expect(verdictText({ kind: 'right' })).toEqual({
			title: { key: 'feedback.right_title', params: {} },
			detail: { key: 'feedback.right_detail', params: {} }
		});
	});

	it('is close, with a detail that says which side is wrong', () => {
		expect(verdictText(wrong())).toEqual({
			title: { key: 'feedback.close_title', params: {} },
			detail: { key: 'feedback.detail_rejects', params: {} }
		});
		expect(verdictText(wrong({ accepted: [{ text: '1', input: '1' }], rejected: [] }))).toEqual({
			title: { key: 'feedback.close_title', params: {} },
			detail: { key: 'feedback.detail_accepts', params: {} }
		});
		expect(verdictText(wrong({ accepted: [{ text: '1', input: '1' }] })).detail).toEqual({
			key: 'feedback.detail_both',
			params: {}
		});
	});

	it('is far, with the advice to run short strings first, when many strings are wrong', () => {
		expect(verdictText(wrong({ closeness: 'far' }))).toEqual({
			title: { key: 'feedback.far_title', params: {} },
			detail: { key: 'feedback.far_detail', params: {} }
		});
	});

	it('says that the check was stopped, and that the engine could not, in calm words', () => {
		expect(verdictText({ kind: 'stopped', reason: 'max_steps' }).title.key).toBe(
			'feedback.stopped_title'
		);
		expect(verdictText({ kind: 'failed', error: message('x') }).title.key).toBe(
			'feedback.failed_title'
		);
	});

	it('does not use a harsh word in any title, in either language', () => {
		const harsh = /\b(salah|gagal|error|wrong|failed|incorrect)\b/i;
		for (const key of [
			'feedback.right_title',
			'feedback.close_title',
			'feedback.far_title',
			'feedback.stopped_title',
			'feedback.failed_title',
			'feedback.structure_title'
		] as const) {
			expect(idMessages[key], key).not.toMatch(harsh);
			expect(enMessages[key], key).not.toMatch(harsh);
		}
	});
});

describe('the structure', () => {
	const doc = documentFrom({
		alphabet: ['0', '1'],
		states: [
			[0, 0, 'a'],
			[100, 0, 'b']
		],
		start: 0,
		accepting: [1]
	});

	it('writes an issue of the question with its own text', () => {
		expect(
			issueText(
				{ severity: 'error', message: message('feedback.too_many_states', { max: 2, count: 3 }) },
				doc
			)
		).toEqual({ key: 'feedback.too_many_states', params: { max: 2, count: 3 } });
	});

	it('writes an issue of the engine with the names of the states of the machine', () => {
		expect(
			issueText(
				{
					severity: 'error',
					message: message('dfsm.missing_transition', { state: 1, symbol: '0' })
				},
				doc
			)
		).toEqual({ key: 'check.missing_transition', params: { state: 'b', symbol: '0' } });
		expect(issueText({ severity: 'error', message: message('fsm.no_start_state') }, doc).key).toBe(
			'check.no_start_state'
		);
	});

	it('says that the structure is valid, with the symbols for a DFSM that must be complete', () => {
		expect(structureValid({ type: 'build-dfsm', alphabet: ['0', '1'] })).toEqual({
			title: { key: 'feedback.structure_valid', params: {} },
			detail: { key: 'feedback.structure_valid_complete', params: { symbols: '0, 1' } }
		});
		expect(structureValid({ type: 'build-ndfsm', alphabet: ['0', '1'] }).detail).toBeUndefined();
		expect(
			structureValid({ type: 'build-dfsm', alphabet: ['0'], constraints: { complete: false } })
				.detail
		).toBeUndefined();
	});
});

describe('the lists and the guiding question', () => {
	it('has the headings of the two lists and the words for an empty or a cut list', () => {
		expect(listHeadings.accepted).toBe('feedback.list_accepted');
		expect(listHeadings.rejected).toBe('feedback.list_rejected');
		expect(listHeadings.none).toBe('feedback.list_none');
		expect(listHeadings.truncated).toBe('feedback.list_truncated');
	});

	it('asks one question about where the machine is after the string, and never names a fix', () => {
		const guide = guideOf(wrong());
		expect(guide).toEqual({
			heading: { key: 'feedback.computation_heading', params: { string: '10' } },
			question: { key: 'feedback.guide_end', params: { string: '10', states: 'a' } }
		});
		for (const key of [
			'feedback.guide_end',
			'feedback.guide_empty_accepts',
			'feedback.guide_empty_rejects'
		] as const) {
			for (const table of [idMessages, enMessages]) {
				expect(table[key], key).not.toMatch(/tambah|hapus|add a|remove|ubah menjadi|change to/i);
			}
		}
	});

	it('asks about the empty string when that is the shortest wrong string', () => {
		const guide = guideOf(
			wrong({
				witness: { text: 'ε', input: '' },
				computation: { rows: [], end: ['a'], accepted: true }
			})
		);
		expect(guide?.question).toEqual({ key: 'feedback.guide_empty_accepts', params: {} });
		const rejects = guideOf(
			wrong({
				witness: { text: 'ε', input: '' },
				computation: { rows: [], end: ['a'], accepted: false }
			})
		);
		expect(rejects?.question).toEqual({ key: 'feedback.guide_empty_rejects', params: {} });
	});

	it('has no question when the run was stopped, and for a verdict that is not wrong', () => {
		expect(guideOf(wrong({ computation: null }))).toBeNull();
		expect(guideOf({ kind: 'right' })).toBeNull();
	});

	it('writes a set of states as one name, or a list in braces', () => {
		expect(
			guideOf(wrong({ computation: { rows: [], end: ['a', 'b'], accepted: false } }))?.question
				.params
		).toMatchObject({
			states: '{a, b}'
		});
		expect(
			guideOf(wrong({ computation: { rows: [], end: [], accepted: false } }))?.question.params
		).toMatchObject({
			states: '∅'
		});
	});
});
