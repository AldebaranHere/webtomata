// The list of guides is made at build time from content/guides (G1), paired with the questions in
// content/questions so each card shows how many practice questions use that pattern.
import { guideSummaryOf, sortGuides } from '#lib/guides/list.ts';
import { summaryOf } from '#lib/questions/summaries.ts';
import { allGuides } from '#lib/server/guides.ts';
import { allQuestions } from '#lib/server/questions.ts';

export const prerender = true;

export function load() {
	const questions = allQuestions().map(summaryOf);
	const guides = sortGuides(allGuides()).map((guide) => guideSummaryOf(guide, questions));
	return { guides };
}
