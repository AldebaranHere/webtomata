// The document against the real engine (the WASM module), so that what the document accepts is
// what the engine accepts. It needs the WASM package (`pnpm build:wasm`); with handlers.test.ts it
// is the only test that imports it. The tests of the JFLAP files of the course read them from
// REFERENCES/JFF-FILES when that folder exists (it is not in the repository) and are skipped
// otherwise.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { EngineResult, Issue, Jff, Machine } from '../engine/types.ts';
import { applyCommand } from './commands.ts';
import type { Command } from './commands.ts';
import {
	LIMITS,
	checkDocument,
	checkSymbol,
	createDocument,
	documentFromJff,
	jffLayout,
	toMachine
} from './document.ts';
import type { MachineDocument } from './document.ts';
import { random, randomCommand } from './testing.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const loadMachine = (machine: unknown) =>
	JSON.parse(wasm.loadMachine(JSON.stringify(machine))) as EngineResult<Machine>;
const validate = (machine: unknown) =>
	JSON.parse(wasm.validate(JSON.stringify(machine))) as EngineResult<Issue[]>;
const importJff = (xml: string) => JSON.parse(wasm.importJff(xml)) as EngineResult<Jff>;
const exportJff = (doc: MachineDocument) =>
	JSON.parse(
		wasm.exportJff(JSON.stringify(toMachine(doc)), JSON.stringify(jffLayout(doc)))
	) as EngineResult<string>;

function build(...commands: Command[]): MachineDocument {
	let doc = createDocument();
	for (const command of commands) {
		const result = applyCommand(doc, command);
		if (!result.ok) throw new Error(`${JSON.stringify(command)}: ${result.error.key}`);
		doc = result.doc;
	}
	return doc;
}

const onlySymbol = (symbol: string): Machine => ({
	schemaVersion: 1,
	kind: 'dfsm',
	alphabet: [symbol],
	states: [],
	start: null,
	accepting: [],
	transitions: []
});

describe('the rules for symbols are the rules of the engine', () => {
	const agree = (symbol: string) => {
		const ours = checkSymbol(symbol).ok;
		const engine = loadMachine(onlySymbol(symbol)).ok;
		return { ours, engine };
	};

	it('agree on every character of the Basic Multilingual Plane', () => {
		const disagree: string[] = [];
		for (let code = 0; code <= 0xffff; code++) {
			// A lone surrogate cannot be sent to the engine as text; it is tested below.
			if (code >= 0xd800 && code <= 0xdfff) continue;
			const symbol = String.fromCharCode(code);
			const { ours, engine } = agree(symbol);
			if (ours !== engine) {
				disagree.push(
					`U+${code.toString(16).padStart(4, '0')} (document ${ours}, engine ${engine})`
				);
			}
		}
		expect(disagree).toEqual([]);
	});

	it('agree on a lone surrogate, on characters beyond the plane and on joiners', () => {
		const symbols = [
			'\uD800',
			'\uDC00',
			'a\uD800',
			'😀',
			'👨‍👩‍👧',
			'\u{1F600}\u{1F601}',
			'\u{10FFFF}',
			'é',
			'‍',
			'‌',
			'\u{E0001}'
		];
		for (const symbol of symbols) {
			const { ours, engine } = agree(symbol);
			expect(ours, JSON.stringify(symbol)).toBe(engine);
		}
	});

	it('agree on the length: 32 characters are allowed, 33 are not, also for emoji and "é" made of two', () => {
		for (const unit of ['a', '😀', 'é', 'é']) {
			const longest = unit.repeat(Math.floor(32 / [...unit].length));
			for (const symbol of [longest, longest + unit, unit.repeat(40)]) {
				const { ours, engine } = agree(symbol);
				expect(ours, `${JSON.stringify(unit)} x ${[...symbol].length}`).toBe(engine);
			}
		}
	});
});

describe('a document becomes a machine that the engine accepts', () => {
	const even = () =>
		build(
			{ type: 'setTitle', title: 'Genap a' },
			{ type: 'addSymbol', symbol: 'a' },
			{ type: 'addSymbol', symbol: 'b' },
			{ type: 'addState', x: 100, y: 100 },
			{ type: 'addState', x: 300, y: 100 },
			{ type: 'setStart', id: 0 },
			{ type: 'setAccepting', id: 0, accepting: true },
			{ type: 'addTransition', from: 0, on: 'a', to: 1 },
			{ type: 'addTransition', from: 0, on: 'b', to: 0 },
			{ type: 'addTransition', from: 1, on: 'a', to: 0 },
			{ type: 'addTransition', from: 1, on: 'b', to: 1 }
		);

	it('loads and gives the same machine back, in the same order', () => {
		const doc = even();
		const loaded = loadMachine(toMachine(doc));
		expect(loaded).toEqual({ ok: true, value: toMachine(doc) });
	});

	it('has no issue when it is a complete DFSM', () => {
		expect(validate(toMachine(even()))).toEqual({ ok: true, value: [] });
	});

	it('is still accepted after states are deleted and added again (sparse ids)', () => {
		const doc = build(
			{ type: 'addSymbol', symbol: 'a' },
			{ type: 'addState', x: 0, y: 0 },
			{ type: 'addState', x: 0, y: 0 },
			{ type: 'addState', x: 0, y: 0 },
			{ type: 'removeState', id: 1 },
			{ type: 'addState', x: 0, y: 0 },
			{ type: 'addTransition', from: 0, on: 'a', to: 3 },
			{ type: 'addTransition', from: 3, on: null, to: 2 }
		);
		expect(doc.states.map((s) => s.id)).toEqual([0, 2, 3]);
		expect(loadMachine(toMachine(doc))).toEqual({ ok: true, value: toMachine(doc) });
	});

	it('is accepted by the engine for 100 random documents, and the engine gives them back unchanged', () => {
		for (let seed = 1; seed <= 100; seed++) {
			const rng = random(seed * 977);
			let doc = createDocument();
			for (let step = 0; step < 30; step++) {
				const result = applyCommand(doc, randomCommand(rng, doc));
				if (result.ok) doc = result.doc;
			}
			expect(checkDocument(doc), `seed ${seed}`).toEqual([]);
			const loaded = loadMachine(toMachine(doc));
			expect(loaded, `seed ${seed}`).toEqual({ ok: true, value: toMachine(doc) });
		}
	});

	it('is accepted at the limits of the engine', () => {
		const big = build({
			type: 'batch',
			commands: Array.from(
				{ length: LIMITS.states },
				(_, i) => ({ type: 'addState', x: i, y: 0 }) as Command
			)
		});
		expect(big.states.length).toBe(LIMITS.states);
		expect(loadMachine(toMachine(big)).ok).toBe(true);
	});
});

describe('a JFLAP round trip keeps the names and the places', () => {
	it('through exportJff and importJff', () => {
		const doc = build(
			{ type: 'addSymbol', symbol: 'a' },
			{ type: 'addSymbol', symbol: 'b' },
			{ type: 'addState', x: 100, y: 100.5, name: 'mulai' },
			{ type: 'addState', x: 300.5, y: 100, name: 'a&b <x>' },
			{ type: 'addState', x: -20, y: 400, name: 'α "β"' },
			{ type: 'setStart', id: 0 },
			{ type: 'setAccepting', id: 2, accepting: true },
			{ type: 'addTransition', from: 0, on: 'a', to: 1 },
			{ type: 'addTransition', from: 1, on: 'b', to: 2 },
			{ type: 'addTransition', from: 2, on: 'a', to: 2 },
			{ type: 'addTransition', from: 2, on: 'b', to: 0 },
			{ type: 'addTransition', from: 1, on: 'a', to: 0 },
			{ type: 'addTransition', from: 0, on: 'b', to: 0 }
		);
		const xml = exportJff(doc);
		expect(xml.ok).toBe(true);
		if (!xml.ok) return;
		const imported = importJff(xml.value);
		expect(imported.ok).toBe(true);
		if (!imported.ok) return;
		const { doc: again, notes } = documentFromJff(imported.value);
		expect(notes).toEqual([]);
		expect(checkDocument(again)).toEqual([]);
		expect(again.states).toEqual(doc.states);
		expect(again.start).toBe(doc.start);
		expect(again.accepting).toEqual(doc.accepting);
		expect(again.kind).toBe(doc.kind);
		expect([...again.alphabet].sort()).toEqual([...doc.alphabet].sort());
		const key = (d: MachineDocument) =>
			d.transitions.map((t) => `${t.from} ${t.on} ${t.to}`).sort();
		expect(key(again)).toEqual(key(doc));
	});
});

describe('the JFLAP files of the course', () => {
	const folder = new URL('../../../../REFERENCES/JFF-FILES/', import.meta.url);
	const present = existsSync(folder);

	it.skipIf(!present)('import, become documents, and go back to JFLAP without a change', () => {
		const files = readdirSync(folder, { recursive: true })
			.map(String)
			.filter((name) => name.endsWith('.jff'));
		let finite = 0;
		for (const rawName of files) {
			const name = rawName.replace(/\\/g, '/');
			const imported = importJff(readFileSync(new URL(name, folder), 'utf8'));
			// Only the finite automata are in scope; the other types are refused by the engine.
			if (!imported.ok) {
				expect(imported.error.key, name).toBe('jff.unsupported_type');
				continue;
			}
			finite++;
			const { doc, notes } = documentFromJff(imported.value);
			expect(notes, name).toEqual([]);
			expect(checkDocument(doc), name).toEqual([]);
			expect(toMachine(doc), name).toEqual(imported.value.fsm);
			expect(loadMachine(toMachine(doc)).ok, name).toBe(true);
			// The names and places are the ones of the file.
			expect(
				doc.states.map(({ id, name, x, y }) => ({ id, name, x, y })),
				name
			).toEqual([...imported.value.states].sort((a, b) => a.id - b.id));
			// And back to JFLAP and to a document again.
			const xml = exportJff(doc);
			expect(xml.ok, name).toBe(true);
			if (!xml.ok) continue;
			const second = importJff(xml.value);
			expect(second.ok, name).toBe(true);
			if (!second.ok) continue;
			expect(documentFromJff(second.value).doc.states, name).toEqual(doc.states);
		}
		expect(finite).toBeGreaterThan(0);
	});
});
