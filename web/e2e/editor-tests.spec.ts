// S6-3, the parts that are for Chrome: the size of the controls, the layout of the panel when the
// list grows, and a real finger. The list itself is tested in every engine (e2e/cross/tests.spec.ts).
import { expect, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { touchTap } from './touch.ts';

const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Simulasi' });
const field = (page: Page) => panel(page).getByLabel('Tambah string');
const rows = (page: Page) => panel(page).locator('.tests li');

test('the controls are at least 44 px, and a long list does not change the size of the canvas or of the panel', async ({
	page
}) => {
	await openSandbox(page);
	const area = (await canvas(page).boundingBox())!;
	const side = (await panel(page).boundingBox())!;
	for (let i = 0; i < 12; i++) {
		await field(page).fill('0'.repeat(i + 1) + '1');
		await field(page).press('Enter');
	}
	await expect(rows(page)).toHaveCount(12);
	for (const target of [
		field(page),
		panel(page).getByRole('button', { name: 'Tambah', exact: true }),
		panel(page)
			.getByRole('button', { name: /^Hapus / })
			.first()
	]) {
		const box = (await target.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.width).toBeGreaterThanOrEqual(44);
	}
	// The panel scrolls inside itself.
	const after = (await canvas(page).boundingBox())!;
	const sideAfter = (await panel(page).boundingBox())!;
	expect(after).toEqual(area);
	expect(sideAfter).toEqual(side);
});

test('a finger adds a string and removes it', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await openSandbox(page);
	await field(page).fill('01');
	await touchTap(page, panel(page).getByRole('button', { name: 'Tambah', exact: true }));
	await expect(rows(page)).toHaveCount(1);
	await expect(rows(page).first().locator('.badge')).toHaveText('Diterima');
	await touchTap(page, panel(page).getByRole('button', { name: 'Hapus 01' }));
	await expect(rows(page)).toHaveCount(0);
});
