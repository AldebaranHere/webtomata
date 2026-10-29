// G1, the guide list at /panduan, the guide page at /panduan/[id], the link from a question's pattern
// back to its guide, Open Graph metadata, and /sitemap.xml.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const card = (page: Page, title: string) =>
	page.getByRole('article').filter({ has: page.getByRole('heading', { name: title }) });

async function chooseTopic(page: Page, option: string) {
	await page
		.getByRole('group', { name: 'Filter topik' })
		.getByRole('radio', { name: option, exact: true })
		.check({ force: true });
}

test('lists the starter guide with its topic, summary, question count and reading time', async ({
	page
}) => {
	await page.goto('/panduan');
	await expect(page.getByRole('heading', { level: 1, name: 'Panduan' })).toBeVisible();
	const one = card(page, 'String berakhiran x');
	await expect(one).toBeVisible();
	await expect(one).toContainText('DFSM');
	await expect(one).toContainText('State mengingat akhiran terpanjang yang cocok dengan awal x.');
	await expect(one).toContainText('1 soal terkait · 6 menit');
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
		'content',
		'Panduan · WebTomata'
	);
	await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
	await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'id_ID');
});

test('topic filters narrow the list, keep the choice in the address, and "Tampilkan semua" resets an empty filter', async ({
	page
}) => {
	await page.goto('/panduan');
	await chooseTopic(page, 'DFSM');
	await expect(page).toHaveURL(/\/panduan\?topik=dfsm$/);
	await expect(card(page, 'String berakhiran x')).toBeVisible();

	await page.reload();
	await expect(page).toHaveURL(/\/panduan\?topik=dfsm$/);
	await expect(
		page.getByRole('group', { name: 'Filter topik' }).getByRole('radio', {
			name: 'DFSM',
			exact: true
		})
	).toBeChecked();
	await expect(card(page, 'String berakhiran x')).toBeVisible();

	await chooseTopic(page, 'Regex');
	await expect(page).toHaveURL(/\/panduan\?topik=regex$/);
	await expect(page.getByText('Tidak ada panduan yang cocok dengan topik ini.')).toBeVisible();
	await page.getByRole('button', { name: 'Tampilkan semua', exact: true }).click();
	await expect(page).toHaveURL(/\/panduan$/);
	await expect(card(page, 'String berakhiran x')).toBeVisible();
});

test('opens a guide page with its sections, contents navigation, and related questions', async ({
	page,
	isMobile
}) => {
	await page.goto('/panduan');
	await card(page, 'String berakhiran x').getByRole('link').click();
	await expect(page).toHaveURL(/\/panduan\/berakhiran-x$/);
	await expect(
		page.getByRole('heading', {
			level: 1,
			name: 'Cara membuat DFSM untuk string berakhiran x'
		})
	).toBeVisible();
	await expect(page.locator('.meta')).toContainText('DFSM');
	await expect(page.locator('.meta')).toContainText('6 menit baca');
	await expect(page.locator('.meta')).toContainText('Rich 5.2 · Sipser 1.1');
	await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
	await expect(page.getByRole('heading', { level: 2, name: 'Ide dasarnya' })).toBeVisible();
	await expect(
		page.getByRole('heading', { level: 2, name: 'Contoh: berakhiran 01' })
	).toBeVisible();
	const embed = page.locator('figure.embed');
	await expect(embed).toBeVisible();
	await expect(embed.locator('svg[role="img"]')).toBeVisible();
	await expect(embed.locator('figcaption')).toContainText('dua simbol terakhir adalah');
	await expect(page.getByRole('heading', { level: 2, name: 'Langkah merancang' })).toBeVisible();
	await expect(page.getByRole('heading', { level: 2, name: 'Kesalahan umum' })).toBeVisible();

	if (isMobile) {
		await expect(page.locator('.side-toc')).toBeHidden();
		const button = page.locator('.toc-toggle');
		await expect(button).toHaveAttribute('aria-expanded', 'false');
		await button.click();
		await expect(button).toHaveAttribute('aria-expanded', 'true');
		const menu = page.locator('#phone-toc');
		await expect(menu.getByRole('link', { name: 'Kesalahan umum' })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(button).toHaveAttribute('aria-expanded', 'false');
	} else {
		const side = page.locator('.side-toc');
		await expect(side).toBeVisible();
		await expect(side.getByRole('link', { name: 'Langkah merancang' })).toBeVisible();
		await expect(side.getByRole('link', { name: 'Soal terkait' })).toBeVisible();
	}

	const related = page.locator('#soal');
	await expect(related).toContainText('String yang diakhiri 10');
	await related.getByRole('link', { name: /String yang diakhiri 10/ }).click();
	await expect(page).toHaveURL(/\/soal\/berakhiran-10$/);

	// On the question page, the pattern links back to the guide when the guide exists.
	if (isMobile) {
		await page.getByRole('button', { name: 'Lihat soal' }).click();
	}
	const patternLink = page.getByRole('link', { name: 'Pola: berakhiran x' });
	await expect(patternLink).toBeVisible();
	await patternLink.click();
	await expect(page).toHaveURL(/\/panduan\/berakhiran-x$/);
});

test('shows the guide list and guide page in English when the language is English', async ({
	page
}) => {
	await page.goto('/panduan/berakhiran-x');
	const menu = page.getByRole('button', { name: 'Menu', exact: true });
	if (await menu.isVisible()) await menu.click();
	await expect(async () => {
		await page.getByRole('button', { name: 'EN, English' }).click();
		await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 1000 });
	}).toPass();
	await expect(
		page.getByRole('heading', {
			level: 1,
			name: 'How to build a DFSM for strings ending with x'
		})
	).toBeVisible();
	await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_US');
	await expect(page.locator('#soal')).toContainText('Strings that end with 10');
});

test('/sitemap.xml lists the public pages, the questions and the guides', async ({ request }) => {
	const response = await request.get('/sitemap.xml');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toContain('application/xml');
	const body = await response.text();
	expect(body).toContain('<loc>https://webtomata.workers.dev/panduan</loc>');
	expect(body).toContain('<loc>https://webtomata.workers.dev/tentang</loc>');
	expect(body).toContain('<loc>https://webtomata.workers.dev/panduan/berakhiran-x</loc>');
	expect(body).toContain('<loc>https://webtomata.workers.dev/soal/berakhiran-10</loc>');
});

test('every interactive target is at least 44 px, and the pages have no accessibility violations', async ({
	page,
	isMobile
}) => {
	await page.goto('/panduan');
	for (const target of await page.locator('.filters .chip span').all()) {
		expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
	}
	await expectNoAxeViolations(page);

	await page.goto('/panduan/berakhiran-x');
	if (isMobile) {
		const button = page.locator('.toc-toggle');
		expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
	}
	for (const link of await page.locator('#soal a').all()) {
		expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
	}
	const openInEditor = page.getByRole('link', { name: 'Buka di editor' });
	expect((await openInEditor.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
	await expectNoAxeViolations(page);
});

test('"Buka di editor" opens the embedded machine in the Sandbox and cleans the address', async ({
	page
}) => {
	await page.goto('/panduan/berakhiran-x');
	await page.getByRole('link', { name: 'Buka di editor' }).click();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(page).toHaveURL(/\/sandbox$/);
	await expect(page.getByRole('button', { name: /^State q0(,|$)/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^State q1(,|$)/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^State q2(,|$)/ })).toBeVisible();
});
