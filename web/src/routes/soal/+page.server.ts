// The list of questions is made when the site is built, from content/questions: a file that breaks
// the rules fails the build (with its name and line), so a broken question never reaches the site.
// This file runs only at build time, so the YAML reader and the schema validator are not in the
// code that the browser loads.
import { createSchemaValidator } from '#lib/questions/load.ts';
import { sortItems } from '#lib/questions/list.ts';
import { loadSummaries } from '#lib/questions/summaries.ts';
import schema from '../../../../content/questions/schema.json';

export const prerender = true;

const files = import.meta.glob('../../../../content/questions/*.{yaml,yml}', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

export function load() {
	return { questions: sortItems(loadSummaries(files, createSchemaValidator(schema))) };
}
