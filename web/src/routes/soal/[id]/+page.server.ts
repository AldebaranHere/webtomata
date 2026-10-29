// The page of each question is made when the site is built, from content/questions (see the list in
// ../+page.server.ts, and docs/decisions/0029). The page gets what it shows (the statement, the
// alphabet, the constraints, the hints, the place in the list) and not the solution or the examples (the
// solution is in jawaban.json, which the page fetches when the student asks to check an answer).
import { error } from '@sveltejs/kit';
import { positionOf, sortItems } from '#lib/questions/list.ts';
import { pageOf, summaryOf } from '#lib/questions/summaries.ts';
import { allGuides } from '#lib/server/guides.ts';
import { allQuestions } from '#lib/server/questions.ts';

export const prerender = true;

const questions = allQuestions;

/** One page for each question. */
export function entries() {
	return questions().map((question) => ({ id: question.id }));
}

export function load({ params }: { params: { id: string } }) {
	const all = questions();
	const question = all.find((q) => q.id === params.id);
	if (!question) error(404, 'There is no such question.');
	const position = positionOf(sortItems(all.map(summaryOf)), question.id);
	const hasGuide = allGuides().some((g) => g.id === question.pattern);
	return { question: pageOf(question, position ?? { n: 1, total: all.length }, hasGuide) };
}
