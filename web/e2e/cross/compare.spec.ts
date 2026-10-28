// Bandingkan with a regular expression in every engine (S8). The verdict and the lists come from the WASM
// module and the computation from the worker; the details are in e2e/editor-compare.spec.ts (Chrome).
import { expect, openSandbox, test } from '../fixtures.ts';

test('compares the machine with an expression: the shortest wrong string, the lists and the equal case', async ({
	page
}) => {
	await openSandbox(page);
	const panel = page.getByRole('complementary', { name: 'Panel' });
	await panel.getByRole('tab', { name: 'Konversi' }).click();
	const form = panel.locator('li.form');
	await form.getByRole('textbox', { name: 'Ekspresi reguler' }).fill('(0∪1)*0');
	await form.getByRole('button', { name: 'Bandingkan dengan mesin ini', exact: true }).click();
	const result = panel.locator('section[aria-labelledby="compare-heading"]');
	await expect(result).toContainText('Belum sama.');
	await expect(result.getByRole('heading', { name: 'Komputasi mesinmu untuk 0' })).toBeVisible();
	await result.getByRole('button', { name: '01', exact: true }).click();
	await expect(result).toContainText('Mesinmu menerima 01, padahal ekspresi menolaknya.');
	await result.getByRole('button', { name: 'Tutup' }).click();
	await form.getByRole('textbox', { name: 'Ekspresi reguler' }).fill('(0∪1)*01');
	await form.getByRole('button', { name: 'Bandingkan dengan mesin ini', exact: true }).click();
	await expect(result).toContainText('Ekuivalen.');
});
