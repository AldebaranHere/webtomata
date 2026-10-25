import { describe, expect, it } from 'vitest';
import type { StorageLike } from '#lib/i18n/translate.ts';
import {
	DEFAULT_REM,
	MIN_REM,
	PANEL_WIDTH_KEY,
	clampRem,
	maxRem,
	pxToRem,
	readWidth,
	saveWidth,
	stepRem
} from './panel-width.ts';

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

// A laptop of 1440 px: 90 rem. The panel may take 60% of it (54 rem) and the canvas keeps 20 rem.
const LAPTOP = 1440;

describe('the limits of the width of the panel', () => {
	it('the default is 22 rem, and that is also the smallest', () => {
		expect(DEFAULT_REM).toBe(22);
		expect(MIN_REM).toBe(22);
	});

	it('the biggest is 60% of the window, at most 56 rem, and it leaves 20 rem for the canvas', () => {
		expect(maxRem(LAPTOP)).toBe(54);
		expect(maxRem(3000)).toBe(56);
		// A window of 40 rem: 60% is 24 rem, and the canvas keeps 20 rem, so the panel gets 20 rem; but never less than the smallest.
		expect(maxRem(640)).toBe(22);
	});

	it('a width is brought into the limits', () => {
		expect(clampRem(10, LAPTOP)).toBe(22);
		expect(clampRem(30, LAPTOP)).toBe(30);
		expect(clampRem(80, LAPTOP)).toBe(54);
		expect(clampRem(Number.NaN, LAPTOP)).toBe(22);
		expect(clampRem(Infinity, LAPTOP)).toBe(54);
		expect(clampRem(-Infinity, LAPTOP)).toBe(22);
	});

	it('a smaller window brings a saved width back', () => {
		expect(clampRem(50, 1000)).toBe(maxRem(1000));
	});

	it('pixels are rem', () => {
		expect(pxToRem(352)).toBe(22);
		expect(pxToRem(8, 8)).toBe(1);
	});
});

describe('the steps of the keyboard', () => {
	it('Left makes it 1 rem wider, Right 1 rem narrower: the handle is on the left edge, so Left pulls it out', () => {
		expect(stepRem(30, 'ArrowLeft', false, LAPTOP)).toBe(31);
		expect(stepRem(30, 'ArrowRight', false, LAPTOP)).toBe(29);
	});

	it('with Shift the step is 4 rem', () => {
		expect(stepRem(30, 'ArrowLeft', true, LAPTOP)).toBe(34);
		expect(stepRem(30, 'ArrowRight', true, LAPTOP)).toBe(26);
	});

	it('stops at the limits, and Home and End go to them', () => {
		expect(stepRem(22, 'ArrowRight', false, LAPTOP)).toBe(22);
		expect(stepRem(54, 'ArrowLeft', false, LAPTOP)).toBe(54);
		expect(stepRem(30, 'Home', false, LAPTOP)).toBe(22);
		expect(stepRem(30, 'End', false, LAPTOP)).toBe(54);
	});

	it('any other key is not a step', () => {
		expect(stepRem(30, 'Enter', false, LAPTOP)).toBeNull();
		expect(stepRem(30, 'ArrowUp', false, LAPTOP)).toBeNull();
	});
});

describe('remembering the width on this device', () => {
	it('starts at the default, and keeps what was saved (inside the limits)', () => {
		const storage = memory();
		expect(readWidth(LAPTOP, storage)).toBe(22);
		saveWidth(36, storage);
		expect(readWidth(LAPTOP, storage)).toBe(36);
		expect(storage.data.get(PANEL_WIDTH_KEY)).toBe('36');
	});

	it('a value that is not a number, or is out of the limits, is brought back', () => {
		const storage = memory();
		storage.setItem(PANEL_WIDTH_KEY, 'wide');
		expect(readWidth(LAPTOP, storage)).toBe(22);
		storage.setItem(PANEL_WIDTH_KEY, '400');
		expect(readWidth(LAPTOP, storage)).toBe(54);
		storage.setItem(PANEL_WIDTH_KEY, '-5');
		expect(readWidth(LAPTOP, storage)).toBe(22);
		storage.setItem(PANEL_WIDTH_KEY, '');
		expect(readWidth(LAPTOP, storage)).toBe(22);
	});

	it('never throws when the storage is blocked or missing', () => {
		expect(readWidth(LAPTOP, blocked)).toBe(22);
		expect(() => saveWidth(30, blocked)).not.toThrow();
		expect(readWidth(LAPTOP, undefined)).toBe(22);
		expect(() => saveWidth(30, undefined)).not.toThrow();
	});

	it('saves a whole number of tenths of a rem, not a long fraction', () => {
		const storage = memory();
		saveWidth(30.123456, storage);
		expect(storage.data.get(PANEL_WIDTH_KEY)).toBe('30.1');
	});
});
