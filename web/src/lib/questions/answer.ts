// The answer file of a question (Q4a): the solution, in a file of its own, `/soal/<id>/jawaban.json`. The page
// of a question does not carry it; the page fetches it only when the student asks to check an answer. There
// is no backend, so the solution is visible to anyone who looks for the file: the roadmap accepts that for a
// learning tool, and it is written in the authoring guide. The file comes from our own site, but it is read
// like any input: its size is checked, and its shape.
import { message } from '../editor/document.ts';
import type { Result } from '../editor/document.ts';
import type { Question, SolutionMachine } from './types.ts';

export interface Answer {
	solution: SolutionMachine;
}

/** The biggest answer file that is read (the question files are at most 64 KB). */
export const ANSWER_BYTE_LIMIT = 64 * 1024;

/** What the answer file of a question holds, or null for a question that has no machine to compare. */
export function answerFileOf(
	question: Pick<Question, 'type' | 'solution'>
): { schemaVersion: 1; solution: SolutionMachine } | null {
	if (question.type === 'write-regex') return null;
	return { schemaVersion: 1, solution: question.solution as SolutionMachine };
}

const isStrings = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((item) => typeof item === 'string');

const unusable = () => ({ ok: false as const, error: message('feedback.answer_unusable') });

/** Fetches and checks the answer file. It never throws: any problem is `feedback.answer_unusable`. */
export async function loadAnswer(
	url: string,
	fetcher: typeof fetch = fetch
): Promise<Result<Answer>> {
	try {
		const response = await fetcher(url);
		if (!response.ok) return unusable();
		const text = await response.text();
		if (new TextEncoder().encode(text).length > ANSWER_BYTE_LIMIT) return unusable();
		const value: unknown = JSON.parse(text);
		if (typeof value !== 'object' || value === null || Array.isArray(value)) return unusable();
		const file = value as { schemaVersion?: unknown; solution?: unknown };
		if (file.schemaVersion !== 1) return unusable();
		const solution = file.solution as Partial<SolutionMachine> | null;
		if (
			typeof solution !== 'object' ||
			solution === null ||
			typeof solution.start !== 'string' ||
			!isStrings(solution.accepting) ||
			!isStrings(solution.transitions) ||
			(solution.states !== undefined && !isStrings(solution.states))
		) {
			return unusable();
		}
		return {
			ok: true,
			value: {
				solution: {
					start: solution.start,
					accepting: solution.accepting,
					transitions: solution.transitions,
					...(solution.states ? { states: solution.states } : {})
				}
			}
		};
	} catch {
		return unusable();
	}
}
