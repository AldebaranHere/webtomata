// S5-2, the parts that are for Chrome: the size of the targets, the layout of the panel with a wide
// table, and a real finger. The table itself is tested in every engine (e2e/cross/table.spec.ts).
import { expect, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { touchTap } from './touch.ts';

const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });
const grid = (page: Page) => panel(page).getByRole('grid', { name: 'Tabel transisi' });

async function openTable(page: Page) {
	await openSandbox(page);
	await panel(page).getByRole('tab', { name: 'Tabel' }).click();
	await expect(grid(page)).toBeVisible();
}

test('every target of the table is at least 44 px, and the table changes no size of the page', async ({
	page
}) => {
	await openTable(page);
	const area = (await canvas(page).boundingBox())!;
	const side = (await panel(page).boundingBox())!;
	const targets = [
		grid(page).getByRole('combobox').first(),
		grid(page).getByRole('checkbox').first(),
		grid(page).getByRole('button', { name: 'q0', exact: true }),
		grid(page)
			.getByRole('button', { name: /^Hapus simbol/ })
			.first(),
		panel(page).getByRole('button', { name: '+ State' }),
		panel(page).getByRole('textbox', { name: 'Simbol baru' }),
		panel(page).getByRole('button', { name: 'Tambah simbol' })
	];
	for (const target of targets) {
		const box = (await target.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.width).toBeGreaterThanOrEqual(44);
	}
	expect(await canvas(page).boundingBox()).toEqual(area);
	expect(await panel(page).boundingBox()).toEqual(side);
});

test('a wide table scrolls inside itself, the page does not, and the first column stays', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'a phone only');
	await page.setViewportSize({ width: 320, height: 640 });
	await openTable(page);
	const symbols = panel(page).getByRole('textbox', { name: 'Simbol baru' });
	for (const symbol of ['a', 'b', 'c', 'd']) {
		await symbols.fill(symbol);
		await symbols.press('Enter');
	}
	const wrap = panel(page).locator('.wrap');
	expect(await wrap.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeGreaterThan(0);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		)
	).toBeLessThanOrEqual(0);
	await wrap.evaluate((e) => e.scrollTo(e.scrollWidth, 0));
	const left = (await wrap.boundingBox())!.x;
	const first = (await grid(page).getByRole('rowheader').first().boundingBox())!;
	expect(Math.abs(first.x - left)).toBeLessThanOrEqual(2);
});

test('a finger toggles Start and adds a state', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await openTable(page);
	await touchTap(page, grid(page).getByRole('checkbox', { name: 'q1: start state' }));
	await expect(grid(page).getByRole('checkbox', { name: 'q1: start state' })).toBeChecked();
	await touchTap(page, panel(page).getByRole('button', { name: '+ State' }));
	await expect(grid(page).getByRole('rowheader')).toHaveCount(4);
});

test('the table is the same machine on a laptop and on a phone: the first row is selected with the diagram', async ({
	page
}) => {
	await openTable(page);
	await page.getByRole('button', { name: /^State q2(,|$)/ }).click();
	await expect(
		grid(page)
			.getByRole('row')
			.filter({ has: page.getByRole('rowheader', { name: 'q2' }) })
	).toHaveAttribute('aria-selected', 'true');
});
