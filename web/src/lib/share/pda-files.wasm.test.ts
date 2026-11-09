// The PDA files against the real engine (the WASM module: `pnpm build:wasm`), as `open-file.wasm.test.ts`
// does for the FSM: the round trips of F1 and F2, the message of F5 for a `.jff`, and F7's mutations.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import init, * as wasm from '../engine/wasm/engine_wasm.js';
import type { EngineResult, JffState, Pda, PdaJff } from '../engine/types.ts';
import { wcwrSample } from '../editor/pda-samples.ts';
import {
	pdaDocumentsEqual,
	parsePdaDocumentText,
	serializePdaDocument,
	toEnginePda
} from '../editor/pda-document.ts';
import type { PdaDocument } from '../editor/pda-document.ts';
import { jffLayout } from '../editor/document.ts';
import { isPdaFile, openPdaFile, pdaJsonFile } from './pda-files.ts';
import type { ImportFile } from './open-file.ts';

beforeAll(async () => {
	const bytes = readFileSync(new URL('../engine/wasm/engine_wasm_bg.wasm', import.meta.url));
	await init({ module_or_path: bytes });
});

const engine = {
	importPdaJff: async (xml: string) => JSON.parse(wasm.importPdaJff(xml)) as EngineResult<PdaJff>,
	exportPdaJff: async (pda: Pda, layout: JffState[]) =>
		JSON.parse(
			wasm.exportPdaJff(JSON.stringify(pda), JSON.stringify(layout))
		) as EngineResult<string>
};

const bytes = (text: string) => new TextEncoder().encode(text).length;
const file = (name: string, text: string): ImportFile => ({
	name,
	size: bytes(text),
	text: async () => text
});

const written = async (doc: PdaDocument): Promise<string> => {
	const answer = await engine.exportPdaJff(toEnginePda(doc), jffLayout(doc));
	if (!answer.ok) throw new Error(answer.error.key);
	return answer.value;
};

describe('F1: round trip of a .jff', () => {
	it('gives the same document back, with the file name as the title and the kind ndpda, and writes the same text again', async () => {
		const doc = wcwrSample();
		const first = await written(doc);
		const result = await openPdaFile(file('wcwr.jff', first), engine);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const back = result.value;
		expect(back.kind).toBe('ndpda');
		expect(back.title).toBe('wcwr');
		expect(back.states).toEqual(doc.states);
		expect(back.transitions).toEqual(doc.transitions);
		expect(back.inputAlphabet).toEqual(doc.inputAlphabet);
		expect(back.stackAlphabet).toEqual(doc.stackAlphabet);
		expect(back.start).toBe(doc.start);
		expect(back.accepting).toEqual(doc.accepting);
		expect(await written(back)).toBe(first);
	});
});

describe('F2: round trip of JSON', () => {
	it('gives the same dpda back, with its title', async () => {
		const doc = wcwrSample('PDA uji');
		const result = await openPdaFile(file('pda.webtomata.json', pdaJsonFile(doc)), engine);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(pdaDocumentsEqual(result.value, doc)).toBe(true);
		expect(result.value.kind).toBe('dpda');
		expect(result.value.title).toBe('PDA uji');
	});
});

describe('F5: a PDA .jff that reads two characters', () => {
	it('says jff.pda_read_not_single, and writes no document', async () => {
		const text = `<structure><type>pda</type><automaton>
			<state id="0" name="q0"><initial/></state>
			<transition><from>0</from><to>0</to><read>ab</read><pop/><push/></transition>
		</automaton></structure>`;
		const result = await openPdaFile(file('a.jff', text), engine);
		expect(!result.ok && result.error.key).toBe('jff.pda_read_not_single');
		expect(!result.ok && result.error.params.label).toBe('ab');
	});
});

describe('F7: untrusted input never throws', () => {
	const pdaJson = () => serializePdaDocument(wcwrSample('PDA uji'));

	/** A seeded pseudo-random generator, so the 200 mutations are the same on every run. */
	function seeded(seed: number) {
		let state = seed >>> 0;
		return () => {
			state = (state * 1664525 + 1013904223) >>> 0;
			return state / 0x1_0000_0000;
		};
	}

	const HUGE = '1234567890123456789012345678901234567890';
	const nesting = '['.repeat(5000);

	function mutate(text: string, round: number, random: () => number): string {
		const at = Math.floor(random() * Math.max(1, text.length));
		switch (round % 6) {
			case 0:
				return (
					text.slice(0, at) +
					String.fromCharCode(32 + Math.floor(random() * 95)) +
					text.slice(at + 1)
				);
			case 1:
				return text.slice(0, at);
			case 2:
				return text.slice(0, at) + HUGE + text.slice(at);
			case 3:
				return text + nesting;
			case 4: {
				// Duplicate a field of a JSON object, or a piece of any text.
				try {
					const value = JSON.parse(text);
					if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
						const key = Object.keys(value)[0];
						if (key !== undefined) return JSON.stringify({ ...value, [`${key}2`]: value[key] });
					}
				} catch {
					// Not JSON: fall through to the text.
				}
				return text.slice(0, at) + text.slice(at, at + 20) + text.slice(at);
			}
			default: {
				// Delete a field of a JSON object, or a piece of any text.
				try {
					const value = JSON.parse(text);
					if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
						const key = Object.keys(value)[0];
						if (key !== undefined) {
							const copy = { ...value };
							delete (copy as Record<string, unknown>)[key];
							return JSON.stringify(copy);
						}
					}
				} catch {
					// Not JSON: fall through to the text.
				}
				return text.slice(0, at) + text.slice(at + 10);
			}
		}
	}

	it('200 mutations of a valid PDA JSON through isPdaFile and openPdaFile', async () => {
		const random = seeded(75);
		const text = pdaJson();
		let ok = 0;
		for (let round = 0; round < 200; round++) {
			const mutated = mutate(text, round, random);
			const probe = file('pda.json', mutated);
			const isPda = await isPdaFile(probe);
			expect(typeof isPda).toBe('boolean');
			const result = await openPdaFile(probe, engine);
			if (result.ok) {
				ok += 1;
				expect(parsePdaDocumentText(serializePdaDocument(result.value)).ok).toBe(true);
			}
		}
		expect(ok).toBeGreaterThan(0);
	});

	it('200 mutations of a valid PDA .jff through isPdaFile and openPdaFile', async () => {
		const random = seeded(76);
		const text = await written(wcwrSample());
		let ok = 0;
		for (let round = 0; round < 200; round++) {
			const mutated = mutate(text, round, random);
			const probe = file('pda.jff', mutated);
			const isPda = await isPdaFile(probe);
			expect(typeof isPda).toBe('boolean');
			const result = await openPdaFile(probe, engine);
			if (result.ok) {
				ok += 1;
				expect(parsePdaDocumentText(serializePdaDocument(result.value)).ok).toBe(true);
			}
		}
		expect(ok).toBeGreaterThan(0);
	});
});
