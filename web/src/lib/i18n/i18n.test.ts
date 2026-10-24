import { describe, expect, it } from 'vitest';
import { en } from './en.ts';
import { id } from './id.ts';
import type { MessageKey } from './id.ts';
import {
	DEFAULT_LOCALE,
	STORAGE_KEY,
	format,
	isLocale,
	readLocale,
	saveLocale,
	translate
} from './translate.ts';
import type { StorageLike } from './translate.ts';

const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('the messages', () => {
	const keys = Object.keys(id) as MessageKey[];

	it('have the same keys in Indonesian and English', () => {
		expect(Object.keys(en).sort()).toEqual([...keys].sort());
	});

	it('are never empty', () => {
		for (const key of keys) {
			expect(id[key].trim(), `id: ${key}`).not.toBe('');
			expect(en[key].trim(), `en: ${key}`).not.toBe('');
		}
	});

	it('use the same parameters in both languages', () => {
		for (const key of keys) {
			expect(parameters(en[key]), key).toEqual(parameters(id[key]));
		}
	});

	it('are not the same long text in both languages (a message that was not translated)', () => {
		for (const key of keys) {
			// A language is always named in its own language, so the same text is right there.
			if (key.startsWith('lang.')) continue;
			if (id[key] === en[key]) expect(id[key].length, key).toBeLessThan(20);
		}
	});
});

describe('format', () => {
	it('replaces each parameter', () => {
		expect(format('{a} dan {b}', { a: 'x', b: 2 })).toBe('x dan 2');
	});

	it('leaves a missing parameter visible', () => {
		expect(format('Halo {name}')).toBe('Halo {name}');
	});

	it('does not read inherited properties as parameters', () => {
		expect(format('{toString} {constructor}', {})).toBe('{toString} {constructor}');
	});

	it('does not treat the value of a parameter as a template', () => {
		expect(format('{a}', { a: '{b}', b: 'no' })).toBe('{b}');
	});
});

describe('translate', () => {
	it('gives the text of the language', () => {
		expect(translate('id', 'nav.soal')).toBe('Soal');
		expect(translate('en', 'nav.soal')).toBe('Questions');
	});
});

describe('the saved language', () => {
	const memory = (initial?: string): StorageLike & { value?: string } => {
		const storage = {
			value: initial,
			getItem: () => storage.value ?? null,
			setItem: (_key: string, value: string) => {
				storage.value = value;
			}
		};
		return storage;
	};

	it('is Indonesian when nothing is saved', () => {
		expect(readLocale(memory())).toBe(DEFAULT_LOCALE);
		expect(DEFAULT_LOCALE).toBe('id');
	});

	it('is what was saved', () => {
		const storage = memory();
		saveLocale(storage, 'en');
		expect(storage.value).toBe('en');
		expect(readLocale(storage)).toBe('en');
	});

	it('ignores a saved value that is not a language', () => {
		expect(readLocale(memory('fr'))).toBe('id');
		expect(readLocale(memory('__proto__'))).toBe('id');
	});

	it('never throws when the storage is missing or blocked', () => {
		const blocked: StorageLike = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		expect(readLocale(undefined)).toBe('id');
		expect(readLocale(blocked)).toBe('id');
		expect(() => saveLocale(undefined, 'en')).not.toThrow();
		expect(() => saveLocale(blocked, 'en')).not.toThrow();
	});

	it('is saved under one key, and only a language is accepted', () => {
		expect(STORAGE_KEY).toBe('webtomata.lang');
		expect(isLocale('en')).toBe(true);
		expect(isLocale('xx')).toBe(false);
		expect(isLocale(null)).toBe(false);
	});
});
