import { describe, expect, it } from 'vitest';
import { wcwrSample } from '../editor/pda-samples.ts';
import { LIMITS, jffLayout } from '../editor/document.ts';
import {
	pdaDocumentsEqual,
	parsePdaDocumentText,
	serializePdaDocument,
	toEnginePda
} from '../editor/pda-document.ts';
import type { PdaDocument } from '../editor/pda-document.ts';
import type { EngineResult, JffState, PdaJff } from '../engine/types.ts';
import { JFF_EXTENSION, JSON_EXTENSION, fileName } from './files.ts';
import { FILE_BYTE_LIMIT } from './open-file.ts';
import type { ImportFile } from './open-file.ts';
import { isPdaFile, openPdaFile, pdaJffFile, pdaJsonFile } from './pda-files.ts';
import type { ImportPdaEngine, PdaJffEngine } from './pda-files.ts';

const bytes = (text: string) => new TextEncoder().encode(text).length;
const file = (name: string, text: string, size = bytes(text)): ImportFile => ({
	name,
	size,
	text: async () => text
});

/** A valid `.jff` of type pda, as the engine writes it. */
const pdaJffText = `<structure>
	<type>pda</type>
	<automaton>
		<state id="0" name="q0">
			<x>10.0</x>
			<y>20.0</y>
			<initial/>
		</state>
		<transition>
			<from>0</from>
			<to>0</to>
			<read>a</read>
			<pop/>
			<push>A</push>
		</transition>
	</automaton>
</structure>
`;

const jffOf = (doc: PdaDocument): PdaJff => ({
	// A `.jff` does not say, so the engine answers ndpda.
	pda: { ...toEnginePda(doc), kind: 'ndpda' },
	states: doc.states.map(({ id, name, x, y }) => ({ id, name, x, y }))
});

const importEngine = (answer: EngineResult<PdaJff>): ImportPdaEngine & { calls: string[] } => {
	const calls: string[] = [];
	return {
		calls,
		importPdaJff: async (xml) => {
			calls.push(xml);
			return answer;
		}
	};
};

describe('isPdaFile (F5, F7)', () => {
	it('tells a PDA .jff by its type, with any space around it', async () => {
		expect(await isPdaFile(file('a.jff', pdaJffText))).toBe(true);
		expect(
			await isPdaFile(file('a.jff', '<structure><type> pda </type><automaton/></structure>'))
		).toBe(true);
		expect(await isPdaFile(file('A.JFF', pdaJffText))).toBe(true);
	});

	it('does not call a finite automaton, a grammar or a Turing machine a PDA', async () => {
		for (const type of ['fa', 'grammar', 'turing']) {
			expect(await isPdaFile(file('a.jff', `<structure><type>${type}</type></structure>`))).toBe(
				false
			);
		}
	});

	it('tells a PDA JSON by its kind, with any space around the colon', async () => {
		expect(await isPdaFile(file('a.json', '{"kind":"dpda"}'))).toBe(true);
		expect(await isPdaFile(file('a.webtomata.json', '{"kind" : "ndpda"}'))).toBe(true);
		expect(await isPdaFile(file('a.json', '{"kind":"dfsm"}'))).toBe(false);
		expect(await isPdaFile(file('a.json', '{"kind":"ndfsm"}'))).toBe(false);
	});

	it('says no for a name that is neither, and for text that is not JSON', async () => {
		expect(await isPdaFile(file('a.txt', '{"kind":"dpda"}'))).toBe(false);
		expect(await isPdaFile(file('a', '{"kind":"dpda"}'))).toBe(false);
		expect(await isPdaFile(file('a.json', 'not json'))).toBe(false);
	});

	it('checks the size before it reads the text: one byte over the limit is not read', async () => {
		let read = 0;
		const spy = (size: number): ImportFile => ({
			name: 'a.jff',
			size,
			text: async () => ((read += 1), pdaJffText)
		});
		expect(await isPdaFile(spy(FILE_BYTE_LIMIT + 1))).toBe(false);
		expect(read).toBe(0);
		expect(await isPdaFile(spy(FILE_BYTE_LIMIT))).toBe(true);
		expect(read).toBe(1);
		expect(await isPdaFile(spy(FILE_BYTE_LIMIT - 1))).toBe(true);
		expect(read).toBe(2);
	});

	it('does not throw when the file cannot be read', async () => {
		const broken: ImportFile = {
			name: 'a.jff',
			size: 2,
			text: async () => {
				throw new Error('gone');
			}
		};
		expect(await isPdaFile(broken)).toBe(false);
	});
});

describe('openPdaFile (F5, F7)', () => {
	it('reads a PDA JSON as the same document, with its title and kind, and does not call the engine', async () => {
		const doc = wcwrSample('PDA uji');
		const engine = importEngine({ ok: false, error: { key: 'never', params: {} } });
		const result = await openPdaFile(file('a.webtomata.json', pdaJsonFile(doc)), engine);
		expect(result.ok && pdaDocumentsEqual(result.value, doc)).toBe(true);
		expect(engine.calls).toEqual([]);
	});

	it('reads a .jff through the engine, with the file name as the title and the kind ndpda', async () => {
		const doc = wcwrSample('PDA uji');
		const engine = importEngine({ ok: true, value: jffOf(doc) });
		const result = await openPdaFile(file('Mesin Uji.jff', pdaJffText), engine);
		expect(engine.calls).toEqual([pdaJffText]);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.title).toBe('Mesin Uji');
		expect(result.value.kind).toBe('ndpda');
		expect(result.value.states.map((s) => s.name)).toEqual(['q0', 'q1']);
		expect(result.value.transitions).toHaveLength(doc.transitions.length);
	});

	it('passes a .jff result through the PDA document, so a document over a limit is refused', async () => {
		const huge: PdaJff = {
			pda: {
				schemaVersion: 1,
				kind: 'ndpda',
				inputAlphabet: [],
				stackAlphabet: [],
				states: [LIMITS.stateId],
				start: null,
				accepting: [],
				transitions: []
			},
			states: [{ id: LIMITS.stateId, name: 'q', x: 0, y: 0 }]
		};
		const result = await openPdaFile(
			file('a.jff', pdaJffText),
			importEngine({ ok: true, value: huge })
		);
		expect(!result.ok && result.error.key).toBe('document.invalid_file');
		expect(!result.ok && result.error.params.at).toBe('nextStateId');
	});

	it('passes on the message of the engine', async () => {
		const answer: EngineResult<PdaJff> = {
			ok: false,
			error: { key: 'jff.pda_read_not_single', params: { label: 'ab', from: 0, to: 1 } }
		};
		expect(await openPdaFile(file('a.jff', pdaJffText), importEngine(answer))).toEqual(answer);
	});

	it('refuses a JSON with a state that is not an object, with the place', async () => {
		const doc = wcwrSample('PDA uji');
		const value = JSON.parse(serializePdaDocument(doc));
		value.states[0] = 42;
		const result = await openPdaFile(
			file('a.json', JSON.stringify(value)),
			importEngine({ ok: false, error: { key: 'never', params: {} } })
		);
		expect(!result.ok && result.error.key).toBe('document.invalid_file');
		expect(!result.ok && result.error.params.at).toBe('states[0]');
	});

	it('refuses a JSON over a limit of the PDA document', async () => {
		const value = {
			schemaVersion: 1,
			title: '',
			kind: 'dpda',
			inputAlphabet: [],
			stackAlphabet: [],
			states: Array.from({ length: LIMITS.states + 1 }, () => ({ id: 0, name: 'q', x: 0, y: 0 })),
			start: null,
			accepting: [],
			transitions: [],
			nextStateId: 1
		};
		const result = await openPdaFile(
			file('a.json', JSON.stringify(value)),
			importEngine({ ok: false, error: { key: 'never', params: {} } })
		);
		expect(!result.ok && result.error.key).toBe('document.limit_exceeded');
	});

	it('checks the size before it reads the text, and refuses an unknown extension', async () => {
		let read = 0;
		const big: ImportFile = {
			name: 'a.jff',
			size: FILE_BYTE_LIMIT + 1,
			text: async () => ((read += 1), pdaJffText)
		};
		const engine = importEngine({ ok: false, error: { key: 'never', params: {} } });
		const tooBig = await openPdaFile(big, engine);
		expect(!tooBig.ok && tooBig.error.key).toBe('import.too_big');
		expect(read).toBe(0);
		const unknown = await openPdaFile(file('a.txt', pdaJffText), engine);
		expect(!unknown.ok && unknown.error.key).toBe('import.unknown_type');
	});

	it('does not throw when the file cannot be read, or the engine fails', async () => {
		const broken: ImportFile = {
			name: 'a.json',
			size: 2,
			text: async () => {
				throw new Error('gone');
			}
		};
		const unreadable = await openPdaFile(
			broken,
			importEngine({ ok: false, error: { key: 'never', params: {} } })
		);
		expect(!unreadable.ok && unreadable.error.key).toBe('import.unreadable');
		const failing: ImportPdaEngine = {
			importPdaJff: async () => {
				throw new Error('worker died');
			}
		};
		const dead = await openPdaFile(file('a.jff', pdaJffText), failing);
		expect(!dead.ok && dead.error.key).toBe('import.unreadable');
	});

	it('a false positive of the sniff is only a message', async () => {
		const result = await openPdaFile(
			file('a.json', '{"note":"\\"kind\\":\\"dpda\\""}'),
			importEngine({ ok: false, error: { key: 'never', params: {} } })
		);
		expect(!result.ok && result.error.key).toBe('document.invalid_file');
	});
});

describe('pdaJffFile (F3)', () => {
	it('asks the engine with the PDA and the names and places of its states', async () => {
		const asked: { pda?: unknown; layout?: JffState[] } = {};
		const engine: PdaJffEngine = {
			exportPdaJff: async (pda, layout) => {
				asked.pda = pda;
				asked.layout = layout;
				return { ok: true, value: '<xml/>' };
			}
		};
		const doc = wcwrSample();
		expect(await pdaJffFile(engine, doc)).toEqual({ ok: true, value: '<xml/>' });
		expect(asked.pda).toEqual(toEnginePda(doc));
		expect(asked.layout).toEqual(jffLayout(doc));
	});

	it('gives the message of the engine when it refuses, and never throws', async () => {
		const refused: EngineResult<string> = {
			ok: false,
			error: { key: 'jff.symbol_not_single_character', params: { symbol: 'Z0' } }
		};
		const engine: PdaJffEngine = { exportPdaJff: async () => refused };
		expect(await pdaJffFile(engine, wcwrSample())).toEqual(refused);
	});
});

describe('pdaJsonFile (F2)', () => {
	it('is the document, written so that a person can read it, and read back without a change', async () => {
		const doc = wcwrSample('PDA uji');
		const text = pdaJsonFile(doc);
		expect(text).toContain('\n');
		expect(text.endsWith('\n')).toBe(true);
		const back = parsePdaDocumentText(text);
		expect(back.ok && pdaDocumentsEqual(back.value, doc)).toBe(true);
	});
});

describe('F6: the names of the files of a PDA', () => {
	const fallback = () => 'mesin';
	it('gives the names of fileName for a title that is safe and one that is not', () => {
		expect(fileName('a/b:c.', JFF_EXTENSION, fallback())).toBe('a-b-c.jff');
		expect(fileName('a/b:c.', JSON_EXTENSION, fallback())).toBe('a-b-c.webtomata.json');
		expect(fileName('', JFF_EXTENSION, fallback())).toBe('mesin.jff');
		expect(fileName('', JSON_EXTENSION, fallback())).toBe('mesin.webtomata.json');
		const long = fileName('x'.repeat(200), JFF_EXTENSION, fallback());
		expect(Array.from(long.replace(JFF_EXTENSION, ''))).toHaveLength(80);
		for (const name of [fileName('a/b:c.', JFF_EXTENSION, fallback()), long]) {
			expect(name).not.toMatch(/[\\/:*?"<>|]/);
		}
	});
});
