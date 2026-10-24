// A store in memory. The unit tests use it, and it is the fallback when the browser gives no
// IndexedDB (a private window, blocked site data): the editor still works, and the status says that
// nothing is saved on the device.
import type { MachineStore, SavedMachine } from './store.ts';

const copy = (record: SavedMachine): SavedMachine => ({ ...record });

export function createMemoryStore(): MachineStore {
	const records = new Map<string, SavedMachine>();
	return {
		async list() {
			return [...records.values()]
				.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
				.map(copy);
		},
		async get(id) {
			const record = records.get(id);
			return record ? copy(record) : undefined;
		},
		async put(record) {
			records.set(record.id, copy(record));
		},
		async delete(id) {
			records.delete(id);
		}
	};
}
