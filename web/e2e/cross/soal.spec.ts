// The list of questions in every engine (Q3a). The filters are native radio buttons and the address is
// changed with the History API, which the engines do in their own ways; the details are in
// e2e/soal-list.spec.ts (Chrome).
import { expect, test } from '../fixtures.ts';

test('lists the questions, filters them, and keeps the filter in the address', async ({
	page,
	isMobile
}) => {
	await page.goto('/soal');
	await expect(page.getByRole('heading', { level: 1, name: 'Soal' })).toBeVisible();
	const card = (title: string) =>
		page.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) });
	await expect(card('String yang diakhiri 10')).toBeVisible();
	let where = page.locator('.filters');
	if (isMobile) {
		await page.getByRole('button', { name: /^Filter \(\d+\)$/ }).tap();
		where = page.getByRole('dialog', { name: 'Filter soal' });
	}
	await where
		.getByRole('group', { name: 'Jenis' })
		.getByRole('radio', { name: 'Buat NDFSM', exact: true })
		.check({ force: true });
	if (isMobile) await where.getByRole('button', { name: 'Terapkan' }).tap();
	await expect(card('String yang mengandung 101')).toBeVisible();
	await expect(card('Jumlah a genap')).toHaveCount(0);
	await expect(page).toHaveURL(/\/soal\?jenis=build-ndfsm$/);
	await page.reload();
	await expect(card('Jumlah a genap')).toHaveCount(0);
	await expect(card('String yang mengandung 101')).toBeVisible();
});
