// The saved machines as the page uses them: the machine that is open, the list, and what the list
// does. One object for the page, so that the header (the count and the button), the Sandbox (the
// editor) and the dialog (the list) all see the same state. The rules are in library.ts, machines.ts
// and autosave.ts, which have no framework in them.
import { createDocument } from '../editor/document.ts';
import type { MachineDocument } from '../editor/document.ts';
import type { Announcement } from '../editor/interaction/editor.ts';
import { createAutosave } from './autosave.ts';
import type { Autosave } from './autosave.ts';
import { createMachine, openLatest, placeExample } from './machines.ts';
import type { Opened, Placeable, Sample, Skipped } from './machines.ts';
import { createPendingDeletes, duplicateMachine, listEntries, renameStored } from './library.ts';
import type { Entry, PendingDeletes, Problem } from './library.ts';
import { getLocale } from '#lib/i18n/index.svelte.ts';
import { createMemoryStore } from './memory.ts';
import { localizedTitle } from './titles.ts';
import { openStore } from './index.ts';
import { readStoredDocument } from './migrate.ts';
import type { MachineStore } from './store.ts';

export interface Current {
	opened: Opened;
	autosave: Autosave;
	/** Changes each time the editor must be made again, also for the same record (an example was put in it). */
	key: number;
}

class Library {
	store = $state.raw<MachineStore | null>(null);
	persistent = $state(true);
	/** The list has been read and a machine is open. */
	ready = $state(false);
	current = $state.raw<Current | null>(null);
	/** The machines that could not be read when the page opened. */
	skipped = $state.raw<Skipped[]>([]);
	entries = $state.raw<Entry[]>([]);
	/** The dialog is open. */
	open = $state(false);
	/** A message of the list (a machine that is gone, or cannot be opened), already a key. */
	problem = $state.raw<Problem | null>(null);
	/** The machine that was just deleted, for the toast with Urungkan. */
	deleted = $state.raw<Announcement | null>(null);
	count = $derived(this.entries.length);

	private pending: PendingDeletes | null = null;
	private sequence = 0;
	private keys = 0;
	/** The editor sets this, so that the title of the open machine is changed through it (undo works). */
	renameCurrent: (title: string) => Problem | null = () => null;

	/** Opens the machine of the last visit. Starts again if the page was left and came back. */
	async start(makeSample: () => Sample): Promise<void> {
		this.dispose();
		this.ready = false;
		const found = await openStore();
		let { store } = found;
		let { persistent } = found;
		let opened: Opened;
		try {
			opened = await openLatest(store, makeSample);
		} catch {
			// The store opened but does not work: the editor goes on in memory, and says so.
			store = createMemoryStore();
			persistent = false;
			opened = await openLatest(store, makeSample);
		}
		this.store = store;
		this.persistent = persistent;
		this.skipped = opened.skipped;
		this.current = {
			opened,
			autosave: createAutosave({ store, base: opened.record }),
			key: ++this.keys
		};
		this.pending = createPendingDeletes({ store, onChange: () => void this.afterPendingChange() });
		await this.refresh();
		this.ready = true;
	}

	dispose(): void {
		// Only the timers: a machine that waits for its delete is kept. The autosave is not stopped here:
		// the editor saves what waits when it is removed from the page.
		this.pending?.dispose();
		this.pending = null;
	}

	show = (): void => {
		this.problem = null;
		this.open = true;
	};

	hide = (): void => {
		this.open = false;
	};

	/** Reads the list again (each time the dialog opens, and after each action). */
	async refresh(): Promise<void> {
		if (!this.store) return;
		const all = await listEntries(this.store);
		this.entries = all.filter((entry) => !this.pending?.isPending(entry.id));
	}

	private async afterPendingChange(): Promise<void> {
		if (this.deleted && !this.pending?.isPending(this.deleted.params.id as string)) {
			this.deleted = null;
		}
		await this.refresh();
	}

	/** Saves the open machine, and stops its autosave: before another one is opened. */
	private async leaveCurrent(): Promise<void> {
		const current = this.current;
		if (!current) return;
		await current.autosave.flush();
		current.autosave.dispose();
	}

	/** Opens a machine of the list. Returns why it could not, or null. */
	async openMachine(id: string, keepOpen = false): Promise<Problem | null> {
		const store = this.store;
		if (!store) return null;
		if (this.current?.opened.record.id === id) {
			if (!keepOpen) this.hide();
			return null;
		}
		const record = await store.get(id);
		if (!record) return this.fail({ key: 'library.missing', params: {} });
		const read = readStoredDocument(record.doc);
		if (!read.ok) return this.fail({ key: 'library.unreadable', params: {} });
		await this.leaveCurrent();
		const opened = { ...record, openedAt: Date.now() };
		try {
			await store.put(opened);
		} catch {
			// It opens all the same; the autosave tells if the store does not work.
		}
		this.current = {
			opened: { record: opened, doc: read.doc, skipped: [] },
			autosave: createAutosave({ store, base: opened }),
			key: ++this.keys
		};
		this.skipped = [];
		this.problem = null;
		if (!keepOpen) this.hide();
		await this.refresh();
		return null;
	}

	/**
	 * Opens an example from the first-run card: in the place of the open machine when that is empty
	 * and untouched, otherwise as a machine of its own (see `placeExample`). Returns why it could
	 * not, or null.
	 */
	async openExample(example: Placeable): Promise<Problem | null> {
		const store = this.store;
		if (!store) return null;
		// What the student has done is saved first, so that the record is what is on the screen. The
		// autosave goes on until the example is placed: a refused write leaves everything as it was.
		await this.current?.autosave.flush();
		let placed;
		try {
			placed = await placeExample(store, this.current?.opened.record.id, example);
		} catch {
			return this.fail({ key: 'storage.failed', params: {} });
		}
		if (!placed.replaced) return await this.openMachine(placed.record.id, true);
		this.current?.autosave.dispose();
		this.current = {
			opened: { record: placed.record, doc: example.doc, skipped: [] },
			autosave: createAutosave({ store, base: placed.record }),
			key: ++this.keys
		};
		this.problem = null;
		await this.refresh();
		return null;
	}

	/** A document (the result of a conversion, or an empty one) saved as a machine of its own, and opened. */
	async openDocument(doc: MachineDocument, keepOpen = false): Promise<Problem | null> {
		const store = this.store;
		if (!store) return null;
		try {
			const record = await createMachine(store, doc);
			return await this.openMachine(record.id, keepOpen);
		} catch {
			return this.fail({ key: 'storage.failed', params: {} });
		}
	}

	/** A new empty machine, saved and opened. */
	newMachine(keepOpen = false): Promise<Problem | null> {
		return this.openDocument(createDocument(), keepOpen);
	}

	async duplicate(id: string): Promise<Problem | null> {
		const store = this.store;
		if (!store) return null;
		const copy = await duplicateMachine(store, id);
		await this.refresh();
		return copy ? null : this.fail({ key: 'library.unreadable', params: {} });
	}

	/** The title of any machine. The open one goes through the editor, so that undo works. */
	async rename(id: string, title: string): Promise<Problem | null> {
		const store = this.store;
		if (!store) return null;
		if (this.current?.opened.record.id === id) {
			const problem = this.renameCurrent(title);
			if (problem) return problem;
			await this.current.autosave.flush();
		} else {
			const problem = await renameStored(store, id, title);
			if (problem) return problem;
		}
		await this.refresh();
		return null;
	}

	/**
	 * The machine leaves the list now and is removed for good after six seconds, unless it is
	 * brought back. Deleting the open machine opens another one first.
	 */
	async deleteMachine(id: string): Promise<void> {
		const store = this.store;
		if (!store || !this.pending) return;
		const entry = this.entries.find((e) => e.id === id);
		const shown = entry ? localizedTitle(entry.titles, entry.title, getLocale()) : '';
		if (this.current?.opened.record.id === id) {
			const next = this.entries.find((e) => e.id !== id && e.readable);
			// The record of the machine that is left is written once more, so that Urungkan finds it as it was.
			if (next) {
				const problem = await this.openMachine(next.id, true);
				if (problem) return;
			} else {
				const problem = await this.newMachine(true);
				if (problem) return;
			}
		}
		this.pending.begin(id);
		this.deleted = {
			key: 'library.deleted' as Announcement['key'],
			params: { title: shown, id },
			seq: ++this.sequence
		};
		await this.refresh();
	}

	undoDelete(): void {
		const id = this.deleted?.params.id as string | undefined;
		if (id) this.pending?.undo(id);
		this.deleted = null;
		void this.refresh();
	}

	dismissDeleted(): void {
		this.deleted = null;
	}

	private fail(problem: Problem): Problem {
		this.problem = problem;
		return problem;
	}
}

export const library = new Library();
