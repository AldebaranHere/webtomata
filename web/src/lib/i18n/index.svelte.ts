// The language of the page, as Svelte state. `t(key)` gives the text in the language now, so a
// template that calls it changes when the user switches the language. The prerendered pages are
// Indonesian; `loadLocale()` (called once after the page loads) applies the saved choice.
import type { MessageKey } from './id.ts';
import { DEFAULT_LOCALE, readLocale, saveLocale, translate } from './translate.ts';
import type { Locale, Params } from './translate.ts';

let locale = $state<Locale>(DEFAULT_LOCALE);

// Reading `localStorage` can throw (blocked site data), so even the lookup is guarded.
function storage() {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

function apply(next: Locale) {
	locale = next;
	document.documentElement.lang = next;
}

export const t = (key: MessageKey, params?: Params): string => translate(locale, key, params);
export const getLocale = (): Locale => locale;

/** Switches the language and remembers the choice on this device. */
export function setLocale(next: Locale): void {
	apply(next);
	saveLocale(storage(), next);
}

/** Applies the language that the user saved. Call it once, in the browser. */
export function loadLocale(): void {
	apply(readLocale(storage()));
}
