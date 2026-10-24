// Turning a message key into text, and remembering the language the user chose. Plain functions
// with no Svelte, so that they are easy to test. The reactive part is in index.svelte.ts.
import { en } from './en.ts';
import { id } from './id.ts';
import type { MessageKey } from './id.ts';

export const LOCALES = ['id', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'id';
export const STORAGE_KEY = 'webtomata.lang';

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { id, en };
export type Params = Record<string, string | number>;

/** Replaces {name} with the parameter. A parameter that is missing stays visible as {name}. */
export function format(template: string, params: Params = {}): string {
	return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
		Object.hasOwn(params, name) ? String(params[name]) : whole
	);
}

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
	return format(MESSAGES[locale][key], params);
}

export const isLocale = (value: unknown): value is Locale =>
	typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/** What `localStorage` offers. It can be missing or throw (a private window, blocked site data). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The language saved by the user, or Indonesian. Never throws. */
export function readLocale(storage: StorageLike | undefined): Locale {
	try {
		const saved = storage?.getItem(STORAGE_KEY);
		return isLocale(saved) ? saved : DEFAULT_LOCALE;
	} catch {
		return DEFAULT_LOCALE;
	}
}

/** Saves the language. The page works without it, so a failure is ignored. */
export function saveLocale(storage: StorageLike | undefined, locale: Locale): void {
	try {
		storage?.setItem(STORAGE_KEY, locale);
	} catch {
		// Blocked storage: the choice lasts until the page closes.
	}
}
