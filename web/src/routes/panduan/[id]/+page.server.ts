// One prerendered page for each guide in content/guides (G1).
import { error } from '@sveltejs/kit';
import { guidePageOf } from '#lib/guides/list.ts';
import { summaryOf } from '#lib/questions/summaries.ts';
import { allGuides } from '#lib/server/guides.ts';
import { allQuestions } from '#lib/server/questions.ts';

export const prerender = true;

export function entries() {
	return allGuides().map((guide) => ({ id: guide.id }));
}

export function load({ params }: { params: { id: string } }) {
	const guides = allGuides();
	const guide = guides.find((g) => g.id === params.id);
	if (!guide) error(404, 'There is no such guide.');
	const questions = allQuestions().map(summaryOf);
	return { guide: guidePageOf(guide, guides, questions) };
}
