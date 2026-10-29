// The guide list and guide page across engines (G1).
import { expect, test } from '../fixtures.ts';

test('filters the guide list, opens the guide, and follows a related question', async ({
	page,
	isMobile
}) => {
	await page.goto('/panduan');
	await expect(page.getByRole('heading', { level: 1, name: 'Panduan' })).toBeVisible();
	await page
		.getByRole('group', { name: 'Filter topik' })
		.getByRole('radio', { name: 'DFSM', exact: true })
		.check({ force: true });
	await expect(page).toHaveURL(/\/panduan\?topik=dfsm$/);

	await page
		.getByRole('article')
		.filter({ has: page.getByRole('heading', { name: 'String berakhiran x' }) })
		.getByRole('link')
		.click();
	await expect(page).toHaveURL(/\/panduan\/berakhiran-x$/);
	await expect(
		page.getByRole('heading', {
			level: 1,
			name: 'Cara membuat DFSM untuk string berakhiran x'
		})
	).toBeVisible();

	if (isMobile) {
		const button = page.locator('.toc-toggle');
		await button.tap();
		await expect(button).toHaveAttribute('aria-expanded', 'true');
		await page.locator('#phone-toc').getByRole('link', { name: 'Kesalahan umum' }).tap();
		await expect(button).toHaveAttribute('aria-expanded', 'false');
	}

	await page
		.locator('#soal')
		.getByRole('link', { name: /String yang diakhiri 10/ })
		.click();
	await expect(page).toHaveURL(/\/soal\/berakhiran-10$/);
});
