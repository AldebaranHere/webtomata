// A scan of axe must not be fooled by something that is fading in. The tooltip of a tool of the rail
// (ToolTip.svelte) appears 300 ms after the pointer rests on it, and fades in for 100 ms; text that
// is half transparent has a low contrast for a moment, and a scan that ran just then failed once in
// a while in CI (the flow "by mouse and keyboard" of editor-flows.spec.ts, retried and green).
// expectNoAxeViolations waits for the transitions that are under way before it scans.
import { expect, expectNoAxeViolations, openSandbox, test } from './fixtures.ts';

test.beforeEach(({ isMobile }) => {
	test.skip(isMobile, 'a laptop only (a phone has no tooltips)');
});

test('a scan while a tooltip fades in finds no violation, every time', async ({ page }) => {
	// Each scan takes about 2 seconds, and a busy runner takes longer: the default 30 s is too short.
	test.setTimeout(90_000);
	await openSandbox(page);
	const rail = page.getByRole('toolbar', { name: 'Alat editor' });
	for (let round = 0; round < 10; round++) {
		await page.mouse.move(700, 400);
		await rail.getByRole('button', { name: 'Tambah state' }).hover();
		// The tooltip is at the start of its fade: 300 ms of delay, then 100 ms.
		await page.waitForTimeout(170 + round * 22);
		await expectNoAxeViolations(page);
		await page.mouse.move(700, 400);
	}
});

test('a scan waits for a transition that is under way, and sees the colors at its end', async ({
	page
}) => {
	await openSandbox(page);
	// A text that goes from a very low contrast to black at the end of 1.5 seconds, started just before the scan.
	// Scanned at once it would fail; scanned after the transition it passes. This is the helper.
	await page.evaluate(() => {
		const p = document.createElement('p');
		p.id = 'fade';
		p.textContent = 'fading text';
		// Through the CSS object model: the page does not allow an inline style attribute.
		p.style.color = '#bbbbbb';
		p.style.background = '#ffffff';
		// The color stays as it was until the end of the transition and then changes: any scan that
		// runs before the end sees the low contrast, however long axe takes to start.
		p.style.transition = 'color 1500ms steps(1, end)';
		document.querySelector('main')!.append(p);
		void getComputedStyle(p).color;
		p.style.color = '#000000';
	});
	await expectNoAxeViolations(page);
});

test('the scan says which element and which colors, when it fails', async ({ page }) => {
	await openSandbox(page);
	// A text with a very low contrast, put in the page on purpose.
	await page.evaluate(() => {
		const p = document.createElement('p');
		p.id = 'weak';
		p.textContent = 'weak text';
		// Through the CSS object model: the page does not allow an inline style attribute.
		p.style.color = '#bbbbbb';
		p.style.background = '#ffffff';
		document.querySelector('main')!.append(p);
	});
	await expect(expectNoAxeViolations(page)).rejects.toThrow(/color-contrast.*#weak.*ratio/s);
});
