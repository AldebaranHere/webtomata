import { expect, expectNoAxeViolations, openPda, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

/**
 * T-077: the label sheet of the PDA editor fills the width of a phone and keeps its buttons above
 * the on-screen keyboard (docs/agent/PLAN.md, task T-077; `design/screens/pda-editor.md`, section 8).
 *
 * Playwright has no on-screen keyboard. The keyboard's visible part was measured on the owner's phone
 * on 2026-11-18: it begins 190 css px below the top of the sheet. The page is not resized while the
 * keyboard is open (the viewport meta has no `interactive-widget`), so the sheet keeps its place and
 * only its top part is visible: what the fixtures measure is the distance from the top of the sheet
 * to the bottom of the Save button, not "inside the viewport" (the buttons are inside the viewport
 * even without a keyboard, so a visibility test could not fail).
 */
const KEYBOARD_LINE = 190;

// The two phone widths of the design: the emulated one and the narrowest phone it names.
const PHONE_SIZES = [
	{ width: 375, height: 667 },
	{ width: 360, height: 740 }
] as const;

async function activate(page: Page, name: RegExp, mobile: boolean): Promise<void> {
	const button = page.getByRole('button', { name });
	if (mobile) await button.tap();
	else await button.click();
}

async function addTwoStates(page: Page, mobile: boolean): Promise<void> {
	await activate(page, /^Tambah state/, mobile);
	const stage = page.locator('.stage svg');
	if (mobile) {
		await stage.tap({ position: { x: 120, y: 100 } });
		await stage.tap({ position: { x: 260, y: 100 } });
	} else {
		await stage.click({ position: { x: 200, y: 200 } });
		await stage.click({ position: { x: 380, y: 200 } });
	}
}

/** Opens the label form on the edge from -> to with the Transisi tool. */
async function startEdge(page: Page, mobile: boolean, from: string, to: string): Promise<void> {
	await activate(page, /^Tambah transisi/, mobile);
	const state = (name: string) =>
		page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });
	if (mobile) {
		await state(from).tap();
		await state(to).tap();
	} else {
		await state(from).click();
		await state(to).click();
	}
	await expect(page.locator('.pda-label-form[role="dialog"]')).toBeVisible();
}

const form = (page: Page) => page.locator('.pda-label-form[role="dialog"]');

/** The DOM order that T-077 fixes: the last field, then the buttons, then add-row, then the hint. */
async function domOrder(page: Page) {
	return page.evaluate(() => {
		const el = document.querySelector('.pda-label-form');
		const lastInput = [...el!.querySelectorAll('.row-fields input')].at(-1)!;
		const actions = el!.querySelector('.actions')!;
		const addRow = el!.querySelector('.add-row-btn')!;
		const hint = el!.querySelector('.hint')!;
		const before = (a: Node, b: Node) =>
			Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
		return {
			actionsAfterLastField: before(lastInput, actions),
			actionsBeforeAddRow: before(actions, addRow),
			actionsBeforeHint: before(actions, hint)
		};
	});
}

test.describe('T-077: the sheet on a phone', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(!isMobile, 'phone project only');
	});

	for (const size of PHONE_SIZES) {
		test(`F1: the form fills the width of the sheet at ${size.width}px`, async ({ page }) => {
			await page.setViewportSize(size);
			await openPda(page);
			await addTwoStates(page, true);
			await startEdge(page, true, 'q0', 'q1');

			const sheet = page.locator('aside.pda-sheet');
			const sheetBox = (await sheet.boundingBox())!;
			const formBox = (await form(page).boundingBox())!;

			// The form is the sheet's content width (the aside has no side padding or border).
			expect(Math.abs(formBox.width - sheetBox.width)).toBeLessThanOrEqual(1);
			// The gap on the left is the gap on the right, both measured to the viewport.
			const leftGap = formBox.x;
			const rightGap = size.width - (formBox.x + formBox.width);
			expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
			expect(formBox.x).toBeGreaterThanOrEqual(0);
			expect(formBox.x + formBox.width).toBeLessThanOrEqual(size.width);
		});
	}

	test('F2: the buttons stay within the keyboard line, at one, two and three rows', async ({
		page
	}) => {
		await page.setViewportSize(PHONE_SIZES[0]);
		await openPda(page);
		await addTwoStates(page, true);
		await startEdge(page, true, 'q0', 'q1');

		const sheet = page.locator('aside.pda-sheet');
		const save = page.locator('.pda-label-form .btn-primary');
		const distance = async () => {
			const sheetBox = (await sheet.boundingBox())!;
			const saveBox = (await save.boundingBox())!;
			return saveBox.y + saveBox.height - sheetBox.y;
		};

		expect(await distance()).toBeLessThanOrEqual(KEYBOARD_LINE);

		const addRow = page.locator('.pda-label-form .add-row-btn');
		await addRow.tap();
		expect(await distance()).toBeLessThanOrEqual(KEYBOARD_LINE);
		await addRow.tap();
		expect(await distance()).toBeLessThanOrEqual(KEYBOARD_LINE);
	});

	test('F3: the action row follows the refusal and the fields, and the tab order says so', async ({
		page
	}) => {
		await page.setViewportSize(PHONE_SIZES[0]);
		await openPda(page);
		await addTwoStates(page, true);
		await startEdge(page, true, 'q0', 'q1');

		expect(await domOrder(page)).toEqual({
			actionsAfterLastField: true,
			actionsBeforeAddRow: true,
			actionsBeforeHint: true
		});

		// The tab order: the fields of the row, its Hapus, then Ketik ε, Batal, Simpan, add-row.
		await page.locator('.pda-label-form input').nth(2).focus();
		const expected = [/Hapus baris 1/, /Ketik ε/, /^Batal/, /Simpan/, /Transisi lain di antara/];
		for (const name of expected) {
			await page.keyboard.press('Tab');
			await expect(page.getByRole('button', { name })).toBeFocused();
		}

		// The refusal line stays above the buttons.
		await page.locator('.pda-label-form input').first().fill('ab');
		await page.getByRole('button', { name: /Simpan/ }).tap();
		await expect(page.locator('.pda-label-form .problem')).toBeVisible();
		const refusalAboveActions = await page.evaluate(() => {
			const el = document.querySelector('.pda-label-form')!;
			const problem = el.querySelector('.problem')!;
			const actions = el.querySelector('.actions')!;
			return Boolean(problem.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING);
		});
		expect(refusalAboveActions).toBe(true);
	});

	test('F4: the three inputs ask for the done key, and Enter commits from each of them', async ({
		page
	}) => {
		await page.setViewportSize(PHONE_SIZES[0]);
		await openPda(page);
		await addTwoStates(page, true);

		// Enter in Baca.
		await startEdge(page, true, 'q0', 'q1');
		await expect(page.locator('.pda-label-form input')).toHaveCount(3);
		expect(
			await page
				.locator('.pda-label-form input')
				.evaluateAll((els) => els.map((el) => el.getAttribute('enterkeyhint')))
		).toEqual(['done', 'done', 'done']);
		await page.locator('.pda-label-form input').first().fill('a');
		await page.keyboard.press('Enter');
		await expect(form(page)).toHaveCount(0);
		await expect(page.locator('.labels text.label').filter({ hasText: 'a / ε / ε' })).toHaveCount(
			1
		);

		// Enter in Pop.
		await startEdge(page, true, 'q1', 'q0');
		await page.locator('.pda-label-form input').nth(1).fill('A');
		await page.keyboard.press('Enter');
		await expect(form(page)).toHaveCount(0);
		await expect(page.locator('.labels text.label').filter({ hasText: 'ε / A / ε' })).toHaveCount(
			1
		);

		// Enter in Push.
		await startEdge(page, true, 'q1', 'q1');
		await page.locator('.pda-label-form input').nth(2).fill('B');
		await page.keyboard.press('Enter');
		await expect(form(page)).toHaveCount(0);
		await expect(page.locator('.labels text.label').filter({ hasText: 'ε / ε / B' })).toHaveCount(
			1
		);
	});

	test('F6: the rows list scrolls inside itself and a new row is scrolled into view', async ({
		page
	}) => {
		await page.setViewportSize(PHONE_SIZES[0]);
		await openPda(page);
		await addTwoStates(page, true);
		await startEdge(page, true, 'q0', 'q1');

		const rows = page.locator('.pda-label-form .rows');
		const addRow = page.locator('.pda-label-form .add-row-btn');

		for (const count of [2, 3]) {
			await addRow.tap();
			await expect(page.locator('.pda-label-form .row')).toHaveCount(count);

			const box = await rows.evaluate((el) => ({
				client: el.clientHeight,
				scroll: el.scrollHeight
			}));
			expect(box.client).toBeLessThanOrEqual(72);
			expect(box.scroll).toBeGreaterThan(box.client);

			// The new row is focused (its Baca field, as `addRow` does) and scrolled into view.
			const input = page.locator('.pda-label-form .row').last().locator('input').first();
			await expect(input).toBeFocused();
			const inputBox = (await input.boundingBox())!;
			const rowsBox = (await rows.boundingBox())!;
			expect(inputBox.y).toBeGreaterThanOrEqual(rowsBox.y - 1);
			expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(rowsBox.y + rowsBox.height + 1);
		}

		// Nothing scrolls the page sideways.
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			)
		).toBeLessThanOrEqual(0);
	});

	test('axe: no violation with the sheet open', async ({ page }) => {
		await page.setViewportSize(PHONE_SIZES[0]);
		await openPda(page);
		await addTwoStates(page, true);
		await startEdge(page, true, 'q0', 'q1');
		await expectNoAxeViolations(page);
	});
});

test.describe('T-077: the popover on a laptop', () => {
	test.beforeEach(({ isMobile }) => {
		test.skip(isMobile, 'desktop project only');
	});

	test('F3/F5: the popover keeps its order and is still 320 px wide', async ({ page }) => {
		await openPda(page);
		await addTwoStates(page, false);
		await startEdge(page, false, 'q0', 'q1');

		await expect(page.locator('aside.pda-sheet')).toHaveCount(0);
		const popover = page.locator('.pda-label-popover');
		await expect(popover).toBeVisible();
		const formBox = (await form(page).boundingBox())!;
		expect(formBox.width).toBe(320);

		expect(await domOrder(page)).toEqual({
			actionsAfterLastField: true,
			actionsBeforeAddRow: true,
			actionsBeforeHint: true
		});
	});
});
