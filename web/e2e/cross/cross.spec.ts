// The small set that runs in every engine: Chrome (desktop and phone), Firefox and WebKit (an
// iPhone). It covers what differs between engines: the engine (WASM and a worker), SVG geometry,
// focus and blur, touch, the keyboard, and saved settings. Everything else runs in Chrome only
// (docs/decisions/0022-cross-browser-tests.md). Only Playwright's own events are used (no
// Chrome-only calls), so Firefox and WebKit can run it. Touch is `tap()`, which does not send the
// mouse events that follow a real tap; a real phone is still needed for that (G4).
import { expect, expectNoAxeViolations, openSandbox, test } from '../fixtures.ts';
import type { Locator, Page } from '@playwright/test';

const nodes = (page: Page) => page.locator('svg.world g.node');
const labels = (page: Page) => page.locator('svg.world text.label');
const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const box = (page: Page) => page.getByRole('textbox', { name: 'Simbol transisi' });
const tool = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const state = (page: Page, name: string) =>
	page.getByRole('button', { name: new RegExp(`^State ${name}(,|$)`) });

/** A click with a mouse, or a tap with a finger, as the project does. */
const press = (target: Locator, isMobile: boolean, position?: { x: number; y: number }) =>
	isMobile ? target.tap({ position }) : target.click({ position });

test('the engine starts and the page shows its version', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.version code')).toHaveText(/^\d+\.\d+\.\d+/);
});

test('the Sandbox opens the sample machine, and axe finds no violation', async ({ page }) => {
	await openSandbox(page);
	await expect(nodes(page)).toHaveCount(3);
	await expect(state(page, 'q0')).toHaveAttribute('aria-label', 'State q0, start state');
	await expectNoAxeViolations(page);
});

test('build two states and an edge, type its symbols, send them, and undo', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	// The page is drawn before it takes keys: try until Select all and Delete work.
	await expect(async () => {
		await canvas(page).focus();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Delete');
		expect(await nodes(page).count()).toBe(0);
	}).toPass();

	await press(tool(page, 'Tambah state'), isMobile);
	const area = (await canvas(page).boundingBox())!;
	await press(canvas(page), isMobile, { x: 70, y: 140 });
	await press(canvas(page), isMobile, { x: area.width - 70, y: 140 });
	await expect(nodes(page)).toHaveCount(2);

	await press(tool(page, 'Tambah transisi'), isMobile);
	await press(state(page, 'q0'), isMobile);
	await press(state(page, 'q1'), isMobile);
	// The box opens and keeps the focus (WebKit and Firefox decide the focus after a tap in
	// their own way).
	await expect(box(page)).toBeFocused();
	await page.waitForTimeout(700);
	await expect(box(page)).toBeFocused();
	await page.keyboard.type('0, 1');
	await page.keyboard.press('Enter');
	await expect(labels(page)).toHaveText(['0, 1']);

	await page.keyboard.press('Control+z');
	await expect(labels(page)).toHaveCount(0);
});

test('the keyboard: a state is pressed, A makes it accepting, Delete removes it, undo brings it back', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await press(state(page, 'q1'), isMobile);
	await expect(state(page, 'q1')).toBeFocused();
	await page.keyboard.press('a');
	await expect(state(page, 'q1')).toHaveAttribute('aria-label', /accepting state/);
	await page.keyboard.press('Delete');
	await expect(nodes(page)).toHaveCount(2);
	await page.keyboard.press('Control+z');
	await expect(nodes(page)).toHaveCount(3);
});

test('phone: every tool name stays inside its button with some room around it', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'the bottom bar is for a phone');
	const size = page.viewportSize()!;
	for (const width of [320, size.width]) {
		await page.setViewportSize({ width, height: size.height });
		await openSandbox(page);
		const bar = page.getByRole('toolbar', { name: 'Alat editor' });
		for (const button of await bar.getByRole('button').all()) {
			const label = button.locator('.label');
			if ((await label.count()) === 0) continue;
			const outer = (await button.boundingBox())!;
			const inner = await label.evaluate((el) => {
				const range = document.createRange();
				range.selectNodeContents(el);
				const r = range.getBoundingClientRect();
				return { left: r.left, right: r.right };
			});
			const name = await label.innerText();
			expect(inner.left - outer.x, `${name} at ${width}: left room`).toBeGreaterThanOrEqual(6);
			expect(
				outer.x + outer.width - inner.right,
				`${name} at ${width}: right room`
			).toBeGreaterThanOrEqual(6);
		}
	}
});

test('a language that is chosen is still there after a reload', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'EN, English' }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
