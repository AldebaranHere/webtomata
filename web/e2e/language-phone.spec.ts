import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

test.beforeEach(({ isMobile }) => {
	test.skip(!isMobile, 'a phone only');
});

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

for (const viewport of [
	{ width: 360, height: 780 },
	{ width: 390, height: 844 }
]) {
	test(`language phone layout at ${viewport.width}x${viewport.height}: tabs, panels, formula above toolbar, results visible`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await openLanguage(page);

		const tablist = page.locator('.workstation [role="tablist"]');
		await expect(tablist).toBeVisible();

		const tabs = tablist.locator('[role="tab"]');
		await expect(tabs).toHaveCount(3);
		await expect(tabs.nth(0)).toHaveText('Pustaka');
		await expect(tabs.nth(1)).toHaveText('Editor');
		await expect(tabs.nth(2)).toHaveText('Hasil');

		// Default active tab is Editor
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
		const editorPane = page.locator('#language-pane-editor');
		await expect(editorPane).toBeVisible();

		// AC5: Language, Editor tab: formula box (4 rows) is above toolbar and fully visible
		const formulaTextarea = editorPane.locator('.formula-textarea');
		const symbolToolbar = editorPane.locator('.symbol-toolbar');
		await expect(formulaTextarea).toBeVisible();
		await expect(symbolToolbar).toBeVisible();

		const formulaBox = (await formulaTextarea.boundingBox())!;
		const toolbarBox = (await symbolToolbar.boundingBox())!;
		expect(formulaBox.y + formulaBox.height).toBeLessThanOrEqual(toolbarBox.y + 2);

		// AC1: Tab switching
		// Tab 0: Pustaka
		await tabs.nth(0).click();
		await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
		const pustakaPane = page.locator('#language-pane-pustaka');
		await expect(pustakaPane).toBeVisible();
		await expect(editorPane).toBeHidden();

		// Tab 2: Hasil
		await tabs.nth(2).click();
		await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
		const hasilPane = page.locator('#language-pane-hasil');
		await expect(hasilPane).toBeVisible();
		await expect(pustakaPane).toBeHidden();

		// AC4: Language, Hasil tab: first result row is visible without scrolling
		const firstResult = hasilPane.locator('.string-row').first();
		await expect(firstResult).toBeVisible();
		const resultBox = (await firstResult.boundingBox())!;
		expect(resultBox.y + resultBox.height).toBeLessThanOrEqual(viewport.height);

		// AC2: No element has vertical scroll of its own
		const verticalScrollers = await page.evaluate(() => {
			const elements = Array.from(document.querySelectorAll('*'));
			const scrolling: string[] = [];
			for (const el of elements) {
				const style = window.getComputedStyle(el);
				const oy = style.overflowY;
				if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
					scrolling.push(
						`${el.tagName}.${el.className} (scroll: ${el.scrollHeight} > client: ${el.clientHeight})`
					);
				}
			}
			return scrolling;
		});
		expect(verticalScrollers).toEqual([]);

		// AC6: Touch targets at least 44x44
		for (const tab of await tabs.all()) {
			const box = (await tab.boundingBox())!;
			expect(box.width).toBeGreaterThanOrEqual(43.5);
			expect(box.height).toBeGreaterThanOrEqual(43.5);
		}
	});
}

test('language phone layout: preset selection jumps to editor, arrow keys, and axe', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openLanguage(page);

	const tablist = page.locator('.workstation [role="tablist"]');
	const tabs = tablist.locator('[role="tab"]');

	// Switch to Pustaka tab
	await tabs.nth(0).click();
	const pustakaPane = page.locator('#language-pane-pustaka');
	await expect(pustakaPane).toBeVisible();

	// AC7: Tapping a preset selects it, moves to Editor, and header shows its name
	const itemButtons = pustakaPane.locator('.item-btn');
	const secondItem = itemButtons.nth(1);
	const itemName = await secondItem.locator('.item-name').innerText();
	await secondItem.click();

	// Should have jumped to Editor tab
	await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	const editorPane = page.locator('#language-pane-editor');
	await expect(editorPane).toBeVisible();
	const editorHeader = editorPane.locator('.col-header');
	await expect(editorHeader).toContainText(itemName);

	// AC8: Arrow keys move between tabs
	await tabs.nth(1).focus();
	await page.keyboard.press('ArrowRight');
	await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
	await expect(tabs.nth(2)).toBeFocused();

	await page.keyboard.press('ArrowRight'); // wraps to 0
	await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
	await expect(tabs.nth(0)).toBeFocused();

	await page.keyboard.press('ArrowLeft'); // wraps to 2
	await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
	await expect(tabs.nth(2)).toBeFocused();

	// Axe check on tab
	await expectNoAxeViolations(page);
});
