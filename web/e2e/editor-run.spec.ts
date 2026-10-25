// S6-2, the parts that are for Chrome: a real finger on a phone, and the size of the controls. The
// run itself is tested in every engine (e2e/cross/run.spec.ts).
import { expect, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { touchTap } from './touch.ts';

const canvas = (page: Page) => page.getByRole('application', { name: 'Kanvas mesin' });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Simulasi' });

test('the controls are at least 44 px, and a run does not change the size of the canvas', async ({
	page
}) => {
	await openSandbox(page);
	const before = (await canvas(page).boundingBox())!;
	await panel(page).getByLabel('String masukan').fill('0101');
	await panel(page).getByRole('button', { name: 'Jalankan' }).click();
	await expect(panel(page).getByRole('list', { name: 'Simbol yang dibaca' })).toBeVisible();
	for (const name of [
		'Kembali ke awal',
		'Langkah sebelumnya',
		/^(Jalankan|Jeda)$/,
		'Langkah berikutnya'
	]) {
		const box = (await panel(page).getByRole('button', { name }).boundingBox())!;
		expect(box.width, String(name)).toBeGreaterThanOrEqual(44);
		expect(box.height, String(name)).toBeGreaterThanOrEqual(44);
	}
	const after = (await canvas(page).boundingBox())!;
	expect(after.width).toBe(before.width);
	expect(after.height).toBe(before.height);
});

test('a finger runs a string, pauses it and steps it', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'a phone only');
	await openSandbox(page);
	await panel(page).getByLabel('String masukan').fill('0101');
	await touchTap(page, panel(page).getByRole('button', { name: 'Jalankan' }));
	await touchTap(page, panel(page).getByRole('button', { name: 'Jeda' }));
	await touchTap(page, panel(page).getByRole('button', { name: 'Kembali ke awal' }));
	await expect(page.locator('svg.world g.node[data-active]')).toHaveAttribute(
		'aria-label',
		/^State q0/
	);
	await touchTap(page, panel(page).getByRole('button', { name: 'Langkah berikutnya' }));
	await expect(page.locator('svg.world g.node[data-active]')).toHaveAttribute(
		'aria-label',
		/^State q1/
	);
	await touchTap(page, panel(page).getByRole('button', { name: 'Langkah sebelumnya' }));
	await expect(page.locator('svg.world g.node[data-active]')).toHaveAttribute(
		'aria-label',
		/^State q0/
	);
});
