// Opening a file of a machine in every engine (S10b-3). A hidden file field and the reading of a file with
// `File.text()` are the parts that browsers do not all do the same way; the details are in e2e/open-file.spec.ts.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, openSandbox, test } from '../fixtures.ts';

const fixture = (name: string) =>
	readFileSync(fileURLToPath(new URL(`../../src/lib/share/fixtures/${name}`, import.meta.url)));

test('a .jff file opens as a new machine, and a PDA is refused', async ({ page }) => {
	await openSandbox(page);
	await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
	const list = page.getByRole('dialog', { name: 'Mesin saya' });
	const field = list.locator('input[type="file"]');
	await field.setInputFiles({
		name: 'pda.jff',
		mimeType: 'application/octet-stream',
		buffer: fixture('pda.jff')
	});
	await expect(list.getByRole('alert')).toContainText('bertipe "pda"');
	await field.setInputFiles({
		name: 'even-a.jff',
		mimeType: 'application/octet-stream',
		buffer: fixture('even-a.jff')
	});
	await expect(page.locator('.notice')).toContainText('File dibuka sebagai mesin baru: even-a.');
	await expect(page.getByRole('button', { name: /^State genap(,|$)/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Mesin saya \(2\)/ })).toBeVisible();
});
