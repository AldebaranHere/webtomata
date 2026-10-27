import { describe, expect, it } from 'vitest';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { LIMITS, documentsEqual, message, toMachine } from '../editor/document.ts';
import type { EngineResult, Jff } from '../engine/types.ts';
import { jsonFile } from './files.ts';
import { FILE_BYTE_LIMIT, importKind, openFile, titleOfFileName } from './open-file.ts';
import type { ImportEngine, ImportFile } from './open-file.ts';

const file = (
	name: string,
	text: string,
	size = new TextEncoder().encode(text).length
): ImportFile => ({
	name,
	size,
	text: async () => text
});

/** The engine for the `.jff`: it answers with what the test gives, and counts the calls. */
function engineWith(answer: EngineResult<Jff>): ImportEngine & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		importJff: async (xml) => {
			calls.push(xml);
			return answer;
		}
	};
}

const sampleJff = (): Jff => {
	const doc = endsWith01();
	return {
		fsm: toMachine(doc),
		states: doc.states.map((s) => ({ id: s.id, name: s.name, x: s.x, y: s.y })),
		notes: [message('jff.label_expanded', { label: 'ab', from: 0, to: 1 })]
	};
};

describe('importKind', () => {
	it('is told by the extension, in any case', () => {
		expect(importKind('a.jff')).toBe('jff');
		expect(importKind('A.JFF')).toBe('jff');
		expect(importKind('a.json')).toBe('json');
		expect(importKind('a.webtomata.json')).toBe('json');
		expect(importKind('a.txt')).toBeNull();
		expect(importKind('jff')).toBeNull();
		expect(importKind('')).toBeNull();
	});
});

describe('titleOfFileName', () => {
	it('takes the extension away', () => {
		expect(titleOfFileName('Berakhiran 01.jff')).toBe('Berakhiran 01');
		expect(titleOfFileName('x.JFF')).toBe('x');
		expect(titleOfFileName('.jff')).toBe('');
	});

	it('is cut at the length of a title, by characters', () => {
		const title = titleOfFileName('😀'.repeat(300) + '.jff');
		expect(Array.from(title)).toHaveLength(LIMITS.titleChars);
	});

	it('leaves out the characters that a title cannot have', () => {
		expect(titleOfFileName('a\u0000b\u001fc.jff')).toBe('abc');
	});
});

describe('openFile', () => {
	it('reads a JSON file as the same document, with its title, and does not call the engine', async () => {
		const doc = endsWith01();
		const engine = engineWith({ ok: false, error: message('never') });
		const result = await openFile(file('x.webtomata.json', jsonFile(doc)), engine);
		expect(result.ok && documentsEqual(result.value.doc, doc)).toBe(true);
		expect(result.ok && result.value.notes).toEqual([]);
		expect(engine.calls).toEqual([]);
	});

	it('reads a .jff through the engine, with the file name as the title and the notes of the engine', async () => {
		const jff = sampleJff();
		const engine = engineWith({ ok: true, value: jff });
		const result = await openFile(file('Berakhiran 01.jff', '<structure/>'), engine);
		expect(engine.calls).toEqual(['<structure/>']);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.doc.title).toBe('Berakhiran 01');
		expect(result.value.doc.states.map((s) => s.name)).toEqual(jff.states.map((s) => s.name));
		expect(result.value.notes.map((n) => n.key)).toEqual(['jff.label_expanded']);
	});

	it('passes on the message of the engine for a file that is not a finite automaton', async () => {
		const answer = { ok: false as const, error: message('jff.unsupported_type', { type: 'pda' }) };
		const result = await openFile(file('p.jff', '<structure/>'), engineWith(answer));
		expect(result).toEqual(answer);
	});

	it('refuses a file that is too big before it reads it', async () => {
		let read = false;
		const big: ImportFile = {
			name: 'big.json',
			size: FILE_BYTE_LIMIT + 1,
			text: async () => ((read = true), '{}')
		};
		const result = await openFile(big, engineWith({ ok: true, value: sampleJff() }));
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.key).toBe('import.too_big');
		expect(read).toBe(false);
	});

	it('takes a file of exactly the limit to the reader', async () => {
		const result = await openFile(
			file('a.json', '{}', FILE_BYTE_LIMIT),
			engineWith({ ok: true, value: sampleJff() })
		);
		// It is read, and it is not a document.
		expect(!result.ok && result.error.key).toBe('document.invalid_file');
	});

	it('refuses an extension that is not known, and says which one', async () => {
		const result = await openFile(
			file('a.txt', '{}'),
			engineWith({ ok: true, value: sampleJff() })
		);
		expect(!result.ok && result.error.key).toBe('import.unknown_type');
	});

	it('says calmly that a file is not a document for text that is not JSON or not a machine', async () => {
		const engine = engineWith({ ok: true, value: sampleJff() });
		for (const text of ['', 'not json', '[]', '{"schemaVersion":1}', 'null']) {
			const result = await openFile(file('a.json', text), engine);
			expect(result.ok, text).toBe(false);
			expect(!result.ok && result.error.key, text).toBe('document.invalid_file');
		}
	});

	it('does not throw when the file cannot be read, or the engine fails', async () => {
		const broken: ImportFile = {
			name: 'a.json',
			size: 2,
			text: async () => {
				throw new Error('gone');
			}
		};
		const engine = engineWith({ ok: true, value: sampleJff() });
		const unreadable = await openFile(broken, engine);
		expect(!unreadable.ok && unreadable.error.key).toBe('import.unreadable');
		const failing: ImportEngine = {
			importJff: async () => {
				throw new Error('worker died');
			}
		};
		const dead = await openFile(file('a.jff', '<x/>'), failing);
		expect(!dead.ok && dead.error.key).toBe('import.unreadable');
	});

	it('gives a title that is empty for a file whose name has no title, never a broken one', async () => {
		const engine = engineWith({ ok: true, value: sampleJff() });
		const result = await openFile(file('.jff', '<x/>'), engine);
		expect(result.ok && result.value.doc.title).toBe('');
	});
});
