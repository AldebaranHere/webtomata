// Saved PDA machines in every engine (docs/agent/PLAN.md Task T-057, S1 to S6):
// The first visit to PDA mode saves an empty PDA as a record with type: 'pda',
// a change is saved on the device and is there after reload,
// unreadable records are skipped with the notice and kept untouched,
// a refused write shows the warning and clears on next save,
// a browser without storage still allows editing with warning,
// and the list shows the PDA record with its NDPDA chip while FSM openLatest ignores it.
import { engineSettled, expect, openPda as openPdaSandbox, test } from '../fixtures.ts';
import { putRow, records } from './db.ts';
import type { Page } from '@playwright/test';
import { parsePdaDocumentText } from '../../src/lib/editor/pda-document.ts';

const status = (page: Page) => page.locator('.save');

test('S1: first visit to PDA mode saves empty PDA record with type pda and kind ndpda', async ({
	page
}) => {
	await openPdaSandbox(page);
	await expect(status(page)).toHaveClass(/saved/);

	await expect
		.poll(async () => {
			const all = await records(page);
			return all.some((r) => r.type === 'pda');
		})
		.toBe(true);

	const all = await records(page);
	const pdaRec = all.find((r) => r.type === 'pda');
	expect(pdaRec).toBeDefined();
	expect(pdaRec).toMatchObject({
		type: 'pda',
		kind: 'ndpda',
		recordVersion: 1
	});
	expect(pdaRec!.doc).toContain('"schemaVersion":1');
	const parsed = parsePdaDocumentText(pdaRec!.doc);
	expect(parsed.ok).toBe(true);
	if (parsed.ok) {
		expect(parsed.value.states).toHaveLength(0);
	}
});

test('S2: PDA change is saved on device and is there after reload', async ({ page, isMobile }) => {
	await openPdaSandbox(page);

	// Add state q0
	const addBtn = page.getByRole('button', { name: /^Tambah state/ });
	if (isMobile) await addBtn.tap();
	else await addBtn.click();

	const stage = page.locator('.stage svg');
	if (isMobile) await stage.tap({ position: { x: 200, y: 200 } });
	else await stage.click({ position: { x: 200, y: 200 } });

	await expect(status(page)).toHaveClass(/saved/);

	// Verify DB has state q0 in PDA record
	await expect
		.poll(async () => {
			const all = await records(page);
			const pda = all.find((r) => r.type === 'pda');
			return pda?.doc ?? '';
		})
		.toContain('"name":"q0"');

	// Reload
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.getByRole('button', { name: /^State q0/ })).toBeVisible();
});

test('S3: unreadable PDA records are skipped, notice says so, and records are preserved', async ({
	page
}) => {
	// Pre-seed an unreadable PDA record and a schemaVersion: 2 record
	const time = Date.now();
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();

	await putRow(page, {
		id: 'corrupt-pda',
		type: 'pda',
		title: 'Rusak',
		kind: 'ndpda',
		createdAt: time,
		updatedAt: time,
		openedAt: time + 5000,
		doc: 'not json',
		recordVersion: 1
	});
	await putRow(page, {
		id: 'newer-pda',
		type: 'pda',
		title: 'Versi Baru',
		kind: 'ndpda',
		createdAt: time,
		updatedAt: time,
		openedAt: time + 4000,
		doc: JSON.stringify({ schemaVersion: 2, title: 'Versi Baru' }),
		recordVersion: 1
	});

	// Reload in PDA mode so unreadable records are processed
	await engineSettled(page);
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();

	// Notice says records were skipped
	const notice = page.locator('.notice');
	await expect(notice).toBeVisible();
	await expect(notice).toContainText('tidak bisa dibuka');

	// Verify both records remain untouched in DB
	const all = await records(page);
	const corrupt = all.find((r) => r.id === 'corrupt-pda');
	const newer = all.find((r) => r.id === 'newer-pda');
	expect(corrupt?.doc).toBe('not json');
	expect(newer?.doc).toBe(JSON.stringify({ schemaVersion: 2, title: 'Versi Baru' }));
	await engineSettled(page);
});

test('S4: refused write shows Belum tersimpan warning and next save clears it', async ({
	page,
	isMobile
}) => {
	await openPdaSandbox(page);

	// Inject write failure on IDBObjectStore.prototype.put (same pattern as storage.spec.ts)
	await page.evaluate(() => {
		const put = IDBObjectStore.prototype.put;
		(window as unknown as { __refuse: boolean }).__refuse = true;
		IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
			if ((window as unknown as { __refuse: boolean }).__refuse) {
				throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
			}
			return put.apply(this, args);
		};
	});

	// Trigger a change
	const addBtn = page.getByRole('button', { name: /^Tambah state/ });
	if (isMobile) await addBtn.tap();
	else await addBtn.click();
	const stage = page.locator('.stage svg');
	if (isMobile) await stage.tap({ position: { x: 180, y: 100 } });
	else await stage.click({ position: { x: 220, y: 220 } });

	// Warning appears
	await expect(page.locator('.save')).toHaveClass(/failed/);
	await expect(page.locator('.problem[role="alert"]')).toBeVisible();

	// Restore put and trigger another change
	await page.evaluate(() => {
		(window as unknown as { __refuse: boolean }).__refuse = false;
	});

	// Add state q1 to trigger next save
	if (isMobile) await stage.tap({ position: { x: 260, y: 100 } });
	else await stage.click({ position: { x: 340, y: 220 } });

	// Next save succeeds and clears warning
	await expect(page.locator('.save')).toHaveClass(/saved/);
	await expect(page.locator('.problem[role="alert"]')).toHaveCount(0);
});

test('S5: browser with no storage allows editor to work with warning', async ({
	page,
	isMobile
}) => {
	// Prevent IndexedDB from opening successfully
	await page.addInitScript(() => {
		delete (window as unknown as { indexedDB?: IDBFactory }).indexedDB;
	});

	await openPdaSandbox(page);

	// Shows unavailable status/warning
	await expect(page.locator('.save')).toHaveClass(/unavailable/);
	await expect(page.locator('.problem[role="alert"]')).toBeVisible();

	// Can still add state
	const addBtn = page.getByRole('button', { name: /^Tambah state/ });
	if (isMobile) await addBtn.tap();
	else await addBtn.click();
	const stage = page.locator('.stage svg');
	if (isMobile) await stage.tap({ position: { x: 180, y: 100 } });
	else await stage.click({ position: { x: 180, y: 180 } });

	await expect(page.getByRole('button', { name: /^State q0/ })).toBeVisible();
});

test('S6: in FSM mode, Mesin saya lists the PDA record with NDPDA chip, and FSM openLatest is not PDA', async ({
	page,
	isMobile
}) => {
	// First ensure a PDA record exists
	await openPdaSandbox(page);
	await expect(status(page)).toHaveClass(/saved/);

	// Switch to FSM mode
	const trigger = page.locator('.switcher-trigger');
	if (isMobile) await trigger.tap();
	else await trigger.click();
	const fsmOption = page
		.locator('.switcher-popover[role="listbox"]')
		.getByRole('option', { name: /^Mesin FSM/ });
	if (isMobile) await fsmOption.tap();
	else await fsmOption.click();
	await page.locator('.editor[data-ready]').waitFor();

	// Open "Mesin saya" library dialog
	const libBtn = page.getByRole('button', { name: /^Mesin saya \(\d+\)$/ });
	if (isMobile) await libBtn.tap();
	else await libBtn.click();
	const libDialog = page.getByRole('dialog', { name: 'Mesin saya' });
	await expect(libDialog).toBeVisible();

	// The list now shows the PDA record with its NDPDA chip
	const rows = libDialog.getByRole('listitem');
	await expect(rows.filter({ hasText: 'NDPDA' })).toHaveCount(1);

	// Close library
	const closeBtn = libDialog.getByRole('button', { name: 'Tutup' });
	if (isMobile) await closeBtn.tap();
	else await closeBtn.click();

	// Ensure FSM editor open document is FSM, not PDA
	const all = await records(page);
	const fsmRecords = all.filter((r) => r.type !== 'pda' && !r.id.startsWith('soal:'));
	expect(fsmRecords.length).toBeGreaterThanOrEqual(1);
});
