// Saved machines: the store, opening the machine of the last visit, and saving after each change.
import { createIndexedDbStore, indexedDbAvailable } from './indexeddb.ts';
import { createMemoryStore } from './memory.ts';
import type { MachineStore } from './store.ts';

export { createAutosave } from './autosave.ts';
export type { Autosave, SaveStatus } from './autosave.ts';
export { createMachine, openLatest } from './machines.ts';
export type { Opened, Skipped } from './machines.ts';
export type { MachineStore, SavedMachine } from './store.ts';

export interface OpenedStore {
	store: MachineStore;
	/** False when the browser gives no storage: the editor works, but nothing stays on the device. */
	persistent: boolean;
}

/**
 * The store of this browser. IndexedDB is asked for a list first, so that a browser that refuses
 * it (a private window, blocked site data) is found out now and not at the first save. Then the
 * editor falls back to memory, and says so.
 */
export async function openStore(): Promise<OpenedStore> {
	if (indexedDbAvailable()) {
		try {
			const store = createIndexedDbStore();
			await store.list();
			return { store, persistent: true };
		} catch {
			// Refused: use memory.
		}
	}
	return { store: createMemoryStore(), persistent: false };
}
