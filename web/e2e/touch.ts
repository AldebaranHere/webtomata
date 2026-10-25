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
	// A control inside a box that scrolls (the panel) may be out of sight: a finger would hit what is
	// there instead, so it is scrolled into view first, as the person would do.
	await target.scrollIntoViewIfNeeded();
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

/** A tap on a point of the page. */
export async function touchTapAt(page: Page, at: { x: number; y: number }): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
	await page.waitForTimeout(150);
}

/** A finger that goes from one point of the page to another and lifts. */
export async function touchDragAt(
	page: Page,
	a: { x: number; y: number },
	b: { x: number; y: number }
): Promise<void> {
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

/** A finger that stays on a point for longer than a long-press. */
export async function touchLongPressAt(page: Page, at: { x: number; y: number }): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
	await page.waitForTimeout(700);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
}

/**
 * Several fingers at once, step by step. Each call gives all the fingers that are down at that
 * moment (the browser works out which finger went down, moved or lifted).
 */
export async function touchSession(page: Page) {
	const cdp = await page.context().newCDPSession(page);
	type Points = { x: number; y: number; id: number }[];
	const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Points) =>
		cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
	return {
		/** A finger goes down (give every finger that is down, the new one included). */
		down: (points: Points) => send('touchStart', points),
		move: (points: Points) => send('touchMove', points),
		/** Every finger is lifted. */
		up: async () => {
			await send('touchEnd', []);
			await page.waitForTimeout(150);
		},
		close: () => cdp.detach()
	};
}

/** Two fingers that go apart (or together) around a point, in steps. */
export async function touchPinch(
	page: Page,
	middle: { x: number; y: number },
	gapFrom: number,
	gapTo: number
): Promise<void> {
	const session = await touchSession(page);
	const at = (gap: number) => [
		{ x: middle.x - gap / 2, y: middle.y, id: 1 },
		{ x: middle.x + gap / 2, y: middle.y, id: 2 }
	];
	await session.down(at(gapFrom).slice(0, 1));
	await session.down(at(gapFrom));
	for (let i = 1; i <= 8; i++) await session.move(at(gapFrom + ((gapTo - gapFrom) * i) / 8));
	await session.up();
	await session.close();
}
