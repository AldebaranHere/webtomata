// How wide the side panel is on a laptop, and the limits. The panel can be pulled wider by its left
// edge (for the table); the width is in rem, is remembered on the device, and is always brought
// back inside the limits, also when the window gets smaller. No DOM. A phone has no handle: its
// panel is under the canvas.
import type { StorageLike } from '#lib/i18n/translate.ts';
import { deviceStorage } from './tour.ts';

export const PANEL_WIDTH_KEY = 'webtomata.panel.width';
/** The width today: the smallest too. */
export const DEFAULT_REM = 22;
export const MIN_REM = 22;
/** The panel is never wider than this, or than this share of the window. */
const MAX_REM = 56;
const MAX_SHARE = 0.6;
/** The canvas keeps at least this much. */
const CANVAS_MIN_REM = 20;
const ROOT_PX = 16;

export const pxToRem = (px: number, root = ROOT_PX) => px / root;

/** The widest panel for a window of `viewportPx`: 60% of it, at most 56 rem, and 20 rem stay for the canvas. */
export function maxRem(viewportPx: number): number {
	const window = pxToRem(viewportPx);
	const room = Math.min(MAX_REM, window * MAX_SHARE, window - CANVAS_MIN_REM);
	return Math.max(MIN_REM, Math.floor(room * 10) / 10);
}

/** A width inside the limits. What is not a number is the default. */
export function clampRem(rem: number, viewportPx: number): number {
	if (Number.isNaN(rem)) return DEFAULT_REM;
	return Math.min(maxRem(viewportPx), Math.max(MIN_REM, rem));
}

/** The width after a key on the handle, or null for a key that is not a step. The handle is on the left edge: Left pulls it out. */
export function stepRem(
	current: number,
	key: string,
	shift: boolean,
	viewportPx: number
): number | null {
	const step = shift ? 4 : 1;
	if (key === 'ArrowLeft') return clampRem(current + step, viewportPx);
	if (key === 'ArrowRight') return clampRem(current - step, viewportPx);
	if (key === 'Home') return MIN_REM;
	if (key === 'End') return maxRem(viewportPx);
	return null;
}

export function readWidth(
	viewportPx: number,
	storage: StorageLike | undefined = deviceStorage()
): number {
	try {
		const saved = storage?.getItem(PANEL_WIDTH_KEY);
		if (saved === null || saved === undefined || saved.trim() === '') return DEFAULT_REM;
		return clampRem(Number(saved), viewportPx);
	} catch {
		return DEFAULT_REM;
	}
}

export function saveWidth(rem: number, storage: StorageLike | undefined = deviceStorage()): void {
	try {
		storage?.setItem(PANEL_WIDTH_KEY, String(Math.round(rem * 10) / 10));
	} catch {
		// Not remembered, and that is all.
	}
}
