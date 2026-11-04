import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

test.beforeEach(({ isMobile }, testInfo) => {
	if (testInfo.title.includes('desktop project')) {
		test.skip(isMobile, 'desktop only');
	} else {
		test.skip(!isMobile, 'a phone only');
	}
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
		await expect(editorPane).toHaveAttribute('role', 'tabpanel');
		await expect(editorPane).toHaveAttribute('aria-labelledby', 'language-tab-editor');
		await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
		await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

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
		await expect(pustakaPane).toHaveAttribute('role', 'tabpanel');
		await expect(pustakaPane).toHaveAttribute('aria-labelledby', 'language-tab-pustaka');
		await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
		await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

		// Tab 2: Hasil
		await tabs.nth(2).click();
		await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
		const hasilPane = page.locator('#language-pane-hasil');
		await expect(hasilPane).toBeVisible();
		await expect(pustakaPane).toBeHidden();
		await expect(hasilPane).toHaveAttribute('role', 'tabpanel');
		await expect(hasilPane).toHaveAttribute('aria-labelledby', 'language-tab-hasil');
		await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
		await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

		// Control row is one compact row of three columns sharing the same y
		const controlFields = hasilPane.locator('.control-row .control-field');
		await expect(controlFields).toHaveCount(3);
		const field0Box = (await controlFields.nth(0).boundingBox())!;
		const field1Box = (await controlFields.nth(1).boundingBox())!;
		const field2Box = (await controlFields.nth(2).boundingBox())!;
		expect(Math.abs(field0Box.y - field1Box.y)).toBeLessThanOrEqual(1);
		expect(Math.abs(field0Box.y - field2Box.y)).toBeLessThanOrEqual(1);

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

test('language phone layout: axe has no violation in every tab', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openLanguage(page);

	const tablist = page.locator('.workstation [role="tablist"]');
	const tabs = tablist.locator('[role="tab"]');

	// Tab 1: Editor (default)
	await expectNoAxeViolations(page);

	// Tab 0: Pustaka
	await tabs.nth(0).click();
	await expect(page.locator('#language-pane-pustaka')).toBeVisible();
	await expectNoAxeViolations(page);

	// Tab 2: Hasil
	await tabs.nth(2).click();
	await expect(page.locator('#language-pane-hasil')).toBeVisible();
	await expectNoAxeViolations(page);
});

test('at 1280x800 on the desktop project, language workstation shows splitters and no tab strip', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await openLanguage(page);

	// AC9: Splitters visible on desktop
	const splitters = page.locator('.workstation .splitter');
	await expect(splitters).toHaveCount(2);
	await expect(splitters.first()).toBeVisible();

	// AC9: Tab strip hidden on desktop
	const tabStrip = page.locator('.workstation-phone-tabs');
	await expect(tabStrip).toBeHidden();
});

test('at 1280x800 and 390x844 on the desktop project: landmarks on laptop, tab panels on phone, and resize across 900px', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await openLanguage(page);

	// AC1: at 1280x800: no element has role="tabpanel" among the three columns; exactly one complementary and two region landmarks, each with its name; tab strip not visible
	const tabStrip = page.locator('.workstation-phone-tabs');
	await expect(tabStrip).toBeHidden();

	const cols = page.locator('.workstation > .col');
	await expect(cols).toHaveCount(3);
	for (const col of await cols.all()) {
		expect(await col.getAttribute('role')).not.toBe('tabpanel');
	}

	const complementary = page.locator('.workstation > .col[role="complementary"]');
	await expect(complementary).toHaveCount(1);
	await expect(complementary).toHaveAttribute('aria-label', /bahasa|language/i);
	expect(await complementary.getAttribute('aria-labelledby')).toBeNull();

	const regions = page.locator('.workstation > .col[role="region"]');
	await expect(regions).toHaveCount(2);
	await expect(regions.nth(0)).toHaveAttribute('aria-label', /editor/i);
	expect(await regions.nth(0).getAttribute('aria-labelledby')).toBeNull();
	await expect(regions.nth(1)).toHaveAttribute(
		'aria-label',
		/hasil|proper ordering|enumeration|output/i
	);
	expect(await regions.nth(1).getAttribute('aria-labelledby')).toBeNull();

	await expectNoAxeViolations(page);

	// AC3: roles change when the window is resized across 900 px, without a reload (tested at both sides, 900 and 901)
	// Resize to 900 (phone side)
	await page.setViewportSize({ width: 900, height: 800 });
	await expect(tabStrip).toBeVisible();

	// AC2: on phone, no column is a landmark
	await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
	await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

	// Shown column has role="tabpanel" and its aria-labelledby points to its tab (default is editor)
	const activeEditorCol = page.locator('#language-pane-editor');
	await expect(activeEditorCol).toHaveAttribute('role', 'tabpanel');
	await expect(activeEditorCol).toHaveAttribute('aria-labelledby', 'language-tab-editor');

	// Resize to 901 (laptop side)
	await page.setViewportSize({ width: 901, height: 800 });
	await expect(tabStrip).toBeHidden();
	for (const col of await cols.all()) {
		expect(await col.getAttribute('role')).not.toBe('tabpanel');
	}
	await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(1);
	await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(2);

	// Resize to 899 (phone side again)
	await page.setViewportSize({ width: 899, height: 800 });
	await expect(tabStrip).toBeVisible();
	await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
	await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);
	await expect(activeEditorCol).toHaveAttribute('role', 'tabpanel');

	// Resize back to 1280
	await page.setViewportSize({ width: 1280, height: 800 });
	await expect(tabStrip).toBeHidden();
	await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(1);
	await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(2);
});

test('on the desktop project, language preset titles respect locale', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await openLanguage(page);

	// Switch interface to English
	await page.locator('button[lang="en"]').click();

	// Preset in library shows its English title "Finite Set {ab, bc}"
	const finitePreset = page.locator('.item-btn', { hasText: 'Finite Set {ab, bc}' });
	await expect(finitePreset).toBeVisible();

	// Switch back to Indonesian
	await page.locator('button[lang="id"]').click();
	const finitePresetId = page.locator('.item-btn', { hasText: 'Himpunan Hingga {ab, bc}' });
	await expect(finitePresetId).toBeVisible();
});
