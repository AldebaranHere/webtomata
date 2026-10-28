import { describe, expect, it } from 'vitest';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { serializeDocument } from '../editor/document.ts';
import { createMemoryStore } from './memory.ts';
import {
	loadProgress,
	readProgress,
	recordCheck,
	resetProgress,
	statusOf,
	summarize
} from './progress.ts';
import type { Progress } from './progress.ts';
import type { SavedMachine } from './store.ts';

const record = (id: string, progress?: unknown): SavedMachine =>
	({
		id,
		recordVersion: 1,
		title: '',
		kind: 'dfsm',
		createdAt: 1,
		updatedAt: 1,
		openedAt: 1,
		doc: serializeDocument(endsWith01()),
		...(progress === undefined ? {} : { progress })
	}) as SavedMachine;

describe('readProgress', () => {
	it('reads a good value', () => {
		expect(readProgress({ checks: 3, solved: true, solvedAt: 10, checkedAt: 20 })).toEqual({
			checks: 3,
			solved: true,
			solvedAt: 10,
			checkedAt: 20
		});
		expect(readProgress({ checks: 1, solved: false, checkedAt: 5 })).toEqual({
			checks: 1,
			solved: false,
			checkedAt: 5
		});
	});

	it('takes anything that is not a good value as no progress, and never throws', () => {
		for (const value of [
			undefined,
			null,
			'x',
			7,
			[],
			{},
			{ checks: 0, solved: false, checkedAt: 1 },
			{ checks: -1, solved: false, checkedAt: 1 },
			{ checks: 1.5, solved: false, checkedAt: 1 },
			{ checks: 1_000_001, solved: false, checkedAt: 1 },
			{ checks: '1', solved: false, checkedAt: 1 },
			{ checks: 1, solved: 'yes', checkedAt: 1 },
			{ checks: 1, solved: false },
			{ checks: 1, solved: false, checkedAt: NaN },
			{ checks: 1, solved: true, solvedAt: 'x', checkedAt: 1 }
		]) {
			expect(readProgress(value), JSON.stringify(value)).toBeUndefined();
		}
	});

	it('does not keep a field that it does not know', () => {
		const read = readProgress({ checks: 1, solved: false, checkedAt: 1, extra: 'x' });
		expect(read && Object.keys(read).sort()).toEqual(['checkedAt', 'checks', 'solved']);
	});
});

describe('recordCheck', () => {
	it('makes the first attempt from a wrong answer or a structure problem', () => {
		for (const kind of ['wrong', 'structure'] as const) {
			expect(recordCheck(undefined, kind, 100)).toEqual({
				checks: 1,
				solved: false,
				checkedAt: 100
			});
		}
	});

	it('solves on a right answer, and remembers when it was first solved', () => {
		const first = recordCheck(undefined, 'right', 100)!;
		expect(first).toEqual({ checks: 1, solved: true, solvedAt: 100, checkedAt: 100 });
		const again = recordCheck(first, 'right', 300)!;
		expect(again).toEqual({ checks: 2, solved: true, solvedAt: 100, checkedAt: 300 });
	});

	it('stays solved after a later wrong check, and counts it', () => {
		const solved = recordCheck(undefined, 'right', 100)!;
		expect(recordCheck(solved, 'wrong', 200)).toEqual({
			checks: 2,
			solved: true,
			solvedAt: 100,
			checkedAt: 200
		});
	});

	it('does not count a check that was stopped or could not run', () => {
		expect(recordCheck(undefined, 'stopped', 1)).toBeUndefined();
		expect(recordCheck(undefined, 'failed', 1)).toBeUndefined();
		const before: Progress = { checks: 2, solved: false, checkedAt: 5 };
		expect(recordCheck(before, 'failed', 9)).toBe(before);
		expect(recordCheck(before, 'stopped', 9)).toBe(before);
	});

	it('does not change the value that it is given', () => {
		const before: Progress = { checks: 1, solved: false, checkedAt: 5 };
		recordCheck(before, 'right', 9);
		expect(before).toEqual({ checks: 1, solved: false, checkedAt: 5 });
	});
});

describe('statusOf and summarize', () => {
	it('has three states', () => {
		expect(statusOf(undefined)).toBe('none');
		expect(statusOf({ checks: 1, solved: false, checkedAt: 1 })).toBe('attempted');
		expect(statusOf({ checks: 1, solved: true, solvedAt: 1, checkedAt: 1 })).toBe('solved');
	});

	it('counts the solved and the attempted questions of a list, and ignores a question that is not in it', () => {
		const map = new Map<string, Progress>([
			['a', { checks: 1, solved: true, solvedAt: 1, checkedAt: 1 }],
			['b', { checks: 2, solved: false, checkedAt: 1 }],
			['gone', { checks: 1, solved: true, solvedAt: 1, checkedAt: 1 }]
		]);
		expect(summarize([{ id: 'a' }, { id: 'b' }, { id: 'c' }], map)).toEqual({
			solved: 1,
			attempted: 1,
			total: 3
		});
		expect(summarize([], map)).toEqual({ solved: 0, attempted: 0, total: 0 });
	});
});

describe('loadProgress and resetProgress', () => {
	it('reads the progress of the question records only', async () => {
		const store = createMemoryStore();
		await store.put(record('soal:a', { checks: 1, solved: true, solvedAt: 1, checkedAt: 1 }));
		await store.put(record('soal:b', { checks: 2, solved: false, checkedAt: 3 }));
		await store.put(record('soal:c'));
		await store.put(record('soal:bad', { checks: 'x' }));
		await store.put(record('machine-1', { checks: 5, solved: true, solvedAt: 1, checkedAt: 1 }));
		const map = await loadProgress(store);
		expect([...map.keys()].sort()).toEqual(['a', 'b']);
		expect(map.get('a')?.solved).toBe(true);
	});

	it('resets: takes the field off every question record, keeps the machines and the machines of the Sandbox', async () => {
		const store = createMemoryStore();
		const progress = { checks: 1, solved: true, solvedAt: 1, checkedAt: 1 };
		await store.put(record('soal:a', progress));
		await store.put(record('soal:b', progress));
		await store.put(record('soal:c'));
		await store.put(record('machine-1', progress));
		const changed = await resetProgress(store);
		expect(changed).toBe(2);
		const after = await store.list();
		expect(after.map((r) => r.id).sort()).toEqual(['machine-1', 'soal:a', 'soal:b', 'soal:c']);
		for (const r of after.filter((x) => x.id.startsWith('soal:'))) {
			expect('progress' in r).toBe(false);
			expect(r.doc).toBe(serializeDocument(endsWith01()));
		}
		// What is not a question record is not touched, even if it has a field with that name.
		expect((await store.get('machine-1'))!.progress).toEqual(progress);
		expect((await loadProgress(store)).size).toBe(0);
	});

	it('also clears a bad value, and does nothing for a store with no progress', async () => {
		const store = createMemoryStore();
		await store.put(record('soal:a', 'garbage'));
		expect(await resetProgress(store)).toBe(1);
		expect(await resetProgress(store)).toBe(0);
	});
});
