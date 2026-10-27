// S10b-3, opening a file of a machine (`.jff` or JSON) from "Mesin saya". A file comes from outside, so these
// tests also try a file that is damaged, too big, of another type, or not a finite automaton. A file never
// replaces the open machine: it is a machine of its own.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const fixture = (name: string) =>
	readFileSync(fileURLToPath(new URL(`../src/lib/share/fixtures/${name}`, import.meta.url)));
const list = (page: Page) => page.getByRole('dialog', { name: 'Mesin saya' });
const note = (page: Page) => page.locator('.notice');
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });

/** Opens the list and gives it a file (the field is hidden: the button opens the chooser of the system). */
async function openFile(
	page: Page,
	file: { name: string; buffer: Buffer; mimeType?: string }
): Promise<void> {
	if (!(await list(page).isVisible())) {
		await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
	}
	await expect(list(page)).toBeVisible();
	await list(page)
		.locator('input[type="file"]')
		.setInputFiles({ mimeType: 'application/octet-stream', ...file });
}

test('a .jff file opens as a new machine, with the names and places of the file', async ({
	page
}) => {
	await openSandbox(page);
	await openFile(page, { name: 'even-a.jff', buffer: fixture('even-a.jff') });
	await expect(list(page)).toBeHidden();
	await expect(note(page)).toContainText('File dibuka sebagai mesin baru: even-a.');
	await expect(state(page, 'genap')).toBeVisible();
	await expect(state(page, 'ganjil')).toBeVisible();
	// The machine that was open is still saved: the list has two machines.
	await expect(page.getByRole('button', { name: /^Mesin saya \(2\)/ })).toBeVisible();
	await expect(note(page)).not.toContainText('Yang diubah');
});

test('says what was changed when a label of several symbols is split', async ({ page }) => {
	await openSandbox(page);
	await openFile(page, {
		name: 'epsilon-and-long-label.jff',
		buffer: fixture('epsilon-and-long-label.jff')
	});
	await expect(note(page)).toContainText('Yang diubah waktu membuka file:');
	await expect(note(page)).toContainText('Label "ab"');
	await note(page).getByRole('button', { name: 'Tutup' }).click();
	await expect(note(page)).toHaveCount(0);
});

test('a JSON file that was downloaded opens again as the same machine, as a new one', async ({
	page
}) => {
	await openSandbox(page);
	await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
	await list(page)
		.getByRole('button', { name: /^Tindakan untuk/ })
		.first()
		.click();
	await list(page).getByRole('button', { name: 'Bagikan', exact: true }).click();
	const download = page.waitForEvent('download');
	await page.getByRole('dialog', { name: 'Bagikan mesin' }).getByText('Unduh JSON').click();
	const path = await (await download).path();
	await page.keyboard.press('Escape');
	await openFile(page, {
		name: 'Berakhiran 01.webtomata.json',
		buffer: readFileSync(path)
	});
	await expect(note(page)).toContainText('File dibuka sebagai mesin baru: Berakhiran 01.');
	await expect(page.getByRole('button', { name: /^Mesin saya \(2\)/ })).toBeVisible();
	await expect(state(page, 'q0')).toBeVisible();
});

test('a PDA, a grammar or a Turing machine is refused calmly, with its type, and nothing changes', async ({
	page
}) => {
	await openSandbox(page);
	for (const type of ['pda', 'grammar', 'turing']) {
		await openFile(page, { name: `${type}.jff`, buffer: fixture(`${type}.jff`) });
		await expect(list(page).getByRole('alert')).toContainText(`bertipe "${type}"`);
		await expect(list(page).getByRole('alert')).toContainText('Mesinmu tidak berubah.');
		await expect(list(page)).toBeVisible();
	}
	await expect(page.getByRole('button', { name: /^Mesin saya \(1\)/ })).toBeVisible();
	await expectNoAxeViolations(page);
});

test('a damaged file, a file of another type and a file that is too big are refused', async ({
	page
}) => {
	await openSandbox(page);
	await openFile(page, { name: 'broken.jff', buffer: fixture('broken.jff') });
	await expect(list(page).getByRole('alert')).toContainText('File .jff ini rusak');
	await openFile(page, { name: 'catatan.txt', buffer: Buffer.from('halo') });
	await expect(list(page).getByRole('alert')).toContainText('bukan keduanya');
	await openFile(page, { name: 'bukan.json', buffer: Buffer.from('{"a":1}') });
	await expect(list(page).getByRole('alert')).toContainText('bukan mesin WebTomata yang valid');
	await openFile(page, { name: 'besar.json', buffer: Buffer.alloc(1024 * 1024 + 1, 32) });
	await expect(list(page).getByRole('alert')).toContainText('lebih besar dari 1 MB');
	await expect(page.getByRole('button', { name: /^Mesin saya \(1\)/ })).toBeVisible();
});

test('the same file can be chosen again, and the button is large enough for a finger', async ({
	page
}) => {
	await openSandbox(page);
	await openFile(page, { name: 'pda.jff', buffer: fixture('pda.jff') });
	await expect(list(page).getByRole('alert')).toBeVisible();
	await openFile(page, { name: 'even-a.jff', buffer: fixture('even-a.jff') });
	await expect(note(page)).toContainText('even-a');
	await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
	const button = list(page).getByRole('button', { name: 'Buka file…' });
	const box = await button.boundingBox();
	expect(box!.height).toBeGreaterThanOrEqual(43.5);
	expect(box!.width).toBeGreaterThanOrEqual(43.5);
});
