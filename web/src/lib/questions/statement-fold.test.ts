import { describe, expect, it } from 'vitest';
import type { StorageLike } from '#lib/i18n/translate.ts';
import { FOLD_KEY, readOpen, saveOpen } from './statement-fold.ts';

const memory = (): StorageLike & { data: Map<string, string> } => {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value)
	};
};

describe('whether a phone shows the statement of a question', () => {
	it('is hidden until the student opens it', () => {
		expect(readOpen(memory())).toBe(false);
		expect(readOpen(undefined)).toBe(false);
	});

	it('remembers the choice on this device', () => {
		const storage = memory();
		saveOpen(true, storage);
		expect(storage.data.get(FOLD_KEY)).toBe('1');
		expect(readOpen(storage)).toBe(true);
		saveOpen(false, storage);
		expect(readOpen(storage)).toBe(false);
	});

	it('takes any other saved value as hidden', () => {
		for (const value of ['', 'true', '2', 'open', '0']) {
			const storage = memory();
			storage.setItem(FOLD_KEY, value);
			expect(readOpen(storage), value).toBe(false);
		}
	});

	it('does not fail when the storage is blocked', () => {
		const blocked: StorageLike = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		expect(readOpen(blocked)).toBe(false);
		expect(() => saveOpen(true, blocked)).not.toThrow();
	});
});
