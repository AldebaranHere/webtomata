// The page of a question in every engine (Q3b). The work is saved in IndexedDB, which the engines do in
// their own ways, and the Sandbox must not open it; the details are in e2e/soal-question.spec.ts (Chrome).
import { engineSettled, expect, test } from '../fixtures.ts';

test('the work on a question stays after a reload, apart from the machines of the Sandbox', async ({
	page
}) => {
	await page.goto('/soal/berakhiran-10');
	await page.locator('.editor[data-ready]').waitFor();
	const panel = page.getByRole('complementary', { name: 'Panel' });
	await panel.getByRole('tab', { name: 'Tabel' }).click();
	await panel.getByRole('button', { name: '+ State' }).click();
	await expect(page.getByText('Tersimpan di perangkat ini').first()).toBeVisible();
	// The checks of the machine start the engine: a reload or a new page while it loads would cancel the
	// request for the WASM file, which the page logs as a failed one (seen in WebKit on a slow runner).
	await engineSettled(page);
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await panel.getByRole('tab', { name: 'Tabel' }).click();
	await expect(panel.getByRole('button', { name: 'q0', exact: true })).toBeVisible();
	await engineSettled(page);
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.getByRole('button', { name: /^(Berakhiran 01|Ending in 01)/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Mesin saya \(1\)/ })).toBeVisible();
	await engineSettled(page);
});
