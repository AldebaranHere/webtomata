// S4d-1 in the browser: the camera. Zoom around the pointer, pan by wheel, drag and keys, the zoom
// control, the first view, and that a click lands on the canvas point under the pointer at every
// zoom. The maths has unit tests (interaction/camera.test.ts); this checks the browser.
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { touchDragAt, touchPinch, touchSession } from './touch.ts';

const nodes = (page: Page) => page.locator('svg.world g.node');
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const q = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });
const level = (page: Page) => page.getByRole('button', { name: 'Atur ke 100%' });
const zoomButton = (page: Page, name: string) =>
	page.getByRole('group', { name: 'Perbesaran' }).getByRole('button', { name, exact: true });

async function center(node: Locator) {
	const b = (await node.locator('circle.state').boundingBox())!;
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
const near = (a: { x: number; y: number }, b: { x: number; y: number }, by = 1) => {
	expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(by);
	expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(by);
};

async function emptyCanvas(page: Page) {
	await openSandbox(page);
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Delete');
		expect(await nodes(page).count()).toBe(0);
	}).toPass();
}

/** Two states far apart and one edge between them: nothing else is near its line. */
async function withEdge(page: Page) {
	await emptyCanvas(page);
	await page.getByRole('button', { name: 'Tambah state', exact: true }).click();
	const area = (await canvas(page).boundingBox())!;
	await page.mouse.click(area.x + 80, area.y + 160);
	await page.mouse.click(area.x + area.width - 80, area.y + 160);
	await page.getByRole('button', { name: 'Tambah transisi', exact: true }).click();
	await q(page, 'q0').click();
	await q(page, 'q1').click();
	await page.keyboard.type('0');
	await page.keyboard.press('Enter');
	await page.getByRole('button', { name: 'Pilih', exact: true }).click();
}

test('the first view shows the whole machine, with room around it', async ({ page }) => {
	await openSandbox(page);
	const area = (await canvas(page).boundingBox())!;
	for (const name of ['q0', 'q1', 'q2']) {
		const c = await center(q(page, name));
		expect(c.x, name).toBeGreaterThan(area.x + 32);
		expect(c.x, name).toBeLessThan(area.x + area.width - 32);
		expect(c.y, name).toBeGreaterThan(area.y + 32);
		expect(c.y, name).toBeLessThan(area.y + area.height - 32);
	}
});

test('an empty canvas opens at 100%', async ({ page, isMobile }) => {
	test.skip(isMobile, 'the zoom control is for a laptop');
	await emptyCanvas(page);
	await expect(level(page)).toHaveText('100%');
});

test.describe('with a mouse and the keyboard', () => {
	test.beforeEach(({ isMobile }) => test.skip(isMobile, 'a laptop'));

	test('Ctrl and the wheel zoom around the pointer: the state under it stays', async ({ page }) => {
		await openSandbox(page);
		const before = await center(q(page, 'q1'));
		const sizeBefore = (await q(page, 'q1').locator('circle.state').boundingBox())!;
		await page.mouse.move(before.x, before.y);
		await page.keyboard.down('Control');
		await page.mouse.wheel(0, -100);
		await page.keyboard.up('Control');
		await expect
			.poll(async () => (await q(page, 'q1').locator('circle.state').boundingBox())!.width)
			.toBeGreaterThan(sizeBefore.width * 1.1);
		near(await center(q(page, 'q1')), before);
	});

	test('the wheel without Ctrl pans, and the zoom stays', async ({ page }) => {
		await openSandbox(page);
		const before = await center(q(page, 'q1'));
		const percent = await level(page).innerText();
		await page.mouse.move(before.x, before.y + 150);
		await page.mouse.wheel(30, 100);
		await expect.poll(async () => (await center(q(page, 'q1'))).y).toBeCloseTo(before.y - 100, 0);
		near(await center(q(page, 'q1')), { x: before.x - 30, y: before.y - 100 });
		expect(await level(page).innerText()).toBe(percent);
	});

	test('the keys: + and − zoom, 0 is 100%, 1 fits, Shift+Arrow pans by 100', async ({ page }) => {
		await openSandbox(page);
		await q(page, 'q1').click();
		await page.keyboard.press('0');
		await expect(level(page)).toHaveText('100%');
		await page.keyboard.press('+');
		await expect(level(page)).toHaveText('125%');
		await page.keyboard.press('-');
		await page.keyboard.press('-');
		await expect(level(page)).toHaveText('80%');
		await page.keyboard.press('0');
		const before = await center(q(page, 'q1'));
		await page.keyboard.press('Shift+ArrowRight');
		near(await center(q(page, 'q1')), { x: before.x - 100, y: before.y });
		await page.keyboard.press('Shift+ArrowUp');
		near(await center(q(page, 'q1')), { x: before.x - 100, y: before.y + 100 });
		await page.keyboard.press('1');
		const area = (await canvas(page).boundingBox())!;
		const c = await center(q(page, 'q1'));
		expect(c.x).toBeGreaterThan(area.x);
		expect(c.x).toBeLessThan(area.x + area.width);
	});

	test('the zoom control: −, +, the percentage and Pas', async ({ page }) => {
		await openSandbox(page);
		const fitted = await level(page).innerText();
		await zoomButton(page, 'Perbesar').click();
		await expect(level(page)).not.toHaveText(fitted);
		await level(page).click();
		await expect(level(page)).toHaveText('100%');
		await zoomButton(page, 'Perkecil').click();
		await expect(level(page)).toHaveText('80%');
		await zoomButton(page, 'Pas').click();
		await expect(level(page)).toHaveText(fitted);
		for (const name of ['Perbesar', 'Perkecil', 'Pas']) {
			const b = (await zoomButton(page, name).boundingBox())!;
			expect(b.height, name).toBeGreaterThanOrEqual(44);
			expect(b.width, name).toBeGreaterThanOrEqual(44);
		}
		await expectNoAxeViolations(page);
	});

	test('a click adds the state under the pointer, at several zooms and after a pan', async ({
		page
	}) => {
		await emptyCanvas(page);
		await page.getByRole('button', { name: 'Tambah state', exact: true }).click();
		const area = (await canvas(page).boundingBox())!;
		const at = { x: area.x + 260, y: area.y + 200 };
		for (const key of ['0', '+', '+', '-', '-', '-', '-']) {
			await canvas(page).focus();
			await page.keyboard.press(key);
			const count = await nodes(page).count();
			await page.mouse.click(at.x, at.y);
			await expect(nodes(page)).toHaveCount(count + 1);
			near(await center(nodes(page).last()), at);
			await page.keyboard.press('Control+z');
			await expect(nodes(page)).toHaveCount(count);
			// A pan changes where the same click lands in the world, never where the state appears.
			await canvas(page).focus();
			await page.keyboard.press('Shift+ArrowLeft');
		}
	});

	test('a drag on empty canvas pans in Pilih; Space and drag pans in other tools; so does the middle button', async ({
		page
	}) => {
		await openSandbox(page);
		const area = (await canvas(page).boundingBox())!;
		const free = { x: area.x + 30, y: area.y + area.height - 120 };
		const before = await center(q(page, 'q1'));

		await page.mouse.move(free.x, free.y);
		await page.mouse.down();
		await page.mouse.move(free.x + 60, free.y + 20, { steps: 6 });
		await page.mouse.up();
		near(await center(q(page, 'q1')), { x: before.x + 60, y: before.y + 20 });
		await expect(page.getByRole('button', { name: 'Pilih', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await page.getByRole('button', { name: 'Tambah state', exact: true }).click();
		await canvas(page).focus();
		await page.keyboard.down(' ');
		await page.mouse.move(free.x, free.y);
		await page.mouse.down();
		await page.mouse.move(free.x - 40, free.y, { steps: 6 });
		await page.mouse.up();
		await page.keyboard.up(' ');
		near(await center(q(page, 'q1')), { x: before.x + 20, y: before.y + 20 });
		// No state was added by that drag.
		await expect(nodes(page)).toHaveCount(3);

		await page.mouse.move(free.x, free.y);
		await page.mouse.down({ button: 'middle' });
		await page.mouse.move(free.x, free.y + 50, { steps: 6 });
		await page.mouse.up({ button: 'middle' });
		near(await center(q(page, 'q1')), { x: before.x + 20, y: before.y + 70 });
		await expect(nodes(page)).toHaveCount(3);
	});

	test('zoomed out to 25% a click far from the origin adds a state, and Pas shows all', async ({
		page
	}) => {
		await openSandbox(page);
		for (let i = 0; i < 10; i++) await zoomButton(page, 'Perkecil').click();
		await expect(level(page)).toHaveText('25%');
		await page.getByRole('button', { name: 'Tambah state', exact: true }).click();
		const area = (await canvas(page).boundingBox())!;
		await page.mouse.click(area.x + area.width - 60, area.y + 60);
		await expect(nodes(page)).toHaveCount(4);
		await zoomButton(page, 'Pas').click();
		const c = await center(nodes(page).last());
		expect(c.x).toBeLessThan(area.x + area.width);
		expect(c.y).toBeLessThan(area.y + area.height);
		const first = await center(q(page, 'q0'));
		expect(first.x).toBeGreaterThan(area.x);
	});

	test('a state that is off the screen is brought into view when the focus goes to it', async ({
		page
	}) => {
		await openSandbox(page);
		await q(page, 'q0').click();
		for (let i = 0; i < 14; i++) await page.keyboard.press('Shift+ArrowRight');
		const area = (await canvas(page).boundingBox())!;
		expect((await center(q(page, 'q0'))).x).toBeLessThan(area.x);
		await page.keyboard.press('Control+ArrowRight');
		const inside = (p: { x: number; y: number }) =>
			p.x >= area.x && p.x <= area.x + area.width && p.y >= area.y && p.y <= area.y + area.height;
		const visible = [await center(q(page, 'q0')), await center(q(page, 'q1'))];
		expect(visible.some(inside)).toBe(true);
	});

	test('the boxes keep a readable size when the view is zoomed out', async ({ page }) => {
		await openSandbox(page);
		for (let i = 0; i < 3; i++) await zoomButton(page, 'Perkecil').click();
		await q(page, 'q1').click();
		await page.keyboard.press('Enter');
		const field = page.getByRole('textbox', { name: 'Nama state' });
		await expect(field).toBeFocused();
		const size = await field.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
		expect(size).toBeGreaterThanOrEqual(16);
		const input = (await field.boundingBox())!;
		const c = await center(q(page, 'q1'));
		near({ x: input.x + input.width / 2, y: input.y + input.height / 2 }, c, 4);
		await page.keyboard.press('Escape');
	});

	test('the line of an edge is as easy to hit when zoomed out', async ({ page }) => {
		await withEdge(page);
		await canvas(page).focus();
		await page.keyboard.press('0');
		for (let i = 0; i < 4; i++) await page.keyboard.press('-');
		await expect(level(page)).toHaveText('41%');
		// 15 px from the middle of a line on the screen, on the side away from its label: only the
		// wide invisible line is there, and it is 44 px wide on the screen at every zoom.
		const at = await page.evaluate(() => {
			const line = document.querySelector<SVGPathElement>('g.edge path.line')!;
			const length = line.getTotalLength();
			const p = line.getPointAtLength(length / 2);
			const ahead = line.getPointAtLength(length / 2 + 1);
			const m = line.getScreenCTM()!;
			const s = new DOMPoint(p.x, p.y).matrixTransform(m);
			const t = new DOMPoint(ahead.x, ahead.y).matrixTransform(m);
			const size = Math.hypot(t.x - s.x, t.y - s.y) || 1;
			let nx = -(t.y - s.y) / size;
			let ny = (t.x - s.x) / size;
			const label = document.querySelector<SVGTextElement>('text.label')!.getBoundingClientRect();
			if (nx * (label.x + label.width / 2 - s.x) + ny * (label.y + label.height / 2 - s.y) > 0) {
				nx = -nx;
				ny = -ny;
			}
			return { x: s.x + nx * 15, y: s.y + ny * 15 };
		});
		await page.mouse.click(at.x, at.y);
		await expect(page.locator('g.edge.chosen')).toHaveCount(1);
	});
});

test.describe('with a finger', () => {
	test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'a phone only'));

	test('one finger on empty canvas pans; the Pas button brings the machine back', async ({
		page
	}) => {
		await openSandbox(page);
		const area = (await canvas(page).boundingBox())!;
		const before = await center(q(page, 'q1'));
		const free = { x: area.x + 20, y: area.y + area.height - 60 };
		await touchDragAt(page, free, { x: free.x + 40, y: free.y - 50 });
		// A finger can lose up to one move at the start (the touch slop), so the pan may lag a few px.
		near(await center(q(page, 'q1')), { x: before.x + 40, y: before.y - 50 }, 8);
		// The zoom control is for a laptop; a phone has the Pas button in the title bar.
		await expect(page.getByRole('group', { name: 'Perbesaran' })).toBeHidden();
		const fit = page.getByRole('button', { name: 'Pas', exact: true });
		const b = (await fit.boundingBox())!;
		expect(b.height).toBeGreaterThanOrEqual(44);
		expect(b.width).toBeGreaterThanOrEqual(44);
		await fit.tap();
		near(await center(q(page, 'q1')), before);
		await expectNoAxeViolations(page);
	});

	test('two fingers pinch: the zoom follows the distance and the point between them stays', async ({
		page
	}) => {
		await openSandbox(page);
		const middle = await center(q(page, 'q1'));
		const size = (await q(page, 'q1').locator('circle.state').boundingBox())!.width;
		await touchPinch(page, middle, 110, 220);
		const bigger = (await q(page, 'q1').locator('circle.state').boundingBox())!.width;
		expect(bigger / size).toBeGreaterThan(1.8);
		expect(bigger / size).toBeLessThan(2.2);
		near(await center(q(page, 'q1')), middle, 3);

		await touchPinch(page, middle, 220, 110);
		const back = (await q(page, 'q1').locator('circle.state').boundingBox())!.width;
		expect(Math.abs(back - size)).toBeLessThan(size * 0.1);
		await expectNoAxeViolations(page);
	});

	test('a second finger drops a drag that the first one began: the state goes back', async ({
		page
	}) => {
		await openSandbox(page);
		const from = await center(q(page, 'q1'));
		const area = (await canvas(page).boundingBox())!;
		const session = await touchSession(page);
		await session.down([{ ...from, id: 1 }]);
		for (let i = 1; i <= 4; i++) {
			await session.move([{ x: from.x + i * 10, y: from.y + i * 8, id: 1 }]);
		}
		const moved = await center(q(page, 'q1'));
		expect(Math.abs(moved.x - from.x)).toBeGreaterThan(20);
		const other = { x: area.x + 30, y: area.y + 40, id: 2 };
		await session.down([{ x: from.x + 40, y: from.y + 32, id: 1 }, other]);
		await page.waitForTimeout(100);
		near(await center(q(page, 'q1')), from, 1);
		await session.up();
		await session.close();
		near(await center(q(page, 'q1')), from, 1);
		// No step was made: there is nothing to undo.
		await expect(page.getByRole('button', { name: 'Urungkan' }).first()).toBeDisabled();
	});

	test('a second finger stops a long-press: no menu opens', async ({ page }) => {
		await openSandbox(page);
		const on = await center(q(page, 'q1'));
		const area = (await canvas(page).boundingBox())!;
		const session = await touchSession(page);
		await session.down([{ ...on, id: 1 }]);
		await page.waitForTimeout(250);
		await session.down([
			{ ...on, id: 1 },
			{ x: area.x + 30, y: area.y + 40, id: 2 }
		]);
		await page.waitForTimeout(700);
		await expect(page.getByRole('menu')).toBeHidden();
		await session.up();
		await session.close();
	});

	test('after a pinch, the finger that is left does not pan or select until it is lifted', async ({
		page
	}) => {
		await openSandbox(page);
		const middle = await center(q(page, 'q1'));
		const session = await touchSession(page);
		const two = [
			{ x: middle.x - 55, y: middle.y + 90, id: 1 },
			{ x: middle.x + 55, y: middle.y + 90, id: 2 }
		];
		await session.down(two.slice(0, 1));
		await session.down(two);
		await session.move(two.map((p) => ({ ...p, x: p.x + (p.id === 1 ? -20 : 20) })));
		// One finger is lifted (the second one stays), and moves over a state.
		const still = [{ x: middle.x + 75, y: middle.y + 90, id: 2 }];
		await session.move(still);
		const before = await center(q(page, 'q1'));
		await session.move([{ x: middle.x + 75, y: middle.y + 140, id: 2 }]);
		await page.waitForTimeout(100);
		near(await center(q(page, 'q1')), before, 20);
		await session.up();
		await session.close();
	});

	test('a finger drag that starts on a state still moves the state, not the view', async ({
		page
	}) => {
		await openSandbox(page);
		const from = await center(q(page, 'q1'));
		const other = await center(q(page, 'q0'));
		await touchDragAt(page, from, { x: from.x + 30, y: from.y + 30 });
		near(await center(q(page, 'q1')), { x: from.x + 30, y: from.y + 30 }, 2);
		near(await center(q(page, 'q0')), other);
	});
});
