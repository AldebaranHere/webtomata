// S11, saving the machine as a picture: "Unduh SVG" and "Unduh PNG" in the dialog "Bagikan mesin". The files are
// checked by what they are, not by the code that made them: the SVG is parsed as XML by the browser and drawn,
// and the PNG is decoded and looked at (its signature, its size and its pixels).
import { readFileSync } from 'node:fs';
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { touchTap } from './touch.ts';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Bagikan mesin' });

/** Opens the dialog: with the button of the bar, or (the bar of a phone is full) from the row of the machine. */
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
			.click();
		await list.getByRole('button', { name: 'Bagikan', exact: true }).click();
	}
	await expect(dialog(page)).toBeVisible();
}

async function download(page: Page, name: string) {
	const waiting = page.waitForEvent('download');
	await dialog(page).getByRole('button', { name }).click();
	const file = await waiting;
	return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) };
}

test('the SVG is XML that the browser parses and draws, with every state and edge of the machine', async ({
	page
}) => {
	await openSandbox(page);
	await openShare(page);
	const file = await download(page, 'Unduh SVG');
	expect(file.name).toBe('Berakhiran 01.svg');
	const svg = file.bytes.toString('utf8');
	const facts = await page.evaluate((text) => {
		const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
		const root = parsed.documentElement;
		return {
			broken: parsed.querySelector('parsererror') !== null,
			root: root.localName,
			states: parsed.querySelectorAll('circle.state').length,
			inner: parsed.querySelectorAll('circle.inner').length,
			edges: parsed.querySelectorAll('path.edge').length,
			start: parsed.querySelectorAll('path.start').length,
			names: [...parsed.querySelectorAll('text')].map((t) => t.textContent)
		};
	}, svg);
	expect(facts).toMatchObject({ broken: false, root: 'svg', states: 3, inner: 1, start: 1 });
	expect(facts.edges).toBeGreaterThanOrEqual(3);
	expect(facts.names).toEqual(expect.arrayContaining(['q0', 'q1', 'q2']));
	expect(svg).not.toMatch(/var\(--|<script/);
	await expect(dialog(page)).toContainText('File Berakhiran 01.svg diunduh.');
});

test('the PNG has the signature, twice the size of the SVG, a white background and a drawing on it', async ({
	page
}) => {
	await openSandbox(page);
	await openShare(page);
	const svgFile = await download(page, 'Unduh SVG');
	const size = /width="(\d+)" height="(\d+)"/.exec(svgFile.bytes.toString('utf8'))!;
	const png = await download(page, 'Unduh PNG');
	expect(png.name).toBe('Berakhiran 01.png');
	expect([...png.bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	// The size is in the IHDR chunk: four bytes of width and four of height, at 16 and 20.
	expect(png.bytes.readUInt32BE(16)).toBe(Number(size[1]) * 2);
	expect(png.bytes.readUInt32BE(20)).toBe(Number(size[2]) * 2);
	// Decode it as the browser does and look at the pixels: white at the corner, dark ink somewhere.
	const pixels = await page.evaluate(async (base64) => {
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
		for (let i = 0; i < data.length; i += 4) if (data[i]! < 100 && data[i + 3]! > 200) dark++;
		return { corner: [...context.getImageData(0, 0, 1, 1).data], dark };
	}, png.bytes.toString('base64'));
	expect(pixels.corner).toEqual([255, 255, 255, 255]);
	expect(pixels.dark).toBeGreaterThan(500);
});

test('the name of the file comes from the title, as for the other files', async ({ page }) => {
	await openSandbox(page);
	await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
	const list = page.getByRole('dialog', { name: 'Mesin saya' });
	await list
		.getByRole('button', { name: /^Tindakan untuk/ })
		.first()
		.click();
	await list.getByRole('button', { name: 'Ubah nama' }).click();
	await list.getByRole('textbox', { name: 'Nama mesin' }).fill('Genap: a/b?');
	await list.getByRole('textbox', { name: 'Nama mesin' }).press('Enter');
	await list.getByRole('button', { name: 'Tutup' }).click();
	await openShare(page);
	expect((await download(page, 'Unduh SVG')).name).toBe('Genap- a-b.svg');
});

test('the buttons are off for a machine with no state, and the JSON file is still there', async ({
	page
}) => {
	await openSandbox(page, { example: false });
	await page.getByRole('button', { name: 'Mulai dari kanvas kosong' }).click();
	await page.getByRole('button', { name: /^Mesin saya \(/ }).click();
	const list = page.getByRole('dialog', { name: 'Mesin saya' });
	await list
		.getByRole('button', { name: /^Tindakan untuk/ })
		.first()
		.click();
	await list.getByRole('button', { name: 'Bagikan', exact: true }).click();
	await expect(dialog(page).getByRole('button', { name: 'Unduh SVG' })).toBeDisabled();
	await expect(dialog(page).getByRole('button', { name: 'Unduh PNG' })).toBeDisabled();
	await expect(dialog(page).getByRole('button', { name: 'Unduh JSON' })).toBeEnabled();
});

test('every button of the pictures is at least 44 px, and the dialog has no violations', async ({
	page,
	isMobile
}) => {
	await openSandbox(page);
	await openShare(page);
	for (const name of ['Unduh SVG', 'Unduh PNG']) {
		const box = (await dialog(page).getByRole('button', { name }).boundingBox())!;
		expect(box.height, name).toBeGreaterThanOrEqual(43.5);
		expect(box.width, name).toBeGreaterThanOrEqual(43.5);
	}
	await expectNoAxeViolations(page);
	if (!isMobile) return;
	const waiting = page.waitForEvent('download');
	await touchTap(page, dialog(page).getByRole('button', { name: 'Unduh PNG' }));
	expect((await waiting).suggestedFilename()).toBe('Berakhiran 01.png');
});
