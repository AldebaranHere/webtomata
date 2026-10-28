// The work of a student on a question (Q3b): one saved machine for each question, in the same store as
// "Mesin saya", under the id `soal:<id of the question>`. There is no new field and no migration: the
// id says what the record is. The Sandbox and the list of machines leave these records out
// (`isQuestionRecord`), so the machine of a question is never opened as the last machine of the
// Sandbox, and the list of the student has only what the student made there. Q5 finds them by the
// prefix too.
import { applyCommand } from '../editor/commands.ts';
import type { Command } from '../editor/commands.ts';
import { createDocument, serializeDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import type { QuestionType } from '../questions/types.ts';
import { readStoredDocument } from './migrate.ts';
import type { MachineStore, SavedMachine, Titles } from './store.ts';

export const QUESTION_PREFIX = 'soal:';

export const questionRecordId = (questionId: string): string => QUESTION_PREFIX + questionId;
export const isQuestionRecord = (id: string): boolean => id.startsWith(QUESTION_PREFIX);

/** What a question needs to start its machine. */
export interface QuestionStart {
	id: string;
	/** The title in both languages: the bar of the editor shows the one of the language of the page. */
	title: Titles;
	type: QuestionType;
	alphabet: readonly string[];
}

/**
 * An empty machine with the alphabet of the question: a DFSM, or an NDFSM for an NDFSM question. Its title is
 * the (Indonesian) title of the question; the record keeps both, so the bar shows the one of the page.
 */
export function startDocument(
	question: Pick<QuestionStart, 'type' | 'alphabet' | 'title'>
): MachineDocument {
	const commands: Command[] = question.alphabet.map((symbol) => ({ type: 'addSymbol', symbol }));
	commands.push({ type: 'setTitle', title: question.title.id });
	if (question.type === 'build-ndfsm') commands.push({ type: 'setKind', kind: 'ndfsm' });
	const result = applyCommand(createDocument(), { type: 'batch', commands });
	// The alphabet of a question passed the schema, so it passes the rules of a document; if it did not, start empty.
	return result.ok ? result.doc : createDocument();
}

export interface QuestionWork {
	record: SavedMachine;
	doc: MachineDocument;
	/** The record was made now. */
	fresh: boolean;
	/** A record was there and could not be read: it is kept as it is until the first change is saved. */
	unreadable: boolean;
}

/**
 * The record of a question: opens what the student saved, or makes the record. A record that cannot be
 * read is not changed here (it is the base of the autosave, which replaces it at the first change), and
 * a store that refuses the first write does not stop the machine from opening: the save says so later.
 */
export async function openQuestionWork(
	store: MachineStore,
	question: QuestionStart,
	now: () => number = Date.now
): Promise<QuestionWork> {
	const id = questionRecordId(question.id);
	const found = await store.get(id);
	if (found) {
		const read = readStoredDocument(found.doc);
		if (read.ok) return { record: found, doc: read.doc, fresh: false, unreadable: false };
		return { record: found, doc: startDocument(question), fresh: false, unreadable: true };
	}
	const doc = startDocument(question);
	const time = now();
	const record: SavedMachine = {
		id,
		recordVersion: 1,
		title: doc.title,
		kind: doc.kind,
		titles: question.title,
		createdAt: time,
		updatedAt: time,
		openedAt: time,
		doc: serializeDocument(doc)
	};
	try {
		await store.put(record);
	} catch {
		// The machine opens all the same; the first save will tell that the store does not work.
	}
	return { record, doc, fresh: true, unreadable: false };
}
