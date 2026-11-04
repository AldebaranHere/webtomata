import { expect, expectNoAxeViolations, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';

test.beforeEach(({ isMobile }, testInfo) => {
	if (!testInfo.title.includes('cross-browser')) {
		test.skip(!isMobile, 'a phone only');
	}
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
	await expect(editorPane).toHaveAttribute('role', 'tabpanel');
	await expect(editorPane).toHaveAttribute('aria-labelledby', 'grammar-tab-editor');
	await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
	await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

	// Shortcut to CNF
	const shortcutBtn = editorPane.locator('.btn-convert-cnf');
	await expect(shortcutBtn).toBeVisible();
	await shortcutBtn.click();
	await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
	const cnfPane = page.locator('#grammar-pane-cnf');
	await expect(cnfPane).toBeVisible();
	await expect(cnfPane).toHaveAttribute('role', 'tabpanel');
	await expect(cnfPane).toHaveAttribute('aria-labelledby', 'grammar-tab-cnf');
	await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
	await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

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
	await expect(editorPane).toHaveAttribute('role', 'tabpanel');
	await expect(editorPane).toHaveAttribute('aria-labelledby', 'language-tab-editor');
	await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
	await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

	// Jump to Pustaka and select preset
	await tabs.nth(0).click();
	const pustakaPane = page.locator('#language-pane-pustaka');
	await expect(pustakaPane).toBeVisible();
	await expect(pustakaPane).toHaveAttribute('role', 'tabpanel');
	await expect(pustakaPane).toHaveAttribute('aria-labelledby', 'language-tab-pustaka');
	await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
	await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

	const firstPreset = pustakaPane.locator('.item-btn').first();
	await firstPreset.click();

	// Jumps to editor
	await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	await expect(editorPane).toBeVisible();

	await expectNoAxeViolations(page);
});

test('cross-browser grammar rule rows on webkit-phone and firefox (AC6)', async ({
	page,
	isMobile
}) => {
	if (!isMobile) {
		await page.setViewportSize({ width: 390, height: 844 });
	}
	await openGrammar(page);

	const deleteBtn = page.locator('.btn-delete-row').first();
	await expect(deleteBtn).toBeVisible();
	const delBox = await deleteBtn.boundingBox();
	expect(delBox).not.toBeNull();
	expect(delBox!.height).toBeGreaterThanOrEqual(43.5);
	expect(delBox!.width).toBeGreaterThanOrEqual(43.5);

	const altInput = page.locator('.alt-cell-input').first();
	await expect(altInput).toBeVisible();
	const altBox = await altInput.boundingBox();
	expect(altBox).not.toBeNull();
	expect(altBox!.height).toBeGreaterThanOrEqual(43.5);
	expect(altBox!.width).toBeGreaterThanOrEqual(63.5);
});

test('cross-browser grammar CNF version toggle on webkit-phone and firefox (T-015)', async ({
	page,
	isMobile
}) => {
	if (!isMobile) {
		await page.setViewportSize({ width: 390, height: 844 });
	}
	await page.addInitScript(() => {
		const r1 = {
			id: 'G_R1_TEST',
			title: 'Tata Bahasa R1',
			grammar: 'S -> x B y | z B y | z B | x\nB -> x'
		};
		localStorage.setItem('webtomata.grammar.custom', JSON.stringify([r1]));
		localStorage.setItem('webtomata.grammar.selected_id', r1.id);
	});
	await page.goto('/sandbox?mode=grammar');
	await page.locator('.workstation').waitFor();

	// On phone layout, navigate to CNF tab
	const cnfTab = page.locator('#grammar-tab-cnf');
	if (await cnfTab.isVisible()) {
		await cnfTab.click();
	}

	const cnfPane = page.locator('#grammar-pane-cnf');
	await expect(cnfPane).toBeVisible();

	// Jump to phase 5
	const stepPills = cnfPane.locator('.step-pill');
	await stepPills.nth(4).click();
	await expect(cnfPane.locator('.step-counter')).toHaveText('5 / 6');
	await expect(cnfPane.locator('.rule-count')).toHaveText('8 aturan');

	// Tap the "Versi ringkas" radio
	const ringkasRadio = cnfPane.locator('.version-radio', { hasText: 'Versi ringkas' });
	await ringkasRadio.click();

	// Check phase remains 5 and rule count changed to 7 aturan
	await expect(cnfPane.locator('.step-counter')).toHaveText('5 / 6');
	await expect(cnfPane.locator('.rule-count')).toHaveText('7 aturan');
});
