// The rail of the tools on a laptop shows icons only. A pointer that rests on an icon (or the focus
// that comes to it) shows its name and its key, quickly, and it can be dismissed with Escape and
// reached with the pointer (WCAG 1.4.13). A phone has the names under the icons, and no tooltip.
import { expect, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const rail = (page: Page) => page.getByRole('toolbar', { name: 'Alat editor' });
const tool = (page: Page, name: string) => rail(page).getByRole('button', { name });
const tip = (page: Page, text: string) =>
	rail(page).locator('.tip').filter({ hasText: text }).first();
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });

test.describe('on a laptop', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'a laptop only');
	});

	test('a pointer on an icon shows its name and its key, and not before', async ({ page }) => {
		await openSandbox(page);
		await expect(tip(page, 'Tambah state')).toBeHidden();
		await tool(page, 'Tambah state').hover();
		await expect(tip(page, 'Tambah state')).toBeVisible();
		await expect(tip(page, 'Tambah state')).toContainText('S');
		await tool(page, 'Tambah transisi').hover();
		await expect(tip(page, 'Tambah transisi')).toBeVisible();
		await expect(tip(page, 'Tambah state')).toBeHidden();
		await expect(tip(page, 'Tambah transisi')).toContainText('T');
	});

	test('it comes quickly: in less than a second', async ({ page }) => {
		await openSandbox(page);
		await tool(page, 'Pilih').hover();
		await expect(tip(page, 'Pilih')).toBeVisible({ timeout: 1000 });
	});

	test('it goes when the pointer leaves', async ({ page }) => {
		await openSandbox(page);
		await tool(page, 'Hapus').hover();
		await expect(tip(page, 'Hapus')).toBeVisible();
		await canvas(page).hover({ position: { x: 300, y: 300 } });
		await expect(tip(page, 'Hapus')).toBeHidden();
	});

	test('the pointer can go onto the tooltip, and it stays', async ({ page }) => {
		await openSandbox(page);
		await tool(page, 'Tambah state').hover();
		await expect(tip(page, 'Tambah state')).toBeVisible();
		await tip(page, 'Tambah state').locator('.bubble').hover();
		await expect(tip(page, 'Tambah state')).toBeVisible();
	});

	test('Escape dismisses it, and it comes back with the next icon', async ({ page }) => {
		await openSandbox(page);
		await tool(page, 'Tambah state').hover();
		await expect(tip(page, 'Tambah state')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(tip(page, 'Tambah state')).toBeHidden();
		// Leaving the rail and coming back shows tooltips again.
		await canvas(page).hover({ position: { x: 300, y: 300 } });
		await tool(page, 'Tambah transisi').hover();
		await expect(tip(page, 'Tambah transisi')).toBeVisible();
	});

	test('the keyboard focus shows it too', async ({ page }) => {
		await openSandbox(page);
		await canvas(page).focus();
		await page.keyboard.press('Shift+Tab');
		// Some control before the canvas has the focus; walk back to the rail with the keyboard.
		await tool(page, 'Pilih').focus();
		await page.keyboard.press('Tab');
		await expect(tool(page, 'Tambah state')).toBeFocused();
		await expect(tip(page, 'Tambah state')).toBeVisible();
	});

	test('undo and redo have tooltips with their keys', async ({ page }) => {
		await openSandbox(page);
		await expect(async () => {
			await canvas(page).focus();
			await page.keyboard.press('n');
			expect(await page.locator('svg.world g.node').count()).toBe(4);
		}).toPass();
		await rail(page).getByRole('button', { name: 'Urungkan' }).hover();
		await expect(tip(page, 'Urungkan')).toBeVisible();
		await expect(tip(page, 'Urungkan')).toContainText('Ctrl+Z');
		await rail(page).getByRole('button', { name: 'Ulangi' }).hover();
		await expect(tip(page, 'Ulangi')).toContainText('Ctrl+Y');
	});

	test('the tooltip is not read twice: it is hidden from screen readers, and the buttons keep their names', async ({
		page
	}) => {
		await openSandbox(page);
		await expect(rail(page).locator('.tip').first()).toHaveAttribute('aria-hidden', 'true');
		await expect(tool(page, 'Tambah state')).toHaveAccessibleName('Tambah state');
	});
});

test('a phone has the names under the icons and no tooltip', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await openSandbox(page);
	await tool(page, 'Tambah state').tap();
	// The tooltip is not even drawn on a phone (the names are under the icons).
	await expect(rail(page).locator('.tip').first()).toHaveCSS('display', 'none');
	await expect(rail(page).locator('.tip').filter({ visible: true })).toHaveCount(0);
	await expect(rail(page).getByText('Tambah state', { exact: true }).first()).toBeVisible();
});
