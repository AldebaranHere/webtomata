// Touch the way a phone does it. Playwright's own tap() does not send the mouse events that a real
// phone sends after a tap, and those events once closed a box that the tap had just opened. These
// helpers send real touch events through the browser, so the whole sequence happens.
import type { Locator, Page } from '@playwright/test';

async function center(target: Locator) {
	const box = (await target.boundingBox())!;
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A tap on the middle of the element (for a state: its circle). */
export async function touchTap(page: Page, target: Locator): Promise<void> {
	const at = await center(target.locator('circle.state').or(target).first());
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
	// The browser sends the mouse events after the tap a moment later.
	await page.waitForTimeout(150);
}

/** A finger that goes from one element to another and lifts. */
export async function touchDrag(page: Page, from: Locator, to: Locator): Promise<void> {
	const a = await center(from.locator('circle.state').or(from).first());
	const b = await center(to.locator('circle.state').or(to).first());
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
	for (let i = 1; i <= 8; i++) {
		await cdp.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8 }]
		});
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
	await page.waitForTimeout(150);
}
