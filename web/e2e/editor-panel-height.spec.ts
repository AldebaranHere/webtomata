// A phone can pull the panel up and push it down by the bar at its top (found in the phone test of
// PR 62: the bar only showed or hid the panel, so the list could not be made taller). Real touch
// events, because a finger on the bar is also the start of a tap that shows or hides the panel.
import { expect, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { touchDragAt, touchTapAt } from './touch.ts';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const bar = (page: Page) => panel(page).getByRole('button', { name: /panel$/ });
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });

test.beforeEach(({ isMobile }) => {
	test.skip(!isMobile, 'a phone only');
});

const size = async (page: Page) => ({
	panel: (await panel(page).boundingBox())!,
	canvas: (await canvas(page).boundingBox())!
});
const center = async (page: Page) => {
	const box = (await bar(page).boundingBox())!;
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('a finger that drags the bar up makes the panel taller, and the canvas shorter', async ({
	page
}) => {
	await openSandbox(page);
	const before = await size(page);
	const at = await center(page);
	await touchDragAt(page, at, { x: at.x, y: at.y - 150 });
	const after = await size(page);
	expect(after.panel.height).toBeGreaterThan(before.panel.height + 100);
	expect(after.canvas.height).toBeLessThan(before.canvas.height - 100);
	// It was a drag, not a tap: the panel is still shown.
	await expect(bar(page)).toHaveAttribute('aria-expanded', 'true');
});

test('a drag down makes it shorter, and it never goes under 30% or takes the canvas', async ({
	page
}) => {
	await openSandbox(page);
	const start = await size(page);
	const editor = (await page.locator('.editor').boundingBox())!.height;
	const at = await center(page);
	await touchDragAt(page, at, { x: at.x, y: at.y + 2000 });
	const low = await size(page);
	expect(low.panel.height).toBeGreaterThanOrEqual(editor * 0.29);
	expect(low.panel.height).toBeLessThan(start.panel.height);

	const now = await center(page);
	await touchDragAt(page, now, { x: now.x, y: -2000 });
	const high = await size(page);
	// The canvas keeps at least 7 rem (112 px), and the panel is at most 80%.
	expect(high.canvas.height).toBeGreaterThanOrEqual(112);
	expect(high.panel.height).toBeLessThanOrEqual(editor * 0.81);
});

test('a tap on the bar still hides the panel and shows it again', async ({ page }) => {
	await openSandbox(page);
	const at = await center(page);
	await touchTapAt(page, at);
	await expect(bar(page)).toHaveAttribute('aria-expanded', 'false');
	await touchTapAt(page, await center(page));
	await expect(bar(page)).toHaveAttribute('aria-expanded', 'true');
});

test('a drag up on a hidden panel shows it at its height', async ({ page }) => {
	await openSandbox(page);
	const shown = await size(page);
	await touchTapAt(page, await center(page));
	await expect(bar(page)).toHaveAttribute('aria-expanded', 'false');
	const at = await center(page);
	await touchDragAt(page, at, { x: at.x, y: at.y - 120 });
	await expect(bar(page)).toHaveAttribute('aria-expanded', 'true');
	const after = await size(page);
	expect(after.panel.height).toBeGreaterThan(shown.panel.height);
});

test('the height is remembered after a reload', async ({ page }) => {
	await openSandbox(page);
	const at = await center(page);
	await touchDragAt(page, at, { x: at.x, y: at.y - 150 });
	const taller = (await size(page)).panel.height;
	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	expect(Math.abs((await size(page)).panel.height - taller)).toBeLessThan(2);
});

test('the keys Up and Down on the bar change the height too', async ({ page }) => {
	await openSandbox(page);
	const before = (await size(page)).panel.height;
	await bar(page).focus();
	await page.keyboard.press('ArrowUp');
	const taller = (await size(page)).panel.height;
	expect(taller).toBeGreaterThan(before);
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	expect((await size(page)).panel.height).toBeLessThan(before);
	// The keys do not hide it.
	await expect(bar(page)).toHaveAttribute('aria-expanded', 'true');
});

test('the bar has a target of at least 44 px, and the page does not scroll when it is dragged', async ({
	page
}) => {
	await openSandbox(page);
	expect((await bar(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
	const at = await center(page);
	await touchDragAt(page, at, { x: at.x, y: at.y - 120 });
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
