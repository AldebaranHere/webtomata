// S8, "Bandingkan dengan mesin ini" in the Konversi tab: the open machine against a regular expression. The
// verdict, the two lists of strings that the machine gets wrong, the computation of the shortest one, and the
// refusals. The example "Berakhiran 01" is the machine: it accepts the strings over {0, 1} that end with 01.
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const regexRow = (page: Page) => panel(page).locator('li.form');
const field = (page: Page) => regexRow(page).getByRole('textbox', { name: 'Ekspresi reguler' });
const compare = (page: Page) =>
	regexRow(page).getByRole('button', { name: 'Bandingkan dengan mesin ini', exact: true });
const shown = (page: Page) => page.locator('.conversion-canvas');
const section = (page: Page) => panel(page).locator('section[aria-labelledby="compare-heading"]');
const chip = (page: Page, text: string) =>
	section(page).getByRole('button', { name: text, exact: true });

async function openCompare(page: Page, text: string) {
	await openSandbox(page);
	await panel(page).getByRole('tab', { name: 'Konversi' }).click();
	await field(page).fill(text);
	await compare(page).click();
}

test('says that the machine and the expression are equivalent, and has no lists', async ({
	page
}) => {
	await openCompare(page, '(0∪1)*01');
	await expect(
		panel(page).getByRole('heading', { name: 'Bandingkan dengan mesin ini' })
	).toBeFocused();
	await expect(section(page)).toContainText('Ekuivalen.');
	await expect(section(page)).toContainText('menerima himpunan string yang sama');
	await expect(section(page).getByRole('heading', { level: 4 })).toHaveCount(0);
	// The canvas shows the machine of the student.
	await expect(shown(page)).toBeVisible();
	await expectNoAxeViolations(page);
});

test('shows the shortest wrong string first, the two lists, and the computation of the chosen string', async ({
	page
}) => {
	await openCompare(page, '(0∪1)*0');
	await expect(section(page)).toContainText('Belum sama.');
	// The machine rejects 0, but the expression accepts it: it is the shortest string that they tell apart.
	await expect(
		section(page).getByRole('heading', { name: 'Komputasi mesinmu untuk 0' })
	).toBeVisible();
	await expect(chip(page, '0')).toHaveAttribute('aria-pressed', 'true');
	await expect(section(page).locator('.rows li').last()).toContainText('–0→');
	await expect(section(page)).toContainText('Mesinmu menolak 0, padahal ekspresi menerimanya.');
	// The other list: the machine accepts 01, the expression does not.
	await chip(page, '01').click();
	await expect(chip(page, '01')).toHaveAttribute('aria-pressed', 'true');
	await expect(chip(page, '0')).toHaveAttribute('aria-pressed', 'false');
	await expect(
		section(page).getByRole('heading', { name: 'Komputasi mesinmu untuk 01' })
	).toBeVisible();
	await expect(section(page)).toContainText('Mesinmu menerima 01, padahal ekspresi menolaknya.');
	await expect(section(page).locator('.rows li')).toHaveCount(2);
	await expectNoAxeViolations(page);
});

test('writes the empty string as ε and shows "none" for a list with nothing in it', async ({
	page
}) => {
	// The expression accepts ε too; the machine does not.
	await openCompare(page, 'ε∪(0∪1)*01');
	await expect(
		section(page).getByRole('heading', { name: 'Komputasi mesinmu untuk ε' })
	).toBeVisible();
	await expect(section(page)).toContainText('Tidak ada. Bagian ini sudah benar.');
	await expect(section(page)).toContainText('Mesinmu menolak ε, padahal ekspresi menerimanya.');
	await expect(section(page).locator('.rows')).toHaveCount(0);
	await expect(section(page)).toContainText('Belum ada simbol yang dibaca.');
});

test('names a symbol that the machine does not have, and a mistake in the expression, under the field', async ({
	page
}) => {
	await openSandbox(page);
	await panel(page).getByRole('tab', { name: 'Konversi' }).click();
	await field(page).fill('(0∪2)*');
	await compare(page).click();
	await expect(regexRow(page)).toContainText('simbol 2 yang tidak ada di alfabet mesin');
	await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
	await expect(section(page)).toHaveCount(0);
	await field(page).fill('(0');
	await compare(page).click();
	await expect(regexRow(page)).toContainText('Tanda kurung di karakter ke-1 tidak punya pasangan.');
	await field(page).fill('0');
	await expect(regexRow(page)).not.toContainText('Tanda kurung');
});

test('is off for an empty field and for a machine with no states, and says why', async ({
	page
}) => {
	await openSandbox(page, { example: false });
	await page.getByRole('button', { name: 'Mulai dari kanvas kosong' }).click();
	await panel(page).getByRole('tab', { name: 'Konversi' }).click();
	await field(page).fill('0');
	await expect(compare(page)).toBeDisabled();
	await expect(regexRow(page)).toContainText('Buat minimal satu state dulu.');
});

test('is off for an empty field, and on when there is an expression', async ({ page }) => {
	await openSandbox(page);
	await panel(page).getByRole('tab', { name: 'Konversi' }).click();
	await expect(compare(page)).toBeDisabled();
	await field(page).fill('0');
	await expect(compare(page)).toBeEnabled();
});

test('a change of the machine closes the result, and the text of the field stays', async ({
	page
}) => {
	await openCompare(page, '(0∪1)*0');
	await expect(section(page)).toBeVisible();
	await panel(page).getByRole('tab', { name: 'Tabel' }).click();
	await panel(page).getByRole('button', { name: '+ State' }).click();
	await panel(page).getByRole('tab', { name: 'Konversi' }).click();
	await expect(section(page)).toHaveCount(0);
	await expect(field(page)).toHaveValue('(0∪1)*0');
	await expect(shown(page)).toHaveCount(0);
});

test('"Tutup" goes back to the form with the text kept, and every target is 44 px', async ({
	page
}) => {
	await openCompare(page, '(0∪1)*0');
	for (const target of [
		chip(page, '0'),
		chip(page, '01'),
		section(page).getByRole('button', { name: 'Tutup' })
	]) {
		const box = (await target.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(43.5);
		expect(box.width).toBeGreaterThanOrEqual(43.5);
	}
	await section(page).getByRole('button', { name: 'Tutup' }).click();
	await expect(field(page)).toHaveValue('(0∪1)*0');
	await expect(compare(page)).toBeVisible();
});
