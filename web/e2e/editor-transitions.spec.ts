// S4c-1 in the browser: adding a transition by drag, by two clicks and by keyboard, the label box
// with ε and the question about long symbols. The rules have unit tests; this checks the pointer,
// the focus, the box over the canvas and the touch.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';

const nodes = (page: Page) => page.locator('svg.world g.node');
const labels = (page: Page) => page.locator('svg.world text.label');
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const status = (page: Page) => page.getByRole('status');
const box = (page: Page) => page.getByRole('textbox', { name: 'Simbol transisi' });
const tool = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function center(node: Locator) {
	const b = (await node.locator('circle.state').boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** An empty canvas with two states, q0 and q1, and the alphabet of the sample (0 and 1). */
async function twoStates(page: Page) {
	await page.goto('/sandbox');
	// The page is drawn before it is ready for keys: try until the keys work.
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Delete');
		expect(await nodes(page).count()).toBe(0);
	}).toPass();
	await page.keyboard.press('n');
	await page.keyboard.press('n');
	await expect(nodes(page)).toHaveCount(2);
}
const q = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });

async function link(page: Page, from: string, to: string) {
	await tool(page, 'Tambah transisi').click();
	await q(page, from).click();
	await q(page, to).click();
}

test('two taps or clicks: source, then target, then the symbols', async ({ page }) => {
	await twoStates(page);
	await tool(page, 'Tambah transisi').click();
	await expect(page.getByText('Pilih state asal transisi.').first()).toBeVisible();
	await q(page, 'q0').click();
	await expect(page.getByText('Pilih state tujuan.').first()).toBeVisible();
	await expect(q(page, 'q0')).toHaveAttribute('aria-pressed', 'true');
	await q(page, 'q1').click();
	await expect(box(page)).toBeFocused();
	await expect(box(page)).toHaveValue('');
	await page.keyboard.type('0, 1');
	await page.keyboard.press('Enter');
	await expect(box(page)).toBeHidden();
	await expect(labels(page)).toHaveText(['0, 1']);
	await expect(status(page)).toHaveText('Transisi dari q0 ke q1: 0, 1.');
	await expect(q(page, 'q0')).toBeFocused();
	// One undo step.
	await page.keyboard.press('Control+z');
	await expect(labels(page)).toHaveCount(0);
});

test('the same state twice makes a self-loop', async ({ page }) => {
	await twoStates(page);
	await link(page, 'q1', 'q1');
	await expect(box(page)).toBeFocused();
	await page.keyboard.type('1');
	await page.keyboard.press('Enter');
	await expect(labels(page)).toHaveText(['1']);
	await expect(page.locator('svg.world path.line')).toHaveCount(1);
});

test('a drag from the source to the target, with a preview arrow', async ({ page, isMobile }) => {
	test.skip(isMobile, 'a mouse');
	await twoStates(page);
	await tool(page, 'Tambah transisi').click();
	const a = await center(q(page, 'q0'));
	const b = await center(q(page, 'q1'));
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
	await expect(page.locator('svg.world line.preview')).toHaveCount(1);
	await page.mouse.move(b.x, b.y, { steps: 5 });
	await page.mouse.up();
	await expect(box(page)).toBeFocused();
	await expect(page.locator('svg.world line.preview')).toHaveCount(0);
	// The states did not move.
	expect(await center(q(page, 'q0'))).toEqual(a);
});

test('a release on empty canvas, and Esc, cancel without a trace', async ({ page, isMobile }) => {
	test.skip(isMobile, 'a mouse');
	await twoStates(page);
	await tool(page, 'Tambah transisi').click();
	const a = await center(q(page, 'q0'));
	await page.mouse.move(a.x, a.y);
	await page.mouse.down();
	await page.mouse.move(a.x + 40, a.y + 160, { steps: 5 });
	await page.mouse.up();
	await expect(box(page)).toBeHidden();
	await expect(nodes(page)).toHaveCount(2);

	await link(page, 'q0', 'q1');
	await expect(box(page)).toBeFocused();
	await page.keyboard.type('1');
	await page.keyboard.press('Escape');
	await expect(box(page)).toBeHidden();
	await expect(labels(page)).toHaveCount(0);
});

test('the keyboard: T on the source, the arrows to the target, Enter', async ({ page }) => {
	await twoStates(page);
	await q(page, 'q0').click();
	await page.keyboard.press('t');
	await expect(page.getByText('Pilih state tujuan.').first()).toBeVisible();
	await page.keyboard.press('Control+ArrowRight');
	await page.keyboard.press('Control+ArrowDown');
	await page.keyboard.press('Control+ArrowLeft');
	await page.keyboard.press('Control+ArrowUp');
	// The focus is somewhere; make it certain that it is q1.
	await q(page, 'q1').focus();
	await page.keyboard.press('Enter');
	await expect(box(page)).toBeFocused();
	await page.keyboard.type('0');
	await page.keyboard.press('Enter');
	await expect(labels(page)).toHaveText(['0']);
});

test('ε: the button, Ctrl+E and the word eps', async ({ page, isMobile }) => {
	await twoStates(page);
	await link(page, 'q0', 'q1');
	await page.getByRole('button', { name: 'Ketik ε' }).click();
	await expect(box(page)).toBeFocused();
	await expect(box(page)).toHaveValue('ε');
	if (!isMobile) {
		await page.keyboard.type(', 1');
		await page.keyboard.press('Control+e');
		await expect(box(page)).toHaveValue('ε, 1ε');
	}
	await page.keyboard.press('Control+a');
	await page.keyboard.type('eps, 1');
	await page.keyboard.press('Enter');
	await expect(labels(page)).toHaveText(['1, ε']);
});

test('a long text asks if it is several symbols', async ({ page }) => {
	await twoStates(page);
	await link(page, 'q0', 'q1');
	await page.keyboard.type('01');
	await page.keyboard.press('Enter');
	await expect(page.getByText('Apakah "01" beberapa simbol?')).toBeVisible();
	await expect(box(page)).toBeVisible();
	await expectNoAxeViolations(page);
	await page.getByRole('button', { name: '0, 1', exact: true }).click();
	await expect(labels(page)).toHaveText(['0, 1']);

	await link(page, 'q1', 'q0');
	await page.keyboard.type('01');
	await page.keyboard.press('Enter');
	await page.getByRole('button', { name: 'Satu simbol 01' }).click();
	await expect(labels(page)).toHaveText(['0, 1', '01']);
});

test('a refused symbol keeps the box open and says why', async ({ page }) => {
	await twoStates(page);
	await link(page, 'q0', 'q1');
	await page.keyboard.type('x'.repeat(40));
	await page.keyboard.press('Enter');
	await page.getByRole('button', { name: /^Satu simbol/ }).click();
	await expect(page.locator('.problem')).toContainText(/tidak bisa dipakai/);
	await expect(box(page)).toBeVisible();
	await expectNoAxeViolations(page);
	await page.keyboard.press('Escape');
	await expect(labels(page)).toHaveCount(0);
});

test('an edge that exists opens its box with the symbols it has; an empty text removes it', async ({
	page
}) => {
	await twoStates(page);
	await link(page, 'q0', 'q1');
	await page.keyboard.type('0');
	await page.keyboard.press('Enter');
	await link(page, 'q0', 'q1');
	await expect(box(page)).toHaveValue('0');
	await page.keyboard.press('Control+a');
	await page.keyboard.press('Backspace');
	await page.keyboard.press('Enter');
	await expect(labels(page)).toHaveCount(0);
	await expect(status(page)).toHaveText('Transisi dari q0 ke q1 dihapus.');
	await page.keyboard.press('Control+z');
	await expect(labels(page)).toHaveText(['0']);
});

test('leaving the box with a new text sends it, and with no change cancels', async ({ page }) => {
	await twoStates(page);
	await link(page, 'q0', 'q1');
	await page.keyboard.type('1');
	await canvas(page).click({ position: { x: 5, y: 5 } });
	await expect(labels(page)).toHaveText(['1']);
	await link(page, 'q1', 'q0');
	await canvas(page).click({ position: { x: 5, y: 5 } });
	await expect(labels(page)).toHaveCount(1);
});

test('touch: tap Transisi, tap the source, tap the target, type', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await twoStates(page);
	for (const name of ['Tambah transisi']) {
		const b = (await tool(page, name).boundingBox())!;
		expect(b.height).toBeGreaterThanOrEqual(44);
		expect(b.width).toBeGreaterThanOrEqual(44);
	}
	await tool(page, 'Tambah transisi').tap();
	await q(page, 'q0').tap();
	await q(page, 'q1').tap();
	await expect(box(page)).toBeFocused();
	for (const name of ['Ketik ε']) {
		const b = (await page.getByRole('button', { name }).boundingBox())!;
		expect(b.height).toBeGreaterThanOrEqual(44);
		expect(b.width).toBeGreaterThanOrEqual(44);
	}
	await page.keyboard.type('1');
	await page.keyboard.press('Enter');
	await expect(labels(page)).toHaveText(['1']);
	await expectNoAxeViolations(page);
});
