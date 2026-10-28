// Saving the machine as a picture in every engine (S11). Drawing an SVG on a canvas is what browsers do in
// their own ways; the details are in e2e/image-export.spec.ts (Chrome).
import { readFileSync } from 'node:fs';
import { expect, openSandbox, test } from '../fixtures.ts';
import type { Page } from '@playwright/test';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Bagikan mesin' });

async function openShare(page: Page): Promise<void> {
	const button = page.getByRole('button', { name: 'Bagikan', exact: true });
	if ((await button.count()) > 0) {
		await button.click();
	} else {
		await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
		const list = page.getByRole('dialog', { name: 'Mesin saya' });
		await list
			.getByRole('button', { name: /^Tindakan untuk/ })
			.first()
			.tap();
		await list.getByRole('button', { name: 'Bagikan', exact: true }).tap();
	}
	await expect(dialog(page)).toBeVisible();
}

test('gives an SVG that parses and a PNG with the signature and some ink', async ({ page }) => {
	await openSandbox(page);
	await openShare(page);
	const svgWaiting = page.waitForEvent('download');
	await dialog(page).getByRole('button', { name: 'Unduh SVG' }).click();
	const svgFile = await svgWaiting;
	expect(svgFile.suggestedFilename()).toMatch(/^Berakhiran[ _]01\.svg$/);
	const svg = readFileSync((await svgFile.path())!, 'utf8');
	const broken = await page.evaluate(
		(text) =>
			new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('parsererror') !== null,
		svg
	);
	expect(broken).toBe(false);
	const pngWaiting = page.waitForEvent('download');
	await dialog(page).getByRole('button', { name: 'Unduh PNG' }).click();
	const pngFile = await pngWaiting;
	expect(pngFile.suggestedFilename()).toMatch(/^Berakhiran[ _]01\.png$/);
	const bytes = readFileSync((await pngFile.path())!);
	expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const ink = await page.evaluate(async (base64) => {
		const image = new Image();
		image.src = `data:image/png;base64,${base64}`;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		const context = canvas.getContext('2d')!;
		context.drawImage(image, 0, 0);
		const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
		let dark = 0;
		for (let i = 0; i < data.length; i += 4) if (data[i]! < 100) dark++;
		return dark;
	}, bytes.toString('base64'));
	expect(ink).toBeGreaterThan(500);
});
