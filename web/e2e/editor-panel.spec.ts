// S5-1, the parts that are for Chrome: the size of the tabs and switches, the layout of the panel
// when the tab changes, and a real finger. The tabs themselves are tested in every engine
// (e2e/cross/panel-tabs.spec.ts).
import { expect, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { touchTap } from './touch.ts';

const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const tab = (page: Page, name: string) => panel(page).getByRole('tab', { name });

test('the tabs and the switch are at least 44 px, and a change of tab changes no size', async ({
	page
}) => {
	await openSandbox(page);
	const area = (await canvas(page).boundingBox())!;
	const side = (await panel(page).boundingBox())!;
	for (const name of ['Simulasi', 'Tabel', 'Definisi']) {
		const box = (await tab(page, name).boundingBox())!;
		expect(box.height, name).toBeGreaterThanOrEqual(44);
		expect(box.width, name).toBeGreaterThanOrEqual(44);
		await tab(page, name).click();
		expect(await canvas(page).boundingBox()).toEqual(area);
		expect(await panel(page).boundingBox()).toEqual(side);
	}
	for (const name of ['DFSM', 'NDFSM']) {
		const box = (await panel(page).getByRole('radio', { name, exact: true }).boundingBox())!;
		expect(box.height, name).toBeGreaterThanOrEqual(44);
		expect(box.width, name).toBeGreaterThanOrEqual(44);
	}
	await expect(panel(page).getByRole('button', { name: 'Salin' })).toHaveCount(1);
});

test('the tab bar stays in view while the open tab scrolls', async ({ page }) => {
	await openSandbox(page, { tests: 'keep' });
	await panel(page)
		.locator('.panes')
		.evaluate((e) => e.scrollTo(0, e.scrollHeight));
	const bar = panel(page).getByRole('tablist');
	await expect(bar).toBeInViewport();
	await expect(tab(page, 'Definisi')).toBeInViewport();
});

test('a finger changes the tab and the machine type', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await openSandbox(page);
	await touchTap(page, tab(page, 'Definisi'));
	await expect(panel(page).getByText('M = (K, Σ, δ, s, A)', { exact: true })).toBeVisible();
	await touchTap(page, panel(page).getByRole('radio', { name: 'NDFSM', exact: true }));
	await expect(panel(page).getByText('M = (K, Σ, Δ, s, A)', { exact: true })).toBeVisible();
	await touchTap(page, tab(page, 'Simulasi'));
	await expect(panel(page).getByLabel('String masukan')).toBeVisible();
});

test('the definition fits a narrow phone without a sideways scroll', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await page.setViewportSize({ width: 320, height: 640 });
	await openSandbox(page);
	await tab(page, 'Definisi').click();
	const over = await panel(page).evaluate((e) => e.scrollWidth - e.clientWidth);
	expect(over).toBeLessThanOrEqual(0);
	const page_ = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(page_).toBeLessThanOrEqual(0);
});

test('each tab starts where it was left: another tab does not inherit the scroll', async ({
	page,
	isMobile
}) => {
	// A low window, so that the panel has more than it can show, on a laptop as well.
	if (!isMobile) await page.setViewportSize({ width: 1280, height: 520 });
	await openSandbox(page, { tests: 'keep' });
	const panes = panel(page).locator('.panes');
	await panes.evaluate((e) => e.scrollTo(0, e.scrollHeight));
	const left = await panes.evaluate((e) => e.scrollTop);
	expect(left).toBeGreaterThan(0);
	await tab(page, 'Definisi').click();
	await expect.poll(() => panes.evaluate((e) => e.scrollTop)).toBe(0);
	await tab(page, 'Simulasi').click();
	await expect.poll(() => panes.evaluate((e) => e.scrollTop)).toBe(left);
});
