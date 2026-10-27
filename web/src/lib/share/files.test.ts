import { describe, expect, it } from 'vitest';
import { documentFrom, endsWith01 } from '../editor/diagram/samples.ts';
import { documentsEqual, jffLayout, parseDocumentText, toMachine } from '../editor/document.ts';
import type { EngineResult, Machine } from '../engine/types.ts';
import {
	JFF_EXTENSION,
	JSON_EXTENSION,
	fileName,
	jffFile,
	jsonFile,
	unusedSymbols
} from './files.ts';
import type { JffEngine } from './files.ts';

describe('fileName', () => {
	it('keeps a title that is safe, with the extension', () => {
		expect(fileName('Berakhiran 01', JFF_EXTENSION)).toBe('Berakhiran 01.jff');
		expect(fileName('Genap a', JSON_EXTENSION)).toBe('Genap a.webtomata.json');
		expect(fileName('Mesin 😀 ünï ε', JFF_EXTENSION)).toBe('Mesin 😀 ünï ε.jff');
	});

	it('takes out the characters that a file name cannot have, and the spaces that stack', () => {
		expect(fileName('a/b\\c:d*e?f"g<h>i|j', JFF_EXTENSION)).toBe('a-b-c-d-e-f-g-h-i-j.jff');
		expect(fileName('a   b\t\nc', JFF_EXTENSION)).toBe('a b c.jff');
		expect(fileName('x\u0000y\u001fz', JFF_EXTENSION)).toBe('x-y-z.jff');
	});

	it('does not end or start with a dot, a hyphen or a space, and is never empty', () => {
		expect(fileName('  ..nama..  ', JFF_EXTENSION)).toBe('nama.jff');
		expect(fileName('---', JFF_EXTENSION)).toBe('mesin.jff');
		expect(fileName('', JFF_EXTENSION)).toBe('mesin.jff');
		expect(fileName('   ', JSON_EXTENSION)).toBe('mesin.webtomata.json');
		expect(fileName('', JFF_EXTENSION, 'machine')).toBe('machine.jff');
	});

	it('is cut at 80 characters, by characters and not by bytes', () => {
		const long = fileName('😀'.repeat(200), JFF_EXTENSION);
		expect(Array.from(long.replace(JFF_EXTENSION, ''))).toHaveLength(80);
		expect(long.endsWith(JFF_EXTENSION)).toBe(true);
	});

	it('does not give the name of a device of Windows', () => {
		for (const name of ['CON', 'prn', 'Aux', 'NUL', 'com1', 'LPT9', 'con.txt']) {
			expect(fileName(name, JFF_EXTENSION).startsWith('_'), name).toBe(true);
		}
		expect(fileName('console', JFF_EXTENSION)).toBe('console.jff');
		expect(fileName('com10', JFF_EXTENSION)).toBe('com10.jff');
	});
});

describe('jsonFile', () => {
	it('is the document, written so that a person can read it, and read back without a change', () => {
		const doc = endsWith01();
		const text = jsonFile(doc);
		expect(text).toContain('\n');
		const back = parseDocumentText(text);
		expect(back.ok && documentsEqual(back.value, doc)).toBe(true);
	});

	it('keeps names and the title in any script, and emoji', () => {
		const doc = documentFrom({
			title: 'Mesin 😀 ε',
			alphabet: ['a', '😀'],
			states: [
				[0, 0, 'q😀'],
				[100, 0, 'ünï']
			],
			start: 0,
			accepting: [1],
			transitions: [[0, '😀', 1]]
		});
		const back = parseDocumentText(jsonFile(doc));
		expect(back.ok && documentsEqual(back.value, doc)).toBe(true);
	});
});

describe('unusedSymbols', () => {
	it('names the symbols of the alphabet that no transition reads', () => {
		expect(unusedSymbols(endsWith01())).toEqual([]);
		const doc = documentFrom({
			alphabet: ['a', 'b', 'c'],
			states: [[0, 0]],
			start: 0,
			transitions: [[0, 'a', 0]]
		});
		expect(unusedSymbols(doc)).toEqual(['b', 'c']);
	});

	it('does not count an ε-transition as a use of a symbol', () => {
		const doc = documentFrom({
			alphabet: ['a'],
			states: [
				[0, 0],
				[100, 0]
			],
			start: 0,
			transitions: [[0, null, 1]]
		});
		expect(unusedSymbols(doc)).toEqual(['a']);
	});
});

describe('jffFile', () => {
	it('asks the engine with the machine and the places of the document', async () => {
		const asked: { machine?: Machine; layout?: unknown } = {};
		const engine: JffEngine = {
			exportJff: async (machine, layout) => {
				asked.machine = machine;
				asked.layout = layout;
				return { ok: true, value: '<xml/>' };
			}
		};
		const doc = endsWith01();
		expect(await jffFile(engine, doc)).toEqual({ ok: true, value: '<xml/>' });
		expect(asked.machine).toEqual(toMachine(doc));
		expect(asked.layout).toEqual(jffLayout(doc));
	});

	it('gives the message of the engine when it refuses, and never throws for an answer that failed', async () => {
		const refused: EngineResult<string> = {
			ok: false,
			error: { key: 'jff.symbol_not_single_character', params: { symbol: 'num' } }
		};
		const engine: JffEngine = { exportJff: async () => refused };
		expect(await jffFile(engine, endsWith01())).toEqual({
			ok: false,
			error: { key: 'jff.symbol_not_single_character', params: { symbol: 'num' } }
		});
	});
});
