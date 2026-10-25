// The one-minute tour: how many steps it has, and whether this device has seen it. Seen means that
// it was finished, skipped or closed once; the first-run card then stops offering it (the "?"
// button in the bar still opens it). Reading or writing the storage can throw (blocked site data):
// then the tour is simply "not seen" and nothing is remembered.
import type { StorageLike } from '#lib/i18n/translate.ts';

export const TOUR_KEY = 'webtomata.tour';
export const TOUR_STEPS = 5;

/** What `localStorage` gives on this page, or nothing when the browser refuses it. */
export function deviceStorage(): StorageLike | undefined {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

export function tourSeen(storage: StorageLike | undefined = deviceStorage()): boolean {
	try {
		return storage?.getItem(TOUR_KEY) === 'seen';
	} catch {
		return false;
	}
}

export function markTourSeen(storage: StorageLike | undefined = deviceStorage()): void {
	try {
		storage?.setItem(TOUR_KEY, 'seen');
	} catch {
		// Not remembered, and that is all.
	}
}
