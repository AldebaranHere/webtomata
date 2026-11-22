// T-083: cross-browser checks (Firefox, WebKit phone, and Chromium) for the PDA label sheet on a
// phone viewport: width fills the sheet, Simpan stays within the 190 px keyboard line at 1 and 3
// rows, and a newly added row's Baca field is focused and fully inside the scrollable .rows box.
import { expect, openPda, test } from '../fixtures.ts';
import type { Locator, Page } from '@playwright/test';

const PHONE = { width: 375, height: 667 };
const KEYBOARD_LINE = 190;

async function press(locator: Locator, isMobile: boolean): Promise<void> {
	if (isMobile) await locator.tap();
	else await locator.click();
}

async function openLabelSheet(page: Page, isMobile: boolean): Promise<void> {
	await page.setViewportSize(PHONE);
	await openPda(page);

	await press(page.getByRole('button', { name: /^Tambah state/ }), isMobile);
	const stage = page.locator('.stage svg');
	if (isMobile) {
		await stage.tap({ position: { x: 120, y: 100 } });
		await stage.tap({ position: { x: 260, y: 100 } });
	} else {
		await stage.click({ position: { x: 120, y: 100 } });
		await stage.click({ position: { x: 260, y: 100 } });
	}

	await press(page.getByRole('button', { name: /^Tambah transisi/ }), isMobile);
	await press(page.getByRole('button', { name: /^State q0(,|$)/ }), isMobile);
	await press(page.getByRole('button', { name: /^State q1(,|$)/ }), isMobile);
	await expect(page.locator('.pda-label-form[role="dialog"]')).toBeVisible();
}

test('F1: the form fills the width of the sheet at 375px', async ({ page, isMobile }) => {
	await openLabelSheet(page, isMobile);

	const sheetBox = (await page.locator('aside.pda-sheet').boundingBox())!;
	const formBox = (await page.locator('.pda-label-form[role="dialog"]').boundingBox())!;

	expect(Math.abs(formBox.width - sheetBox.width)).toBeLessThanOrEqual(1);
	const leftGap = formBox.x;
	const rightGap = PHONE.width - (formBox.x + formBox.width);
	expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
	expect(formBox.x).toBeGreaterThanOrEqual(0);
	expect(formBox.x + formBox.width).toBeLessThanOrEqual(PHONE.width);
});

test('F2: Simpan stays within 190 px of the top of the sheet at 1 and 3 rows', async ({
	page,
	isMobile
}) => {
	await openLabelSheet(page, isMobile);

	const sheet = page.locator('aside.pda-sheet');
	const save = page.locator('.pda-label-form .btn-primary');
	const distance = async () => {
		const sheetBox = (await sheet.boundingBox())!;
		const saveBox = (await save.boundingBox())!;
		return saveBox.y + saveBox.height - sheetBox.y;
	};

	expect(await distance()).toBeLessThanOrEqual(KEYBOARD_LINE);

	const addRow = page.locator('.pda-label-form .add-row-btn');
	await press(addRow, isMobile);
	await press(addRow, isMobile);
	await expect(page.locator('.pda-label-form .row')).toHaveCount(3);
	expect(await distance()).toBeLessThanOrEqual(KEYBOARD_LINE);
});

test('F3: the new row Baca field is focused and fully inside the rows list', async ({
	page,
	isMobile
}) => {
	await openLabelSheet(page, isMobile);

	const rows = page.locator('.pda-label-form .rows');
	const addRow = page.locator('.pda-label-form .add-row-btn');

	for (const count of [2, 3]) {
		await press(addRow, isMobile);
		await expect(page.locator('.pda-label-form .row')).toHaveCount(count);

		const box = await rows.evaluate((el) => ({
			client: el.clientHeight,
			scroll: el.scrollHeight
		}));
		expect(box.client).toBeLessThanOrEqual(72);
		expect(box.scroll).toBeGreaterThan(box.client);

		const input = page.locator('.pda-label-form .row').last().locator('input').first();
		await expect(input).toBeFocused();
		const inputBox = (await input.boundingBox())!;
		const rowsBox = (await rows.boundingBox())!;
		expect(inputBox.y).toBeGreaterThanOrEqual(rowsBox.y - 1);
		expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(rowsBox.y + rowsBox.height + 1);
	}
});
