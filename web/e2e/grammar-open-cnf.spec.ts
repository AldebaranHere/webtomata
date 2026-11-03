import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

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

test('desktop: open CNF result as new grammar (AC3, AC4, AC6, AC8)', async ({ page, isMobile }) => {
	test.skip(isMobile, 'desktop project only');
	await page.setViewportSize({ width: 1280, height: 800 });
	await openGrammar(page);

	const cnfPane = page.locator('#grammar-pane-cnf');
	await expect(cnfPane).toBeVisible();

	const stepPills = cnfPane.locator('.step-pill');
	await expect(stepPills).toHaveCount(6);

	const openResultBtn = cnfPane.locator('.btn-open-result');

	// AC3: Button is hidden on steps 1 through 5
	for (let i = 0; i < 5; i++) {
		await stepPills.nth(i).click();
		await expect(openResultBtn).toBeHidden();
	}

	// AC3: Button is visible on step 6
	await stepPills.nth(5).click();
	await expect(openResultBtn).toBeVisible();
	await expect(openResultBtn).toHaveText('Buka sebagai tata bahasa baru');

	// AC8: Axe check on desktop at step 6
	await expectNoAxeViolations(page);

	// Original preset title
	const origTitle = 'Urutan Eliminasi Simbol (Fase 4)';
	const editorHeader = page.locator('#grammar-pane-editor .col-header');
	await expect(editorHeader).toContainText(origTitle);

	// AC4: Tapping button adds "<name> (CNF)", selects it, and shows it in Editor header
	await openResultBtn.click();

	const expectedTitle1 = `${origTitle} (CNF)`;
	await expect(editorHeader).toContainText(expectedTitle1);

	// Library shows custom item
	const customCards = page.locator('#grammar-pane-pustaka .custom-card');
	await expect(customCards).toHaveCount(1);
	await expect(customCards.first().locator('.card-title')).toHaveText(expectedTitle1);

	// Original preset is unchanged in library
	const presetCards = page.locator('#grammar-pane-pustaka .preset-card');
	await presetCards.first().click();
	await expect(editorHeader).toContainText(origTitle);

	// Go to step 6 again and tap "Buka sebagai tata bahasa baru" -> creates (CNF 2)
	await stepPills.nth(5).click();
	await expect(openResultBtn).toBeVisible();
	await openResultBtn.click();

	const expectedTitle2 = `${origTitle} (CNF 2)`;
	await expect(editorHeader).toContainText(expectedTitle2);
	await expect(customCards).toHaveCount(2);
	await expect(customCards.nth(1).locator('.card-title')).toHaveText(expectedTitle2);

	// AC6: Reload page: both entries are still in the library
	await page.reload();
	await page.locator('.workstation').waitFor();
	await expect(customCards).toHaveCount(2);
	await expect(customCards.first().locator('.card-title')).toHaveText(expectedTitle1);
	await expect(customCards.nth(1).locator('.card-title')).toHaveText(expectedTitle2);
});

test('desktop: open nullable preset, tap open CNF result, and check new grammar CNF tab shows same rules', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'desktop project only');
	await page.setViewportSize({ width: 1280, height: 800 });
	await openGrammar(page);

	// Select the nullable preset
	const nullablePresetCard = page.locator('#grammar-pane-pustaka .preset-card', {
		hasText: 'Variabel Nullable Majemuk (Fase 2)'
	});
	await nullablePresetCard.click();

	const cnfPane = page.locator('#grammar-pane-cnf');
	await expect(cnfPane).toBeVisible();

	// Go to step 6 of the original nullable grammar
	const stepPills = cnfPane.locator('.step-pill');
	await stepPills.nth(5).click();

	const openResultBtn = cnfPane.locator('.btn-open-result');
	await expect(openResultBtn).toBeVisible();

	// Record rule count and math formula text of step 6
	const originalRuleCount = await cnfPane.locator('.preview-header .rule-count').textContent();
	const originalMathContent = await cnfPane.locator('.latex-grammar-math').textContent();

	// Tap "Buka sebagai tata bahasa baru"
	await openResultBtn.click();

	// The new custom grammar is selected and displayed in the Editor
	const editorHeader = page.locator('#grammar-pane-editor .col-header');
	await expect(editorHeader).toContainText('Variabel Nullable Majemuk (Fase 2) (CNF)');

	// Navigate to step 6 of the new grammar's CNF tab
	await stepPills.nth(5).click();

	// Verify that the new grammar's CNF tab shows the exact same rules as the original CNF result
	const newRuleCount = await cnfPane.locator('.preview-header .rule-count').textContent();
	const newMathContent = await cnfPane.locator('.latex-grammar-math').textContent();

	expect(newRuleCount).toBe(originalRuleCount);
	expect(newMathContent).toBe(originalMathContent);
});

test('phone: open CNF result as new grammar button size, navigation, and axe (AC3, AC4, AC8)', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'phone project only');
	await page.setViewportSize({ width: 390, height: 844 });
	await openGrammar(page);

	const tablist = page.locator('.workstation [role="tablist"]');
	const tabs = tablist.locator('[role="tab"]');

	// Navigate to CNF tab
	await tabs.nth(2).click();
	const cnfPane = page.locator('#grammar-pane-cnf');
	await expect(cnfPane).toBeVisible();

	const stepPills = cnfPane.locator('.step-pill');
	const openResultBtn = cnfPane.locator('.btn-open-result');

	// Steps 1 to 5: button is hidden
	for (let i = 0; i < 5; i++) {
		await stepPills.nth(i).click();
		await expect(openResultBtn).toBeHidden();
	}

	// Step 6: button is visible
	await stepPills.nth(5).click();
	await expect(openResultBtn).toBeVisible();
	await expect(openResultBtn).toHaveText('Buka sebagai tata bahasa baru');

	// AC8: Button is at least 44px high and full width on mobile
	const btnBox = (await openResultBtn.boundingBox())!;
	expect(btnBox.height).toBeGreaterThanOrEqual(43.5);
	expect(btnBox.width).toBeGreaterThanOrEqual(300);

	// AC8: Axe check on phone at step 6
	await expectNoAxeViolations(page);

	// AC4: Tapping button jumps to Editor tab on mobile and displays new title in header
	await openResultBtn.click();

	await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	const editorPane = page.locator('#grammar-pane-editor');
	await expect(editorPane).toBeVisible();
	await expect(editorPane.locator('.col-header')).toContainText('(CNF)');
});
