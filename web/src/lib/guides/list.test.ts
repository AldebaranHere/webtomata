import { describe, expect, it } from 'vitest';
import {
	applyTopicFilter,
	guidePageOf,
	guideSummaryOf,
	parseTopicFilter,
	referencesTextOf,
	sortGuides,
	topicToSearch
} from './list.ts';
import type { Guide } from './types.ts';
import type { ListItem as QuestionListItem } from '#lib/questions/list.ts';

const makeGuide = (overrides: Partial<Guide> = {}): Guide => ({
	schemaVersion: 1,
	id: 'berakhiran-x',
	order: 1,
	topic: 'dfsm',
	readingMinutes: 6,
	cardTitle: { id: 'String berakhiran x', en: 'Strings ending with x' },
	title: { id: 'Cara membuat DFSM untuk string berakhiran x' },
	summary: { id: 'State mengingat akhiran terpanjang.' },
	references: { rich: ['5.2'], sipser: ['1.1'] },
	intro: [[{ kind: 'text', text: 'Intro' }]],
	sections: [
		{
			id: 'ide',
			heading: 'Ide dasarnya',
			blocks: [{ kind: 'paragraph', pieces: [{ kind: 'text', text: 'Isi' }] }]
		}
	],
	...overrides
});

const QUESTIONS: QuestionListItem[] = [
	{
		id: 'berakhiran-10',
		title: { id: 'String yang diakhiri 10', en: 'Strings that end with 10' },
		type: 'build-dfsm',
		difficulty: 1,
		week: 1,
		pattern: 'berakhiran-x'
	},
	{
		id: 'mengandung-101',
		title: { id: 'String yang mengandung 101', en: 'Strings that contain 101' },
		type: 'build-ndfsm',
		difficulty: 2,
		week: 2,
		pattern: 'menebak'
	}
];

describe('guide list and page helpers', () => {
	it('counts linked questions by pattern and sorts guides by order', () => {
		const g1 = makeGuide({ id: 'berakhiran-x', order: 2 });
		const g2 = makeGuide({ id: 'menebak', order: 1, topic: 'ndfsm' });
		const sorted = sortGuides([g1, g2]).map((g) => guideSummaryOf(g, QUESTIONS));
		expect(sorted.map((s) => s.id)).toEqual(['menebak', 'berakhiran-x']);
		expect(sorted[0]!.questionCount).toBe(1);
		expect(sorted[1]!.questionCount).toBe(1);
	});

	it('filters by topic and parses ?topik= from the URL', () => {
		const items = [
			guideSummaryOf(makeGuide({ id: 'berakhiran-x', topic: 'dfsm' }), QUESTIONS),
			guideSummaryOf(makeGuide({ id: 'menebak', topic: 'ndfsm' }), QUESTIONS)
		];
		expect(parseTopicFilter('?topik=dfsm')).toBe('dfsm');
		expect(parseTopicFilter('?topik=ndfsm')).toBe('ndfsm');
		expect(parseTopicFilter('?topik=unknown')).toBeNull();
		expect(parseTopicFilter('')).toBeNull();
		expect(topicToSearch('dfsm')).toBe('?topik=dfsm');
		expect(topicToSearch(null)).toBe('');
		expect(applyTopicFilter(items, 'ndfsm').map((i) => i.id)).toEqual(['menebak']);
		expect(applyTopicFilter(items, null)).toHaveLength(2);
	});

	it('builds a GuidePage with linked questions, references and prev/next links', () => {
		const g1 = makeGuide({ id: 'berakhiran-x', order: 1 });
		const g2 = makeGuide({
			id: 'menebak',
			order: 2,
			topic: 'ndfsm',
			cardTitle: { id: 'Menebak dan transisi ε' }
		});
		const page1 = guidePageOf(g1, [g2, g1], QUESTIONS);
		expect(page1.referencesText).toBe('Rich 5.2 · Sipser 1.1');
		expect(page1.linkedQuestions.map((q) => q.id)).toEqual(['berakhiran-10']);
		expect(page1.prev).toBeNull();
		expect(page1.next?.id).toBe('menebak');

		const page2 = guidePageOf(g2, [g2, g1], QUESTIONS);
		expect(page2.prev?.id).toBe('berakhiran-x');
		expect(page2.next).toBeNull();
		expect(referencesTextOf(undefined)).toBeNull();
	});
});
