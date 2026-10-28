import { describe, expect, it } from 'vitest';
import { serializeDocument } from '../editor/document.ts';
import { documentFrom, endsWith01 } from '../editor/diagram/samples.ts';
import { createMemoryStore } from './memory.ts';
import { listEntries } from './library.ts';
import { createMachine, openLatest } from './machines.ts';
import {
	QUESTION_PREFIX,
	isQuestionRecord,
	openQuestionWork,
	questionRecordId,
	startDocument
} from './question-work.ts';
import type { MachineStore, SavedMachine } from './store.ts';

const question = {
	id: 'berakhiran-10',
	title: { id: 'String yang diakhiri 10', en: 'Strings that end with 10' },
	type: 'build-dfsm' as const,
	alphabet: ['0', '1']
};

describe('the id of a question record', () => {
	it('starts with soal: and is not the id of a machine that the student makes', () => {
		expect(QUESTION_PREFIX).toBe('soal:');
		expect(questionRecordId('berakhiran-10')).toBe('soal:berakhiran-10');
		expect(isQuestionRecord('soal:berakhiran-10')).toBe(true);
		expect(isQuestionRecord('3f9c1a6e-0000-4000-8000-000000000000')).toBe(false);
		expect(isQuestionRecord('')).toBe(false);
		expect(isQuestionRecord('xsoal:a')).toBe(false);
	});
});

describe('startDocument', () => {
	it('is an empty machine with the alphabet of the question', () => {
		const doc = startDocument(question);
		expect(doc.alphabet).toEqual(['0', '1']);
		expect(doc.states).toEqual([]);
		expect(doc.start).toBeNull();
		expect(doc.kind).toBe('dfsm');
		expect(doc.title).toBe('String yang diakhiri 10');
	});

	it('is an NDFSM for an NDFSM question, and a DFSM for the other types', () => {
		expect(startDocument({ ...question, type: 'build-ndfsm' }).kind).toBe('ndfsm');
		expect(startDocument({ ...question, type: 'write-regex' }).kind).toBe('dfsm');
	});

	it('keeps symbols of several characters', () => {
		expect(startDocument({ ...question, alphabet: ['num', 'plus'] }).alphabet).toEqual([
			'num',
			'plus'
		]);
	});
});

describe('openQuestionWork', () => {
	it('makes the record the first time, and saves it with the alphabet', async () => {
		const store = createMemoryStore();
		const work = await openQuestionWork(store, question, () => 700);
		expect(work.fresh).toBe(true);
		expect(work.unreadable).toBe(false);
		expect(work.record).toMatchObject({
			id: 'soal:berakhiran-10',
			recordVersion: 1,
			kind: 'dfsm',
			createdAt: 700,
			openedAt: 700,
			title: 'String yang diakhiri 10',
			titles: question.title
		});
		expect(work.doc.alphabet).toEqual(['0', '1']);
		const all = await store.list();
		expect(all.map((r) => r.id)).toEqual(['soal:berakhiran-10']);
	});

	it('opens what the student saved, and makes no second record', async () => {
		const store = createMemoryStore();
		const mine = endsWith01();
		await store.put({
			id: 'soal:berakhiran-10',
			recordVersion: 1,
			title: mine.title,
			kind: mine.kind,
			createdAt: 1,
			updatedAt: 2,
			openedAt: 2,
			doc: serializeDocument(mine)
		});
		const work = await openQuestionWork(store, question, () => 900);
		expect(work.fresh).toBe(false);
		expect(work.unreadable).toBe(false);
		expect(work.doc.states).toHaveLength(3);
		expect(work.record.id).toBe('soal:berakhiran-10');
		expect(await store.list()).toHaveLength(1);
	});

	it('does not touch a record that cannot be read: it starts a new machine in memory and keeps the old text', async () => {
		const store = createMemoryStore();
		await store.put({
			id: 'soal:berakhiran-10',
			recordVersion: 1,
			title: '',
			kind: 'dfsm',
			createdAt: 1,
			updatedAt: 2,
			openedAt: 2,
			doc: '{not json'
		});
		const work = await openQuestionWork(store, question, () => 900);
		expect(work.unreadable).toBe(true);
		expect(work.doc.alphabet).toEqual(['0', '1']);
		expect(work.doc.states).toEqual([]);
		// Nothing was written: the old text is still there until the student changes the machine.
		expect((await store.get('soal:berakhiran-10'))!.doc).toBe('{not json');
	});

	it('works when the store refuses the first write: the machine opens, and the save will say so', async () => {
		const refusing: MachineStore = {
			...createMemoryStore(),
			async put() {
				throw new Error('quota');
			}
		};
		const work = await openQuestionWork(refusing, question, () => 1);
		expect(work.fresh).toBe(true);
		expect(work.doc.alphabet).toEqual(['0', '1']);
	});

	it('is one record for each question, so two questions never share work', async () => {
		const store = createMemoryStore();
		await openQuestionWork(store, question, () => 1);
		await openQuestionWork(store, { ...question, id: 'other' }, () => 2);
		expect((await store.list()).map((r) => r.id).sort()).toEqual([
			'soal:berakhiran-10',
			'soal:other'
		]);
	});
});

describe('the records of questions are not machines of the Sandbox', () => {
	const sandboxSample = () => ({ doc: documentFrom({ title: 'Contoh', states: [[0, 0]] }) });

	it('openLatest never opens one, even when it was opened last', async () => {
		const store = createMemoryStore();
		const mine = await createMachine(store, endsWith01(), () => 10);
		await openQuestionWork(store, question, () => 5000);
		const opened = await openLatest(store, sandboxSample, () => 6000);
		expect(opened.record.id).toBe(mine.id);
		expect(opened.doc.title).toBe('Berakhiran 01');
	});

	it('openLatest with only question records makes a sample, and leaves the questions alone', async () => {
		const store = createMemoryStore();
		await openQuestionWork(store, question, () => 5000);
		const opened = await openLatest(store, sandboxSample, () => 6000);
		expect(opened.doc.title).toBe('Contoh');
		expect(isQuestionRecord(opened.record.id)).toBe(false);
		const all = await store.list();
		expect(all).toHaveLength(2);
		expect(all.find((r) => r.id === 'soal:berakhiran-10')!.openedAt).toBe(5000);
	});

	it('the list "Mesin saya" does not show them', async () => {
		const store = createMemoryStore();
		await createMachine(store, endsWith01(), () => 10);
		await openQuestionWork(store, question, () => 5000);
		const entries = await listEntries(store);
		expect(entries).toHaveLength(1);
		expect(entries.every((e) => !isQuestionRecord(e.id))).toBe(true);
	});

	it('a record is a question record by its id only, whatever its title says', async () => {
		const store = createMemoryStore();
		const record: SavedMachine = {
			id: 'abc',
			recordVersion: 1,
			title: 'soal:x',
			kind: 'dfsm',
			createdAt: 1,
			updatedAt: 1,
			openedAt: 1,
			doc: serializeDocument(endsWith01())
		};
		await store.put(record);
		expect(await listEntries(store)).toHaveLength(1);
	});
});
