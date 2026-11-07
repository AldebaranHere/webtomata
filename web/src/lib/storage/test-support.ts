import { isPdaRecord } from './store.ts';
import type { MachineStore, SavedPdaMachine } from './store.ts';

export async function getPdaRecord(store: MachineStore, id: string): Promise<SavedPdaMachine> {
	const record = await store.get(id);
	if (!record || !isPdaRecord(record)) {
		throw new Error(`Record ${id} is not a SavedPdaMachine`);
	}
	return record;
}

export interface RefusingStoreOptions {
	put?: boolean | (() => boolean);
	list?: boolean | (() => boolean);
}

export function createRefusingStore(
	store: MachineStore,
	options: RefusingStoreOptions = { put: true }
): MachineStore {
	return {
		...store,
		put: async (record) => {
			const shouldRefuse = typeof options.put === 'function' ? options.put() : options.put;
			if (shouldRefuse) throw new Error('QuotaExceededError');
			await store.put(record);
		},
		list: async () => {
			const shouldRefuse = typeof options.list === 'function' ? options.list() : options.list;
			if (shouldRefuse) throw new Error('StoreListError');
			return store.list();
		}
	};
}
