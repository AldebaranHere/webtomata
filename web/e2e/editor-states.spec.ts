// S4b-2 in the browser: accepting and start, rename, the menu, the delete toast and the long-press.
// The rules have unit tests (src/lib/editor/interaction); this checks the focus, the keys that
// reach a field or not, the positions and the touch targets, which only a browser can show.
import { expect, expectNoAxeViolations, test, openSandbox } from './fixtures.ts';
import type { Page } from '@playwright/test';

const nodes = (page: Page) => page.locator('svg.world g.node');
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });
const status = (page: Page) => page.getByRole('status');
const menu = (page: Page) => page.getByRole('menu', { name: 'Menu state' });
const field = (page: Page) => page.getByRole('textbox', { name: 'Nama state' });

test.describe('accepting and start', () => {
	test('A and M act on the selected state, and undo brings them back', async ({ page }) => {
		await openSandbox(page);
		await state(page, 'q1').click();
		await page.keyboard.press('a');
		await expect(state(page, 'q1')).toHaveAttribute('aria-label', 'State q1, accepting state');
		await expect(status(page)).toHaveText('q1 menjadi accepting state.');
		await page.keyboard.press('m');
		await expect(state(page, 'q1')).toHaveAttribute(
			'aria-label',
			'State q1, start state, accepting state'
		);
		await expect(state(page, 'q0')).toHaveAttribute('aria-label', 'State q0');
		await page.keyboard.press('m');
		await expect(status(page)).toHaveText('Start state dilepas.');
		await page.keyboard.press('Control+z');
		await page.keyboard.press('Control+z');
		await page.keyboard.press('Control+z');
		await expect(state(page, 'q1')).toHaveAttribute('aria-label', 'State q1');
		await expect(state(page, 'q0')).toHaveAttribute('aria-label', 'State q0, start state');
	});

	test('M needs exactly one state', async ({ page }) => {
		await openSandbox(page);
		await page.getByRole('application', { name: 'Kanvas mesin' }).focus();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('m');
		await expect(status(page)).toHaveText('Pilih tepat satu state dulu.');
	});

	test('a double-click toggles accepting', async ({ page, isMobile }) => {
		test.skip(isMobile, 'a mouse');
		await openSandbox(page);
		await state(page, 'q1').dblclick();
		await expect(state(page, 'q1')).toHaveAttribute('aria-label', 'State q1, accepting state');
		await state(page, 'q1').dblclick();
		await expect(state(page, 'q1')).toHaveAttribute('aria-label', 'State q1');
		await expect(nodes(page)).toHaveCount(3);
	});
});

test.describe('rename', () => {
	test('Enter opens the field with the name selected, Enter sends, undo restores', async ({
		page
	}) => {
		await openSandbox(page);
		await state(page, 'q1').click();
		await page.keyboard.press('Enter');
		await expect(field(page)).toBeFocused();
		await expect(field(page)).toHaveValue('q1');
		const size = await field(page).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
		expect(size).toBeGreaterThanOrEqual(16);
		await page.keyboard.type('Genap');
		await page.keyboard.press('Enter');
		await expect(field(page)).toBeHidden();
		await expect(state(page, 'Genap')).toBeFocused();
		await expect(status(page)).toHaveText('Nama state menjadi Genap.');
		await page.keyboard.press('Control+z');
		await expect(state(page, 'q1')).toBeVisible();
	});

	test('the keys of the canvas do not reach the field', async ({ page }) => {
		await openSandbox(page);
		await state(page, 'q1').click();
		await page.keyboard.press('F2');
		await page.keyboard.type('amsnv');
		await page.keyboard.press('Delete');
		await expect(field(page)).toHaveValue('amsnv');
		await expect(nodes(page)).toHaveCount(3);
		await page.keyboard.press('Escape');
		await expect(field(page)).toBeHidden();
		await expect(state(page, 'q1')).toHaveAttribute('aria-label', 'State q1');
	});

	test('a refused name keeps the field open and says why; Esc leaves the name', async ({
		page
	}) => {
		await openSandbox(page);
		await state(page, 'q1').click();
		await page.keyboard.press('Enter');
		await page.keyboard.type('q2');
		await page.keyboard.press('Enter');
		await expect(field(page)).toBeVisible();
		await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByText('Nama q2 sudah dipakai state lain.').first()).toBeVisible();
		await expectNoAxeViolations(page);
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Backspace');
		await page.keyboard.press('Enter');
		await expect(page.getByText(/tidak boleh kosong/).first()).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(field(page)).toBeHidden();
		await expect(state(page, 'q1')).toBeFocused();
	});
});

test.describe('the menu', () => {
	test('a right-click on a state opens it; the arrows and Enter choose; Esc closes', async ({
		page,
		isMobile
	}) => {
		test.skip(isMobile, 'a mouse');
		await openSandbox(page);
		await state(page, 'q1').click({ button: 'right' });
		await expect(menu(page)).toBeVisible();
		const items = menu(page).getByRole('menuitem');
		await expect(items).toHaveCount(3); // rename, link, delete
		await expect(menu(page).getByRole('menuitemcheckbox')).toHaveCount(2); // start, accepting
		await expect(items.first()).toBeFocused();
		await expectNoAxeViolations(page);

		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Enter');
		await expect(menu(page)).toBeHidden();
		await expect(state(page, 'q1')).toHaveAttribute('aria-label', 'State q1, accepting state');

		await state(page, 'q1').click({ button: 'right' });
		await expect(menu(page).getByRole('menuitemcheckbox', { name: /Accepting/ })).toHaveAttribute(
			'aria-checked',
			'true'
		);
		await page.keyboard.press('Escape');
		await expect(menu(page)).toBeHidden();
		await expect(state(page, 'q1')).toBeFocused();
	});

	test('Ubah nama in the menu opens the field', async ({ page, isMobile }) => {
		test.skip(isMobile, 'a mouse');
		await openSandbox(page);
		await state(page, 'q2').click({ button: 'right' });
		await menu(page).getByRole('menuitem', { name: 'Ubah nama' }).click();
		await expect(field(page)).toBeFocused();
		await page.keyboard.press('Escape');
	});

	test('on empty canvas it adds a state where the pointer was', async ({ page, isMobile }) => {
		test.skip(isMobile, 'a mouse');
		await openSandbox(page);
		const area = (await page.getByRole('application', { name: 'Kanvas mesin' }).boundingBox())!;
		const at = { x: area.x + 60, y: area.y + 60 };
		await page.mouse.click(at.x, at.y, { button: 'right' });
		// Adding a state here, and auto layout (there are states to place).
		await expect(menu(page).getByRole('menuitem')).toHaveText([
			'Tambah state di sini',
			'Tata letak otomatis'
		]);
		await menu(page).getByRole('menuitem', { name: 'Tambah state di sini' }).click();
		await expect(nodes(page)).toHaveCount(4);
		const box = (await nodes(page).last().locator('circle.state').boundingBox())!;
		expect(Math.abs(box.x + box.width / 2 - at.x)).toBeLessThanOrEqual(1);
		expect(Math.abs(box.y + box.height / 2 - at.y)).toBeLessThanOrEqual(1);
	});

	test('a click outside closes it', async ({ page, isMobile }) => {
		test.skip(isMobile, 'a mouse');
		await openSandbox(page);
		await state(page, 'q0').click({ button: 'right' });
		await expect(menu(page)).toBeVisible();
		await page.mouse.click(5, 300);
		await expect(menu(page)).toBeHidden();
	});
});

test.describe('the delete toast', () => {
	test('names what was deleted, undoes it, and goes away by itself', async ({ page }) => {
		await openSandbox(page);
		await state(page, 'q2').click();
		await page.keyboard.press('Delete');
		const toast = page.getByRole('group', { name: 'Pesan' });
		await expect(toast).toContainText('State q2 dihapus.');
		const undo = toast.getByRole('button', { name: 'Urungkan' });
		const box = (await undo.boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.width).toBeGreaterThanOrEqual(44);
		await expectNoAxeViolations(page);
		await undo.click();
		await expect(nodes(page)).toHaveCount(3);
		await expect(toast).toBeHidden();

		await state(page, 'q2').click();
		await page.keyboard.press('Delete');
		await expect(toast).toBeVisible();
		await expect(toast).toBeHidden({ timeout: 9000 });
		await expect(nodes(page)).toHaveCount(2);
	});

	test('stays while the pointer is on it', async ({ page, isMobile }) => {
		test.skip(isMobile, 'a mouse');
		await openSandbox(page);
		await state(page, 'q2').click();
		await page.keyboard.press('Delete');
		const toast = page.getByRole('group', { name: 'Pesan' });
		await toast.hover();
		await page.waitForTimeout(7000);
		await expect(toast).toBeVisible();
		await page.mouse.move(300, 300);
		await expect(toast).toBeHidden({ timeout: 9000 });
	});
});

test('touch: a long-press on a state opens the menu, with targets of 44 px', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'a phone only');
	await openSandbox(page);
	const box = (await state(page, 'q1').locator('circle.state').boundingBox())!;
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
	await page.waitForTimeout(700);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await expect(menu(page)).toBeVisible();
	for (const item of await menu(page).getByRole('button').all()) {
		expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	}
	await expectNoAxeViolations(page);
	// Choosing an item works, and the lifted finger did not choose one.
	await menu(page)
		.getByRole('menuitemcheckbox', { name: /Accepting/ })
		.click();
	await expect(state(page, 'q1')).toHaveAttribute('aria-label', 'State q1, accepting state');
	await expect(nodes(page)).toHaveCount(3);
});
