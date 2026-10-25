// S6-1, the parts that are for Chrome: the layout of the panel, and the engine that fails. The
// checks themselves run in every engine (e2e/cross/checks.spec.ts).
import { expect, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';

const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Panel' });

test('laptop: the panel is a column of 22 rem at the right of the canvas', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a laptop');
	await openSandbox(page);
	const side = (await panel(page).boundingBox())!;
	const area = (await canvas(page).boundingBox())!;
	expect(Math.abs(side.width - 352)).toBeLessThanOrEqual(1);
	expect(area.x + area.width).toBeLessThanOrEqual(side.x + 1);
	// The bar that hides the panel is for a phone.
	await expect(panel(page).getByRole('button', { name: /panel/ })).toBeHidden();
});

test('phone: the panel is under the canvas, a bar hides it, and the choice is remembered', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'a phone only');
	await openSandbox(page);
	const area = (await canvas(page).boundingBox())!;
	const side = (await panel(page).boundingBox())!;
	expect(side.y).toBeGreaterThanOrEqual(area.y + area.height - 1);
	// The canvas keeps at least half of the height under the title bar and above the tools.
	const size = page.viewportSize()!;
	expect(area.height).toBeGreaterThan(size.height * 0.3);

	const hide = panel(page).getByRole('button', { name: 'Sembunyikan panel' });
	expect((await hide.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	await hide.tap();
	await expect(panel(page).getByText('Pemeriksaan')).toBeHidden();
	const taller = (await canvas(page).boundingBox())!;
	expect(taller.height).toBeGreaterThan(area.height);

	await page.reload();
	await page.locator('.editor[data-ready]').waitFor();
	await expect(panel(page).getByRole('button', { name: 'Tampilkan panel' })).toBeVisible();
	await panel(page).getByRole('button', { name: 'Tampilkan panel' }).tap();
	await expect(panel(page).getByText('Pemeriksaan')).toBeVisible();
});

test.describe('an engine that does not start', () => {
	test.use({ allowedProblem: /./ });

	test('a calm notice with a way to try again, and the editor still works', async ({ page }) => {
		let blocked = true;
		await page.route('**/*.wasm', (route) => (blocked ? route.abort() : route.continue()));
		await openSandbox(page);
		await expect(panel(page).getByText('Engine berhenti.')).toBeVisible();
		// The editor is not affected.
		await canvas(page).focus();
		await page.keyboard.press('n');
		await expect(page.locator('svg.world g.node')).toHaveCount(4);
		// The change makes the page ask again (after 200 ms), and the answer is a failure again. Only
		// then is the engine let through, so that the notice is still there to be pressed.
		await page.waitForTimeout(700);
		await expect(panel(page).getByText('Engine berhenti.')).toBeVisible();

		blocked = false;
		await panel(page).getByRole('button', { name: 'Coba lagi' }).click();
		await expect(panel(page).getByText('hal perlu dilihat').first()).toBeVisible();
	});
});
