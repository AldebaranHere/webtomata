// Q3b, the page of one question at /soal/<id>: the statement and the chips, the editor with the alphabet of
// the question and the tabs that a question has, the work that is saved on the device for this question and
// kept apart from the machines of the Sandbox, and a record that cannot be read. The questions come from
// content/questions at build time (a computer may also have a question of its own there, so a test never
// relies on the number of questions).
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { putRow, records } from './cross/db.ts';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const ID = 'berakhiran-10';

async function openQuestion(page: Page) {
	await page.goto(`/soal/${ID}`);
	await page.locator('.editor[data-ready]').waitFor();
}

async function addState(page: Page) {
	await panel(page).getByRole('tab', { name: 'Tabel' }).click();
	await panel(page).getByRole('button', { name: '+ State' }).click();
	await expect(page.getByText('Tersimpan di perangkat ini').first()).toBeVisible();
}

test('a card of the list opens the page of its question', async ({ page }) => {
	await page.goto('/soal');
	await page.getByRole('link', { name: 'String yang diakhiri 10' }).click();
	await expect(page).toHaveURL(/\/soal\/berakhiran-10$/);
	await expect(
		page.getByRole('heading', { level: 1, name: 'String yang diakhiri 10' })
	).toBeVisible();
});

test('shows where the question is, the statement with its code, and the chips', async ({
	page
}) => {
	await openQuestion(page);
	const statement = page.locator('.statement');
	await expect(statement).toContainText(/Soal \d+ dari \d+ · Pola: berakhiran x/);
	await expect(statement.locator('code').first()).toHaveText('Σ = {0, 1}');
	await expect(statement).toContainText('Buat DFSM atas alfabet');
	// A phone keeps the rest of the question behind a button.
	const toggle = statement.getByRole('button', { name: 'Lihat soal lengkap' });
	if (await toggle.isVisible()) await toggle.click();
	await expect(statement.getByText('Harus DFSM')).toBeVisible();
	await expect(statement.getByText('Rich 5.2 · Sipser 1.1')).toBeVisible();
	await expect(statement).toContainText('Mesinmu harus lengkap');
	await expect(statement.getByRole('link', { name: 'Soal', exact: true })).toHaveAttribute(
		'href',
		'/soal'
	);
});

test('the editor has the alphabet of the question and the tabs of a question only', async ({
	page
}) => {
	await openQuestion(page);
	await expect(panel(page).getByRole('tab')).toHaveCount(3);
	await expect(panel(page).getByRole('tab', { name: 'Konversi' })).toHaveCount(0);
	await addState(page);
	await panel(page).getByRole('tab', { name: 'Definisi' }).click();
	await expect(panel(page)).toContainText('{0, 1}');
	// No share button, list of machines or tour: this is a question, not the Sandbox.
	await expect(page.getByRole('button', { name: 'Bagikan', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Mesin saya/ })).toHaveCount(0);
	await expect(page.locator('.bar .title')).toHaveText('String yang diakhiri 10');
});

test('the work is saved for this question, and is there after a reload', async ({ page }) => {
	await openQuestion(page);
	await addState(page);
	const saved = (await records(page)).filter((r) => r.id === `soal:${ID}`);
	expect(saved).toHaveLength(1);
	expect(JSON.parse(saved[0]!.doc).states).toHaveLength(1);
	expect(JSON.parse(saved[0]!.doc).alphabet).toEqual(['0', '1']);
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await panel(page).getByRole('tab', { name: 'Tabel' }).click();
	await expect(panel(page).getByRole('button', { name: 'q0', exact: true })).toBeVisible();
	expect((await records(page)).filter((r) => r.id === `soal:${ID}`)).toHaveLength(1);
});

test('the machine of a question is not a machine of the Sandbox', async ({ page }) => {
	await openQuestion(page);
	await addState(page);
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
	// The Sandbox made its own empty machine, with the first-run examples, and the list has only that one.
	await expect(page.getByRole('button', { name: /^(Berakhiran 01|Ending in 01)/ })).toBeVisible();
	await expect(page.locator('.bar .title')).not.toHaveText('String yang diakhiri 10');
	await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
	const list = page.getByRole('dialog', { name: 'Mesin saya' });
	await expect(list.getByText('String yang diakhiri 10')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Mesin saya \(1\)/ })).toBeVisible();
	// The record of the question is still in the store.
	expect((await records(page)).some((r) => r.id === `soal:${ID}`)).toBe(true);
});

test('two questions keep two machines', async ({ page }) => {
	await openQuestion(page);
	await addState(page);
	await page.goto('/soal/jumlah-a-genap');
	await page.locator('.editor[data-ready]').waitFor();
	await addState(page);
	await panel(page).getByRole('tab', { name: 'Definisi' }).click();
	await expect(panel(page)).toContainText('{a, b}');
	const ids = (await records(page)).map((r) => r.id).sort();
	expect(ids).toEqual(expect.arrayContaining([`soal:${ID}`, 'soal:jumlah-a-genap']));
});

test('an NDFSM question starts as an NDFSM', async ({ page }) => {
	await page.goto('/soal/mengandung-101');
	await page.locator('.editor[data-ready]').waitFor();
	await panel(page).getByRole('tab', { name: 'Tabel' }).click();
	await expect(panel(page).getByRole('radio', { name: 'NDFSM' })).toBeChecked();
});

test('says so when the saved work cannot be read, starts again, and keeps the old text until a change', async ({
	page
}) => {
	await openQuestion(page);
	await addState(page);
	await putRow(page, { id: `soal:${ID}`, doc: '{not json' });
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.getByRole('status').filter({ hasText: 'tidak bisa dibaca' })).toBeVisible();
	await expect(page.getByText('Tersimpan di perangkat ini').first()).toBeVisible();
	expect((await records(page)).find((r) => r.id === `soal:${ID}`)!.doc).toBe('{not json');
	// The first change replaces it.
	await addState(page);
	expect(
		JSON.parse((await records(page)).find((r) => r.id === `soal:${ID}`)!.doc).states
	).toHaveLength(1);
});

test('shows the question in English when the language is English', async ({ page }) => {
	await openQuestion(page);
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	if (await menu.isVisible()) await menu.click();
	await page.getByRole('button', { name: 'EN, English' }).click();
	await expect(
		page.getByRole('heading', { level: 1, name: 'Strings that end with 10' })
	).toBeVisible();
	await expect(page.locator('.statement')).toContainText('Build a DFSM over');
	await expect(page.locator('.bar .title')).toHaveText('Strings that end with 10');
});

test('the targets are at least 44 px, the page has no violations, and a phone folds the question', async ({
	page,
	isMobile
}) => {
	await openQuestion(page);
	const statement = page.locator('.statement');
	for (const target of [
		statement.getByRole('link', { name: 'Soal', exact: true }),
		...(isMobile ? [statement.getByRole('button', { name: 'Lihat soal lengkap' })] : [])
	]) {
		expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
	}
	if (isMobile) {
		await expect(statement.getByText('Harus DFSM')).toBeHidden();
		await statement.getByRole('button', { name: 'Lihat soal lengkap' }).click();
		await expect(statement.getByText('Harus DFSM')).toBeVisible();
		await expect(statement.getByRole('button', { name: 'Sembunyikan' })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		await statement.getByRole('button', { name: 'Sembunyikan' }).click();
	} else {
		await expect(statement.getByRole('button', { name: 'Lihat soal lengkap' })).toBeHidden();
		await expect(statement.getByText('Harus DFSM')).toBeVisible();
	}
	await expectNoAxeViolations(page);
});

// The Sandbox itself must not have changed.
test('the Sandbox still opens its example', async ({ page }) => {
	await openSandbox(page);
	await expect(page.locator('.bar .title')).toHaveText('Berakhiran 01');
});
