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

/** A phone keeps the statement behind a button; a laptop shows it. Opens it when there is a button. */
async function showStatement(page: Page) {
	const toggle = page
		.locator('.statement')
		.getByRole('button', { name: 'Lihat soal', exact: true });
	if (await toggle.isVisible()) await toggle.click();
}

test('shows where the question is, the statement with its code, and the chips', async ({
	page
}) => {
	await openQuestion(page);
	await showStatement(page);
	const statement = page.locator('.statement');
	await expect(statement).toContainText(/Soal \d+ dari \d+ · Pola: berakhiran x/);
	await expect(statement.locator('code').first()).toHaveText('Σ = {0, 1}');
	await expect(statement).toContainText('Buat DFSM atas alfabet');
	await expect(statement.getByText('Harus DFSM')).toBeVisible();
	await expect(statement.getByText('Rich 5.2 · Sipser 1.1')).toBeVisible();
	await expect(statement).toContainText('Mesinmu harus lengkap');
	await expect(statement.getByRole('link', { name: 'Soal', exact: true })).toHaveAttribute(
		'href',
		'/soal'
	);
});

test('the page does not carry the solution, which is in a file of its own', async ({ request }) => {
	// The transitions of the solution of berakhiran-10 are written "q1 0 q2", "q0 1 q1" and so on.
	for (const path of [`/soal/${ID}`, `/soal/${ID}/__data.json`, '/soal', '/soal/__data.json']) {
		const text = await (await request.get(path)).text();
		expect(text, path).not.toMatch(/q\d [01] q\d/);
		expect(text, path).not.toContain('"solution"');
	}
	const answer = await request.get(`/soal/${ID}/jawaban.json`);
	expect(answer.status()).toBe(200);
	const file = await answer.json();
	expect(file.schemaVersion).toBe(1);
	expect(file.solution.accepting).toEqual(['q2']);
	expect(file.solution.transitions).toContain('q1 0 q2');
	// The hints are in the page (they are a help), and the examples are not in it.
	const data = await (await request.get(`/soal/${ID}/__data.json`)).text();
	expect(data).toContain('State tidak perlu mengingat');
	expect(data).not.toContain('examples');
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

test('the targets are at least 44 px, and the page has no violations', async ({
	page,
	isMobile
}) => {
	await openQuestion(page);
	await showStatement(page);
	const statement = page.locator('.statement');
	for (const target of [
		statement.getByRole('link', { name: 'Soal', exact: true }),
		...(isMobile ? [statement.getByRole('button', { name: 'Sembunyikan soal' })] : [])
	]) {
		expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
	}
	await expectNoAxeViolations(page);
});

test('a laptop always shows the statement, and has no button to hide it', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone folds the statement');
	await openQuestion(page);
	const statement = page.locator('.statement');
	await expect(statement.getByRole('button', { name: /soal$/ })).toBeHidden();
	await expect(statement.getByText('Harus DFSM')).toBeVisible();
	await expect(statement).toContainText('Buat DFSM atas alfabet');
});

test('on a phone the statement is hidden at first, so the canvas has the room', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'the fold is for a phone');
	await openQuestion(page);
	const statement = page.locator('.statement');
	// One line: the title and the button. The statement, the chips and the crumbs wait behind the button.
	await expect(statement.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(statement.getByRole('button', { name: 'Lihat soal', exact: true })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await expect(statement.getByText('Buat DFSM atas alfabet')).toBeHidden();
	await expect(statement.getByText('Harus DFSM')).toBeHidden();
	expect((await statement.boundingBox())!.height).toBeLessThanOrEqual(64);
	// The canvas has most of the screen: at least a third of the height of the window.
	const canvas = (await page.locator('.canvas, .stage').first().boundingBox())!;
	expect(canvas.height).toBeGreaterThan(page.viewportSize()!.height / 3);
});

test('on a phone the student opens the statement and hides it again, and the choice is kept', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'the fold is for a phone');
	await openQuestion(page);
	const statement = page.locator('.statement');
	await statement.getByRole('button', { name: 'Lihat soal', exact: true }).click();
	await expect(statement.getByText('Buat DFSM atas alfabet')).toBeVisible();
	await expect(statement.getByText('Harus DFSM')).toBeVisible();
	const hide = statement.getByRole('button', { name: 'Sembunyikan soal' });
	await expect(hide).toHaveAttribute('aria-expanded', 'true');
	// It never takes more than half of the height, and scrolls inside itself.
	expect((await statement.boundingBox())!.height).toBeLessThanOrEqual(
		page.viewportSize()!.height / 2 + 1
	);
	// Open stays open after a reload, and on the page of another question.
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(statement.getByText('Buat DFSM atas alfabet')).toBeVisible();
	await page.goto('/soal/jumlah-a-genap');
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.locator('.statement').getByText('Buat DFSM atas alfabet')).toBeVisible();
	await page.locator('.statement').getByRole('button', { name: 'Sembunyikan soal' }).click();
	await expect(page.locator('.statement').getByText('Buat DFSM atas alfabet')).toBeHidden();
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.locator('.statement').getByText('Buat DFSM atas alfabet')).toBeHidden();
});

test('on the narrowest phones the closed bar is one line, inside the screen, and the canvas keeps the room', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'the fold is for a phone');
	for (const width of [320, 360, 412]) {
		await page.setViewportSize({ width, height: 740 });
		await openQuestion(page);
		const statement = page.locator('.statement');
		const button = statement.getByRole('button', { name: 'Lihat soal', exact: true });
		const box = (await button.boundingBox())!;
		expect(box.x, `${width}: button inside`).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width, `${width}: button inside`).toBeLessThanOrEqual(width);
		expect(box.height, `${width}: 44 px`).toBeGreaterThanOrEqual(43.5);
		expect((await statement.boundingBox())!.height, `${width}: one line`).toBeLessThanOrEqual(64);
		const scrolls = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(scrolls, `${width}: no sideways scroll`).toBe(false);
		// The title keeps room next to the button, and is cut with an ellipsis, not wrapped.
		const title = (await statement.getByRole('heading', { level: 1 }).boundingBox())!;
		expect(title.width, `${width}: title`).toBeGreaterThan(60);
		const canvas = (await page.locator('.stage').first().boundingBox())!;
		expect(canvas.height, `${width}: canvas`).toBeGreaterThan(740 / 3);
	}
});

test('the statement can be opened with the keyboard and a screen reader hears its state', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'the fold is for a phone');
	await openQuestion(page);
	const button = page
		.locator('.statement')
		.getByRole('button', { name: 'Lihat soal', exact: true });
	await button.focus();
	await page.keyboard.press('Enter');
	await expect(
		page.locator('.statement').getByRole('button', { name: 'Sembunyikan soal' })
	).toHaveAttribute('aria-expanded', 'true');
});

// The Sandbox itself must not have changed.
test('the Sandbox still opens its example', async ({ page }) => {
	await openSandbox(page);
	await expect(page.locator('.bar .title')).toHaveText('Berakhiran 01');
});
