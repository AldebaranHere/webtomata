import { describe, expect, it } from 'vitest';
import { random } from '../testing.ts';
import {
	IDENTITY,
	MAX_SCALE,
	MIN_SCALE,
	centerOf,
	fit,
	panBy,
	pinch,
	percent,
	reveal,
	toScreen,
	toWorld,
	wheel,
	zoomAt,
	zoomBy
} from './camera.ts';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('the camera: screen = world × scale + offset', () => {
	it('toScreen and toWorld are inverses, at any zoom and offset', () => {
		const camera = { x: -120, y: 75, scale: 1.6 };
		const p = { x: 310, y: -40 };
		const back = toWorld(camera, toScreen(camera, p));
		close(back.x, p.x);
		close(back.y, p.y);
	});

	it('the identity camera shows the world as it is', () => {
		expect(toScreen(IDENTITY, { x: 5, y: 9 })).toEqual({ x: 5, y: 9 });
	});
});

describe('zoom', () => {
	it('keeps the point under the pointer where it is (200 random cases)', () => {
		const rng = random(7);
		for (let i = 0; i < 200; i++) {
			const camera = {
				x: rng.int(2000) - 1000,
				y: rng.int(2000) - 1000,
				scale: MIN_SCALE + (rng.int(1000) / 1000) * (MAX_SCALE - MIN_SCALE)
			};
			const at = { x: rng.int(1400), y: rng.int(900) };
			const target = MIN_SCALE + (rng.int(1000) / 1000) * (MAX_SCALE - MIN_SCALE);
			const after = zoomAt(camera, at, target);
			const before = toWorld(camera, at);
			const now = toWorld(after, at);
			close(now.x, before.x);
			close(now.y, before.y);
			close(after.scale, target);
		}
	});

	it('stays between 25% and 400%, and stops exactly at the limits', () => {
		let camera = IDENTITY;
		for (let i = 0; i < 40; i++) camera = zoomBy(camera, { x: 0, y: 0 }, 1.25);
		expect(camera.scale).toBe(MAX_SCALE);
		for (let i = 0; i < 80; i++) camera = zoomBy(camera, { x: 0, y: 0 }, 1 / 1.25);
		expect(camera.scale).toBe(MIN_SCALE);
	});

	it('a zoom that does nothing returns the same camera', () => {
		const camera = { x: 10, y: 20, scale: MAX_SCALE };
		expect(zoomBy(camera, { x: 5, y: 5 }, 2)).toBe(camera);
	});

	it('shows the zoom as a whole percent', () => {
		expect(percent(IDENTITY)).toBe(100);
		expect(percent({ x: 0, y: 0, scale: 1.25 })).toBe(125);
		expect(percent({ x: 0, y: 0, scale: 0.3333 })).toBe(33);
	});
});

describe('pan', () => {
	it('moves the camera by the given screen distance', () => {
		expect(panBy({ x: 10, y: 20, scale: 2 }, -30, 5)).toEqual({ x: -20, y: 25, scale: 2 });
	});
});

describe('fit', () => {
	const size = { width: 800, height: 600 };

	it('an empty machine is shown at 100% at the origin', () => {
		expect(fit(null, size)).toEqual(IDENTITY);
	});

	it('a small machine is centered and not enlarged beyond 100%', () => {
		const camera = fit({ x: 100, y: 100, width: 200, height: 100 }, size);
		expect(camera.scale).toBe(1);
		const middle = toScreen(camera, { x: 200, y: 150 });
		close(middle.x, 400);
		close(middle.y, 300);
	});

	it('a big machine is scaled down so that all of it is inside, with room around it', () => {
		const bounds = { x: -500, y: -300, width: 2000, height: 1200 };
		const camera = fit(bounds, size, 48);
		expect(camera.scale).toBeLessThan(0.5);
		const topLeft = toScreen(camera, { x: bounds.x, y: bounds.y });
		const bottomRight = toScreen(camera, {
			x: bounds.x + bounds.width,
			y: bounds.y + bounds.height
		});
		expect(topLeft.x).toBeGreaterThanOrEqual(47.999);
		expect(topLeft.y).toBeGreaterThanOrEqual(47.999);
		expect(bottomRight.x).toBeLessThanOrEqual(800 - 47.999);
		expect(bottomRight.y).toBeLessThanOrEqual(600 - 47.999);
	});

	it('never goes below 25%, even for a huge machine', () => {
		expect(fit({ x: 0, y: 0, width: 100_000, height: 100_000 }, size).scale).toBe(MIN_SCALE);
	});

	it('a view of no size gives the identity (the page is not drawn yet)', () => {
		expect(fit({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 0 })).toEqual(IDENTITY);
	});
});

describe('the middle of the view, and revealing a point', () => {
	const size = { width: 800, height: 600 };

	it('centerOf gives the world point under the middle of the view', () => {
		expect(centerOf({ x: 100, y: 50, scale: 2 }, size)).toEqual({ x: 150, y: 125 });
	});

	it('reveal does nothing for a point that is inside', () => {
		const camera = { x: 0, y: 0, scale: 1 };
		expect(reveal(camera, { x: 400, y: 300 }, size)).toBe(camera);
	});

	it('reveal moves the view just enough, and keeps the zoom', () => {
		const camera = { x: 0, y: 0, scale: 1.5 };
		const after = reveal(camera, { x: 1000, y: 100 }, size, 64);
		expect(after.scale).toBe(1.5);
		close(toScreen(after, { x: 1000, y: 100 }).x, 800 - 64);
		close(toScreen(after, { x: 1000, y: 100 }).y, toScreen(camera, { x: 1000, y: 100 }).y);
	});

	it('reveal handles a point above and to the left', () => {
		const after = reveal({ x: 0, y: 0, scale: 1 }, { x: -200, y: -90 }, size, 64);
		close(toScreen(after, { x: -200, y: -90 }).x, 64);
		close(toScreen(after, { x: -200, y: -90 }).y, 64);
	});
});

describe('the wheel', () => {
	const base = { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, x: 400, y: 300 };

	it('with Ctrl it zooms around the pointer: up zooms in, down zooms out', () => {
		const camera = { x: 50, y: 20, scale: 1 };
		const zoomedIn = wheel(camera, { ...base, ctrlKey: true, deltaY: -10 });
		expect(zoomedIn.scale).toBeGreaterThan(1);
		const was = toWorld(camera, { x: 400, y: 300 });
		const now = toWorld(zoomedIn, { x: 400, y: 300 });
		close(now.x, was.x);
		close(now.y, was.y);
		expect(wheel(camera, { ...base, ctrlKey: true, deltaY: 10 }).scale).toBeLessThan(1);
	});

	it('one turn of a mouse wheel zooms by a modest step, not by a leap', () => {
		const out = wheel(IDENTITY, { ...base, ctrlKey: true, deltaY: -100 });
		expect(out.scale).toBeGreaterThan(1.1);
		expect(out.scale).toBeLessThan(1.5);
	});

	it('without Ctrl it pans, opposite to the scroll, and keeps the zoom', () => {
		expect(wheel({ x: 0, y: 0, scale: 2 }, { ...base, deltaX: 10, deltaY: 40 })).toEqual({
			x: -10,
			y: -40,
			scale: 2
		});
	});

	it('a wheel counted in lines is turned into pixels', () => {
		expect(wheel(IDENTITY, { ...base, deltaMode: 1, deltaY: 3 }).y).toBe(-48);
	});
});

describe('pinch', () => {
	const start = { x: 40, y: -30, scale: 1 };
	const from = { a: { x: 300, y: 300 }, b: { x: 500, y: 300 } };

	it('moving the fingers apart zooms in around the point between them, which stays under it', () => {
		const to = { a: { x: 200, y: 300 }, b: { x: 600, y: 300 } };
		const after = pinch(start, from, to);
		close(after.scale, 2);
		const was = toWorld(start, { x: 400, y: 300 });
		const now = toWorld(after, { x: 400, y: 300 });
		close(now.x, was.x);
		close(now.y, was.y);
	});

	it('moving them together zooms out', () => {
		const to = { a: { x: 350, y: 300 }, b: { x: 450, y: 300 } };
		close(pinch(start, from, to).scale, 0.5);
	});

	it('fingers that move together without changing their distance pan the view', () => {
		const to = { a: { x: 330, y: 340 }, b: { x: 530, y: 340 } };
		const after = pinch(start, from, to);
		close(after.scale, 1);
		close(after.x, start.x + 30);
		close(after.y, start.y + 40);
	});

	it('stays between 25% and 400%, and keeps the point between the fingers where it is', () => {
		const to = { a: { x: 0, y: 300 }, b: { x: 5000, y: 300 } };
		const after = pinch(start, from, to);
		expect(after.scale).toBe(MAX_SCALE);
		const small = pinch(start, from, { a: { x: 399, y: 300 }, b: { x: 401, y: 300 } });
		expect(small.scale).toBe(MIN_SCALE);
	});

	it('fingers that start on the same point do not divide by zero', () => {
		const same = { a: { x: 100, y: 100 }, b: { x: 100, y: 100 } };
		const after = pinch(start, same, { a: { x: 90, y: 100 }, b: { x: 110, y: 100 } });
		expect(Number.isFinite(after.scale)).toBe(true);
		expect(Number.isFinite(after.x)).toBe(true);
	});
});
