// The questions of content/questions, read when the site is built (docs/decisions/0029). Only server code
// imports this (the pages are prerendered), so the YAML reader and the schema validator are not in the code
// that the browser loads. A file that breaks a rule fails the build with its name and line.
import { createSchemaValidator } from '#lib/questions/load.ts';
import { loadQuestions } from '#lib/questions/summaries.ts';
import type { Question } from '#lib/questions/types.ts';
import schema from '../../../../content/questions/schema.json';

const files = import.meta.glob('../../../../content/questions/*.{yaml,yml}', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

/** Every question, in the order of the file names. */
export const allQuestions = (): Question[] => loadQuestions(files, createSchemaValidator(schema));
