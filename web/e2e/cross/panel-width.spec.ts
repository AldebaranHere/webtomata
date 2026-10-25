// The panel on a laptop can be pulled wider by its left edge (for the table). The width is
// remembered, stays inside its limits, and has a keyboard way. A phone has no handle.
import { expect, expectNoAxeViolations, openSandbox, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const handle = (page: Page) => panel(page).getByRole('separator', { name: 'Ubah lebar panel' });
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const width = async (page: Page) => (await panel(page).boundingBox())!.width;

async function pull(page: Page, dx: number) {
	const box = (await handle(page).boundingBox())!;
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + dx / 2, y, { steps: 4 });
	await page.mouse.move(x + dx, y, { steps: 4 });
	await page.mouse.up();
}

test('a phone has no handle', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await openSandbox(page);
	await expect(handle(page)).toBeHidden();
});

test.describe('on a laptop', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'a laptop only');
	});

	test('the panel is 22 rem at first, and the handle says so', async ({ page }) => {
		await openSandbox(page);
		expect(Math.abs((await width(page)) - 352)).toBeLessThanOrEqual(1);
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '22');
		await expect(handle(page)).toHaveAttribute('aria-valuemin', '22');
		await expect(handle(page)).toHaveAttribute('aria-valuemax', '54');
	});

	test('pulling the handle to the left makes the panel wider, and the canvas narrower', async ({
		page
	}) => {
		await openSandbox(page);
		const before = (await canvas(page).boundingBox())!;
		await pull(page, -200);
		expect(Math.abs((await width(page)) - 552)).toBeLessThanOrEqual(2);
		const after = (await canvas(page).boundingBox())!;
		expect(Math.abs(before.width - after.width - 200)).toBeLessThanOrEqual(2);
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '35');
	});

	test('it does not go below 22 rem, and not above 60% of the window, which leaves the canvas 20 rem', async ({
		page
	}) => {
		await openSandbox(page);
		await pull(page, 300);
		expect(Math.abs((await width(page)) - 352)).toBeLessThanOrEqual(1);
		await pull(page, -2000);
		const wide = await width(page);
		expect(wide).toBeLessThanOrEqual(1440 * 0.6 + 1);
		expect((await canvas(page).boundingBox())!.width).toBeGreaterThanOrEqual(320);
	});

	test('the keyboard: Left and Right change it by 1 rem, with Shift by 4, Home and End go to the limits', async ({
		page
	}) => {
		await openSandbox(page);
		await handle(page).focus();
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowLeft');
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '25');
		expect(Math.abs((await width(page)) - 400)).toBeLessThanOrEqual(1);
		await page.keyboard.press('Shift+ArrowLeft');
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '29');
		await page.keyboard.press('ArrowRight');
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '28');
		await page.keyboard.press('End');
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '54');
		await page.keyboard.press('Home');
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '22');
		await page.keyboard.press('ArrowRight');
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '22');
	});

	test('a double click puts it back', async ({ page }) => {
		await openSandbox(page);
		await pull(page, -150);
		expect((await width(page)) > 400).toBe(true);
		await handle(page).dblclick();
		expect(Math.abs((await width(page)) - 352)).toBeLessThanOrEqual(1);
	});

	test('the width is remembered after a reload', async ({ page }) => {
		await openSandbox(page);
		await handle(page).focus();
		await page.keyboard.press('Shift+ArrowLeft');
		await page.keyboard.press('Shift+ArrowLeft');
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '30');
		await page.reload();
		await page.locator('.editor[data-ready]').waitFor();
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '30');
		expect(Math.abs((await width(page)) - 480)).toBeLessThanOrEqual(1);
	});

	test('a width that was pulled with the mouse is remembered too', async ({ page }) => {
		await openSandbox(page);
		await pull(page, -160);
		await page.reload();
		await page.locator('.editor[data-ready]').waitFor();
		expect(Math.abs((await width(page)) - 512)).toBeLessThanOrEqual(3);
	});

	test('a saved width that is too big or is not a number is brought back', async ({ page }) => {
		// Only on the first load: the script runs again after the reload.
		await page.addInitScript(() => {
			if (sessionStorage.getItem('seeded')) return;
			sessionStorage.setItem('seeded', '1');
			localStorage.setItem('webtomata.panel.width', '900');
		});
		await openSandbox(page);
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '54');
		await page.evaluate(() => localStorage.setItem('webtomata.panel.width', 'wide'));
		await page.reload();
		await page.locator('.editor[data-ready]').waitFor();
		await expect(handle(page)).toHaveAttribute('aria-valuenow', '22');
	});

	test('a smaller window brings a wide panel back inside the limits', async ({ page }) => {
		await openSandbox(page);
		await handle(page).focus();
		await page.keyboard.press('End');
		await page.setViewportSize({ width: 1000, height: 700 });
		await expect.poll(() => width(page)).toBeLessThanOrEqual(600 + 1);
		expect((await canvas(page).boundingBox())!.width).toBeGreaterThanOrEqual(320);
	});

	test('the machine can still be edited after the canvas changed its size', async ({ page }) => {
		await openSandbox(page);
		await pull(page, -300);
		await page.getByRole('button', { name: /^State q1(,|$)/ }).click();
		await expect(page.getByRole('button', { name: /^State q1(,|$)/ })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.locator('svg.world g.node')).toHaveCount(3);
	});

	test('a wider panel shows the table without a sideways scroll', async ({ page }) => {
		await openSandbox(page);
		await panel(page).getByRole('tab', { name: 'Tabel' }).click();
		const wrap = panel(page).locator('.wrap');
		const symbols = panel(page).getByRole('textbox', { name: 'Simbol baru' });
		for (const symbol of ['a', 'b', 'c']) {
			await symbols.fill(symbol);
			await symbols.press('Enter');
		}
		expect(await wrap.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeGreaterThan(0);
		await handle(page).focus();
		await page.keyboard.press('End');
		expect(await wrap.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
	});

	test('the widened panel passes axe, and the handle is a tab stop', async ({ page }) => {
		await openSandbox(page);
		await handle(page).focus();
		await expect(handle(page)).toBeFocused();
		await page.keyboard.press('Shift+ArrowLeft');
		await expectNoAxeViolations(page);
	});
});
