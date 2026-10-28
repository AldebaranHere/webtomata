// The answer file of a question, `/soal/<id>/jawaban.json`: the solution, made when the site is built. The page
// of the question does not carry it; the page fetches it when the student asks to check an answer (Q4). There
// is no backend, so anyone can read it: the roadmap accepts that, and the authoring guide says it.
import { error, json } from '@sveltejs/kit';
import { answerFileOf } from '#lib/questions/answer.ts';
import { allQuestions } from '#lib/server/questions.ts';

export const prerender = true;

/** One file for each machine question (a regular expression question has no machine to compare yet). */
export function entries() {
	return allQuestions()
		.filter((question) => answerFileOf(question) !== null)
		.map((question) => ({ id: question.id }));
}

export function GET({ params }: { params: { id: string } }) {
	const question = allQuestions().find((q) => q.id === params.id);
	const file = question ? answerFileOf(question) : null;
	if (!file) error(404, 'There is no such answer.');
	return json(file);
}
