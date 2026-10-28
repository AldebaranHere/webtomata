// The progress of a student on the questions (Q5), kept on this device: one small value in the saved record of
// each question (`soal:<id>`, see question-work.ts), so there is no new store and no migration. A question is
// "attempted" after one check that said something about the machine, and "solved" after one check that said
// "Tepat.", for good: a later change of the machine does not take it back. Anything may have written the field
// (it is data from the device), so it is read with `readProgress`, which never throws.
import type { MachineStore, SavedMachine } from './store.ts';
import { QUESTION_PREFIX, isQuestionRecord } from './question-work.ts';

export interface Progress {
	/** How many checks said something about the machine (a verdict or a problem of the structure). */
	checks: number;
	/** At least one check said that the answer is right. */
	solved: boolean;
	/** When it was first solved (milliseconds). */
	solvedAt?: number;
	/** When the last check was made (milliseconds). */
	checkedAt: number;
}

export type Status = 'none' | 'attempted' | 'solved';

const MAX_CHECKS = 1_000_000;
const isTime = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

/** The progress in a record, or undefined when the value is not a good one. */
export function readProgress(value: unknown): Progress | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
	const { checks, solved, solvedAt, checkedAt } = value as Record<string, unknown>;
	if (!Number.isSafeInteger(checks) || (checks as number) < 1 || (checks as number) > MAX_CHECKS) {
		return undefined;
	}
	if (typeof solved !== 'boolean' || !isTime(checkedAt)) return undefined;
	if (solvedAt !== undefined && !isTime(solvedAt)) return undefined;
	return {
		checks: checks as number,
		solved,
		...(solvedAt !== undefined ? { solvedAt } : {}),
		checkedAt
	};
}

export const sameProgress = (a: Progress | undefined, b: Progress | undefined): boolean =>
	a === b ||
	(a !== undefined &&
		b !== undefined &&
		a.checks === b.checks &&
		a.solved === b.solved &&
		a.solvedAt === b.solvedAt &&
		a.checkedAt === b.checkedAt);

/**
 * The progress after a check. A wrong answer or a problem of the structure counts as an attempt; a right answer
 * solves the question (and the first time is kept). A check that was stopped or could not run says nothing about
 * the machine, so it changes nothing: the value that was given comes back.
 */
export function recordCheck(
	previous: Progress | undefined,
	kind: 'right' | 'wrong' | 'structure' | 'stopped' | 'failed',
	now: number
): Progress | undefined {
	if (kind === 'stopped' || kind === 'failed') return previous;
	const solved = previous?.solved === true || kind === 'right';
	const solvedAt = previous?.solvedAt ?? (kind === 'right' ? now : undefined);
	return {
		checks: (previous?.checks ?? 0) + 1,
		solved,
		...(solvedAt !== undefined ? { solvedAt } : {}),
		checkedAt: now
	};
}

export const statusOf = (progress: Progress | undefined): Status =>
	progress === undefined ? 'none' : progress.solved ? 'solved' : 'attempted';

/** How many of the questions of a list are solved or only attempted. A question that is not in the list is not counted. */
export function summarize(
	questions: readonly { id: string }[],
	progress: ReadonlyMap<string, Progress>
): { solved: number; attempted: number; total: number } {
	let solved = 0;
	let attempted = 0;
	for (const { id } of questions) {
		const status = statusOf(progress.get(id));
		if (status === 'solved') solved += 1;
		else if (status === 'attempted') attempted += 1;
	}
	return { solved, attempted, total: questions.length };
}

/** The progress of each question, by the id of the question. Records that are not questions are not read. */
export async function loadProgress(store: MachineStore): Promise<Map<string, Progress>> {
	const map = new Map<string, Progress>();
	for (const record of await store.list()) {
		if (!isQuestionRecord(record.id)) continue;
		const progress = readProgress((record as SavedMachine).progress);
		if (progress) map.set(record.id.slice(QUESTION_PREFIX.length), progress);
	}
	return map;
}

/**
 * Takes the progress off every question record (a bad value too). The machines stay as they are, and so does
 * every record that is not a question. Returns how many records were changed.
 */
export async function resetProgress(store: MachineStore): Promise<number> {
	let changed = 0;
	for (const record of await store.list()) {
		if (!isQuestionRecord(record.id) || !('progress' in record)) continue;
		const rest = { ...record };
		delete rest.progress;
		await store.put(rest);
		changed += 1;
	}
	return changed;
}
