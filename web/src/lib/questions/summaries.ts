// The questions as the site's build reads them: every file of content/questions is checked with
// the same loader and schema as `pnpm check:questions`, and what the list needs is kept (the
// statement and the solution are not part of it). A file that does not follow the rules fails the
// build with its name and the line, so a broken question can never reach the site.
import { FILE, parseQuestionFile } from './load.ts';
import type { SchemaValidator } from './load.ts';
import type { ListItem } from './list.ts';
import type { Question } from './types.ts';

export function summaryOf(question: Question): ListItem {
	return {
		id: question.id,
		title: question.title,
		type: question.type,
		difficulty: question.difficulty,
		week: question.week,
		pattern: question.pattern
	};
}

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/**
 * The summaries of the files (`{ path: text }`, as `import.meta.glob` gives them), in the order of
 * the file names. A name that starts with an underscore is a template and is skipped. Throws one
 * error that lists every problem of every file.
 */
export function loadSummaries(
	files: Readonly<Record<string, string>>,
	validate: SchemaValidator
): ListItem[] {
	const names = Object.keys(files)
		.filter((path) => !baseName(path).startsWith('_'))
		.sort((a, b) => (baseName(a) < baseName(b) ? -1 : baseName(a) > baseName(b) ? 1 : 0));
	const found: string[] = [];
	const items: ListItem[] = [];
	const owners = new Map<string, string>();
	for (const path of names) {
		const name = baseName(path);
		const { question, problems } = parseQuestionFile(files[path]!, validate);
		for (const p of problems) {
			const where = p.line === undefined ? name : `${name}:${p.line}`;
			found.push(`${where}: ${p.path === FILE ? '' : `${p.path}: `}${p.message}`);
		}
		if (!question) continue;
		const expected = name.replace(/\.ya?ml$/, '');
		if (question.id !== expected) {
			found.push(`${name}: id: the id "${question.id}" must be the name of the file (${expected})`);
			continue;
		}
		const other = owners.get(question.id);
		if (other !== undefined) {
			found.push(`${name}: id: the id "${question.id}" is also used by ${other}`);
			continue;
		}
		owners.set(question.id, name);
		items.push(summaryOf(question));
	}
	if (found.length > 0) {
		throw new Error(
			`The question files have problems:\n${found.map((line) => `  ${line}`).join('\n')}`
		);
	}
	return items;
}
