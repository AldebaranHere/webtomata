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

test('CYK string length limits: 101 chars shows translated error in id and en, 100 chars works as before (AC2, AC3)', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'desktop project');
	await page.setViewportSize({ width: 1280, height: 800 });
	await openGrammar(page);

	// Navigate to CYK tab on desktop
	const cykTab = page.locator('.output-col .tabs-header .tab-btn').nth(1);
	await expect(cykTab).toBeVisible();
	await cykTab.click();

	const cykPane = page.locator('#grammar-pane-cyk');
	await expect(cykPane).toBeVisible();

	const input = cykPane.locator('#cyk-test-word');
	await expect(input).toBeVisible();

	// Test 101-character string in Indonesian (default)
	const word101 = 'a'.repeat(101);
	await input.fill(word101);
	const testBtn = cykPane.locator('.test-btn');
	await testBtn.click();

	const error = cykPane.locator('.cyk-error');
	await expect(error).toBeVisible();
	await expect(error.locator('.error-text')).toHaveText(
		'String terlalu panjang untuk diuji (101 karakter; paling banyak 100).'
	);

	// Switch language to English
	const enBtn = page.getByRole('button', { name: 'EN, English' });
	await enBtn.click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');

	// Error message updates dynamically to English with 101 and 100
	await expect(error.locator('.error-text')).toHaveText(
		'The string is too long to test (101 characters; at most 100).'
	);

	await expectNoAxeViolations(page);

	// Switch back to Indonesian
	const idBtn = page.getByRole('button', { name: 'ID, Bahasa Indonesia' });
	await idBtn.click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'id');
	await expect(error.locator('.error-text')).toHaveText(
		'String terlalu panjang untuk diuji (101 karakter; paling banyak 100).'
	);

	// AC3: Test 100-character string works as before without limit error
	const word100 = 'a'.repeat(100);
	await input.fill(word100);
	await testBtn.click();

	await expect(error).toBeHidden();
	const verdict = cykPane.locator('.cyk-verdict');
	await expect(verdict).toBeVisible();
});

test('phone: CYK 101-character limit message and 100-character test', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'phone project only');
	await page.setViewportSize({ width: 390, height: 844 });
	await openGrammar(page);

	const tabs = page.locator('.workstation [role="tablist"] [role="tab"]');
	await tabs.nth(3).click(); // CYK tab

	const cykPane = page.locator('#grammar-pane-cyk');
	await expect(cykPane).toBeVisible();

	const input = cykPane.locator('#cyk-test-word');
	await input.fill('a'.repeat(101));
	await cykPane.locator('.test-btn').click();

	const error = cykPane.locator('.cyk-error');
	await expect(error).toBeVisible();
	await expect(error.locator('.error-text')).toHaveText(
		'String terlalu panjang untuk diuji (101 karakter; paling banyak 100).'
	);

	await expectNoAxeViolations(page);

	// 100 characters
	await input.fill('a'.repeat(100));
	await cykPane.locator('.test-btn').click();
	await expect(error).toBeHidden();
	await expect(cykPane.locator('.cyk-verdict')).toBeVisible();
});
