// Opening a file against the real engine (the WASM module: `pnpm build:wasm`): the files of the page's own export,
// small `.jff` files written for these tests (fixtures/), and the files of the course when that folder exists.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { EngineResult, Jff } from '../engine/types.ts';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { documentsEqual, toMachine } from '../editor/document.ts';
import { JFF_EXTENSION, JSON_EXTENSION, fileName, jffFile, jsonFile } from './files.ts';
import { openFile } from './open-file.ts';
import type { ImportFile } from './open-file.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const engine = {
	importJff: async (xml: string) => JSON.parse(wasm.importJff(xml)) as EngineResult<Jff>,
	exportJff: async (machine: unknown, layout: unknown) =>
		JSON.parse(
			wasm.exportJff(JSON.stringify(machine), JSON.stringify(layout))
		) as EngineResult<string>
};

const fileOf = (name: string, text: string): ImportFile => ({
	name,
	size: new TextEncoder().encode(text).length,
	text: async () => text
});
const fixture = (name: string) =>
	readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('opening the files that the page writes', () => {
	it('gives back the same machine from the JSON file, with its title', async () => {
		const doc = endsWith01();
		const result = await openFile(
			fileOf(fileName(doc.title, JSON_EXTENSION), jsonFile(doc)),
			engine
		);
		expect(result.ok && documentsEqual(result.value.doc, doc)).toBe(true);
	});

	it('gives back the same machine from the .jff file, with the file name as the title', async () => {
		const doc = endsWith01();
		const written = await jffFile(engine, doc);
		if (!written.ok) throw new Error(written.error.key);
		const name = fileName(doc.title, JFF_EXTENSION);
		const result = await openFile(fileOf(name, written.value), engine);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.doc.title).toBe(doc.title);
		expect(toMachine(result.value.doc)).toEqual(toMachine(doc));
		expect(result.value.doc.states.map((s) => [s.id, s.name, s.x, s.y])).toEqual(
			doc.states.map((s) => [s.id, s.name, s.x, s.y])
		);
		expect(result.value.notes).toEqual([]);
	});
});

describe('opening a .jff file from JFLAP', () => {
	it('reads the states, their names and places, and the transitions', async () => {
		const result = await openFile(fileOf('even-a.jff', fixture('even-a.jff')), engine);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const { doc, notes } = result.value;
		expect(doc.title).toBe('even-a');
		expect(doc.kind).toBe('dfsm');
		expect(doc.alphabet).toEqual(['a', 'b']);
		expect(doc.states.map((s) => [s.name, s.x, s.y])).toEqual([
			['genap', 60, 80],
			['ganjil', 220, 80]
		]);
		expect(doc.start).toBe(0);
		expect(doc.accepting).toEqual([0]);
		expect(doc.transitions).toHaveLength(4);
		expect(notes).toEqual([]);
	});

	it('is an NDFSM for an ε-transition, and says that a label of two characters became a chain', async () => {
		const result = await openFile(
			fileOf('epsilon-and-long-label.jff', fixture('epsilon-and-long-label.jff')),
			engine
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.doc.kind).toBe('ndfsm');
		expect(result.value.doc.transitions.some((t) => t.on === null)).toBe(true);
		expect(result.value.doc.states).toHaveLength(4);
		expect(result.value.notes.map((n) => n.key)).toEqual(['jff.label_expanded']);
	});

	it('names the type for a grammar, a PDA and a Turing machine, and makes no machine', async () => {
		for (const type of ['grammar', 'pda', 'turing']) {
			const result = await openFile(fileOf(`${type}.jff`, fixture(`${type}.jff`)), engine);
			expect(result.ok, type).toBe(false);
			if (result.ok) continue;
			expect(result.error.key).toBe('jff.unsupported_type');
			expect(result.error.params.type).toBe(type);
		}
	});

	it('says that the XML is damaged, with the place', async () => {
		const result = await openFile(fileOf('broken.jff', fixture('broken.jff')), engine);
		expect(!result.ok && result.error.key).toBe('jff.xml_invalid');
	});

	it('does not break on any text, whatever the file is called', async () => {
		for (const text of [
			'',
			' ',
			'<',
			'<structure/>',
			'<structure><type>fa</type></structure>',
			'\u0000'
		]) {
			const result = await openFile(fileOf('x.jff', text), engine);
			expect(result.ok, JSON.stringify(text)).toBe(false);
			expect(!result.ok && result.error.key).toMatch(/^jff\./);
		}
	});
});

const folder = new URL('../../../../REFERENCES/JFF-FILES/', import.meta.url);
const files = existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith('.jff')) : [];

describe.skipIf(files.length === 0)(
	'opening the JFLAP files of the course (a local folder)',
	() => {
		it('opens each finite automaton, and names the type of each of the others', async () => {
			let finite = 0;
			for (const name of files) {
				const result = await openFile(
					fileOf(name, readFileSync(new URL(name, folder), 'utf8')),
					engine
				);
				if (result.ok) {
					finite += 1;
					expect(result.value.doc.states.length, name).toBeGreaterThan(0);
				} else {
					expect(result.error.key, name).toBe('jff.unsupported_type');
				}
			}
			expect(finite).toBeGreaterThan(0);
		});
	}
);
