// Reading and writing the records of the page's IndexedDB from a test, the way any code of the
// page could (docs/decisions/0023-saved-machines.md).
import type { Page } from '@playwright/test';

export interface Row {
	id: string;
	recordVersion: number;
	title: string;
	kind: string;
	createdAt: number;
	updatedAt: number;
	openedAt: number;
	doc: string;
	titles?: { id: string; en: string };
}

/** The records in the database of the page, read the way any code of the page could read them. */
export const records = (page: Page) =>
	page.evaluate(
		() =>
			new Promise<Row[]>((resolve, reject) => {
				const open = indexedDB.open('webtomata');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const all = db.transaction('machines').objectStore('machines').getAll();
					all.onsuccess = () => {
						db.close();
						resolve(all.result as Row[]);
					};
					all.onerror = () => reject(all.error);
				};
			})
	);

export const putRow = (page: Page, row: Partial<Row> & { id: string }) =>
	page.evaluate(
		(value) =>
			new Promise<void>((resolve, reject) => {
				const open = indexedDB.open('webtomata');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const tx = db.transaction('machines', 'readwrite');
					tx.objectStore('machines').put(value);
					tx.oncomplete = () => {
						db.close();
						resolve();
					};
					tx.onerror = () => reject(tx.error);
				};
			}),
		row
	);
