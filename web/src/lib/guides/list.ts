// Pure data helpers for the Panduan list (/panduan) and guide page (/panduan/[id]).
import type { ListItem as QuestionListItem } from '#lib/questions/list.ts';
import { sortItems as sortQuestions } from '#lib/questions/list.ts';
import type { Guide, GuideSection, GuideText, GuideTopic, InlinePiece } from './types.ts';

export const TOPICS: readonly GuideTopic[] = ['dfsm', 'ndfsm', 'regex', 'operasi'];

export interface GuideListItem {
	id: string;
	order: number;
	topic: GuideTopic;
	readingMinutes: number;
	cardTitle: GuideText;
	summary: GuideText;
	questionCount: number;
}

export interface LinkedQuestion {
	id: string;
	title: { id: string; en: string };
	difficulty: 1 | 2 | 3;
}

export interface GuideNavLink {
	id: string;
	cardTitle: GuideText;
}

export interface GuidePage {
	id: string;
	topic: GuideTopic;
	readingMinutes: number;
	title: GuideText;
	summary: GuideText;
	referencesText: string | null;
	intro: InlinePiece[][];
	sections: GuideSection[];
	linkedQuestions: LinkedQuestion[];
	prev: GuideNavLink | null;
	next: GuideNavLink | null;
}

export function sortGuides<T extends { order: number; id: string }>(items: readonly T[]): T[] {
	return [...items].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function guideSummaryOf(
	guide: Guide,
	questions: readonly Pick<QuestionListItem, 'pattern'>[]
): GuideListItem {
	const questionCount = questions.filter((q) => q.pattern === guide.id).length;
	return {
		id: guide.id,
		order: guide.order,
		topic: guide.topic,
		readingMinutes: guide.readingMinutes,
		cardTitle: guide.cardTitle,
		summary: guide.summary,
		questionCount
	};
}

export function referencesTextOf(references: Guide['references']): string | null {
	const parts = [
		references?.rich && references.rich.length > 0 ? `Rich ${references.rich.join(', ')}` : '',
		references?.sipser && references.sipser.length > 0
			? `Sipser ${references.sipser.join(', ')}`
			: ''
	].filter((part) => part !== '');
	return parts.length > 0 ? parts.join(' · ') : null;
}

export function guidePageOf(
	guide: Guide,
	allGuides: readonly Guide[],
	questions: readonly QuestionListItem[]
): GuidePage {
	const sorted = sortGuides(allGuides);
	const idx = sorted.findIndex((g) => g.id === guide.id);
	const prevGuide = idx > 0 ? sorted[idx - 1]! : null;
	const nextGuide = idx >= 0 && idx + 1 < sorted.length ? sorted[idx + 1]! : null;
	const linkedQuestions = sortQuestions(questions.filter((q) => q.pattern === guide.id)).map(
		(q) => ({
			id: q.id,
			title: q.title,
			difficulty: q.difficulty
		})
	);

	return {
		id: guide.id,
		topic: guide.topic,
		readingMinutes: guide.readingMinutes,
		title: guide.title,
		summary: guide.summary,
		referencesText: referencesTextOf(guide.references),
		intro: guide.intro,
		sections: guide.sections,
		linkedQuestions,
		prev: prevGuide ? { id: prevGuide.id, cardTitle: prevGuide.cardTitle } : null,
		next: nextGuide ? { id: nextGuide.id, cardTitle: nextGuide.cardTitle } : null
	};
}

export function applyTopicFilter(
	items: readonly GuideListItem[],
	topic: GuideTopic | null
): GuideListItem[] {
	return topic === null ? [...items] : items.filter((item) => item.topic === topic);
}

export function topicToSearch(topic: GuideTopic | null): string {
	return topic === null ? '' : `?topik=${topic}`;
}

export function parseTopicFilter(search: string): GuideTopic | null {
	const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	const raw = params.get('topik');
	return TOPICS.find((t) => t === raw) ?? null;
}
