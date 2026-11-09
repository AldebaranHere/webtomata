// The first-run card of the PDA editor (docs/agent/PLAN.md, task T-073): an empty PDA record shows
// "Coba contoh" with the three samples of T-033, one tap copies a sample into a new PDA machine on
// the device, and "Mulai dari kanvas kosong" leaves the card. See `design/screens/pda-editor.md`
// sections 1 and 9 and question 4.
import { engineSettled, expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { records } from './cross/db.ts';
import { parsePdaDocumentText } from '../src/lib/editor/pda-document.ts';

const card = (page: Page) => page.getByRole('region', { name: 'Coba contoh' });
const rows = (page: Page) => card(page).getByRole('listitem');
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });
const blank = (page: Page) =>
	card(page).getByRole('button', {
		name: /^(Mulai dari kanvas kosong|Start from an empty canvas)$/
	});
const status = (page: Page) => page.locator('.save');

/** Opens the PDA mode and waits for the card; a test of the card must not leave it. */
async function openEmptyPda(page: Page): Promise<void> {
	await page.goto('/sandbox?mode=pda');
	await page.locator('.editor[data-ready]').waitFor();
	await expect(card(page)).toBeVisible();
}

/** The one PDA record of the device (a test starts on a clean context), as a document. */
async function pdaDocument(page: Page) {
	const pda = (await records(page)).find((row) => row.type === 'pda');
	expect(pda).toBeDefined();
	const parsed = parsePdaDocumentText(pda!.doc);
	expect(parsed.ok).toBe(true);
	if (!parsed.ok) throw new Error(parsed.error.key);
	return parsed.value;
}

/** Deletes every PDA record from the page's store, so that the next PDA visit starts empty. */
async function deletePdaRecords(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const open = indexedDB.open('webtomata');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const tx = db.transaction('machines', 'readwrite');
					const store = tx.objectStore('machines');
					const all = store.getAll();
					all.onsuccess = () => {
						for (const row of all.result as { id: string; type?: string }[]) {
							if (row.type === 'pda') store.delete(row.id);
						}
					};
					tx.oncomplete = () => {
						db.close();
						resolve();
					};
					tx.onerror = () => reject(tx.error);
				};
			})
	);
}

test.describe('F1: the card of an empty PDA', () => {
	test('shows the three samples, their chips, the blank button and no tour, and is accessible', async ({
		page
	}) => {
		await openEmptyPda(page);

		await expect(card(page).getByRole('heading', { name: 'Coba contoh' })).toBeVisible();
		await expect(rows(page)).toHaveCount(3);
		const texts = await rows(page).allInnerTexts();
		expect(texts[0]).toContain('aⁿbⁿ (n ≥ 1)');
		expect(texts[0]).toContain('DPDA');
		expect(texts[1]).toContain('wcwᴿ');
		expect(texts[1]).toContain('DPDA');
		expect(texts[2]).toContain('wwᴿ');
		expect(texts[2]).toContain('NDPDA');

		await expect(blank(page)).toBeVisible();
		await expect(
			card(page).getByText('Tersimpan di perangkat ini. Tanpa akun, tanpa pelacakan.')
		).toBeVisible();
		// No tour in the PDA mode: the three rows and the blank button, nothing else.
		await expect(card(page).getByRole('button')).toHaveCount(4);
		await expect(
			card(page).getByRole('button', { name: /^(Tur 1 menit|One-minute tour)/ })
		).toHaveCount(0);
		// The panel waits behind the card, as in the FSM editor.
		await expect(page.getByRole('complementary', { name: 'Panel' })).toHaveCount(0);

		for (const button of await card(page).getByRole('button').all()) {
			expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		}

		// Tab order inside the card: the three rows, then the blank button.
		const buttons = card(page).getByRole('button');
		await buttons.nth(0).focus();
		for (const index of [1, 2, 3]) {
			await page.keyboard.press('Tab');
			await expect(buttons.nth(index)).toBeFocused();
		}

		await expectNoAxeViolations(page);
	});

	test('Enter opens the row that has the focus', async ({ page }) => {
		await openEmptyPda(page);
		await card(page).getByRole('button', { name: /^aⁿbⁿ/ }).focus();
		await page.keyboard.press('Enter');
		await expect(card(page)).toHaveCount(0);
		await expect(state(page, 'q0')).toBeVisible();
		await expect(state(page, 'q1')).toBeVisible();
	});

	test('Space opens the row that has the focus', async ({ page }) => {
		await openEmptyPda(page);
		await card(page).getByRole('button', { name: /^wcwᴿ/ }).focus();
		await page.keyboard.press('Space');
		await expect(card(page)).toHaveCount(0);
		await expect(state(page, 'q0')).toBeVisible();
		await expect(state(page, 'q1')).toBeVisible();
	});

	test('a state added with the keyboard makes the card go away by itself', async ({ page }) => {
		await openEmptyPda(page);
		const canvas = page.getByRole('application', { name: 'Kanvas mesin' });
		await expect(async () => {
			await canvas.focus();
			await page.keyboard.press('n');
			expect(await state(page, 'q0').count()).toBe(1);
		}).toPass();
		await expect(card(page)).toHaveCount(0);
	});
});

test('F2: tapping wwᴿ opens its machine, the card leaves, it is saved and it survives a reload', async ({
	page
}) => {
	await openEmptyPda(page);
	await card(page).getByRole('button', { name: /^wwᴿ/ }).click();

	await expect(card(page)).toHaveCount(0);
	await expect(state(page, 'q0')).toBeVisible();
	await expect(state(page, 'q1')).toBeVisible();
	// wwrSample: two states, three edges, five transitions.
	await expect(page.locator('.edge-node')).toHaveCount(3);
	await expect(page.locator('.labels text.label')).toHaveCount(3);
	await expect(status(page)).toHaveClass(/saved/);
	const chip = page.getByRole('radio', { name: 'NDPDA', exact: true });
	await expect(chip).toHaveAttribute('aria-checked', 'true');
	const doc = await pdaDocument(page);
	expect(doc.kind).toBe('ndpda');
	expect(doc.states).toHaveLength(2);
	expect(doc.transitions).toHaveLength(5);

	await engineSettled(page);
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(card(page)).toHaveCount(0);
	await expect(state(page, 'q0')).toBeVisible();
	await expect(state(page, 'q1')).toBeVisible();
	await expect(chip).toHaveAttribute('aria-checked', 'true');
});

test('F3: the opened example is a copy: its edits survive, and the sample comes back whole', async ({
	page
}) => {
	await openEmptyPda(page);
	await card(page).getByRole('button', { name: /^aⁿbⁿ/ }).click();
	await expect(card(page)).toHaveCount(0);
	await expect(state(page, 'q0')).toBeVisible();

	// Delete the accepting state q1 and wait for the save.
	await page.getByRole('button', { name: 'Hapus', exact: true }).click();
	await state(page, 'q1').click();
	await expect(status(page)).toHaveClass(/saved/);
	expect((await pdaDocument(page)).states).toHaveLength(1);

	await engineSettled(page);
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(card(page)).toHaveCount(0);
	await expect(state(page, 'q0')).toBeVisible();
	await expect(state(page, 'q1')).toHaveCount(0);

	// The same page keeps the sample in memory: leave the mode (which flushes the edit), delete the
	// PDA records, come back to a fresh empty record, and open aⁿbⁿ again. A sample changed by the
	// first visit would open with one state here.
	await page.locator('.switcher-trigger').click();
	await page
		.locator('.switcher-popover[role="listbox"]')
		.getByRole('option', { name: /^Mesin FSM/ })
		.click();
	await page.locator('.editor[data-ready]').waitFor();
	await deletePdaRecords(page);
	await page.locator('.switcher-trigger').click();
	await page
		.locator('.switcher-popover[role="listbox"]')
		.getByRole('option', { name: /^Otomata Pushdown \(PDA\)/ })
		.click();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(card(page)).toBeVisible();
	await card(page).getByRole('button', { name: /^aⁿbⁿ/ }).click();
	await expect(state(page, 'q0')).toBeVisible();
	await expect(state(page, 'q1')).toBeVisible();
});

test('F4: "Mulai dari kanvas kosong" leaves the card for the visit, and undo does not bring it back', async ({
	page
}) => {
	await openEmptyPda(page);
	await blank(page).click();
	await expect(card(page)).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^State / })).toHaveCount(0);
	expect((await pdaDocument(page)).states).toHaveLength(0);

	// A state with a tap: still no card.
	await page.getByRole('button', { name: /^Tambah state/ }).click();
	await page.locator('.stage svg').click({ position: { x: 200, y: 200 } });
	await expect(state(page, 'q0')).toBeVisible();
	await expect(card(page)).toHaveCount(0);

	// Undo back to an empty document: the card stays away in this visit.
	await page
		.getByRole('button', { name: /^Urungkan/ })
		.first()
		.click();
	await expect(state(page, 'q0')).toHaveCount(0);
	await expect(card(page)).toHaveCount(0);
});

test('F6: a refused write shows a calm note, loses nothing, and the editor still works', async ({
	page
}) => {
	await openEmptyPda(page);
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

	await card(page).getByRole('button', { name: /^aⁿbⁿ/ }).click();
	await expect(card(page).getByText('Contoh ini belum bisa dibuka. Coba lagi.')).toBeVisible();
	await expect(card(page)).toBeVisible();
	// Nothing was lost: the empty record is still the only PDA record, with no state.
	const pda = (await records(page)).filter((row) => row.type === 'pda');
	expect(pda).toHaveLength(1);
	expect((await pdaDocument(page)).states).toHaveLength(0);

	// The editor still works once writes are allowed again.
	await page.evaluate(() => {
		(window as unknown as { __refuse: boolean }).__refuse = false;
	});
	await blank(page).click();
	await page.getByRole('button', { name: /^Tambah state/ }).click();
	await page.locator('.stage svg').click({ position: { x: 200, y: 200 } });
	await expect(state(page, 'q0')).toBeVisible();
	await expect(status(page)).toHaveClass(/saved/);
});
