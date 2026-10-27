// The bar of the editor on a phone (suggested in the phone test of PR 83): it has the title, the state of the save,
// "Pas", the help, the list of machines and undo and redo. Every button must keep the 44 px of a finger, also on
// the narrowest phone, and nothing may run out of the screen or lie over another; the title gives way.
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';

test.beforeEach(({ isMobile }) => {
	test.skip(!isMobile, 'a phone only');
});

for (const width of [320, 360, 412]) {
	test(`at ${width} px every button of the bar is at least 44 px, inside the screen, and none lies over another`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 700 });
		await openSandbox(page);
		const bar = page.locator('.editor .work > .bar');
		const boxes: { name: string; x: number; width: number; height: number }[] = [];
		for (const button of await bar.getByRole('button').all()) {
			const box = (await button.boundingBox())!;
			const name = (await button.getAttribute('aria-label')) ?? (await button.innerText());
			boxes.push({ name, x: box.x, width: box.width, height: box.height });
		}
		// "Pas", the help, the machines, undo and redo.
		expect(boxes.length).toBeGreaterThanOrEqual(5);
		for (const b of boxes) {
			expect(b.width, `${b.name} wide`).toBeGreaterThanOrEqual(43.5);
			expect(b.height, `${b.name} high`).toBeGreaterThanOrEqual(43.5);
			expect(b.x, `${b.name} left`).toBeGreaterThanOrEqual(0);
			expect(b.x + b.width, `${b.name} right`).toBeLessThanOrEqual(width + 0.5);
		}
		const sorted = [...boxes].sort((a, b) => a.x - b.x);
		for (let i = 1; i < sorted.length; i++) {
			const before = sorted[i - 1]!;
			expect(sorted[i]!.x, `${sorted[i]!.name} against ${before.name}`).toBeGreaterThanOrEqual(
				before.x + before.width - 0.5
			);
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			width
		);
	});
}

test('the title gives way: it keeps some room, is cut with an ellipsis, and the page has no violation', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 700 });
	await openSandbox(page);
	const title = page.locator('.editor .work > .bar .title');
	const box = (await title.boundingBox())!;
	// Room for a few letters, at least, on the narrowest phone.
	expect(box.width).toBeGreaterThanOrEqual(30);
	expect(await title.evaluate((el) => getComputedStyle(el).textOverflow)).toBe('ellipsis');
	// On a phone of 412 px the whole title "Berakhiran 01" is there.
	await page.setViewportSize({ width: 412, height: 700 });
	expect(await title.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	await expectNoAxeViolations(page);
});
