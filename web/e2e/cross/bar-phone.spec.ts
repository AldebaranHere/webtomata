// The bar of the editor on a phone keeps the 44 px of every button in WebKit and Firefox too (flex items
// shrink in the same way, but each engine rounds a little differently). The details are in
// e2e/editor-bar-phone.spec.ts.
import { expect, openSandbox, test } from '../fixtures.ts';

test('the buttons of the bar of a phone are at least 44 px, inside the screen, at 360 px', async ({
	page,
	isMobile
}) => {
	test.skip(!isMobile, 'a phone only');
	await page.setViewportSize({ width: 360, height: 700 });
	await openSandbox(page);
	for (const button of await page.locator('.editor .work > .bar').getByRole('button').all()) {
		const box = (await button.boundingBox())!;
		const name = (await button.getAttribute('aria-label')) ?? (await button.innerText());
		expect(box.width, name).toBeGreaterThanOrEqual(43.5);
		expect(box.height, name).toBeGreaterThanOrEqual(43.5);
		expect(box.x + box.width, name).toBeLessThanOrEqual(360.5);
	}
});
