// Q3a, the list of questions at /soal: the cards, the three filters, the count, the address that keeps
// the filters, the empty states, and the sheet of filters on a phone. The questions come from
// content/questions at build time. A computer may also have a question of its own there (not in the
// repository), so a test never counts all the questions: it looks for the three starter questions, and
// for counts only in filters that no other question can match.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const card = (page: Page, title: string) =>
	page.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) });
const count = (page: Page) => page.getByRole('status').filter({ hasText: /^\d+ soal$/ });

/** The filters that are in the page (a laptop) or, on a phone, in the sheet that the button opens. */
async function filtersOf(page: Page, isMobile: boolean) {
	if (!isMobile) return page.locator('.filters');
	await page.getByRole('button', { name: /^Filter \(\d+\)$/ }).click();
	return page.getByRole('dialog', { name: 'Filter soal' });
}

async function choose(page: Page, isMobile: boolean, group: string, option: string) {
	const where = await filtersOf(page, isMobile);
	await where
		.getByRole('group', { name: group })
		.getByRole('radio', { name: option, exact: true })
		.check({ force: true });
	if (isMobile) await where.getByRole('button', { name: 'Terapkan' }).click();
}

test('lists the starter questions with their week, pattern, type and level', async ({ page }) => {
	await page.goto('/soal');
	await expect(page.getByRole('heading', { level: 1, name: 'Soal' })).toBeVisible();
	await expect(count(page)).toBeVisible();
	const one = card(page, 'String yang diakhiri 10');
	await expect(one).toContainText('Minggu 1 · Pola: berakhiran x');
	await expect(one).toContainText('Buat DFSM');
	await expect(one).toContainText('Mudah');
	await expect(card(page, 'String yang mengandung 101')).toContainText('Buat NDFSM');
	await expect(card(page, 'String yang mengandung 101')).toContainText('Minggu 2');
	await expect(card(page, 'Jumlah a genap')).toContainText('Sedang');
});

test('is in the order of the syllabus: the earlier week first', async ({ page }) => {
	await page.goto('/soal');
	const titles = await page.getByRole('article').getByRole('heading').allTextContents();
	expect(titles.indexOf('String yang diakhiri 10')).toBeLessThan(
		titles.indexOf('String yang mengandung 101')
	);
	expect(titles.indexOf('Jumlah a genap')).toBeLessThan(
		titles.indexOf('String yang mengandung 101')
	);
});

test('a filter shows only the questions that match, and the address keeps it', async ({
	page,
	isMobile
}) => {
	await page.goto('/soal');
	await choose(page, isMobile, 'Jenis', 'Buat NDFSM');
	// Only one question is an NDFSM question, on every computer.
	await expect(count(page)).toHaveText('1 soal');
	await expect(card(page, 'String yang mengandung 101')).toBeVisible();
	await expect(card(page, 'Jumlah a genap')).toHaveCount(0);
	await expect(page).toHaveURL(/\/soal\?jenis=build-ndfsm$/);
	// A reload, or a shared address, opens the same list.
	await page.reload();
	await expect(count(page)).toHaveText('1 soal');
	await expect(card(page, 'Jumlah a genap')).toHaveCount(0);
});

test('two filters work together, and "Semua" takes one away', async ({ page, isMobile }) => {
	await page.goto('/soal');
	await choose(page, isMobile, 'Minggu', '2');
	await choose(page, isMobile, 'Tingkat', 'Sedang');
	await expect(page).toHaveURL(/\?minggu=2&tingkat=2$/);
	await expect(count(page)).toHaveText('1 soal');
	await choose(page, isMobile, 'Minggu', 'Semua');
	await expect(page).toHaveURL(/\?tingkat=2$/);
	await expect(card(page, 'Jumlah a genap')).toBeVisible();
});

test('a link with filters opens the filtered list, and a link that is wrong shows the whole list', async ({
	page
}) => {
	await page.goto('/soal?minggu=2');
	await expect(card(page, 'String yang mengandung 101')).toBeVisible();
	await expect(card(page, 'Jumlah a genap')).toHaveCount(0);
	await page.goto('/soal?minggu=99&jenis=banana&tingkat=x');
	await expect(card(page, 'Jumlah a genap')).toBeVisible();
	await expect(card(page, 'String yang mengandung 101')).toBeVisible();
});

test('says when nothing matches, and "Hapus filter" brings the list back', async ({
	page,
	isMobile
}) => {
	await page.goto('/soal');
	await choose(page, isMobile, 'Tingkat', 'Sedang');
	await choose(page, isMobile, 'Minggu', '1');
	await choose(page, isMobile, 'Jenis', 'Buat NDFSM');
	await expect(page.getByText('Tidak ada soal yang cocok dengan filter ini.')).toBeVisible();
	await expect(page.getByRole('article')).toHaveCount(0);
	await page.getByRole('button', { name: 'Hapus filter', exact: true }).click();
	await expect(card(page, 'Jumlah a genap')).toBeVisible();
	await expect(page).toHaveURL(/\/soal$/);
});

test('shows the titles in English when the language is English', async ({ page }) => {
	await page.goto('/soal');
	// The bar of a phone keeps the language switch in its menu.
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	if (await menu.isVisible()) await menu.click();
	await page.getByRole('button', { name: 'EN, English' }).click();
	await expect(card(page, 'Strings that end with 10')).toContainText('Week 1');
	await expect(card(page, 'String yang diakhiri 10')).toHaveCount(0);
	await expect(card(page, 'Strings that end with 10')).toContainText('Build a DFSM');
});

test('every chip and button is at least 44 px, and the page has no violations', async ({
	page,
	isMobile
}) => {
	await page.goto('/soal');
	if (isMobile) {
		const button = page.getByRole('button', { name: /^Filter \(\d+\)$/ });
		expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
		await expectNoAxeViolations(page);
		await button.click();
		const sheet = page.getByRole('dialog', { name: 'Filter soal' });
		for (const target of await sheet.locator('.chip span').all()) {
			expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
		}
		for (const name of ['Terapkan', 'Hapus filter', 'Tutup']) {
			expect(
				(await sheet.getByRole('button', { name }).boundingBox())!.height
			).toBeGreaterThanOrEqual(43.5);
		}
		await expectNoAxeViolations(page);
	} else {
		for (const target of await page.locator('.filters .chip span').all()) {
			expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
		}
		await expectNoAxeViolations(page);
	}
});

test('on a phone the filters wait in a sheet, and "Tutup" leaves them as they were', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'the sheet is for a phone');
	await page.goto('/soal');
	await expect(page.locator('.filters')).toBeHidden();
	await page.getByRole('button', { name: /^Filter \(0\)$/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Filter soal' });
	await sheet
		.getByRole('group', { name: 'Jenis' })
		.getByRole('radio', { name: 'Buat NDFSM' })
		.check({ force: true });
	// Nothing is applied before "Terapkan".
	await sheet.getByRole('button', { name: 'Tutup' }).click();
	await expect(page).not.toHaveURL(/jenis/);
	await expect(page.getByRole('button', { name: /^Filter \(0\)$/ })).toBeVisible();
	await page.getByRole('button', { name: /^Filter \(0\)$/ }).click();
	await sheet
		.getByRole('group', { name: 'Jenis' })
		.getByRole('radio', { name: 'Buat NDFSM' })
		.check({ force: true });
	await sheet.getByRole('button', { name: 'Terapkan' }).click();
	await expect(page.getByRole('button', { name: /^Filter \(1\)$/ })).toBeVisible();
});
