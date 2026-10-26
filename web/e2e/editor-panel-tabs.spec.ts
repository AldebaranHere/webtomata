// The four tabs of the panel must fit the panel in both languages: the English names are longer
// ("Conversion"), and a tab that runs out of the panel cannot be read or reached (found in the
// phone test of PR 62).
import { expect, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const tablist = (page: Page) => panel(page).getByRole('tablist');

async function measure(page: Page) {
	return tablist(page).evaluate((list) => {
		const box = list.getBoundingClientRect();
		const tabs = [...list.querySelectorAll('[role=tab]')].map((tab) => tab.getBoundingClientRect());
		return {
			overflow: list.scrollWidth - list.clientWidth,
			outside: Math.max(...tabs.map((tab) => tab.right - box.right)),
			lines: new Set(tabs.map((tab) => Math.round(tab.top))).size,
			heights: tabs.map((tab) => tab.height)
		};
	});
}

for (const lang of ['id', 'en']) {
	test(`the four tabs fit the panel in one line, in ${lang}`, async ({ page }) => {
		await page.addInitScript((value) => localStorage.setItem('webtomata.lang', value), lang);
		await openSandbox(page);
		await expect(tablist(page).getByRole('tab')).toHaveCount(4);
		const fit = await measure(page);
		expect(fit.overflow).toBeLessThanOrEqual(0);
		expect(fit.outside).toBeLessThanOrEqual(0.5);
		expect(fit.lines).toBe(1);
		for (const height of fit.heights) expect(height).toBeGreaterThanOrEqual(44);
	});

	test(`on the narrowest phone the tabs wrap and nothing runs out, in ${lang}`, async ({
		page,
		isMobile
	}) => {
		test.skip(!isMobile, 'a phone only');
		await page.setViewportSize({ width: 320, height: 640 });
		await page.addInitScript((value) => localStorage.setItem('webtomata.lang', value), lang);
		await openSandbox(page);
		const fit = await measure(page);
		expect(fit.overflow).toBeLessThanOrEqual(0);
		expect(fit.outside).toBeLessThanOrEqual(0.5);
	});
}
