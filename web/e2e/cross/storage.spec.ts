// Saved machines in every engine (docs/decisions/0023-saved-machines.md): a change is saved on the
// device and is there after a reload, a record that cannot be read is skipped and kept, and a
// browser without storage still lets the editor work, with a warning. IndexedDB is where the
// engines differ, so this runs in Chrome, Firefox and WebKit.
import { engineSettled, expect, openSandbox, test } from '../fixtures.ts';
import { putRow, records } from './db.ts';
import type { Locator, Page } from '@playwright/test';

const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });
const press = (target: Locator, isMobile: boolean) => (isMobile ? target.tap() : target.click());
const rename = async (page: Page, isMobile: boolean, from: string, to: string) => {
	await press(state(page, from), isMobile);
	await page.keyboard.press('Enter');
	await page.keyboard.press('Control+a');
	await page.keyboard.type(to);
	await page.keyboard.press('Enter');
	await expect(state(page, to)).toBeVisible();
};
const status = (page: Page) => page.locator('.save');

test('the first visit saves the sample as the first machine', async ({ page }) => {
	await openSandbox(page);
	await expect(status(page)).toHaveClass(/saved/);
	await expect.poll(async () => (await records(page)).length).toBe(1);
	const [first] = await records(page);
	expect(first).toMatchObject({ title: 'Berakhiran 01', kind: 'dfsm', recordVersion: 1 });
	expect(JSON.parse(first!.doc).schemaVersion).toBe(1);
});

test('a change is saved on the device, and is there after a reload', async ({ page, isMobile }) => {
	await openSandbox(page);
	await rename(page, isMobile, 'q1', 'Genap');
	await expect(status(page)).toHaveClass(/saved/);
	await expect.poll(async () => (await records(page))[0]?.doc ?? '').toContain('"name":"Genap"');
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(state(page, 'Genap')).toBeVisible();
	await expect(state(page, 'q1')).toHaveCount(0);
	// Still one machine: the reload opened it, it did not make another.
	expect(await records(page)).toHaveLength(1);
});

test('a change that waits for its delay is saved at once when the page is hidden or closed', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await rename(page, isMobile, 'q2', 'Akhir');
	// The page is closing: its events ask for the save before the delay of 800 ms is over.
	await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
	await expect
		.poll(async () => (await records(page))[0]?.doc ?? '', { timeout: 600, intervals: [50] })
		.toContain('"name":"Akhir"');
});

test('leaving the page asks first while a change is not saved, and not after', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	// The strings of the example were just removed: wait until that is saved too.
	await expect(status(page)).toHaveClass(/saved/);
	const asks = () =>
		page.evaluate(() => {
			const event = new Event('beforeunload', { cancelable: true });
			window.dispatchEvent(event);
			return event.defaultPrevented;
		});
	expect(await asks()).toBe(false);
	await rename(page, isMobile, 'q1', 'Nanti');
	expect(await asks()).toBe(true);
	await expect(status(page)).toHaveClass(/saved/);
	expect(await asks()).toBe(false);
});

test('a machine that cannot be read is skipped and kept, with a message', async ({ page }) => {
	await openSandbox(page);
	await expect.poll(async () => (await records(page)).length).toBe(1);
	await engineSettled(page);
	const [good] = await records(page);
	await putRow(page, {
		...good!,
		id: 'rusak',
		title: 'Rusak',
		openedAt: good!.openedAt + 1000,
		doc: '{"broken'
	});
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	// The good machine opens, the bad one is not touched, and the page says so.
	await expect(page.getByRole('status').filter({ hasText: 'datanya rusak' })).toBeVisible();
	await expect(state(page, 'q0')).toBeVisible();
	const all = await records(page);
	expect(all.map((r) => r.id).sort()).toEqual([good!.id, 'rusak'].sort());
	expect(all.find((r) => r.id === 'rusak')!.doc).toBe('{"broken');
});

test('a machine of a newer version is skipped and kept, never overwritten', async ({ page }) => {
	await openSandbox(page);
	await expect.poll(async () => (await records(page)).length).toBe(1);
	await engineSettled(page);
	const [good] = await records(page);
	const future = JSON.stringify({ ...JSON.parse(good!.doc), schemaVersion: 2 });
	await putRow(page, {
		...good!,
		id: 'masa-depan',
		title: 'Dari masa depan',
		openedAt: good!.openedAt + 1000,
		doc: future
	});
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(
		page.getByRole('status').filter({ hasText: 'versi WebTomata yang lebih baru' })
	).toBeVisible();
	await page.getByRole('button', { name: 'Tutup pesan' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'lebih baru' })).toHaveCount(0);
	expect((await records(page)).find((r) => r.id === 'masa-depan')!.doc).toBe(future);
});

test('when every machine is unreadable a new one is made, and none is deleted', async ({
	page
}) => {
	await openSandbox(page);
	await expect.poll(async () => (await records(page)).length).toBe(1);
	await engineSettled(page);
	const [good] = await records(page);
	await putRow(page, { ...good!, doc: 'not json at all', openedAt: good!.openedAt + 1000 });
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	// The new machine is empty, so "Coba contoh" is over it.
	await expect(page.getByRole('region', { name: 'Coba contoh' })).toBeVisible();
	const all = await records(page);
	expect(all).toHaveLength(2);
	expect(all.find((r) => r.id === good!.id)!.doc).toBe('not json at all');
});

test('a browser that refuses storage: the editor works, with a warning that nothing is saved', async ({
	page,
	isMobile
}) => {
	await page.addInitScript(() => {
		IDBFactory.prototype.open = function () {
			throw new DOMException('denied', 'SecurityError');
		};
	});
	await openSandbox(page);
	await expect(page.getByRole('alert')).toContainText('memblokir penyimpanan');
	await expect(status(page)).toHaveClass(/unavailable/);
	// Editing goes on.
	await rename(page, isMobile, 'q1', 'Tetap');
	await expect(state(page, 'Tetap')).toBeVisible();
	await expect(page.getByRole('alert')).toBeVisible();
});

test('a write that is refused: the warning shows, the work stays, and the next save clears it', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await expect(status(page)).toHaveClass(/saved/);
	await page.evaluate(() => {
		const put = IDBObjectStore.prototype.put;
		(window as unknown as { __refuse: boolean }).__refuse = true;
		IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
			if ((window as unknown as { __refuse: boolean }).__refuse) {
				throw new DOMException('full', 'QuotaExceededError');
			}
			return put.apply(this, args);
		};
	});
	await rename(page, isMobile, 'q1', 'Penuh');
	await expect(status(page)).toHaveClass(/failed/);
	await expect(page.getByRole('alert')).toContainText('gagal');
	await expect(state(page, 'Penuh')).toBeVisible();

	await page.evaluate(() => ((window as unknown as { __refuse: boolean }).__refuse = false));
	await rename(page, isMobile, 'q2', 'Lega');
	await expect(status(page)).toHaveClass(/saved/);
	await expect(page.getByRole('alert')).toHaveCount(0);
	await expect.poll(async () => (await records(page))[0]?.doc ?? '').toContain('"name":"Penuh"');
});
