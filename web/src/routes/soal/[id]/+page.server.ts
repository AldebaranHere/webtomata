// The page of each question is made when the site is built, from content/questions (see the list in
// ../+page.server.ts, and docs/decisions/0029). The page gets what it shows (the statement, the
// alphabet, the constraints, the place in the list) and not the solution, the examples or the hints.
import { error } from '@sveltejs/kit';
import { createSchemaValidator } from '#lib/questions/load.ts';
import { positionOf, sortItems } from '#lib/questions/list.ts';
import { loadQuestions, pageOf, summaryOf } from '#lib/questions/summaries.ts';
import schema from '../../../../../content/questions/schema.json';

export const prerender = true;

const files = import.meta.glob('../../../../../content/questions/*.{yaml,yml}', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

const questions = () => loadQuestions(files, createSchemaValidator(schema));

/** One page for each question. */
export function entries() {
	return questions().map((question) => ({ id: question.id }));
}

export function load({ params }: { params: { id: string } }) {
	const all = questions();
	const question = all.find((q) => q.id === params.id);
	if (!question) error(404, 'There is no such question.');
	const position = positionOf(sortItems(all.map(summaryOf)), question.id);
	return { question: pageOf(question, position ?? { n: 1, total: all.length }) };
}
