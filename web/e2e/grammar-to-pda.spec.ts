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

async function openToPdaTab(page: Page, isMobile: boolean) {
	if (isMobile) {
		await page.locator('#grammar-tab-topda').click();
	} else {
		await page.locator('.tabs-header .tab-btn', { hasText: 'Ke PDA' }).click();
	}
	await expect(page.locator('#grammar-pane-topda')).toBeVisible();
}

async function selectPreset(page: Page, isMobile: boolean, presetId: string) {
	if (isMobile) {
		await page.locator('#grammar-tab-pustaka').click();
	}
	await page.locator('.preset-card', { hasText: presetId }).click();
	if (isMobile) {
		await expect(page.locator('#grammar-pane-editor')).toBeVisible();
	}
}

async function enterAnbnEpsilon(page: Page, isMobile: boolean) {
	// CFG_ANBN has 1 row: S -> aSb | ab. Replace the second cell with ε -> S -> aSb | ε.
	await selectPreset(page, isMobile, 'CFG_ANBN');
	const firstRow = page.locator('.matrix-row').first();
	await firstRow.locator('.alt-cell-input').nth(1).fill('ε');
	await page.locator('.editor-col .col-title').click();
}

async function enterBadSymbolClash(page: Page, isMobile: boolean) {
	// Start from CFG_ANBN (1 row, 2 cells), replace cell 0 with a<a> and delete cell 1.
	await selectPreset(page, isMobile, 'CFG_ANBN');
	const firstRow = page.locator('.matrix-row').first();
	await firstRow.locator('.alt-cell-input').nth(0).fill('a<a>');
	const secondCell = firstRow.locator('.alt-cell-input').nth(1);
	await secondCell.fill('');
	await secondCell.press('Backspace');
	await page.locator('.editor-col .col-title').click();
}

test('AC1, AC2, AC3, AC5: F-ANBN top-down & bottom-up stepper, method switch (B1), open as PDA (B3, B4, B5), axe', async ({
	page,
	isMobile
}) => {
	await openGrammar(page);

	if (!isMobile) {
		const tabBtns = page.locator('.tabs-header .tab-btn');
		await expect(tabBtns).toHaveCount(3);
		await expect(tabBtns.nth(0)).toHaveText('Transformasi CNF (6 Fase)');
		await expect(tabBtns.nth(1)).toHaveText('Uji String (CYK)');
		await expect(tabBtns.nth(2)).toHaveText('Ke PDA');
	}

	// Enter F-ANBN: S -> aSb | ε
	await enterAnbnEpsilon(page, isMobile);
	await openToPdaTab(page, isMobile);

	const pane = page.locator('#grammar-pane-topda');
	const topdownRadio = pane.getByRole('radio', { name: 'Atas-bawah' });
	const bottomupRadio = pane.getByRole('radio', { name: 'Bawah-atas' });
	await expect(topdownRadio).toHaveAttribute('aria-checked', 'true');
	await expect(bottomupRadio).toHaveAttribute('aria-checked', 'false');

	// Build top-down PDA
	await pane.getByRole('button', { name: 'Buat PDA' }).click();
	await expect(pane.locator('.step-counter')).toHaveText('Langkah 1 dari 5');

	const expectedTopdown = ['ε / ε / S', 'ε / S / aSb', 'ε / S / ε', 'a / a / ε', 'b / b / ε'];
	for (let i = 0; i < expectedTopdown.length; i++) {
		await expect(pane.locator('.step-counter')).toHaveText(`Langkah ${i + 1} dari 5`);
		await expect(pane.locator('.step-sentence')).not.toBeEmpty();
		await expect(pane.locator('.added-row .row-label')).toHaveText(expectedTopdown[i]!);
		if (i > 0) {
			await expect(pane.locator('.earlier-list .transition-row')).toHaveCount(i);
		}
		if (i < expectedTopdown.length - 1) {
			await pane.getByRole('button', { name: 'Selanjutnya' }).click();
		}
	}

	// Top-down does NOT show the bottom-up ε-rule warning
	await expect(pane.locator('.epsilon-note')).toHaveCount(0);
	await expect(pane.getByRole('button', { name: 'Buka sebagai PDA baru' })).toBeVisible();
	await expectNoAxeViolations(page);

	// B1: Switch method via ArrowRight keyboard navigation on radiogroup -> restarts at step 1
	await topdownRadio.focus();
	await page.keyboard.press('ArrowRight');
	await expect(bottomupRadio).toHaveAttribute('aria-checked', 'true');
	await expect(pane.locator('.step-counter')).toHaveText('Langkah 1 dari 5');

	const expectedBottomup = ['a / ε / a', 'b / ε / b', 'ε / bSa / S', 'ε / ε / S', 'ε / S / ε'];
	for (let i = 0; i < expectedBottomup.length; i++) {
		await expect(pane.locator('.step-counter')).toHaveText(`Langkah ${i + 1} dari 5`);
		await expect(pane.locator('.added-row .row-label')).toHaveText(expectedBottomup[i]!);
		if (i < expectedBottomup.length - 1) {
			await pane.getByRole('button', { name: 'Selanjutnya' }).click();
		}
	}

	// Bottom-up WITH ε-rule shows the warning note
	await expect(pane.locator('.epsilon-note')).toBeVisible();
	await expectNoAxeViolations(page);

	// AC5 (B3, B4, B5): Open as a new PDA
	await pane.getByRole('button', { name: 'Buka sebagai PDA baru' }).click();

	// Mode switches to PDA
	await expect(page).toHaveURL(/mode=pda/);
	await expect(page.locator('.pda-editor, .editor')).toBeVisible();

	// Title includes "(PDA bawah-atas)"
	await expect(page.getByText('(PDA bawah-atas)')).toBeVisible();

	// B4: Diagram has 2 states (p, q) at distinct positions
	const stateGroups = page.locator('svg g[data-state]');
	await expect(stateGroups).toHaveCount(2);
	const box0 = await stateGroups.nth(0).boundingBox();
	const box1 = await stateGroups.nth(1).boundingBox();
	expect(box0).not.toBeNull();
	expect(box1).not.toBeNull();
	expect(Math.hypot(box1!.x - box0!.x, box1!.y - box0!.y)).toBeGreaterThan(20);

	// B3: Check transition count in Tabel tab equals 5
	await page.getByRole('tab', { name: 'Tabel' }).click();
	await expect(page.getByRole('heading', { name: 'Transisi (5)' })).toBeVisible();

	// B5: Switch back to Grammar mode and verify grammar text is unchanged
	const switcher = page.locator('.switcher-trigger');
	await switcher.click();
	await page.getByRole('option', { name: /Tata Bahasa/ }).click();
	await page.locator('.workstation').waitFor();
	if (isMobile) {
		await page.locator('#grammar-tab-editor').click();
	}
	const rowAlts = page.locator('.matrix-row').first().locator('.alt-cell-input');
	await expect(rowAlts).toHaveCount(2);
	await expect(rowAlts.nth(0)).toHaveValue('aSb');
	await expect(rowAlts.nth(1)).toHaveValue('ab');
});

test('AC4 (B2): editing the grammar clears the conversion result so no stale answer is shown', async ({
	page,
	isMobile
}) => {
	await openGrammar(page);
	await enterAnbnEpsilon(page, isMobile);
	await openToPdaTab(page, isMobile);

	const pane = page.locator('#grammar-pane-topda');
	await pane.getByRole('button', { name: 'Buat PDA' }).click();
	await expect(pane.locator('.step-counter')).toHaveText('Langkah 1 dari 5');

	// Edit grammar text
	if (isMobile) {
		await page.locator('#grammar-tab-editor').click();
	}
	await page.locator('.matrix-row').first().locator('.alt-cell-input').first().fill('a');
	await openToPdaTab(page, isMobile);

	// Result is cleared; Buat PDA button is back and no step counter is shown
	await expect(pane.locator('.step-counter')).toHaveCount(0);
	await expect(pane.getByRole('button', { name: 'Buat PDA' })).toBeVisible();
});

test('AC6 (B6): bottom-up note hidden without ε-rule; F-BAD shows calm refusal and passes axe', async ({
	page,
	isMobile
}) => {
	await openGrammar(page);

	// Select CFG_ANBN preset (S -> aSb | ab, no ε-rule)
	if (isMobile) {
		await page.locator('#grammar-tab-pustaka').click();
	}
	await page.locator('.preset-card', { hasText: 'CFG_ANBN' }).click();
	await openToPdaTab(page, isMobile);

	const pane = page.locator('#grammar-pane-topda');
	await pane.getByRole('radio', { name: 'Bawah-atas' }).click();
	await pane.getByRole('button', { name: 'Buat PDA' }).click();
	await expect(pane.locator('.step-counter')).toBeVisible();
	// B6: No ε-rule -> note MUST NOT appear
	await expect(pane.locator('.epsilon-note')).toHaveCount(0);

	// F-BAD: S -> a<a> (symbol_clash, no space so matrix editor keeps it in one cell)
	await enterBadSymbolClash(page, isMobile);
	await openToPdaTab(page, isMobile);
	await pane.getByRole('button', { name: 'Buat PDA' }).click();

	await expect(pane.locator('.refusal-box')).toBeVisible();
	await expect(pane.locator('.refusal-box')).toContainText('a');
	await expect(pane.locator('.step-counter')).toHaveCount(0);
	await expectNoAxeViolations(page);
});

test('AC1, AC7 (B7): phone strip has 5 single-line items at 360px, >= 44px targets, no sideways scroll', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'phone layout check');
	await page.setViewportSize({ width: 360, height: 780 });
	await openGrammar(page);

	const tablist = page.locator('.workstation [role="tablist"]');
	const tabs = tablist.locator('[role="tab"]');
	await expect(tabs).toHaveCount(5);

	const metrics = await tabs.evaluateAll((els) =>
		els.map((el) => {
			const r = el.getBoundingClientRect();
			return {
				text: el.textContent?.trim() ?? '',
				y: Math.round(r.y),
				width: r.width,
				height: r.height,
				scrollWidth: el.scrollWidth,
				clientWidth: el.clientWidth
			};
		})
	);

	// B7: All 5 tabs on one single row, each single-line height ~44px and >= 44x44 touch target
	const distinctRows = new Set(metrics.map((m) => m.y));
	expect(distinctRows.size).toBe(1);
	for (const m of metrics) {
		expect(m.width, m.text).toBeGreaterThanOrEqual(43.5);
		expect(m.height, m.text).toBeGreaterThanOrEqual(43.5);
		expect(m.height, `${m.text} should not wrap to two lines`).toBeLessThanOrEqual(48);
	}

	// Open Ke PDA tab and verify controls >= 44px and no sideways scroll at 360px
	await page.locator('#grammar-tab-topda').click();
	const pane = page.locator('#grammar-pane-topda');
	const buildBtn = pane.getByRole('button', { name: 'Buat PDA' });
	const buildBox = await buildBtn.boundingBox();
	expect(buildBox).not.toBeNull();
	expect(buildBox!.height).toBeGreaterThanOrEqual(44);

	await buildBtn.click();
	await expect(pane.locator('.step-counter')).toBeVisible();

	const hasHorizontalScroll = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
	expect(hasHorizontalScroll).toBe(false);
});
