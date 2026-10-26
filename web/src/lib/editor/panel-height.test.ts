import { describe, expect, it } from 'vitest';
import type { StorageLike } from '#lib/i18n/translate.ts';
import {
	DEFAULT_PCT,
	MIN_PCT,
	PANEL_HEIGHT_KEY,
	TAP_PX,
	clampPct,
	dragPct,
	maxPct,
	readHeight,
	saveHeight,
	stepPct
} from './panel-height.ts';

const memory = (): StorageLike & { data: Map<string, string> } => {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value)
	};
};
const blocked: StorageLike = {
	getItem() {
		throw new Error('SecurityError');
	},
	setItem() {
		throw new Error('SecurityError');
	}
};

// A tall phone: the editor under the header is about 900 px high.
const PHONE = 900;

describe('the limits of the height of the panel on a phone', () => {
	it('is 40% at first, and at least 30%', () => {
		expect(DEFAULT_PCT).toBe(40);
		expect(MIN_PCT).toBe(30);
	});

	it('is at most 80%, and 15 rem (240 px) stay for the canvas, its bar and the tools', () => {
		// 900 px: 240 px is 26.7% of it, so the panel may take 73.3%.
		expect(maxPct(PHONE)).toBe(73.3);
		// 700 px: 240 px is 34.3%, so 65.7%.
		expect(maxPct(700)).toBe(65.7);
		// Only a very tall editor reaches the 80% of the rule.
		expect(maxPct(1600)).toBe(80);
		// A window that is too low for both limits keeps the smallest panel.
		expect(maxPct(300)).toBe(MIN_PCT);
	});

	it('brings a value inside the limits, and a bad value to the default', () => {
		expect(clampPct(10, PHONE)).toBe(MIN_PCT);
		expect(clampPct(95, PHONE)).toBe(73.3);
		expect(clampPct(55, PHONE)).toBe(55);
		expect(clampPct(Number.NaN, PHONE)).toBe(DEFAULT_PCT);
		expect(clampPct(Number.POSITIVE_INFINITY, PHONE)).toBe(73.3);
	});
});

describe('dragging the bar', () => {
	it('up makes the panel taller and down makes it shorter, by the share of the screen that moved', () => {
		// 90 px of 900 px is 10 percentage points.
		expect(dragPct(40, 500, 410, PHONE)).toBe(50);
		expect(dragPct(40, 500, 590, PHONE)).toBe(30);
	});

	it('stays inside the limits however far the finger goes', () => {
		expect(dragPct(40, 500, -4000, PHONE)).toBe(73.3);
		expect(dragPct(40, 500, 4000, PHONE)).toBe(MIN_PCT);
	});

	it('a move of less than a few pixels is a tap, not a drag', () => {
		expect(TAP_PX).toBe(8);
	});
});

describe('the keys on the bar', () => {
	it('Up and Down change the height by 5 points, and Home and End go to the limits', () => {
		expect(stepPct(40, 'ArrowUp', PHONE)).toBe(45);
		expect(stepPct(40, 'ArrowDown', PHONE)).toBe(35);
		expect(stepPct(40, 'Home', PHONE)).toBe(MIN_PCT);
		expect(stepPct(40, 'End', PHONE)).toBe(73.3);
		expect(stepPct(71, 'ArrowUp', PHONE)).toBe(73.3);
		expect(stepPct(31, 'ArrowDown', PHONE)).toBe(MIN_PCT);
	});

	it('any other key is not a step', () => {
		expect(stepPct(40, 'Enter', PHONE)).toBeNull();
		expect(stepPct(40, ' ', PHONE)).toBeNull();
		expect(stepPct(40, 'ArrowLeft', PHONE)).toBeNull();
	});
});

describe('remembering the height', () => {
	it('starts at the default and remembers the last height on this device', () => {
		const storage = memory();
		expect(readHeight(PHONE, storage)).toBe(DEFAULT_PCT);
		saveHeight(63.456, storage);
		expect(storage.data.get(PANEL_HEIGHT_KEY)).toBe('63.5');
		expect(readHeight(PHONE, storage)).toBe(63.5);
	});

	it('a saved height outside the limits is brought inside them when it is read', () => {
		const storage = memory();
		storage.setItem(PANEL_HEIGHT_KEY, '95');
		expect(readHeight(PHONE, storage)).toBe(73.3);
		storage.setItem(PANEL_HEIGHT_KEY, '5');
		expect(readHeight(PHONE, storage)).toBe(MIN_PCT);
		// A shorter window re-reads the same value inside its own limits.
		storage.setItem(PANEL_HEIGHT_KEY, '78');
		expect(readHeight(700, storage)).toBe(65.7);
	});

	it('a missing, empty or bad value is the default', () => {
		const storage = memory();
		for (const bad of ['', '  ', 'tall', 'NaN']) {
			storage.setItem(PANEL_HEIGHT_KEY, bad);
			expect(readHeight(PHONE, storage)).toBe(DEFAULT_PCT);
		}
	});

	it('never throws when the storage is blocked or missing', () => {
		expect(readHeight(PHONE, blocked)).toBe(DEFAULT_PCT);
		expect(() => saveHeight(50, blocked)).not.toThrow();
		expect(readHeight(PHONE, undefined)).toBe(DEFAULT_PCT);
		expect(() => saveHeight(50, undefined)).not.toThrow();
	});
});
