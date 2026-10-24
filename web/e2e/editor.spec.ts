// The editor as a user meets it (S4b-1): build a machine with the mouse, move and delete states,
// undo, use the keyboard, and the touch. The rules have unit tests (src/lib/editor/interaction);
// this checks the browser: coordinates after a scroll, focus, the live region and touch targets.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';

const nodes = (page: Page) => page.locator('svg.world g.node');
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const status = (page: Page) => page.getByRole('status');

async function center(node: Locator) {
	const box = (await node.locator('circle.state').boundingBox())!;
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Clears the sample, so that tests start from an empty canvas (Select all, Delete). */
async function emptyCanvas(page: Page) {
	await page.goto('/sandbox');
	await canvas(page).focus();
	await page.keyboard.press('Control+a');
	await page.keyboard.press('Delete');
	await expect(nodes(page)).toHaveCount(0);
}

test('the Sandbox opens with the sample, and the page does not scroll', async ({ page }) => {
	await page.goto('/sandbox');
	await expect(nodes(page)).toHaveCount(3);
	await expect(page.getByRole('button', { name: 'State q0, start state' })).toBeVisible();
	await expect(page.locator('footer')).toHaveCount(0);
	const overflow = await page.evaluate(() => ({
		x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
		y: document.documentElement.scrollHeight - document.documentElement.clientHeight
	}));
	expect(overflow.x).toBeLessThanOrEqual(0);
	expect(overflow.y).toBeLessThanOrEqual(0);
	await expectNoAxeViolations(page);
});

test('a state appears where the pointer clicked, also after the canvas scrolled', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a mouse click');
	await emptyCanvas(page);
	await page.getByRole('button', { name: 'Tambah state' }).click();
	const area = (await canvas(page).boundingBox())!;
	await canvas(page).evaluate((el) => {
		el.scrollLeft = 130;
		el.scrollTop = 70;
	});
	const at = { x: area.x + 200, y: area.y + 150 };
	await page.mouse.click(at.x, at.y);
	await expect(nodes(page)).toHaveCount(1);
	const got = await center(nodes(page).first());
	expect(Math.abs(got.x - at.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(got.y - at.y)).toBeLessThanOrEqual(1);
	await expect(status(page)).toHaveText('State q0 ditambahkan.');
});

test('build four states with the mouse, drag one, and undo the drag', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a mouse');
	await emptyCanvas(page);
	await page.getByRole('button', { name: 'Tambah state' }).click();
	const area = (await canvas(page).boundingBox())!;
	for (const { dx, dy } of [
		{ dx: 120, dy: 120 },
		{ dx: 320, dy: 120 },
		{ dx: 120, dy: 300 },
		{ dx: 320, dy: 300 }
	]) {
		await page.mouse.click(area.x + dx, area.y + dy);
	}
	await expect(nodes(page)).toHaveCount(4);
	await page.getByRole('button', { name: 'Pilih' }).click();

	const first = nodes(page).first();
	const before = await center(first);
	await page.mouse.move(before.x, before.y);
	await page.mouse.down();
	await page.mouse.move(before.x + 60, before.y + 40, { steps: 6 });
	await page.mouse.up();
	const after = await center(first);
	expect(after.x).toBeGreaterThan(before.x + 30);
	// One drag is one undo step.
	await page.getByRole('button', { name: 'Urungkan' }).click();
	const undone = await center(first);
	expect(Math.abs(undone.x - before.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(undone.y - before.y)).toBeLessThanOrEqual(1);
	await expect(nodes(page)).toHaveCount(4);
});

test('the keyboard: Tab to a state, arrows, N, nudge, Delete and undo', async ({ page }) => {
	await page.goto('/sandbox');
	const q0 = page.getByRole('button', { name: 'State q0, start state' });
	await canvas(page).focus();
	await page.keyboard.press('Tab');
	await expect(q0).toBeFocused();
	await expect(q0).toHaveAttribute('aria-pressed', 'true');
	await expect(status(page)).toHaveText('q0 dipilih.');

	// Alt+Arrow moves the selected state.
	const before = await center(q0);
	await page.keyboard.press('Alt+ArrowRight');
	await page.keyboard.press('Alt+ArrowRight');
	const moved = await center(q0);
	expect(moved.x).toBeGreaterThan(before.x);

	await page.keyboard.press('n');
	await expect(nodes(page)).toHaveCount(4);
	await expect(status(page)).toHaveText('State q3 ditambahkan.');

	await page.keyboard.press('Delete');
	await expect(nodes(page)).toHaveCount(3);
	await expect(status(page)).toHaveText('State q3 dihapus.');
	await page.keyboard.press('Control+z');
	await expect(nodes(page)).toHaveCount(4);
	await expectNoAxeViolations(page);
});

test('the Hapus tool deletes the state that is pressed, and undo brings it back', async ({
	page
}) => {
	await page.goto('/sandbox');
	await page.getByRole('button', { name: 'Hapus' }).click();
	await page.getByRole('button', { name: 'State q2' }).click();
	await expect(nodes(page)).toHaveCount(2);
	await page.getByRole('button', { name: 'Urungkan' }).first().click();
	await expect(nodes(page)).toHaveCount(3);
});

test('touch: the tools are at least 44 px and a tap adds a state', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await emptyCanvas(page);
	for (const name of ['Pilih', 'Tambah state', 'Hapus', 'Urungkan', 'Ulangi']) {
		const box = await page.getByRole('button', { name }).first().boundingBox();
		expect(box?.height, name).toBeGreaterThanOrEqual(44);
		expect(box?.width, name).toBeGreaterThanOrEqual(44);
	}
	await page.getByRole('button', { name: 'Tambah state' }).click();
	const area = (await canvas(page).boundingBox())!;
	await page.touchscreen.tap(area.x + area.width / 2, area.y + area.height / 2);
	await expect(nodes(page)).toHaveCount(1);
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
	await expectNoAxeViolations(page);
});

test('the editor texts follow the language', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('webtomata.lang', 'en'));
	await page.goto('/sandbox');
	await expect(page.getByRole('application', { name: 'Machine canvas' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Undo' }).first()).toBeVisible();
});
