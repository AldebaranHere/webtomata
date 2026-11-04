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

test.describe('grammar rule rows on touch phone (390x844)', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(!isMobile, 'phone only');
	});

	test('AC1 & AC5: 44px targets, table semantics, and axe on phone', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openGrammar(page);

		const editorPane = page.locator('#grammar-pane-editor');
		await expect(editorPane).toBeVisible();

		// Default preset (CNF_ORDER) has 3 rows:
		// S -> a | A B
		// A -> a
		// B -> B b
		const table = page.getByRole('table');
		await expect(table).toBeVisible();

		// AC5 semantics:
		// 1 row for the header and 1 per rule (3 rules -> 4 rows total)
		await expect(table.locator('thead').getByRole('row')).toHaveCount(1);
		await expect(table.locator('tbody').getByRole('row')).toHaveCount(3);
		await expect(table.getByRole('row')).toHaveCount(4);
		await expect(table.getByRole('columnheader')).toHaveCount(3);

		// Focus first row's alternative to display contextual symbol bar
		const firstAlt = page.locator('.alt-cell-input').first();
		await firstAlt.click();
		const symbolBar = page.locator('.inline-symbol-bar');
		await expect(symbolBar).toBeVisible();

		// AC1 measurements:
		// 1. Left-hand boxes (height >= 44)
		const lhsInputs = page.locator('.lhs-input');
		const lhsCount = await lhsInputs.count();
		expect(lhsCount).toBe(3);
		for (let i = 0; i < lhsCount; i++) {
			const box = await lhsInputs.nth(i).boundingBox();
			expect(box).not.toBeNull();
			expect(box!.height).toBeGreaterThanOrEqual(43.5);
			expect(box!.width).toBeGreaterThanOrEqual(71.5);
		}

		// 2. Every alternative box (height >= 44, width >= 64)
		const altInputs = page.locator('.alt-cell-input');
		const altCount = await altInputs.count();
		expect(altCount).toBeGreaterThanOrEqual(3);
		for (let i = 0; i < altCount; i++) {
			const box = await altInputs.nth(i).boundingBox();
			expect(box).not.toBeNull();
			expect(box!.height).toBeGreaterThanOrEqual(43.5);
			expect(box!.width).toBeGreaterThanOrEqual(63.5);
		}

		// 3. Every "+" button (width >= 44, height >= 44)
		const addAltBtns = page.locator('.btn-add-alt');
		const addAltCount = await addAltBtns.count();
		expect(addAltCount).toBe(3);
		for (let i = 0; i < addAltCount; i++) {
			const box = await addAltBtns.nth(i).boundingBox();
			expect(box).not.toBeNull();
			expect(box!.width).toBeGreaterThanOrEqual(43.5);
			expect(box!.height).toBeGreaterThanOrEqual(43.5);
		}

		// 4. Every delete button (width >= 44, height >= 44)
		const deleteBtns = page.locator('.btn-delete-row');
		const deleteCount = await deleteBtns.count();
		expect(deleteCount).toBe(3);
		for (let i = 0; i < deleteCount; i++) {
			const box = await deleteBtns.nth(i).boundingBox();
			expect(box).not.toBeNull();
			expect(box!.width).toBeGreaterThanOrEqual(43.5);
			expect(box!.height).toBeGreaterThanOrEqual(43.5);
		}

		// 5. Every symbol button of the active row (width >= 44, height >= 44)
		const symBtns = symbolBar.locator('.inline-sym-btn');
		const symCount = await symBtns.count();
		expect(symCount).toBeGreaterThan(0);
		for (let i = 0; i < symCount; i++) {
			const box = await symBtns.nth(i).boundingBox();
			expect(box).not.toBeNull();
			expect(box!.width).toBeGreaterThanOrEqual(43.5);
			expect(box!.height).toBeGreaterThanOrEqual(43.5);
		}

		// 6. "+ Tambah Baris" (height >= 44, full width)
		const addRowBtn = page.locator('.btn-add-row');
		const addRowBox = await addRowBtn.boundingBox();
		expect(addRowBox).not.toBeNull();
		expect(addRowBox!.height).toBeGreaterThanOrEqual(43.5);

		// Axe check with row focused / symbol bar showing
		await expectNoAxeViolations(page);
	});

	test('AC2: delete button removes row, updates notation, leaves empty S, and moves focus', async ({
		page
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await openGrammar(page);

		const rows = page.locator('.matrix-row');
		await expect(rows).toHaveCount(3);

		// Initial math card preview contains S, A, B
		const mathCard = page.locator('.math-card');
		await expect(mathCard).toContainText('S');
		await expect(mathCard).toContainText('A');
		await expect(mathCard).toContainText('B');

		// 1. Delete middle row (row 1, A -> a)
		const deleteBtnRow1 = rows.nth(1).locator('.btn-delete-row');
		await deleteBtnRow1.click();

		await expect(rows).toHaveCount(2);
		// Row 0 is S, row 1 is now B
		await expect(rows.nth(0).locator('.lhs-input')).toHaveValue('S');
		await expect(rows.nth(1).locator('.lhs-input')).toHaveValue('B');

		// Focus moved to first alternative of row that now has the same index (index 1, B)
		const row1FirstAlt = rows.nth(1).locator('.alt-cell-input').first();
		await expect(row1FirstAlt).toBeFocused();

		// Math preview updated (A is gone)
		await expect(mathCard).not.toContainText('A →');

		// 2. Delete last row (now index 1, B)
		const deleteBtnRowLast = rows.nth(1).locator('.btn-delete-row');
		await deleteBtnRowLast.click();

		await expect(rows).toHaveCount(1);
		await expect(rows.nth(0).locator('.lhs-input')).toHaveValue('S');

		// Focus moved to first alternative of previous row (index 0, S)
		const row0FirstAlt = rows.nth(0).locator('.alt-cell-input').first();
		await expect(row0FirstAlt).toBeFocused();

		// 3. Delete only remaining row (index 0, S)
		const deleteBtnOnlyRow = rows.nth(0).locator('.btn-delete-row');
		await deleteBtnOnlyRow.click();

		// Deleting the only row leaves one empty row S
		await expect(rows).toHaveCount(1);
		await expect(rows.nth(0).locator('.lhs-input')).toHaveValue('S');
		await expect(rows.nth(0).locator('.alt-cell-input').first()).toHaveValue('');

		// Focus moves to first alternative of that row
		await expect(rows.nth(0).locator('.alt-cell-input').first()).toBeFocused();
	});
});

test.describe('grammar rule rows on desktop (1280x800)', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'desktop only');
	});

	test('AC3 & AC5: desktop layout hides delete button, shows column headers, and passes axe', async ({
		page
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await openGrammar(page);

		// Delete buttons must not be visible on desktop
		const deleteBtns = page.locator('.btn-delete-row');
		const deleteCount = await deleteBtns.count();
		for (let i = 0; i < deleteCount; i++) {
			await expect(deleteBtns.nth(i)).toBeHidden();
		}

		// Column headers are visible
		await expect(page.locator('.th-lhs')).toBeVisible();
		const lhsHeaderBox = await page.locator('.th-lhs').boundingBox();
		expect(lhsHeaderBox).not.toBeNull();
		expect(lhsHeaderBox!.height).toBeGreaterThan(10);
		expect(lhsHeaderBox!.width).toBeGreaterThan(10);

		await expect(page.locator('.th-arrow')).toBeVisible();
		await expect(page.locator('.th-rhs')).toBeVisible();

		// Focus a row to open symbol bar on desktop and run axe
		const firstAlt = page.locator('.alt-cell-input').first();
		await firstAlt.click();
		await expect(page.locator('.inline-symbol-bar')).toBeVisible();

		await expectNoAxeViolations(page);
	});
});

test.describe('grammar rule rows on touch screen wider than 900px (AC4)', () => {
	test.use({ hasTouch: true, isMobile: true, viewport: { width: 1024, height: 768 } });

	test('AC4: touch screen at 1024x768 gets touch layout if pointer is coarse', async ({ page }) => {
		await page.goto('/sandbox');
		const isCoarse = await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);

		if (!isCoarse) {
			// As stated in AC4: "If Playwright cannot make it true, say so in REPORT.md,
			// keep the assertion for the 390 px case, and the owner checks a tablet; do not fake it."
			test.skip(true, 'Playwright browser does not report pointer: coarse for 1024x768 tablet');
			return;
		}

		await openGrammar(page);
		const deleteBtns = page.locator('.btn-delete-row');
		await expect(deleteBtns.first()).toBeVisible();
		const delBox = await deleteBtns.first().boundingBox();
		expect(delBox).not.toBeNull();
		expect(delBox!.height).toBeGreaterThanOrEqual(43.5);
		expect(delBox!.width).toBeGreaterThanOrEqual(43.5);

		const altInput = page.locator('.alt-cell-input').first();
		const altBox = await altInput.boundingBox();
		expect(altBox).not.toBeNull();
		expect(altBox!.height).toBeGreaterThanOrEqual(43.5);
	});
});
