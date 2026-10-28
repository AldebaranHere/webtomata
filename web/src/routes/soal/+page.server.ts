// The list of questions is made when the site is built, from content/questions: a file that breaks
// the rules fails the build (with its name and line), so a broken question never reaches the site.
// This file runs only at build time, so the YAML reader and the schema validator are not in the
// code that the browser loads (see #lib/server/questions.ts).
import { sortItems } from '#lib/questions/list.ts';
import { summaryOf } from '#lib/questions/summaries.ts';
import { allQuestions } from '#lib/server/questions.ts';

export const prerender = true;

export function load() {
	return { questions: sortItems(allQuestions().map(summaryOf)) };
}
