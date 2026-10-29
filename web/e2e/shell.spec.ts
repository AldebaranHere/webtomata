// The app shell: the four routes, the navigation, the skip link, the language switch and the
// phone menu. Texts are the Indonesian messages of src/lib/i18n/id.ts (and en.ts for English).
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const ROUTES = [
	{ path: '/', heading: 'WebTomata', navLabel: 'WebTomata' },
	{ path: '/sandbox', heading: 'Sandbox', navLabel: 'Sandbox' },
	{ path: '/soal', heading: 'Soal', navLabel: 'Soal' },
	{ path: '/panduan', heading: 'Panduan', navLabel: 'Panduan' },
	{ path: '/tentang', heading: 'Tentang WebTomata', navLabel: 'Tentang' }
] as const;

// On a phone the links are behind the Menu button; on a laptop they are in the bar.
async function openMenuIfPhone(page: Page) {
	const menu = page.getByRole('button', { name: 'Menu' });
	if ((await menu.isVisible()) && (await menu.getAttribute('aria-expanded')) === 'false') {
		await menu.click();
	}
}

for (const { path, heading } of ROUTES) {
	test(`${path} opens, has its heading and no accessibility violations`, async ({ page }) => {
		await page.goto(path);
		await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
		await expect(page).toHaveTitle(path === '/' ? 'WebTomata' : `${heading} · WebTomata`);
		await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
		await expect(page.locator('html')).toHaveAttribute('lang', 'id');
		if (path === '/') await expect(page.locator('.version code')).toHaveText(/^\d+\.\d+\.\d+/);
		await expectNoAxeViolations(page);
	});
}

test('each link of the navigation opens its page and is marked as the current one', async ({
	page
}) => {
	await page.goto('/');
	for (const { path, heading, navLabel } of ROUTES.slice(1)) {
		await openMenuIfPhone(page);
		const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
		await nav.getByRole('link', { name: navLabel, exact: true }).click();
		await expect(page).toHaveURL(path);
		await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
		await openMenuIfPhone(page);
		await expect(nav.locator('a[aria-current="page"]')).toHaveText(navLabel);
	}
	await page.getByRole('link', { name: 'WebTomata' }).first().click();
	await expect(page).toHaveURL('/');
});

test('the skip link moves the focus to the content', async ({ page }) => {
	await page.goto('/sandbox');
	await page.keyboard.press('Tab');
	const skip = page.getByRole('link', { name: 'Lewati ke konten' });
	await expect(skip).toBeFocused();
	await expect(skip).toBeInViewport();
	await page.keyboard.press('Enter');
	await expect(page.locator('main')).toBeFocused();
});

test('the language switch changes the text and the page language, and is remembered', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'ID, Bahasa Indonesia' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('button', { name: 'EN, English' }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.locator('footer')).toContainText('No account, no tracking.');
	await expectNoAxeViolations(page);

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page.locator('footer')).toContainText('No account, no tracking.');
	await openMenuIfPhone(page);
	await expect(page.getByRole('link', { name: 'Questions', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'ID, Bahasa Indonesia' }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'id');
	await expect(page.locator('footer')).toContainText('Tanpa akun, tanpa pelacakan.');
});

test('a language that is not saved is ignored, and the page stays Indonesian', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('webtomata.lang', 'fr'));
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('lang', 'id');
	await expect(page.locator('footer')).toContainText('Tanpa akun, tanpa pelacakan.');
});

test('the page works when the browser blocks storage', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'localStorage', {
			get() {
				throw new DOMException('blocked', 'SecurityError');
			}
		});
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'EN, English' }).click();
	await expect(page.locator('footer')).toContainText('No account, no tracking.');
});

test.describe('the phone menu', () => {
	test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'a phone only'));

	test('is closed at first, opens with the button and closes with Escape', async ({ page }) => {
		await page.goto('/');
		const menu = page.getByRole('button', { name: 'Menu' });
		const link = page.getByRole('link', { name: 'Sandbox', exact: true });
		await expect(menu).toHaveAttribute('aria-expanded', 'false');
		await expect(link).toBeHidden();
		await menu.click();
		await expect(menu).toHaveAttribute('aria-expanded', 'true');
		await expect(link).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(link).toBeHidden();
	});

	test('has targets of at least 44 px', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Menu' }).click();
		const targets = [
			page.getByRole('button', { name: 'Menu' }),
			page.getByRole('link', { name: 'Sandbox', exact: true }),
			page.getByRole('button', { name: 'ID, Bahasa Indonesia' }),
			page.getByRole('button', { name: 'EN, English' })
		];
		for (const target of targets) {
			const box = await target.boundingBox();
			expect(box?.height).toBeGreaterThanOrEqual(44);
			expect(box?.width).toBeGreaterThanOrEqual(44);
		}
	});
});

test.describe('the laptop bar', () => {
	test.beforeEach(({ isMobile }) => test.skip(isMobile, 'a laptop only'));

	test('shows the links without a menu button', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
		await expect(page.getByRole('link', { name: 'Panduan', exact: true })).toBeVisible();
	});
});
