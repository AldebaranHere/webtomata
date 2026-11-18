// "Mesin saya" with FSM and PDA machines (docs/agent/PLAN.md Task T-074, F3 to F8).
import { expect, expectNoAxeViolations, openPda, openSandbox, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { putRow, records } from './cross/db.ts';
import { serializePdaDocument } from '../src/lib/editor/pda-document.ts';
import { anbnSample } from '../src/lib/editor/pda-samples.ts';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Mesin saya' });
const press = (target: Locator, isMobile: boolean) => (isMobile ? target.tap() : target.click());
const openButton = (page: Page) => page.getByRole('button', { name: /^Mesin saya \(\d+\)$/ });
const row = (page: Page, title: string | RegExp) =>
	dialog(page)
		.getByRole('listitem')
		.filter({
			has:
				typeof title === 'string' ? page.getByText(title, { exact: true }) : page.getByText(title)
		});
const waitSaved = (page: Page) => expect(page.locator('.save').first()).toHaveClass(/saved/);

async function openList(page: Page, isMobile: boolean) {
	await press(openButton(page), isMobile);
	await expect(dialog(page)).toBeVisible();
}

async function closeList(page: Page, isMobile: boolean) {
	await press(dialog(page).getByRole('button', { name: 'Tutup' }), isMobile);
	await expect(dialog(page)).toBeHidden();
}

async function openActions(page: Page, title: string | RegExp, isMobile: boolean) {
	const btn = row(page, title).getByRole('button', { name: /^Tindakan untuk / });
	if ((await btn.getAttribute('aria-expanded')) !== 'true') {
		await press(btn, isMobile);
	}
}

test('F3: tap row of the other kind switches mode and opens that machine; reload restores last left', async ({
	page,
	isMobile
}) => {
	// Start in PDA mode and load an example (wcwR)
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	const wcwr = page.getByRole('button', { name: /^wcwᴿ/ });
	await press(wcwr, isMobile);
	await expect(page.locator('.first-run')).toHaveCount(0);
	await waitSaved(page);

	// In PDA mode, open "Mesin saya"
	await openList(page, isMobile);
	// Both FSM and PDA should be in the list
	const fsmRow = row(page, /Tanpa judul|Berakhiran 01/);
	await expect(fsmRow).toBeVisible();
	await expect(fsmRow).toContainText('DFSM');

	// Tap the FSM row: switches mode to FSM
	await press(fsmRow.locator('button.open'), isMobile);
	await expect(dialog(page)).toBeHidden();
	await expect(page).not.toHaveURL(/mode=pda/);
	await expect(page.locator('.editor[data-ready]')).toBeVisible();
	await expect(page.locator('.trigger-current')).toHaveText('Mesin FSM');

	// Now in FSM mode, open "Mesin saya" and tap the PDA row
	await openList(page, isMobile);
	const pdaRow = row(page, /wcwᴿ/);
	await expect(pdaRow).toBeVisible();
	await expect(pdaRow).toContainText('DPDA');

	await press(pdaRow.locator('button.open'), isMobile);
	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(/mode=pda/);
	await expect(page.locator('.editor[data-ready]')).toBeVisible();
	await expect(page.locator('.trigger-current')).toHaveText('Otomata Pushdown (PDA)');

	// Reload keeps the open PDA machine
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page).toHaveURL(/mode=pda/);
	await expect(page.locator('p.title')).toContainText('wcwᴿ');
});

test('F3b: tapping an older PDA row from FSM mode opens that older PDA, not the latest PDA', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await putRow(page, {
		id: 'pda-tua',
		recordVersion: 1,
		type: 'pda',
		title: 'Tua',
		kind: 'dpda',
		createdAt: 1,
		updatedAt: 1,
		openedAt: 1,
		doc: serializePdaDocument(anbnSample('Tua'))
	});
	await putRow(page, {
		id: 'pda-baru',
		recordVersion: 1,
		type: 'pda',
		title: 'Baru',
		kind: 'ndpda',
		createdAt: 2000,
		updatedAt: 2000,
		openedAt: 2000,
		doc: serializePdaDocument(anbnSample('Baru'))
	});

	await openList(page, isMobile);
	await expect(row(page, 'Tua')).toBeVisible();
	await expect(row(page, 'Baru')).toBeVisible();

	await press(row(page, 'Tua').locator('button.open'), isMobile);
	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(/mode=pda/);
	await expect(page.locator('.editor[data-ready]')).toBeVisible();
	await expect(page.locator('p.title')).toHaveText('Tua');

	// A later request while mounted in PDA mode still opens the other PDA row
	await openList(page, isMobile);
	await press(row(page, 'Baru').locator('button.open'), isMobile);
	await expect(dialog(page)).toBeHidden();
	await expect(page.locator('p.title')).toHaveText('Baru');
});

test('F3c: tapping a PDA row that passes checkStoredPda but fails readStoredPda shows unreadable alert and keeps open machine', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await putRow(page, {
		id: 'pda-baik',
		recordVersion: 1,
		type: 'pda',
		title: 'PDA Baik',
		kind: 'dpda',
		createdAt: 2000,
		updatedAt: 2000,
		openedAt: 2000,
		doc: serializePdaDocument(anbnSample('PDA Baik'))
	});
	await putRow(page, {
		id: 'pda-rusak-dalam',
		recordVersion: 1,
		type: 'pda',
		title: 'Rusak Dalam',
		kind: 'dpda',
		createdAt: 1000,
		updatedAt: 1000,
		openedAt: 1000,
		doc: JSON.stringify({
			schemaVersion: 1,
			kind: 'dpda',
			title: 'Rusak Dalam',
			states: [{ bad: 1 }],
			inputAlphabet: [],
			stackAlphabet: [],
			transitions: []
		})
	});

	// From FSM mode: tap 'Rusak Dalam'
	await openList(page, isMobile);
	await press(row(page, 'Rusak Dalam').locator('button.open'), isMobile);
	await expect(dialog(page)).toBeVisible();
	await expect(dialog(page).getByRole('alert')).toContainText(
		'Mesin ini tidak bisa dibuka, jadi tidak bisa diubah.'
	);
	await expect(page).not.toHaveURL(/mode=pda/);

	// Open 'PDA Baik' to switch to PDA mode, then tap 'Rusak Dalam' from PDA mode
	await press(row(page, 'PDA Baik').locator('button.open'), isMobile);
	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(/mode=pda/);
	await expect(page.locator('p.title')).toHaveText('PDA Baik');

	await openList(page, isMobile);
	await press(row(page, 'Rusak Dalam').locator('button.open'), isMobile);
	await expect(dialog(page)).toBeVisible();
	await expect(dialog(page).getByRole('alert')).toContainText(
		'Mesin ini tidak bisa dibuka, jadi tidak bisa diubah.'
	);
	await closeList(page, isMobile);
	await expect(page.locator('p.title')).toHaveText('PDA Baik');
});

test('F4: rename non-open PDA row, duplicate it, delete with Urungkan', async ({
	page,
	isMobile
}) => {
	// Open PDA sandbox and make an example
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	await press(page.getByRole('button', { name: /^aⁿbⁿ/ }), isMobile);
	await waitSaved(page);

	// Make another PDA by switching to FSM then back or through Mesin baru
	// Let's create an FSM or another PDA
	await openList(page, isMobile);
	await expect(dialog(page)).toBeVisible();

	// Check that a PDA row does NOT have "Bagikan"
	await openActions(page, 'aⁿbⁿ (n ≥ 1)', isMobile);
	await expect(dialog(page).getByRole('button', { name: 'Bagikan' })).toHaveCount(0);

	// Duplicate PDA row
	await press(dialog(page).getByRole('button', { name: 'Duplikat' }), isMobile);
	const copyTitle = 'aⁿbⁿ (n ≥ 1) (salinan)';
	const copyRow = row(page, copyTitle);
	await expect(copyRow).toBeVisible();
	await expect(copyRow).toContainText('DPDA');

	// Rename the copy
	await openActions(page, copyTitle, isMobile);
	await press(dialog(page).getByRole('button', { name: 'Ubah nama' }), isMobile);
	const renameInput = dialog(page).getByRole('textbox', { name: 'Nama mesin' });
	await renameInput.fill('Bahasa Palindrom');
	await renameInput.press('Enter');
	await expect(renameInput).toHaveCount(0);
	await expect(row(page, 'Bahasa Palindrom')).toBeVisible();

	// Delete the renamed copy with Urungkan
	await openActions(page, 'Bahasa Palindrom', isMobile);
	await press(dialog(page).getByRole('button', { name: 'Hapus' }), isMobile);
	await expect(row(page, 'Bahasa Palindrom')).toHaveCount(0);

	// Toast has Urungkan
	const toast = dialog(page).getByRole('group', { name: 'Pesan' });
	await expect(toast).toBeVisible();
	await press(toast.getByRole('button', { name: 'Urungkan' }), isMobile);
	await expect(row(page, 'Bahasa Palindrom')).toBeVisible();
});

test('F5: delete open PDA opens next PDA; delete only PDA keeps mode PDA and makes empty PDA', async ({
	page,
	isMobile
}) => {
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	await press(page.getByRole('button', { name: /^aⁿbⁿ/ }), isMobile);
	await waitSaved(page);

	// Duplicate to have 2 PDAs
	await openList(page, isMobile);
	await openActions(page, 'aⁿbⁿ (n ≥ 1)', isMobile);
	await press(dialog(page).getByRole('button', { name: 'Duplikat' }), isMobile);
	const copyTitle = 'aⁿbⁿ (n ≥ 1) (salinan)';
	await expect(row(page, copyTitle)).toBeVisible();

	// Open the copy
	await press(row(page, copyTitle).locator('button.open'), isMobile);
	await expect(dialog(page)).toBeHidden();
	await expect(page.locator('p.title')).toContainText(copyTitle);

	// Delete the open copy while original PDA exists
	await openList(page, isMobile);
	await openActions(page, copyTitle, isMobile);
	await press(dialog(page).getByRole('button', { name: 'Hapus' }), isMobile);

	// Next PDA ('aⁿbⁿ (n ≥ 1)') opened, mode stays PDA
	await expect(page).toHaveURL(/mode=pda/);
	await expect(page.locator('p.title')).toContainText('aⁿbⁿ (n ≥ 1)');

	// Now delete the only remaining PDA
	await openActions(page, 'aⁿbⁿ (n ≥ 1)', isMobile);
	await press(dialog(page).getByRole('button', { name: 'Hapus' }), isMobile);

	// Mode stays PDA, and a new empty PDA is opened showing the first-run card
	await expect(page).toHaveURL(/mode=pda/);
	await closeList(page, isMobile);
	await expect(page.locator('.first-run')).toBeVisible();
});

test('F7: rename open PDA through dialog updates editor title and supports undo', async ({
	page,
	isMobile
}) => {
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	await press(page.getByRole('button', { name: /^wcwᴿ/ }), isMobile);
	await waitSaved(page);

	await openList(page, isMobile);
	await openActions(page, /wcwᴿ/, isMobile);
	await press(dialog(page).getByRole('button', { name: 'Ubah nama' }), isMobile);
	const renameInput = dialog(page).getByRole('textbox', { name: 'Nama mesin' });
	await renameInput.fill('Mesin Palindrom Tengah');
	await renameInput.press('Enter');
	await closeList(page, isMobile);

	// Editor bar shows new title
	await expect(page.locator('p.title')).toContainText('Mesin Palindrom Tengah');

	// Undo restores old title
	const undoBtn = page.getByRole('button', { name: 'Urungkan' }).first();
	await press(undoBtn, isMobile);
	await expect(page.locator('p.title')).toContainText('wcwᴿ');
});

test('F8: phone viewport has >=44px touch targets and no axe violations', async ({
	page,
	isMobile
}) => {
	await openPda(page);
	await openList(page, isMobile);

	// Check axe on library dialog in PDA mode
	await expectNoAxeViolations(page);

	// Button is at least 44px
	const closeBox = await dialog(page).getByRole('button', { name: 'Tutup' }).boundingBox();
	expect(closeBox?.height).toBeGreaterThanOrEqual(44);

	const rowBtnBox = await dialog(page).locator('button.open').first().boundingBox();
	expect(rowBtnBox?.height).toBeGreaterThanOrEqual(44);
});

async function switchMode(page: Page, optionName: RegExp, isMobile: boolean) {
	await press(page.locator('.switcher-trigger'), isMobile);
	await press(
		page.locator('.switcher-popover[role="listbox"]').getByRole('option', { name: optionName }),
		isMobile
	);
	await page.locator('.editor[data-ready]').waitFor();
}

test('T-078 F1: in PDA mode, Mesin baru opens a new empty PDA with first-run card, closes the list, and adds no FSM record', async ({
	page,
	isMobile
}) => {
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	await press(page.getByRole('button', { name: /^aⁿbⁿ/ }), isMobile);
	await expect(page.locator('.first-run')).toHaveCount(0);
	await waitSaved(page);

	const before = await records(page);
	const fsmBefore = before.filter((r) => r.type !== 'pda').length;
	const pdaBefore = before.filter((r) => r.type === 'pda').length;

	await openList(page, isMobile);
	await press(dialog(page).getByRole('button', { name: 'Mesin baru' }), isMobile);
	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(/mode=pda/);
	await expect(page.locator('.first-run')).toBeVisible();
	await expect(page.locator('svg.world g.node')).toHaveCount(0);

	const after = await records(page);
	expect(after.filter((r) => r.type !== 'pda')).toHaveLength(fsmBefore);
	expect(after.filter((r) => r.type === 'pda')).toHaveLength(pdaBefore + 1);

	await openList(page, isMobile);
	const newPdaRow = dialog(page)
		.getByRole('listitem')
		.filter({ hasText: 'NDPDA' })
		.filter({ hasText: 'Tanpa judul' });
	await expect(newPdaRow).toBeVisible();
	await expect(newPdaRow).toContainText('Sedang dibuka');
	await expect(row(page, 'aⁿbⁿ (n ≥ 1)')).toBeVisible();
});

test('T-078 F3: in PDA mode, deleting the FSM current record replaces it with the other FSM or a new empty FSM without touching the open PDA, and after 6s + edit it never returns', async ({
	page,
	isMobile
}) => {
	test.setTimeout(30_000);
	await openSandbox(page);
	await waitSaved(page);

	// Duplicate Berakhiran 01 and rename the copy to 'FSM Cadangan' so there are two FSM records
	await openList(page, isMobile);
	await openActions(page, 'Berakhiran 01', isMobile);
	await press(dialog(page).getByRole('button', { name: 'Duplikat' }), isMobile);
	await openActions(page, 'Berakhiran 01 (salinan)', isMobile);
	await press(dialog(page).getByRole('button', { name: 'Ubah nama' }), isMobile);
	const renameInput = dialog(page).getByRole('textbox', { name: 'Nama mesin' });
	await renameInput.fill('FSM Cadangan');
	await renameInput.press('Enter');
	await expect(row(page, 'FSM Cadangan')).toBeVisible();
	await closeList(page, isMobile);

	const initialRecords = await records(page);
	const fsmCurrent = initialRecords.find((r) => r.type !== 'pda' && r.title === 'Berakhiran 01')!;
	const fsmBackup = initialRecords.find((r) => r.type !== 'pda' && r.title === 'FSM Cadangan')!;
	expect(fsmCurrent).toBeDefined();
	expect(fsmBackup).toBeDefined();

	// Switch to PDA mode and open wcwR
	await switchMode(page, /^Otomata Pushdown/, isMobile);
	await press(page.getByRole('button', { name: /^wcwᴿ/ }), isMobile);
	await waitSaved(page);

	const pdaBefore = (await records(page)).find((r) => r.type === 'pda')!;
	expect(pdaBefore).toBeDefined();

	// Case A: delete the FSM current record ('Berakhiran 01') while in PDA mode (two FSMs exist)
	await openList(page, isMobile);
	await openActions(page, 'Berakhiran 01', isMobile);
	await press(dialog(page).getByRole('button', { name: 'Hapus' }), isMobile);
	await expect(dialog(page)).toBeVisible();
	await expect(row(page, 'Berakhiran 01')).toHaveCount(0);
	await expect(row(page, 'FSM Cadangan')).toBeVisible();
	await expect(page).toHaveURL(/mode=pda/);

	// Wait for the 6-second pending delete to remove Berakhiran 01 from IndexedDB
	await expect
		.poll(async () => (await records(page)).some((r) => r.id === fsmCurrent.id), { timeout: 9000 })
		.toBe(false);

	// Switch to FSM mode: shows 'FSM Cadangan', not the deleted 'Berakhiran 01' and not an empty FSM
	await closeList(page, isMobile);
	await switchMode(page, /^Mesin FSM/, isMobile);
	await expect(page.locator('p.title')).toHaveText('FSM Cadangan');

	// Edit in FSM mode and wait for save: deleted FSM id does not come back
	await page.getByRole('application', { name: 'Kanvas mesin' }).focus();
	await page.keyboard.press('n');
	await waitSaved(page);
	expect((await records(page)).some((r) => r.id === fsmCurrent.id)).toBe(false);

	// Case B: switch back to PDA mode and delete the last remaining FSM ('FSM Cadangan')
	await switchMode(page, /^Otomata Pushdown/, isMobile);
	await expect(page.locator('p.title')).toContainText('wcwᴿ');
	const pdaMid = (await records(page)).find((r) => r.type === 'pda')!;

	await openList(page, isMobile);
	await openActions(page, 'FSM Cadangan', isMobile);
	await press(dialog(page).getByRole('button', { name: 'Hapus' }), isMobile);

	// Dialog stays open, a new empty FSM is created as current for FSM mode, and open PDA is untouched
	await expect(dialog(page)).toBeVisible();
	await expect(row(page, 'FSM Cadangan')).toHaveCount(0);
	const newEmptyFsmRow = dialog(page)
		.getByRole('listitem')
		.filter({ hasText: 'DFSM' })
		.filter({ hasText: 'Tanpa judul' });
	await expect(newEmptyFsmRow).toBeVisible();
	await expect(row(page, /wcwᴿ/)).toContainText('Sedang dibuka');

	const afterLastFsmDelete = await records(page);
	const pdaListAfter = afterLastFsmDelete.filter((r) => r.type === 'pda');
	expect(pdaListAfter).toHaveLength(1);
	expect(pdaListAfter[0]!.id).toBe(pdaMid.id);
	expect(pdaListAfter[0]!.doc).toBe(pdaMid.doc);

	await closeList(page, isMobile);
	await switchMode(page, /^Mesin FSM/, isMobile);
	await expect(page.locator('p.title')).toHaveText('Tanpa judul');
	await expect(page.locator('.first-run')).toBeVisible();
});

test('T-078 F4 (path i): in FSM mode, deleting the latest PDA and switching to PDA mode within 6s opens the other PDA, and Urungkan restores the deleted row', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await putRow(page, {
		id: 'pda-cadangan',
		recordVersion: 1,
		type: 'pda',
		title: 'PDA Cadangan',
		kind: 'dpda',
		createdAt: 1000,
		updatedAt: 1000,
		openedAt: 1000,
		doc: serializePdaDocument(anbnSample('PDA Cadangan'))
	});
	await putRow(page, {
		id: 'pda-terbaru',
		recordVersion: 1,
		type: 'pda',
		title: 'PDA Terbaru',
		kind: 'dpda',
		createdAt: 2000,
		updatedAt: 2000,
		openedAt: 2000,
		doc: serializePdaDocument(anbnSample('PDA Terbaru'))
	});

	await openList(page, isMobile);
	await openActions(page, 'PDA Terbaru', isMobile);
	await press(dialog(page).getByRole('button', { name: 'Hapus' }), isMobile);
	await closeList(page, isMobile);

	// Switch to PDA mode right away (within 6s): opens PDA Cadangan, not the pending-delete PDA Terbaru
	await switchMode(page, /^Otomata Pushdown/, isMobile);
	await expect(page.locator('p.title')).toHaveText('PDA Cadangan');

	// Pressing Urungkan before 6s restores PDA Terbaru in the list
	const toast = page.getByRole('group', { name: 'Pesan' });
	await expect(toast).toBeVisible();
	await press(toast.getByRole('button', { name: 'Urungkan' }), isMobile);

	await openList(page, isMobile);
	await expect(row(page, 'PDA Terbaru')).toBeVisible();
});

test('T-078 F4 (path ii): opening a PDA row from FSM mode, switching back to FSM, deleting that row, and switching to PDA within 6s does not reopen the deleted PDA; Urungkan restores it', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await putRow(page, {
		id: 'pda-cadangan',
		recordVersion: 1,
		type: 'pda',
		title: 'PDA Cadangan',
		kind: 'dpda',
		createdAt: 1000,
		updatedAt: 1000,
		openedAt: 1000,
		doc: serializePdaDocument(anbnSample('PDA Cadangan'))
	});
	await putRow(page, {
		id: 'pda-terbaru',
		recordVersion: 1,
		type: 'pda',
		title: 'PDA Terbaru',
		kind: 'dpda',
		createdAt: 2000,
		updatedAt: 2000,
		openedAt: 2000,
		doc: serializePdaDocument(anbnSample('PDA Terbaru'))
	});

	// Open PDA Terbaru from FSM mode (sets pdaOpenRequest on the page)
	await openList(page, isMobile);
	await press(row(page, 'PDA Terbaru').locator('button.open'), isMobile);
	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(/mode=pda/);
	await expect(page.locator('p.title')).toHaveText('PDA Terbaru');

	// Switch back to FSM mode, delete PDA Terbaru, and switch to PDA mode within 6s
	await switchMode(page, /^Mesin FSM/, isMobile);
	await openList(page, isMobile);
	await openActions(page, 'PDA Terbaru', isMobile);
	await press(dialog(page).getByRole('button', { name: 'Hapus' }), isMobile);
	await closeList(page, isMobile);

	await switchMode(page, /^Otomata Pushdown/, isMobile);
	await expect(page.locator('p.title')).toHaveText('PDA Cadangan');

	// Pressing Urungkan before 6s restores PDA Terbaru
	const toast = page.getByRole('group', { name: 'Pesan' });
	await expect(toast).toBeVisible();
	await press(toast.getByRole('button', { name: 'Urungkan' }), isMobile);

	await openList(page, isMobile);
	await expect(row(page, 'PDA Terbaru')).toBeVisible();
});
