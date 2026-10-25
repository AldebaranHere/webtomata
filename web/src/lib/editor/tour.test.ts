import { describe, expect, it } from 'vitest';
import { TOUR_KEY, markTourSeen, tourSeen } from './tour.ts';
import type { StorageLike } from '#lib/i18n/translate.ts';

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

describe('remembering that the tour was seen', () => {
	it('starts as not seen, and is seen after it is marked', () => {
		const storage = memory();
		expect(tourSeen(storage)).toBe(false);
		markTourSeen(storage);
		expect(tourSeen(storage)).toBe(true);
		expect(storage.data.get(TOUR_KEY)).toBe('seen');
	});

	it('reads only its own value: anything else is not seen', () => {
		const storage = memory();
		storage.setItem(TOUR_KEY, 'maybe');
		expect(tourSeen(storage)).toBe(false);
	});

	it('never throws when the storage is blocked, or missing: not seen, and no error', () => {
		expect(tourSeen(blocked)).toBe(false);
		expect(() => markTourSeen(blocked)).not.toThrow();
		expect(tourSeen(undefined)).toBe(false);
		expect(() => markTourSeen(undefined)).not.toThrow();
	});
});
