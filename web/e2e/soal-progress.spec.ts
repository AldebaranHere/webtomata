// Q5, the progress of a student on the questions: "Sudah dicoba" after a check that said something about the
// machine, "Selesai" after "Tepat." (for good), kept on the device after a reload, shown on the list with a
// count, and reset with a second step that keeps the machines. A computer may have a question of its own that is
// not in the repository, so a test never relies on the number of questions.
import { engineSettled, expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { putRow, records } from './cross/db.ts';
import { ENDS_WITH_1, RIGHT, docJson } from './question-machines.ts';
import type { Spec } from './question-machines.ts';

const ID = 'berakhiran-10';
const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const feedback = (page: Page) => panel(page).locator('#panel-pane-feedback');
const check = (page: Page) =>
	feedback(page).getByRole('button', { name: /^(Periksa jawaban|Periksa lagi)$/ });
const card = (page: Page) =>
	page
		.getByRole('article')
		.filter({ has: page.getByRole('heading', { name: 'String yang diakhiri 10' }) });
const summary = (page: Page) => page.locator('.progress [role="status"]');

/** The saved record of the question: its progress, as the page wrote it. */
const progressOf = async (page: Page) =>
	(await records(page)).find((r) => r.id === `soal:${ID}`)?.progress;

/** Opens the question with this machine as the work of the student, and checks it. */
async function checkWith(page: Page, spec: Spec) {
	await page.goto(`/soal/${ID}`);
	await page.locator('.editor[data-ready]').waitFor();
	await engineSettled(page);
	await putRow(page, { id: `soal:${ID}`, doc: docJson(spec) });
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await check(page).click();
	await expect(feedback(page).getByRole('status')).toContainText(/Tepat|Belum tepat|Lihat dulu/);
}

test('there is no progress at first: a count of zero, no chip, and no reset', async ({ page }) => {
	await page.goto('/soal');
	await expect(summary(page)).toContainText(/Progres: 0 dari \d+ soal selesai/);
	await expect(card(page)).toBeVisible();
	await expect(card(page).locator('.status')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Atur ulang progres' })).toHaveCount(0);
});

test('a wrong answer makes the question "Sudah dicoba", on the list and on the page, and it stays after a reload', async ({
	page
}) => {
	await checkWith(page, ENDS_WITH_1);
	await expect.poll(() => progressOf(page)).toMatchObject({ checks: 1, solved: false });
	await expect(page.locator('.statement .meta .status')).toHaveText('Sudah dicoba');
	await page.goto('/soal');
	await expect(card(page).locator('.status')).toHaveText('Sudah dicoba');
	await expect(summary(page)).toContainText(/Progres: 0 dari \d+ soal selesai/);
	await page.reload();
	await expect(card(page).locator('.status')).toHaveText('Sudah dicoba');
	await expect(page.getByRole('button', { name: 'Atur ulang progres' })).toBeVisible();
});

test('a right answer makes the question "Selesai", counted on the list, and it stays after a reload', async ({
	page
}) => {
	await checkWith(page, RIGHT);
	await expect.poll(() => progressOf(page)).toMatchObject({ checks: 1, solved: true });
	const saved = (await progressOf(page)) as { solvedAt: number; checkedAt: number };
	expect(saved.solvedAt).toBeGreaterThan(1_000_000_000_000);
	await page.goto('/soal');
	await expect(card(page).locator('.status')).toHaveText('Selesai');
	await expect(summary(page)).toContainText(/Progres: 1 dari \d+ soal selesai/);
	await page.reload();
	await expect(card(page).locator('.status')).toHaveText('Selesai');
	await expect(summary(page)).toContainText(/Progres: 1 dari \d+ soal selesai/);
});

test('a question that was solved stays solved when the machine is changed and checked again', async ({
	page
}) => {
	await checkWith(page, RIGHT);
	await expect.poll(() => progressOf(page)).toMatchObject({ checks: 1, solved: true });
	const first = (await progressOf(page)) as { solvedAt: number };
	// A state more does not change the language, but a changed accepting state does: the machine is now wrong.
	await panel(page).getByRole('tab', { name: 'Tabel' }).click();
	await panel(page).getByRole('button', { name: '+ State' }).click();
	await panel(page).getByRole('tab', { name: 'Umpan balik' }).click();
	await check(page).click();
	await expect.poll(() => progressOf(page)).toMatchObject({ checks: 2, solved: true });
	expect(((await progressOf(page)) as { solvedAt: number }).solvedAt).toBe(first.solvedAt);
	await page.goto('/soal');
	await expect(card(page).locator('.status')).toHaveText('Selesai');
});

test('a problem of the structure counts as an attempt, and a check that cannot run counts as nothing', async ({
	page
}) => {
	const missing: Spec = {
		...RIGHT,
		transitions: RIGHT.transitions.filter(([from, on]) => !(from === 1 && on === '0'))
	};
	await checkWith(page, missing);
	await expect.poll(() => progressOf(page)).toMatchObject({ checks: 1, solved: false });
	await page.goto('/soal');
	await expect(card(page).locator('.status')).toHaveText('Sudah dicoba');
});

test.describe('a check that cannot run', () => {
	test.use({ allowedProblem: /jawaban\.json|ERR_FAILED/ });

	test('is not an attempt', async ({ page }) => {
		await page.goto(`/soal/${ID}`);
		await page.locator('.editor[data-ready]').waitFor();
		await engineSettled(page);
		await putRow(page, { id: `soal:${ID}`, doc: docJson(RIGHT) });
		await page.reload();
		await page.locator('.editor[data-ready]').waitFor();
		await page.route('**/jawaban.json', (route) => route.abort());
		await check(page).click();
		await expect(feedback(page).getByRole('status')).toContainText(
			'Pemeriksaan belum bisa dijalankan.'
		);
		await page.goto('/soal');
		await expect(card(page).locator('.status')).toHaveCount(0);
		expect(await progressOf(page)).toBeUndefined();
	});
});

test('a value that is not progress is ignored: no chip, no error', async ({ page }) => {
	await page.goto(`/soal/${ID}`);
	await page.locator('.editor[data-ready]').waitFor();
	await engineSettled(page);
	await putRow(page, { id: `soal:${ID}`, doc: docJson(RIGHT), progress: { checks: 'many' } });
	await page.goto('/soal');
	await expect(card(page)).toBeVisible();
	await expect(card(page).locator('.status')).toHaveCount(0);
	await expect(summary(page)).toContainText(/Progres: 0 dari \d+ soal selesai/);
});

test('the reset asks again, "Batal" keeps the progress, and "Ya, hapus" deletes only the progress', async ({
	page
}) => {
	await checkWith(page, RIGHT);
	await expect.poll(() => progressOf(page)).toMatchObject({ solved: true });
	await page.goto('/soal');
	await page.getByRole('button', { name: 'Atur ulang progres' }).click();
	await expect(
		page.getByText('Hapus progres semua soal? Mesinmu tidak ikut dihapus.')
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Atur ulang progres' })).toHaveCount(0);
	await expectNoAxeViolations(page);
	await page.getByRole('button', { name: 'Batal' }).click();
	await expect(card(page).locator('.status')).toHaveText('Selesai');
	await page.getByRole('button', { name: 'Atur ulang progres' }).click();
	await page.getByRole('button', { name: 'Ya, hapus' }).click();
	await expect(card(page).locator('.status')).toHaveCount(0);
	await expect(summary(page)).toContainText(/Progres: 0 dari \d+ soal selesai/);
	await expect(page.getByRole('button', { name: 'Atur ulang progres' })).toHaveCount(0);
	// The machine of the student is still there, and the progress is gone from the record.
	const record = (await records(page)).find((r) => r.id === `soal:${ID}`)!;
	expect('progress' in record).toBe(false);
	expect(JSON.parse(record.doc).states).toHaveLength(3);
	await page.reload();
	await expect(card(page).locator('.status')).toHaveCount(0);
});

test('the progress is not a machine of the Sandbox', async ({ page }) => {
	await checkWith(page, RIGHT);
	await expect.poll(() => progressOf(page)).toMatchObject({ solved: true });
	await page.goto('/sandbox');
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page.getByRole('button', { name: /^(Berakhiran 01|Ending in 01)/ })).toBeVisible();
	await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
	await expect(page.getByRole('dialog', { name: 'Mesin saya' })).not.toContainText(
		'String yang diakhiri 10'
	);
	await expect(page.getByRole('button', { name: /^Mesin saya \(1\)/ })).toBeVisible();
});

test('the words follow the language, and the buttons are at least 44 px', async ({ page }) => {
	await checkWith(page, RIGHT);
	await expect.poll(() => progressOf(page)).toMatchObject({ solved: true });
	await page.goto('/soal');
	const reset = page.getByRole('button', { name: 'Atur ulang progres' });
	expect((await reset.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
	await reset.click();
	for (const name of ['Ya, hapus', 'Batal']) {
		expect(
			(await page.getByRole('button', { name }).boundingBox())!.height,
			name
		).toBeGreaterThanOrEqual(43.5);
	}
	await page.getByRole('button', { name: 'Batal' }).click();
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	if (await menu.isVisible()) await menu.click();
	await page.getByRole('button', { name: 'EN, English' }).click();
	await expect(summary(page)).toContainText(/Progress: 1 of \d+ questions solved/);
	await expect(card(page).or(page.getByRole('article').first()).first()).toBeVisible();
	await expect(page.locator('.status.solved').first()).toHaveText('Solved');
	await expect(page.getByRole('button', { name: 'Reset progress' })).toBeVisible();
	await expectNoAxeViolations(page);
});
