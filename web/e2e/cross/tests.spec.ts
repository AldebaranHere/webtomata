// S6-3 in every engine: test many strings. The strings are saved with the machine (in its record),
// each has a result that follows the machine, and a string that cannot be run is not "rejected".
import { expect, expectNoAxeViolations, openSandbox, test } from '../fixtures.ts';
import { records } from './db.ts';
import type { Page } from '@playwright/test';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const rows = (page: Page) => panel(page).locator('.tests li');
const field = (page: Page) => panel(page).getByLabel('Tambah string');
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });
const status = (page: Page) => page.locator('.save');

async function add(page: Page, text: string) {
	await field(page).fill(text);
	await field(page).press('Enter');
}
const row = (page: Page, text: string) => rows(page).filter({ hasText: text }).first();
const savedTests = async (page: Page) =>
	((await records(page))[0] as { tests?: string[] } | undefined)?.tests ?? [];

test('a string is added with its result, and so is the empty string', async ({ page }) => {
	await openSandbox(page);
	await expect(panel(page).getByText('Belum ada string.')).toBeVisible();
	await add(page, '01');
	await add(page, '110');
	await add(page, '');
	await expect(rows(page)).toHaveCount(3);
	await expect(rows(page).nth(0)).toContainText('01');
	await expect(rows(page).nth(0).locator('.badge')).toHaveText('Diterima');
	await expect(rows(page).nth(1).locator('.badge')).toHaveText('Ditolak');
	await expect(rows(page).nth(2)).toContainText('ε');
	await expect(rows(page).nth(2).locator('.badge')).toHaveText('Ditolak');
	// The field is empty again, ready for the next one.
	await expect(field(page)).toHaveValue('');
	await expectNoAxeViolations(page);
});

test('a string that cannot be run is not rejected: it says why', async ({ page }) => {
	await openSandbox(page);
	await add(page, '012');
	await expect(row(page, '012').locator('.badge')).toHaveText('Tidak bisa dijalankan');
	await expect(
		row(page, '012').getByText('Simbol "2" (posisi 3) tidak ada di alfabet.')
	).toBeVisible();
});

test('the same string twice, and a string that is too long, are said calmly', async ({ page }) => {
	await openSandbox(page);
	await add(page, '01');
	await add(page, ' 01 ');
	await expect(panel(page).getByText('String ini sudah ada di daftar.')).toBeVisible();
	await expect(rows(page)).toHaveCount(1);
	// What was typed stays in the field, so that it can be fixed.
	await expect(field(page)).toHaveValue(' 01 ');
	await field(page).fill('0'.repeat(201));
	await field(page).press('Enter');
	await expect(
		panel(page).getByText('String ini terlalu panjang (paling banyak 200 karakter).')
	).toBeVisible();
	await expect(rows(page)).toHaveCount(1);
});

test('the strings are saved with the machine and are there after a reload', async ({ page }) => {
	await openSandbox(page);
	await add(page, '01');
	await add(page, '110');
	await expect(status(page)).toHaveClass(/saved/);
	await expect.poll(() => savedTests(page)).toEqual(['01', '110']);
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(rows(page)).toHaveCount(2);
	await expect(rows(page).nth(0).locator('.badge')).toHaveText('Diterima');
	await expect(rows(page).nth(1).locator('.badge')).toHaveText('Ditolak');
	// Still one machine.
	expect(await records(page)).toHaveLength(1);
});

test('a removed string is gone after a reload, and the last one leaves no field', async ({
	page
}) => {
	await openSandbox(page);
	await add(page, '01');
	await add(page, '110');
	await panel(page).getByRole('button', { name: 'Hapus 01' }).click();
	await expect(rows(page)).toHaveCount(1);
	await expect(status(page)).toHaveClass(/saved/);
	await expect.poll(() => savedTests(page)).toEqual(['110']);
	await panel(page).getByRole('button', { name: 'Hapus 110' }).click();
	await expect(rows(page)).toHaveCount(0);
	await expect(status(page)).toHaveClass(/saved/);
	await expect.poll(async () => Object.hasOwn((await records(page))[0]!, 'tests')).toBe(false);
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(panel(page).getByText('Belum ada string.')).toBeVisible();
});

test('the results follow the machine', async ({ page, isMobile }) => {
	await openSandbox(page);
	await add(page, '01');
	await expect(row(page, '01').locator('.badge')).toHaveText('Diterima');
	// Without a start state no string can run.
	if (isMobile) await state(page, 'q0').tap();
	else await state(page, 'q0').click();
	await page.keyboard.press('m');
	await expect(row(page, '01').locator('.badge')).toHaveText('Tidak bisa dijalankan');
	await expect(row(page, '01').getByText('Belum ada start state.')).toBeVisible();
	// An undo brings the start state, and the result, back.
	await page.keyboard.press('Control+z');
	await expect(row(page, '01').locator('.badge')).toHaveText('Diterima');
});
