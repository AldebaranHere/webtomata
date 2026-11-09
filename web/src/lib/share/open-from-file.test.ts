import { beforeEach, describe, expect, it, vi } from 'vitest';
import { endsWith01 } from '../editor/diagram/samples.ts';
import { wcwrSample } from '../editor/pda-samples.ts';
import { serializePdaDocument, toEnginePda } from '../editor/pda-document.ts';
import { toMachine } from '../editor/document.ts';
import type { EngineResult, Jff, PdaJff } from '../engine/types.ts';
import type { WorkstationMode } from '../workstation-mode.ts';
import { createMachine } from '../storage/machines.ts';
import { createMemoryStore } from '../storage/memory.ts';
import { isPdaRecord } from '../storage/store.ts';
import type { MachineStore } from '../storage/store.ts';
import type { Problem } from '../storage/library.ts';
import type { OpenFromFileContext } from './open-from-file.ts';
import { openFromFile } from './open-from-file.ts';

const engineMock = vi.hoisted(() => ({
	importJff: vi.fn(),
	importPdaJff: vi.fn(),
	exportPdaJff: vi.fn()
}));
vi.mock('../engine/client.ts', () => ({ engine: engineMock }));

const pdaJffText = `<structure><type>pda</type><automaton><state id="0" name="q0"><initial/></state></automaton></structure>`;
const fsmJffText = `<structure><type>fa</type><automaton/></structure>`;

const jffOf = (): PdaJff => ({
	pda: toEnginePda(wcwrSample()),
	states: wcwrSample().states.map(({ id, name, x, y }) => ({ id, name, x, y }))
});

const fsmOf = (): Jff => ({
	fsm: toMachine(endsWith01()),
	states: endsWith01().states.map(({ id, name, x, y }) => ({ id, name, x, y })),
	notes: []
});

/** What the page gives the opener: the real pieces, with the pieces the opener must call kept visible. */
function fakeLibrary(store: MachineStore) {
	const library = {
		store,
		problem: null as Problem | null,
		hidden: 0,
		openDocument: vi.fn(async (): Promise<Problem | null> => null),
		hide() {
			this.hidden += 1;
		}
	};
	return library;
}

function fakeContext(library: ReturnType<typeof fakeLibrary>, mode: WorkstationMode) {
	const selectMode = vi.fn(async () => {});
	const notice = vi.fn();
	const notes = vi.fn();
	const requestPda = vi.fn();
	const context: OpenFromFileContext = {
		library,
		mode: () => mode,
		selectMode,
		notice,
		notes,
		requestPda,
		untitled: 'Mesin tanpa judul'
	};
	return { context, selectMode, notice, notes, requestPda };
}

const file = (name: string, text: string) => ({
	name,
	size: new TextEncoder().encode(text).length,
	text: async () => text
});

beforeEach(() => {
	engineMock.importJff.mockReset();
	engineMock.importPdaJff.mockReset();
	engineMock.exportPdaJff.mockReset();
});

describe('openFromFile: a PDA file (F4, F5)', () => {
	it('in the FSM mode makes exactly one new PDA record, closes the list, clears an older failure and opens it', async () => {
		const store = createMemoryStore();
		await createMachine(store, endsWith01());
		const library = fakeLibrary(store);
		library.problem = { key: 'library.unreadable', params: {} };
		const { context, selectMode, notice, requestPda } = fakeContext(library, 'fsm');
		engineMock.importPdaJff.mockResolvedValue({
			ok: true,
			value: jffOf()
		} satisfies EngineResult<PdaJff>);

		await openFromFile(file('Mesin Uji.jff', pdaJffText), context);

		const records = await store.list();
		expect(records).toHaveLength(2);
		expect(records.filter(isPdaRecord)).toHaveLength(1);
		expect(library.hidden).toBe(1);
		expect(library.problem).toBeNull();
		expect(selectMode).toHaveBeenCalledWith('pda');
		expect(requestPda).toHaveBeenCalledWith(records.find(isPdaRecord)!.id);
		expect(notice).toHaveBeenCalledWith({
			key: 'import.opened',
			params: { title: 'Mesin Uji' }
		});
	});

	it('in the PDA mode adds the record without switching the mode again', async () => {
		const store = createMemoryStore();
		const library = fakeLibrary(store);
		const { context, selectMode, notice, requestPda } = fakeContext(library, 'pda');
		engineMock.importPdaJff.mockResolvedValue({
			ok: true,
			value: jffOf()
		} satisfies EngineResult<PdaJff>);

		await openFromFile(file('pda.json', serializePdaDocument(wcwrSample('PDA uji'))), context);

		expect((await store.list()).filter(isPdaRecord)).toHaveLength(1);
		expect(selectMode).not.toHaveBeenCalled();
		expect(requestPda).toHaveBeenCalledTimes(1);
		expect(notice).toHaveBeenCalledWith({ key: 'import.opened', params: { title: 'PDA uji' } });
	});

	it('writes nothing and keeps the list open when the file fails', async () => {
		const store = createMemoryStore();
		await createMachine(store, endsWith01());
		const library = fakeLibrary(store);
		const { context, selectMode, notice, requestPda } = fakeContext(library, 'fsm');
		engineMock.importPdaJff.mockResolvedValue({
			ok: false,
			error: { key: 'jff.pda_read_not_single', params: { label: 'ab', from: 0, to: 1 } }
		} satisfies EngineResult<PdaJff>);

		await openFromFile(file('a.jff', pdaJffText), context);

		expect(await store.list()).toHaveLength(1);
		expect(library.hidden).toBe(0);
		expect(library.problem).toEqual({
			key: 'jff.pda_read_not_single',
			params: { label: 'ab', from: 0, to: 1 }
		});
		expect(selectMode).not.toHaveBeenCalled();
		expect(requestPda).not.toHaveBeenCalled();
		expect(notice).not.toHaveBeenCalled();
	});

	it('shows a message without text as the calm unreadable, not as a raw key', async () => {
		const store = createMemoryStore();
		const library = fakeLibrary(store);
		const { context } = fakeContext(library, 'fsm');
		engineMock.importPdaJff.mockResolvedValue({
			ok: false,
			error: { key: 'machine.unknown_symbol', params: { symbol: 'A' } }
		} satisfies EngineResult<PdaJff>);

		await openFromFile(file('a.jff', pdaJffText), context);

		expect(library.problem).toEqual({ key: 'import.unreadable', params: {} });
	});

	it('says storage.failed and writes nothing when the store refuses the write', async () => {
		const store = createMemoryStore();
		await createMachine(store, endsWith01());
		const failing: MachineStore = {
			...store,
			put: async () => {
				throw new Error('refused');
			}
		};
		const library = fakeLibrary(failing);
		const { context, selectMode, requestPda } = fakeContext(library, 'fsm');
		engineMock.importPdaJff.mockResolvedValue({
			ok: true,
			value: jffOf()
		} satisfies EngineResult<PdaJff>);

		await openFromFile(file('a.jff', pdaJffText), context);

		expect(await failing.list()).toHaveLength(1);
		expect(library.problem).toEqual({ key: 'storage.failed', params: {} });
		expect(library.hidden).toBe(0);
		expect(selectMode).not.toHaveBeenCalled();
		expect(requestPda).not.toHaveBeenCalled();
	});
});

describe('openFromFile: a finite automaton file (F4, F5)', () => {
	it('in the FSM mode opens the machine as today, with its notes and the notice', async () => {
		const store = createMemoryStore();
		await createMachine(store, endsWith01());
		const library = fakeLibrary(store);
		const { context, selectMode, notice, notes } = fakeContext(library, 'fsm');
		engineMock.importJff.mockResolvedValue({
			ok: true,
			value: fsmOf()
		} satisfies EngineResult<Jff>);

		await openFromFile(file('Mesin FSM.jff', fsmJffText), context);

		expect(library.openDocument).toHaveBeenCalledTimes(1);
		expect(selectMode).not.toHaveBeenCalled();
		expect(notes).toHaveBeenCalledWith([]);
		expect(notice).toHaveBeenCalledWith({ key: 'import.opened', params: { title: 'Mesin FSM' } });
	});

	it('in the PDA mode opens it and switches to the FSM mode, and makes no PDA record', async () => {
		const store = createMemoryStore();
		const library = fakeLibrary(store);
		const { context, selectMode, notice } = fakeContext(library, 'pda');
		engineMock.importJff.mockResolvedValue({
			ok: true,
			value: fsmOf()
		} satisfies EngineResult<Jff>);

		await openFromFile(file('Mesin FSM.jff', fsmJffText), context);

		expect(library.openDocument).toHaveBeenCalledTimes(1);
		expect(selectMode).toHaveBeenCalledWith('fsm');
		expect((await store.list()).filter(isPdaRecord)).toHaveLength(0);
		expect(notice).toHaveBeenCalledWith({ key: 'import.opened', params: { title: 'Mesin FSM' } });
	});

	it('in the PDA mode does not switch when the FSM file failed', async () => {
		const store = createMemoryStore();
		const library = fakeLibrary(store);
		const { context, selectMode } = fakeContext(library, 'pda');
		engineMock.importJff.mockResolvedValue({
			ok: false,
			error: { key: 'jff.xml_invalid', params: { line: 1, column: 2 } }
		} satisfies EngineResult<Jff>);

		await openFromFile(file('a.jff', '<structure'), context);

		expect(selectMode).not.toHaveBeenCalled();
		expect(library.problem).toEqual({ key: 'jff.xml_invalid', params: { line: 1, column: 2 } });
	});
});
