import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

test.beforeEach(({ isMobile }, testInfo) => {
	if (testInfo.title.includes('desktop project')) {
		test.skip(isMobile, 'desktop only');
	} else {
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
		await expect(editorPane).toHaveAttribute('role', 'tabpanel');
		await expect(editorPane).toHaveAttribute('aria-labelledby', 'grammar-tab-editor');
		await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
		await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

		// AC1: Tapping each tab shows its area and hides the others
		// Tab 0: Pustaka
		await tabs.nth(0).click();
		await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
		await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');
		const pustakaPane = page.locator('#grammar-pane-pustaka');
		await expect(pustakaPane).toBeVisible();
		await expect(editorPane).toBeHidden();
		await expect(pustakaPane).toHaveAttribute('role', 'tabpanel');
		await expect(pustakaPane).toHaveAttribute('aria-labelledby', 'grammar-tab-pustaka');
		await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
		await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

		// Tab 2: CNF
		await tabs.nth(2).click();
		await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
		const cnfPane = page.locator('#grammar-pane-cnf');
		await expect(cnfPane).toBeVisible();
		await expect(pustakaPane).toBeHidden();
		await expect(cnfPane).toHaveAttribute('role', 'tabpanel');
		await expect(cnfPane).toHaveAttribute('aria-labelledby', 'grammar-tab-cnf');
		await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
		await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

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
		await expect(cykPane).toHaveAttribute('role', 'tabpanel');
		await expect(cykPane).toHaveAttribute('aria-labelledby', 'grammar-tab-cyk');
		await expect(page.locator('.workstation > .col[role="complementary"]')).toHaveCount(0);
		await expect(page.locator('.workstation > .col[role="region"]')).toHaveCount(0);

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

test('grammar phone layout at 390x480: CNF stepper header remains sticky at 52px when scrolled to bottom', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 480 });
	await openGrammar(page);

	const tablist = page.locator('.workstation [role="tablist"]');
	const tabs = tablist.locator('[role="tab"]');

	// Select a preset whose CNF transformation has rich diffs and rules so the card overflows and scrolls
	await tabs.nth(0).click();
	await page.locator('.preset-card').nth(1).click();

	await tabs.nth(2).click();
	const cnfPane = page.locator('#grammar-pane-cnf');
	await expect(cnfPane).toBeVisible();

	// Go to step 2 which has nullable eliminations and extensive diffs
	await cnfPane.locator('.step-pill').nth(1).click();

	const stepperHeader = cnfPane.locator('.stepper-header');
	await expect(stepperHeader).toBeVisible();

	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

	const tablistStrip = page.locator('.workstation-phone-tabs');
	const tabBox = (await tablistStrip.boundingBox())!;
	const headerBox = (await stepperHeader.boundingBox())!;

	expect(Math.abs(headerBox.y - 52)).toBeLessThanOrEqual(1);
	expect(headerBox.y).toBeGreaterThanOrEqual(tabBox.y + tabBox.height - 1);
});

test('grammar phone layout: axe has no violation in every tab', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openGrammar(page);

	const tablist = page.locator('.workstation [role="tablist"]');
	const tabs = tablist.locator('[role="tab"]');

	// Tab 1: Editor (default)
	await expectNoAxeViolations(page);

	// Tab 0: Pustaka
	await tabs.nth(0).click();
	await expect(page.locator('#grammar-pane-pustaka')).toBeVisible();
	await expectNoAxeViolations(page);

	// Tab 2: CNF
	await tabs.nth(2).click();
	await expect(page.locator('#grammar-pane-cnf')).toBeVisible();
	await expectNoAxeViolations(page);

	// Tab 3: CYK
	await tabs.nth(3).click();
	await expect(page.locator('#grammar-pane-cyk')).toBeVisible();
	await expectNoAxeViolations(page);
});

test('at 1280x800 on the desktop project, grammar workstation shows splitters, no tab strip and no Ubah ke CNF button', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await openGrammar(page);

	// AC9: Splitters visible on desktop
	const splitters = page.locator('.workstation .splitter');
	await expect(splitters).toHaveCount(2);
	await expect(splitters.first()).toBeVisible();

	// AC9: Tab strip hidden on desktop
	const tabStrip = page.locator('.workstation-phone-tabs');
	await expect(tabStrip).toBeHidden();

	// AC12: "Ubah ke CNF" button hidden on desktop
	const shortcutBtn = page.locator('.btn-convert-cnf');
	await expect(shortcutBtn).toBeHidden();
});

test('at 1280x800 and 390x844 on the desktop project: landmarks on laptop, tab panels on phone, and resize across 900px', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await openGrammar(page);

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
	await expect(complementary).toHaveAttribute('aria-label', /tata bahasa|grammar/i);
	expect(await complementary.getAttribute('aria-labelledby')).toBeNull();

	const regions = page.locator('.workstation > .col[role="region"]');
	await expect(regions).toHaveCount(2);
	await expect(regions.nth(0)).toHaveAttribute('aria-label', /editor/i);
	expect(await regions.nth(0).getAttribute('aria-labelledby')).toBeNull();
	await expect(regions.nth(1)).toHaveAttribute('aria-label', /pemrosesan|processing|hasil/i);
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
	const activeEditorCol = page.locator('#grammar-pane-editor');
	await expect(activeEditorCol).toHaveAttribute('role', 'tabpanel');
	await expect(activeEditorCol).toHaveAttribute('aria-labelledby', 'grammar-tab-editor');

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

test('on the desktop project, grammar preset titles and custom titles respect locale', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await openGrammar(page);

	// Switch interface to English
	await page.locator('button[lang="en"]').click();

	// Preset in library shows its English title
	const palPreset = page.locator('.preset-card', { hasText: 'Palindromes {a, b}' });
	await expect(palPreset).toBeVisible();

	// Create a new grammar
	await page.locator('.btn-new').click();
	const editorHeader = page.locator('#grammar-pane-editor .col-header');
	await expect(editorHeader.locator('.active-item-title')).toHaveText(/^Grammar G\d+$/);

	// Switch back to Indonesian
	await page.locator('button[lang="id"]').click();
	await expect(editorHeader.locator('.active-item-title')).toHaveText(/^Grammar G\d+$/);
});
