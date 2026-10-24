import { describe, expect, it } from 'vitest';
import { documentFrom } from '../editor/diagram/samples.ts';
import { serializeDocument } from '../editor/document.ts';
import { CURRENT_VERSION, readStoredDocument } from './migrate.ts';

const good = () =>
	documentFrom({
		title: 'Genap',
		alphabet: ['a'],
		states: [
			[100, 100],
			[300, 100]
		],
		start: 0,
		accepting: [1],
		transitions: [[0, 'a', 1]]
	});

describe('readStoredDocument', () => {
	it('reads a document of the current version, as it was saved', () => {
		const doc = good();
		const result = readStoredDocument(serializeDocument(doc));
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.doc).toEqual(doc);
		expect(CURRENT_VERSION).toBe(1);
	});

	it('a text that is not JSON, or not a document, is corrupt, and nothing throws', () => {
		for (const text of ['', '{', 'null', '[]', '"x"', '{"schemaVersion":1}', '{"a":']) {
			const result = readStoredDocument(text);
			expect(result.ok, text).toBe(false);
			if (!result.ok) expect(result.reason, text).toBe('corrupt');
		}
	});

	it('a document that breaks a rule (a transition to a state that is not there) is corrupt', () => {
		const broken = JSON.parse(serializeDocument(good()));
		broken.transitions = [{ from: 0, on: 'a', to: 99 }];
		const result = readStoredDocument(JSON.stringify(broken));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe('corrupt');
	});

	it('a text that is far too big is corrupt, and is not parsed', () => {
		const result = readStoredDocument('x'.repeat(50_000_000));
		expect(result.ok).toBe(false);
	});

	it('a version newer than ours is refused as newer, so that it is never overwritten', () => {
		const future = { ...JSON.parse(serializeDocument(good())), schemaVersion: 2 };
		const result = readStoredDocument(JSON.stringify(future));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe('newer');
	});

	it('an older version is moved up, one step at a time, by the migrations it is given', () => {
		const current = JSON.parse(serializeDocument(good()));
		// A made-up version 0 that stored the title under another name.
		const old = { ...current, schemaVersion: 0, name: current.title };
		delete old.title;
		const migrations = {
			0: (value: Record<string, unknown>) => {
				const { name, ...rest } = value;
				return { ...rest, title: name, schemaVersion: 1 };
			}
		};
		const result = readStoredDocument(JSON.stringify(old), migrations);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.doc.title).toBe('Genap');
	});

	it('an older version with no migration is unsupported, and is kept untouched by the caller', () => {
		const old = { ...JSON.parse(serializeDocument(good())), schemaVersion: 0 };
		const result = readStoredDocument(JSON.stringify(old), {});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe('unsupported');
	});

	it('a migration that throws gives corrupt, not a crash', () => {
		const old = { ...JSON.parse(serializeDocument(good())), schemaVersion: 0 };
		const result = readStoredDocument(JSON.stringify(old), {
			0: () => {
				throw new Error('boom');
			}
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe('corrupt');
	});

	it('a version that is not a number is corrupt', () => {
		const odd = { ...JSON.parse(serializeDocument(good())), schemaVersion: '1' };
		const result = readStoredDocument(JSON.stringify(odd));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe('corrupt');
	});
});
