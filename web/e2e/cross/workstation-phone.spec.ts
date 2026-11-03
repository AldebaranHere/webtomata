import { expect, expectNoAxeViolations, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';

test.beforeEach(({ isMobile }) => {
	test.skip(!isMobile, 'a phone only');
});

async function openGrammar(page: Page) {
	await page.goto('/sandbox');
	const switcher = page.locator('.switcher-trigger');
	await switcher.waitFor();
	await switcher.click();
	const item = page.getByRole('option', { name: /Tata Bahasa/ });
	await item.waitFor();
	await item.click();
	await page.locator('.workstation').waitFor();
}

async function openLanguage(page: Page) {
	await page.goto('/sandbox');
	const switcher = page.locator('.switcher-trigger');
	await switcher.waitFor();
	await switcher.click();
	const item = page.getByRole('option', { name: /^Bahasa & Enumerasi/ });
	await item.waitFor();
	await item.click();
	await page.locator('.workstation').waitFor();
}

test('grammar phone layout on WebKit phone: tab navigation, shortcut, and axe', async ({
	page
}) => {
	await openGrammar(page);

	const tablist = page.locator('.workstation [role="tablist"]');
	await expect(tablist).toBeVisible();

	const tabs = tablist.locator('[role="tab"]');
	await expect(tabs).toHaveCount(4);

	// Editor tab is default
	await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	const editorPane = page.locator('#grammar-pane-editor');
	await expect(editorPane).toBeVisible();

	// Shortcut to CNF
	const shortcutBtn = editorPane.locator('.btn-convert-cnf');
	await expect(shortcutBtn).toBeVisible();
	await shortcutBtn.click();
	await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
	const cnfPane = page.locator('#grammar-pane-cnf');
	await expect(cnfPane).toBeVisible();

	// Step 6 has "Buka sebagai tata bahasa baru"
	const stepPills = cnfPane.locator('.step-pill');
	await stepPills.nth(5).click();
	const openResultBtn = cnfPane.locator('.btn-open-result');
	await expect(openResultBtn).toBeVisible();

	await expectNoAxeViolations(page);

	// Tapping openResultBtn jumps to Editor tab with (CNF) title
	await openResultBtn.click();
	await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	await expect(editorPane).toBeVisible();
	await expect(editorPane.locator('.col-header')).toContainText('(CNF)');
});

test('language phone layout on WebKit phone: tab navigation and axe', async ({ page }) => {
	await openLanguage(page);

	const tablist = page.locator('.workstation [role="tablist"]');
	await expect(tablist).toBeVisible();

	const tabs = tablist.locator('[role="tab"]');
	await expect(tabs).toHaveCount(3);

	// Editor tab is default
	await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	const editorPane = page.locator('#language-pane-editor');
	await expect(editorPane).toBeVisible();

	// Jump to Pustaka and select preset
	await tabs.nth(0).click();
	const pustakaPane = page.locator('#language-pane-pustaka');
	await expect(pustakaPane).toBeVisible();

	const firstPreset = pustakaPane.locator('.item-btn').first();
	await firstPreset.click();

	// Jumps to editor
	await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	await expect(editorPane).toBeVisible();

	await expectNoAxeViolations(page);
});
