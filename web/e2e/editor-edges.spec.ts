// S4c-2 in the browser: select, edit and delete an edge, by mouse, keyboard and finger, and the menu.
// The rules have unit tests; this checks the hit areas, the focus, the order of Tab and the touch.
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { touchLongPressAt, touchTapAt } from './touch.ts';

const nodes = (page: Page) => page.locator('svg.world g.node');
const labels = (page: Page) => page.locator('svg.world text.label');
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const status = (page: Page) => page.getByRole('status');
const box = (page: Page) => page.getByRole('textbox', { name: 'Simbol transisi' });
const menu = (page: Page) => page.getByRole('menu', { name: 'Menu state' });
const toast = (page: Page) => page.getByRole('group', { name: 'Pesan' });
const q = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });
const edgeButton = (page: Page) => page.getByRole('button', { name: /^Transisi dari q0 ke q1/ });

/**
 * The middle of the line of the (only) edge, where a pointer hits it. With `away`, a point that
 * far from the line, on the side away from the label: only the wide invisible line is there.
 */
function edgeMiddle(page: Page, away = 0) {
	return page.evaluate((distance) => {
		const line = document.querySelector<SVGPathElement>('g.edge path.line')!;
		const m = line.getScreenCTM()!;
		const length = line.getTotalLength();
		const at = line.getPointAtLength(length / 2);
		const ahead = line.getPointAtLength(length / 2 + 1);
		const dx = ahead.x - at.x;
		const dy = ahead.y - at.y;
		const size = Math.hypot(dx, dy) || 1;
		let nx = -dy / size;
		let ny = dx / size;
		const label = document.querySelector<SVGTextElement>('text.label')!;
		const lx = Number(label.getAttribute('x')) - at.x;
		const ly = Number(label.getAttribute('y')) - at.y;
		if (nx * lx + ny * ly > 0) {
			nx = -nx;
			ny = -ny;
		}
		const p = new DOMPoint(at.x + nx * distance, at.y + ny * distance).matrixTransform(m);
		return { x: p.x, y: p.y };
	}, away);
}

/** An empty canvas with q0 and q1 and one edge q0 → q1 with the symbols 0 and 1. */
async function withEdge(page: Page) {
	await openSandbox(page);
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Delete');
		expect(await nodes(page).count()).toBe(0);
	}).toPass();
	// Two states far enough apart that the line between them has room around it.
	await page.getByRole('button', { name: 'Tambah state', exact: true }).click();
	const area = (await canvas(page).boundingBox())!;
	await page.mouse.click(area.x + 80, area.y + 160);
	await page.mouse.click(area.x + area.width - 80, area.y + 160);
	await expect(nodes(page)).toHaveCount(2);
	await page.getByRole('button', { name: 'Tambah transisi', exact: true }).click();
	await q(page, 'q0').click();
	await q(page, 'q1').click();
	await expect(box(page)).toBeFocused();
	await page.keyboard.type('0, 1');
	await page.keyboard.press('Enter');
	await expect(labels(page)).toHaveText(['0, 1']);
	await page.getByRole('button', { name: 'Pilih', exact: true }).click();
}

test.describe('with a mouse', () => {
	test.beforeEach(({ isMobile }) => test.skip(isMobile, 'a mouse'));

	test('a click on the line selects the edge; a click on empty canvas and Esc clear it', async ({
		page
	}) => {
		await withEdge(page);
		const at = await edgeMiddle(page);
		await page.mouse.click(at.x, at.y);
		await expect(edgeButton(page)).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('g.edge.chosen')).toHaveCount(1);
		await expect(status(page)).toHaveText('Transisi dari q0 ke q1: 0, 1 dipilih.');
		await expect(edgeButton(page)).toBeFocused();
		await expectNoAxeViolations(page);
		await page.keyboard.press('Escape');
		await expect(page.locator('g.edge.chosen')).toHaveCount(0);
	});

	test('a click 15 px from the line, on the wide invisible line, selects the edge', async ({
		page
	}) => {
		await withEdge(page);
		const at = await edgeMiddle(page, 15);
		await page.mouse.click(at.x, at.y);
		await expect(edgeButton(page)).toHaveAttribute('aria-pressed', 'true');
	});

	test('a click on the label selects it too, and a state on the line wins over the line', async ({
		page
	}) => {
		await withEdge(page);
		await labels(page).first().click({ force: true });
		await expect(edgeButton(page)).toHaveAttribute('aria-pressed', 'true');
		await q(page, 'q0').click();
		await expect(q(page, 'q0')).toHaveAttribute('aria-pressed', 'true');
		await expect(edgeButton(page)).toHaveAttribute('aria-pressed', 'false');
	});

	test('Tab goes to the states first and then to the edges, and the edge is selected', async ({
		page
	}) => {
		await withEdge(page);
		await q(page, 'q1').click();
		await page.keyboard.press('Tab');
		await expect(edgeButton(page)).toBeFocused();
		await expect(edgeButton(page)).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Shift+Tab');
		await expect(q(page, 'q1')).toBeFocused();
	});

	test('Enter opens the symbols, a new text is sent, and the focus returns to the edge', async ({
		page
	}) => {
		await withEdge(page);
		const at = await edgeMiddle(page);
		await page.mouse.click(at.x, at.y);
		await page.keyboard.press('Enter');
		await expect(box(page)).toBeFocused();
		await expect(box(page)).toHaveValue('0, 1');
		await expectNoAxeViolations(page);
		await page.keyboard.press('Control+a');
		await page.keyboard.type('1');
		await page.keyboard.press('Enter');
		await expect(labels(page)).toHaveText(['1']);
		await expect(edgeButton(page)).toBeFocused();
		await expect(edgeButton(page)).toHaveAttribute('aria-pressed', 'true');
		await page.keyboard.press('Control+z');
		await expect(labels(page)).toHaveText(['0, 1']);
	});

	test('a double-click on the line edits it', async ({ page }) => {
		await withEdge(page);
		const at = await edgeMiddle(page);
		await page.mouse.dblclick(at.x, at.y);
		await expect(box(page)).toHaveValue('0, 1');
		await expect(nodes(page)).toHaveCount(2);
	});

	test('Delete removes the edge with a toast, and Urungkan brings it back', async ({ page }) => {
		await withEdge(page);
		const at = await edgeMiddle(page);
		await page.mouse.click(at.x, at.y);
		await page.keyboard.press('Delete');
		await expect(labels(page)).toHaveCount(0);
		await expect(toast(page)).toContainText('Transisi dari q0 ke q1 dihapus.');
		await expect(nodes(page)).toHaveCount(2);
		await toast(page).getByRole('button', { name: 'Urungkan' }).click();
		await expect(labels(page)).toHaveText(['0, 1']);
	});

	test('the Hapus tool deletes the edge that is pressed', async ({ page }) => {
		await withEdge(page);
		await page.getByRole('button', { name: 'Hapus', exact: true }).click();
		const at = await edgeMiddle(page);
		await page.mouse.click(at.x, at.y);
		await expect(labels(page)).toHaveCount(0);
		await expect(nodes(page)).toHaveCount(2);
	});

	test('in the State tool a click near the line adds a state, not a selection', async ({
		page
	}) => {
		await withEdge(page);
		await page.getByRole('button', { name: 'Tambah state', exact: true }).click();
		const at = await edgeMiddle(page);
		await page.mouse.click(at.x, at.y);
		await expect(nodes(page)).toHaveCount(3);
	});

	test('the menu of an edge: Ubah simbol and Hapus', async ({ page }) => {
		await withEdge(page);
		const at = await edgeMiddle(page);
		await page.mouse.click(at.x, at.y, { button: 'right' });
		await expect(menu(page).getByRole('menuitem')).toHaveText(['Ubah simbol', 'Hapus']);
		await expectNoAxeViolations(page);
		await menu(page).getByRole('menuitem', { name: 'Ubah simbol' }).click();
		await expect(box(page)).toHaveValue('0, 1');
		await page.keyboard.press('Escape');
		await page.mouse.click(at.x, at.y, { button: 'right' });
		await page.keyboard.press('Escape');
		await expect(menu(page)).toBeHidden();
		await expect(edgeButton(page)).toBeFocused();
	});

	test('the menu of a state has "Tambah transisi dari sini"', async ({ page }) => {
		await withEdge(page);
		await q(page, 'q1').click({ button: 'right' });
		await menu(page).getByRole('menuitem', { name: 'Tambah transisi dari sini' }).click();
		await expect(page.getByText('Pilih state tujuan.').first()).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Tambah transisi', exact: true })
		).toHaveAttribute('aria-pressed', 'true');
		await q(page, 'q0').click();
		await expect(box(page)).toBeFocused();
		await page.keyboard.type('1');
		await page.keyboard.press('Enter');
		await expect(labels(page)).toHaveCount(2);
	});
});

test.describe('with a finger, as a phone sends it', () => {
	test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'a phone only'));

	test('a tap 15 px from the line selects the edge', async ({ page }) => {
		await withEdge(page);
		await touchTapAt(page, await edgeMiddle(page, 15));
		await expect(edgeButton(page)).toHaveAttribute('aria-pressed', 'true');
		await expect(status(page)).toHaveText('Transisi dari q0 ke q1: 0, 1 dipilih.');
		await expectNoAxeViolations(page);
	});

	test('a long-press on the line opens the menu, and Ubah simbol opens a box that stays', async ({
		page
	}) => {
		await withEdge(page);
		await touchLongPressAt(page, await edgeMiddle(page));
		await expect(menu(page)).toBeVisible();
		for (const item of await menu(page).getByRole('menuitem').all()) {
			expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		}
		// A finger that is lifted just after a long-press must not choose an item (350 ms).
		await page.waitForTimeout(400);
		await menu(page).getByRole('menuitem', { name: 'Ubah simbol' }).click();
		await expect(box(page)).toBeFocused();
		await page.waitForTimeout(700);
		await expect(box(page)).toBeFocused();
	});

	test('Hapus on a tapped edge removes it, and the toast has a 44 px Urungkan', async ({
		page
	}) => {
		await withEdge(page);
		await page.getByRole('button', { name: 'Hapus', exact: true }).tap();
		await touchTapAt(page, await edgeMiddle(page));
		await expect(labels(page)).toHaveCount(0);
		const undo = toast(page).getByRole('button', { name: 'Urungkan' });
		const b = (await undo.boundingBox())!;
		expect(b.height).toBeGreaterThanOrEqual(44);
		await undo.click();
		await expect(labels(page)).toHaveText(['0, 1']);
	});
});
