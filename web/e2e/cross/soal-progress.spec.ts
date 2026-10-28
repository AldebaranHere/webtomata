// The progress of a student in every engine (Q5): saved in IndexedDB with the machine of the question, shown on the
// list after a reload, and reset without losing the machine. The details are in e2e/soal-progress.spec.ts (Chrome).
import { engineSettled, expect, test } from '../fixtures.ts';
import { ENDS_WITH_1, docJson } from '../question-machines.ts';
import { putRow, records } from './db.ts';

test('a check makes the question "Sudah dicoba" after a reload, and the reset takes only that away', async ({
	page
}) => {
	await page.goto('/soal/berakhiran-10');
	await page.locator('.editor[data-ready]').waitFor();
	await engineSettled(page);
	await putRow(page, { id: 'soal:berakhiran-10', doc: docJson(ENDS_WITH_1) });
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	const panel = page.getByRole('complementary', { name: 'Panel' });
	await panel
		.locator('#panel-pane-feedback')
		.getByRole('button', { name: 'Periksa jawaban' })
		.click();
	await expect(panel.locator('#panel-pane-feedback').getByRole('status')).toContainText(
		'Belum tepat.'
	);
	await expect
		.poll(async () => (await records(page)).find((r) => r.id === 'soal:berakhiran-10')?.progress)
		.toMatchObject({ checks: 1, solved: false });
	await engineSettled(page);
	await page.goto('/soal');
	const status = page
		.getByRole('article')
		.filter({ has: page.getByRole('heading', { name: 'String yang diakhiri 10' }) })
		.locator('.status');
	await expect(status).toHaveText('Sudah dicoba');
	await page.getByRole('button', { name: 'Atur ulang progres' }).click();
	await page.getByRole('button', { name: 'Ya, hapus' }).click();
	await expect(status).toHaveCount(0);
	const record = (await records(page)).find((r) => r.id === 'soal:berakhiran-10')!;
	expect('progress' in record).toBe(false);
	expect(JSON.parse(record.doc).states).toHaveLength(3);
});
