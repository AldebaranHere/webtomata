// The store in IndexedDB: one database, one object store, one record for each machine. No package:
// the part of the API that is used is small. A write resolves when its transaction is complete, so
// "saved" means that the browser has the record. It is tested in the real browsers
// (e2e/cross/storage.spec.ts), because IndexedDB is where they differ.
import type { MachineStore, SavedMachine } from './store.ts';

const DATABASE = 'webtomata';
const STORE = 'machines';
const VERSION = 1;

/** The browser has IndexedDB (it may still refuse to open it, in a private window). */
export const indexedDbAvailable = (): boolean => typeof indexedDB !== 'undefined';

const failure = (error: DOMException | null | undefined, fallback: string) =>
	error ?? new Error(fallback);

export function createIndexedDbStore(factory: IDBFactory = indexedDB): MachineStore {
	let opening: Promise<IDBDatabase> | null = null;

	function open(): Promise<IDBDatabase> {
		opening ??= new Promise<IDBDatabase>((resolve, reject) => {
			const request = factory.open(DATABASE, VERSION);
			request.onupgradeneeded = () => {
				if (!request.result.objectStoreNames.contains(STORE)) {
					request.result.createObjectStore(STORE, { keyPath: 'id' });
				}
			};
			request.onsuccess = () => {
				const db = request.result;
				// Another tab wants to upgrade the database, or the browser closes it: open again next time.
				db.onversionchange = () => {
					db.close();
					opening = null;
				};
				db.onclose = () => {
					opening = null;
				};
				resolve(db);
			};
			request.onerror = () => reject(failure(request.error, 'IndexedDB could not be opened'));
			request.onblocked = () => reject(new Error('IndexedDB is blocked by another tab'));
		}).catch((error) => {
			opening = null;
			throw error;
		});
		return opening;
	}

	/** Runs one transaction. A write resolves when the transaction is complete, a read when it has its result. */
	async function run<T>(
		mode: IDBTransactionMode,
		work: (store: IDBObjectStore) => IDBRequest<T> | null
	): Promise<T | undefined> {
		const db = await open();
		return new Promise<T | undefined>((resolve, reject) => {
			let transaction: IDBTransaction;
			try {
				transaction = db.transaction(STORE, mode);
			} catch (error) {
				opening = null;
				reject(error);
				return;
			}
			const request = work(transaction.objectStore(STORE));
			transaction.oncomplete = () => resolve(request?.result);
			transaction.onerror = () =>
				reject(failure(transaction.error, 'IndexedDB transaction failed'));
			transaction.onabort = () =>
				reject(failure(transaction.error, 'IndexedDB transaction aborted'));
		});
	}

	return {
		async list() {
			const all = (await run<SavedMachine[]>('readonly', (s) => s.getAll())) ?? [];
			return all.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
		},
		async get(id) {
			return run<SavedMachine | undefined>('readonly', (s) => s.get(id));
		},
		async put(record) {
			await run('readwrite', (s) => s.put(record));
		},
		async delete(id) {
			await run('readwrite', (s) => s.delete(id));
		}
	};
}
