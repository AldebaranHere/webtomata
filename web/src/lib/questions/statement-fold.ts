// Whether the statement of a question is shown on a phone, and the choice kept on this device. It is
// hidden until the student opens it, so that the canvas and the panel have the room (a laptop always shows
// the statement in its own column). A blocked or missing `localStorage` means "hidden", and nothing else
// (like the tour, tour.ts).
import type { StorageLike } from '#lib/i18n/translate.ts';
import { deviceStorage } from '#lib/editor/tour.ts';

export const FOLD_KEY = 'webtomata.question.open';

export function readOpen(storage: StorageLike | undefined = deviceStorage()): boolean {
	try {
		return storage?.getItem(FOLD_KEY) === '1';
	} catch {
		return false;
	}
}

export function saveOpen(open: boolean, storage: StorageLike | undefined = deviceStorage()): void {
	try {
		storage?.setItem(FOLD_KEY, open ? '1' : '0');
	} catch {
		// Not remembered, and that is all.
	}
}
