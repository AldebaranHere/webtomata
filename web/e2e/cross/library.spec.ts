// The list "Mesin saya" in every engine: new, open, duplicate, rename, delete with Urungkan, a
// machine that cannot be read, and the sheet of a phone (docs/ux/editor-interactions.md and ADR 0023).
import { expect, expectNoAxeViolations, openSandbox, test } from '../fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { putRow, records } from './db.ts';

const nodes = (page: Page) => page.locator('svg.world g.node');
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Mesin saya' });
const press = (target: Locator, isMobile: boolean) => (isMobile ? target.tap() : target.click());
const openButton = (page: Page) => page.getByRole('button', { name: /^Mesin saya \(\d+\)$/ });
const row = (page: Page, title: string) =>
	dialog(page)
		.getByRole('listitem')
		.filter({ has: page.getByText(title, { exact: true }) });

async function openList(page: Page, isMobile: boolean) {
	await press(openButton(page), isMobile);
	await expect(dialog(page)).toBeVisible();
}
async function closeList(page: Page, isMobile: boolean) {
	await press(dialog(page).getByRole('button', { name: 'Tutup' }), isMobile);
	await expect(dialog(page)).toBeHidden();
}
async function actions(page: Page, title: string, isMobile: boolean) {
	await press(row(page, title).getByRole('button', { name: `Tindakan untuk ${title}` }), isMobile);
}
const waitSaved = (page: Page) => expect(page.locator('.save').first()).toHaveClass(/saved/);

test('the button shows how many machines there are, and the list marks the one that is open', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await expect(openButton(page)).toHaveText(isMobile ? '' : 'Mesin saya (1)');
	await expect(openButton(page)).toHaveAccessibleName('Mesin saya (1)');
	await openList(page, isMobile);
	await expect(row(page, 'Berakhiran 01')).toContainText('Sedang dibuka');
	await expect(row(page, 'Berakhiran 01')).toContainText('DFSM');
	await expect(dialog(page)).toContainText(
		'Menghapus data situs di peramban juga menghapus mesin ini.'
	);
	await expectNoAxeViolations(page);
	// Esc closes it, and the focus goes back to the button that opened it.
	if (!isMobile) {
		await page.keyboard.press('Escape');
		await expect(dialog(page)).toBeHidden();
		await expect(openButton(page)).toBeFocused();
	}
});

test('a new machine is empty, saved and opened; each machine keeps its own changes, also after a reload', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await openList(page, isMobile);
	await press(dialog(page).getByRole('button', { name: 'Mesin baru' }), isMobile);
	await expect(dialog(page)).toBeHidden();
	await expect(nodes(page)).toHaveCount(0);
	await expect(openButton(page)).toHaveAccessibleName('Mesin saya (2)');

	// A state in the new machine.
	await page.getByRole('application', { name: 'Kanvas mesin' }).focus();
	await page.keyboard.press('n');
	await expect(nodes(page)).toHaveCount(1);
	await waitSaved(page);

	// Back to the first machine: it has its three states.
	await openList(page, isMobile);
	await press(row(page, 'Berakhiran 01').locator('button.open'), isMobile);
	await expect(dialog(page)).toBeHidden();
	await expect(nodes(page)).toHaveCount(3);

	// A reload opens the machine that was opened last, and the other one is as it was left.
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(nodes(page)).toHaveCount(3);
	await openList(page, isMobile);
	await press(row(page, 'Tanpa judul').locator('button.open'), isMobile);
	await expect(nodes(page)).toHaveCount(1);
});

test('switching right after a change keeps that change', async ({ page, isMobile }) => {
	await openSandbox(page);
	await press(state(page, 'q1'), isMobile);
	await page.keyboard.press('a');
	await expect(state(page, 'q1')).toHaveAttribute('aria-label', /accepting state/);
	// No waiting for the autosave: the list is opened at once, and a new machine is made.
	await openList(page, isMobile);
	await press(dialog(page).getByRole('button', { name: 'Mesin baru' }), isMobile);
	await expect(nodes(page)).toHaveCount(0);
	await openList(page, isMobile);
	await press(row(page, 'Berakhiran 01').locator('button.open'), isMobile);
	await expect(state(page, 'q1')).toHaveAttribute('aria-label', /accepting state/);
});

test('duplicate: a copy under the original, not opened', async ({ page, isMobile }) => {
	await openSandbox(page);
	await openList(page, isMobile);
	await actions(page, 'Berakhiran 01', isMobile);
	await press(row(page, 'Berakhiran 01').getByRole('button', { name: 'Duplikat' }), isMobile);
	await expect(row(page, 'Berakhiran 01 (salinan)')).toBeVisible();
	await expect(row(page, 'Berakhiran 01 (salinan)')).not.toContainText('Sedang dibuka');
	await expect(row(page, 'Berakhiran 01')).toContainText('Sedang dibuka');
	const titles = await dialog(page).locator('li .name').allInnerTexts();
	expect(titles).toEqual(['Berakhiran 01', 'Berakhiran 01 (salinan)']);
	await closeList(page, isMobile);
	await expect(openButton(page)).toHaveAccessibleName('Mesin saya (2)');
});

test('rename: the open machine through the editor (undo works), another one directly, and a title that is refused', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await openList(page, isMobile);
	await actions(page, 'Berakhiran 01', isMobile);
	await press(row(page, 'Berakhiran 01').getByRole('button', { name: 'Ubah nama' }), isMobile);
	const field = dialog(page).getByRole('textbox', { name: 'Nama mesin' });
	await expect(field).toBeFocused();
	await expect(field).toHaveValue('Berakhiran 01');
	await page.keyboard.press('Control+a');
	await page.keyboard.type('Genap a');
	await page.keyboard.press('Enter');
	await expect(row(page, 'Genap a')).toContainText('Sedang dibuka');
	await closeList(page, isMobile);
	await expect(page.locator('.bar .title')).toHaveText('Genap a');
	// The title is one step of the editor's history.
	await page.getByRole('application', { name: 'Kanvas mesin' }).focus();
	await page.keyboard.press('Control+z');
	await expect(page.locator('.bar .title')).toHaveText('Berakhiran 01');
	await page.keyboard.press('Control+y');
	await expect(page.locator('.bar .title')).toHaveText('Genap a');

	// Another machine: a copy, renamed directly. A title that is too long is refused and nothing changes.
	await openList(page, isMobile);
	await actions(page, 'Genap a', isMobile);
	await press(row(page, 'Genap a').getByRole('button', { name: 'Duplikat' }), isMobile);
	await actions(page, 'Genap a (salinan)', isMobile);
	await press(row(page, 'Genap a (salinan)').getByRole('button', { name: 'Ubah nama' }), isMobile);
	await page.keyboard.press('Control+a');
	await page.keyboard.type('x'.repeat(101));
	await page.keyboard.press('Enter');
	await expect(dialog(page).getByRole('alert')).toContainText('100 karakter');
	await page.keyboard.press('Control+a');
	await page.keyboard.type('Versi saya');
	await page.keyboard.press('Enter');
	await expect(row(page, 'Versi saya')).toBeVisible();
	await expect(row(page, 'Genap a')).toContainText('Sedang dibuka');
});

test('delete with Urungkan: the machine is gone from the list at once and removed for good after six seconds', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await openList(page, isMobile);
	await actions(page, 'Berakhiran 01', isMobile);
	await press(row(page, 'Berakhiran 01').getByRole('button', { name: 'Duplikat' }), isMobile);
	await actions(page, 'Berakhiran 01 (salinan)', isMobile);
	await press(
		row(page, 'Berakhiran 01 (salinan)').getByRole('button', { name: 'Hapus' }),
		isMobile
	);
	await expect(row(page, 'Berakhiran 01 (salinan)')).toHaveCount(0);
	const toast = dialog(page).getByRole('group', { name: 'Pesan' });
	await expect(toast).toContainText('Mesin "Berakhiran 01 (salinan)" dihapus.');
	const undo = toast.getByRole('button', { name: 'Urungkan' });
	expect((await undo.boundingBox())!.height).toBeGreaterThanOrEqual(44);

	// Urungkan: it is back, as it was.
	await press(undo, isMobile);
	await expect(row(page, 'Berakhiran 01 (salinan)')).toBeVisible();
	expect(await records(page)).toHaveLength(2);

	// Delete again and let the time pass.
	await actions(page, 'Berakhiran 01 (salinan)', isMobile);
	await press(
		row(page, 'Berakhiran 01 (salinan)').getByRole('button', { name: 'Hapus' }),
		isMobile
	);
	await expect.poll(async () => (await records(page)).length, { timeout: 9000 }).toBe(1);
	await expect(row(page, 'Berakhiran 01 (salinan)')).toHaveCount(0);
});

test('a machine waiting to be deleted survives if the page is closed inside the six seconds', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await openList(page, isMobile);
	await actions(page, 'Berakhiran 01', isMobile);
	await press(row(page, 'Berakhiran 01').getByRole('button', { name: 'Duplikat' }), isMobile);
	await actions(page, 'Berakhiran 01 (salinan)', isMobile);
	await press(
		row(page, 'Berakhiran 01 (salinan)').getByRole('button', { name: 'Hapus' }),
		isMobile
	);
	await expect(row(page, 'Berakhiran 01 (salinan)')).toHaveCount(0);
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(openButton(page)).toHaveAccessibleName('Mesin saya (2)');
});

test('deleting the open machine opens another one; deleting the only one makes a new empty machine', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await openList(page, isMobile);
	await press(dialog(page).getByRole('button', { name: 'Mesin baru' }), isMobile);
	await openList(page, isMobile);
	// The open machine is the new one: delete it, and the first one opens.
	await actions(page, 'Tanpa judul', isMobile);
	await press(row(page, 'Tanpa judul').getByRole('button', { name: 'Hapus' }), isMobile);
	await expect(dialog(page)).toBeVisible();
	await expect(row(page, 'Berakhiran 01')).toContainText('Sedang dibuka');
	await expect(row(page, 'Tanpa judul')).toHaveCount(0);

	// The only machine: deleting it opens a new empty one.
	await actions(page, 'Berakhiran 01', isMobile);
	await press(row(page, 'Berakhiran 01').getByRole('button', { name: 'Hapus' }), isMobile);
	await expect(row(page, 'Tanpa judul')).toContainText('Sedang dibuka');
	await expect(row(page, 'Berakhiran 01')).toHaveCount(0);
	// Urungkan brings the first one back.
	await press(dialog(page).getByRole('button', { name: 'Urungkan' }), isMobile);
	await expect(row(page, 'Berakhiran 01')).toBeVisible();
	await expect(row(page, 'Tanpa judul')).toContainText('Sedang dibuka');
});

test('a machine that cannot be read is in the list, marked, with only Hapus, and is kept until it is deleted', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await expect.poll(async () => (await records(page)).length).toBe(1);
	const [good] = await records(page);
	await putRow(page, {
		...good!,
		id: 'rusak',
		title: 'Rusak',
		openedAt: good!.openedAt - 5000,
		doc: '{"broken'
	});
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await openList(page, isMobile);
	await expect(row(page, 'Rusak')).toContainText('Tidak bisa dibuka');
	// It cannot be opened: there is no button to open it.
	await expect(row(page, 'Rusak').locator('button.open')).toHaveCount(0);
	await actions(page, 'Rusak', isMobile);
	await expect(row(page, 'Rusak').getByRole('button')).toHaveCount(2); // "…" and Hapus
	await expect(row(page, 'Rusak').getByRole('button', { name: 'Hapus' })).toBeVisible();
	expect((await records(page)).find((r) => r.id === 'rusak')!.doc).toBe('{"broken');
	// Only its own Hapus removes it (after the time).
	await press(row(page, 'Rusak').getByRole('button', { name: 'Hapus' }), isMobile);
	await expect.poll(async () => (await records(page)).length, { timeout: 9000 }).toBe(1);
});

test('phone: the list is a sheet from the bottom, and every control is at least 44 px', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'a phone only');
	await openSandbox(page);
	await openList(page, true);
	const size = page.viewportSize()!;
	const sheet = (await dialog(page).boundingBox())!;
	expect(Math.abs(sheet.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(sheet.width - size.width)).toBeLessThanOrEqual(1);
	expect(Math.abs(sheet.y + sheet.height - size.height)).toBeLessThanOrEqual(1);
	await actions(page, 'Berakhiran 01', true);
	for (const button of await dialog(page).getByRole('button').all()) {
		const box = (await button.boundingBox())!;
		const name = (await button.getAttribute('aria-label')) ?? (await button.innerText());
		expect(box.height, name).toBeGreaterThanOrEqual(44);
		expect(box.width, name).toBeGreaterThanOrEqual(44);
	}
	await expectNoAxeViolations(page);
	// A tap on the dark part above the sheet closes it.
	await page.touchscreen.tap(size.width / 2, 20);
	await expect(dialog(page)).toBeHidden();
});
