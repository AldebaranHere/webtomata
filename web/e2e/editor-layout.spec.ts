// S9, the parts that are for Chrome: a real finger on a phone (a long-press on empty canvas opens
// the menu that has "Tata letak otomatis"), and the size of the button. The layout itself is tested
// in every engine (e2e/cross/layout.spec.ts).
import { expect, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { touchLongPressAt, touchTap } from './touch.ts';

const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });

test('a finger: a long-press on empty canvas, then the item, lays the machine out in one step', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'a phone only');
	await openSandbox(page);
	const box = (await canvas(page).boundingBox())!;
	await touchLongPressAt(page, { x: box.x + 20, y: box.y + 20 });
	const item = page.getByRole('menuitem', { name: 'Tata letak otomatis' });
	await expect(item).toBeVisible();
	expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	// The finger that was lifted after the long-press does not choose the item (a short guard).
	await page.waitForTimeout(450);
	await touchTap(page, item);
	await expect(page.getByRole('group', { name: 'Pesan' })).toContainText(
		'Tata letak otomatis selesai.'
	);
});

test('the button of the bar is at least 44 px high, and the bar still holds its other controls', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a laptop only');
	await openSandbox(page);
	const button = page.getByRole('button', { name: 'Tata letak otomatis' });
	expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	await expect(page.getByRole('button', { name: /^Mesin saya/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Bantuan/ })).toBeVisible();
	// The title is still shown, not cut to nothing.
	expect((await page.locator('.editor .title').boundingBox())!.width).toBeGreaterThan(60);
});

test('after the layout the view fits the machine: every state is on the screen', async ({
	page
}) => {
	await openSandbox(page);
	const box = (await canvas(page).boundingBox())!;
	await page.mouse.click(box.x + 16, box.y + 16, { button: 'right' });
	await page.getByRole('menuitem', { name: 'Tata letak otomatis' }).click();
	await expect(page.getByRole('group', { name: 'Pesan' })).toBeVisible();
	const area = (await canvas(page).boundingBox())!;
	for (const state of await page.locator('svg.world g.node circle.state').all()) {
		const box = (await state.boundingBox())!;
		expect(box.x).toBeGreaterThanOrEqual(area.x);
		expect(box.y).toBeGreaterThanOrEqual(area.y);
		expect(box.x + box.width).toBeLessThanOrEqual(area.x + area.width);
		expect(box.y + box.height).toBeLessThanOrEqual(area.y + area.height);
	}
});
