import { expect, expectNoAxeViolations, test } from './fixtures.ts';
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

for (const viewport of [
	{ width: 360, height: 780 },
	{ width: 390, height: 844 }
]) {
	test(`grammar phone layout at ${viewport.width}x${viewport.height}: tabs, panels, touch targets, and scrolling`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await openGrammar(page);

		const tablist = page.locator('.workstation [role="tablist"]');
		await expect(tablist).toBeVisible();

		const tabs = tablist.locator('[role="tab"]');
		await expect(tabs).toHaveCount(4);
		await expect(tabs.nth(0)).toHaveText('Pustaka');
		await expect(tabs.nth(1)).toHaveText('Editor');
		await expect(tabs.nth(2)).toHaveText('CNF');
		await expect(tabs.nth(3)).toHaveText('CYK');

		// Default active tab is Editor
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
		const editorPane = page.locator('#grammar-pane-editor');
		await expect(editorPane).toBeVisible();
		await expect(editorPane).not.toHaveAttribute('hidden');

		// AC1: Tapping each tab shows its area and hides the others
		// Tab 0: Pustaka
		await tabs.nth(0).click();
		await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');
		const pustakaPane = page.locator('#grammar-pane-pustaka');
		await expect(pustakaPane).toBeVisible();
		await expect(editorPane).toBeHidden();

		// Tab 2: CNF
		await tabs.nth(2).click();
		await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
		const cnfPane = page.locator('#grammar-pane-cnf');
		await expect(cnfPane).toBeVisible();
		await expect(pustakaPane).toBeHidden();

		const cnfHtml = await cnfPane.innerHTML();
		console.log('CNF Pane text length:', cnfHtml.length, 'preview:', cnfHtml.slice(0, 200));

		// AC3: In CNF tab, title of phase and first chips are visible without scrolling
		const phaseTitle = cnfPane.locator('.step-title');
		await expect(phaseTitle).toBeVisible();
		const phaseBox = await phaseTitle.boundingBox();
		expect(phaseBox).not.toBeNull();
		expect(phaseBox!.y).toBeLessThan(viewport.height);

		// Sticky test for stepper header:
		// AC3: "After scrolling down the step card, the stepper header is still visible (a bounding-box test)."
		const stepperHeader = cnfPane.locator('.stepper-header');
		await expect(stepperHeader).toBeVisible();
		const initialHeaderBox = await stepperHeader.boundingBox();
		expect(initialHeaderBox).not.toBeNull();

		await page.evaluate(() => window.scrollBy(0, 300));
		const scrolledHeaderBox = await stepperHeader.boundingBox();
		expect(scrolledHeaderBox).not.toBeNull();
		expect(scrolledHeaderBox!.y).toBeGreaterThanOrEqual(0);
		expect(scrolledHeaderBox!.y).toBeLessThan(viewport.height);

		// Tab 3: CYK
		await tabs.nth(3).click();
		await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
		const cykPane = page.locator('#grammar-pane-cyk');
		await expect(cykPane).toBeVisible();
		await expect(cnfPane).toBeHidden();

		// AC2: No element other than .table-scroll has vertical scroll of its own
		const verticalScrollers = await page.evaluate(() => {
			const elements = Array.from(document.querySelectorAll('*'));
			const scrolling: string[] = [];
			for (const el of elements) {
				if (el.closest('.table-scroll')) continue;
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

test('grammar phone layout: preset selection jumps to editor, shortcut button, arrow keys, and axe', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openGrammar(page);

	const tablist = page.locator('.workstation [role="tablist"]');
	const tabs = tablist.locator('[role="tab"]');

	// Switch to Pustaka tab
	await tabs.nth(0).click();
	const pustakaPane = page.locator('#grammar-pane-pustaka');
	await expect(pustakaPane).toBeVisible();

	// AC7: Tapping a preset selects it, moves to Editor, and header shows its name
	const presetCards = pustakaPane.locator('.preset-card');
	const secondPreset = presetCards.nth(1);
	const presetTitle = await secondPreset.locator('.card-title').innerText();
	await secondPreset.click();

	// Should have jumped to Editor tab
	await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
	const editorPane = page.locator('#grammar-pane-editor');
	await expect(editorPane).toBeVisible();
	const editorHeader = editorPane.locator('.col-header');
	await expect(editorHeader).toContainText(presetTitle);

	// AC12: In grammar Editor tab, button "Ubah ke CNF" is at the end, full width (>= 300px), >= 44px high, and clicking it opens CNF tab
	const shortcutBtn = editorPane.locator('.btn-convert-cnf');
	await expect(shortcutBtn).toBeVisible();
	await expect(shortcutBtn).toHaveText('Ubah ke CNF');
	const btnBox = (await shortcutBtn.boundingBox())!;
	expect(btnBox.height).toBeGreaterThanOrEqual(43.5);
	expect(btnBox.width).toBeGreaterThanOrEqual(300);
	await shortcutBtn.click();
	await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#grammar-pane-cnf')).toBeVisible();

	// AC8: Arrow keys move between tabs
	await tabs.nth(2).focus();
	await page.keyboard.press('ArrowRight');
	await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
	await expect(tabs.nth(3)).toBeFocused();

	await page.keyboard.press('ArrowRight'); // wraps to 0
	await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
	await expect(tabs.nth(0)).toBeFocused();

	await page.keyboard.press('ArrowLeft'); // wraps to 3
	await expect(tabs.nth(3)).toHaveAttribute('aria-selected', 'true');
	await expect(tabs.nth(3)).toBeFocused();

	// Axe check on tab
	await expectNoAxeViolations(page);
});
