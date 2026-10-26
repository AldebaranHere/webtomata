// How high the side panel is on a phone, and the limits. The panel is under the canvas; it can be
// pulled up by the bar at its top (to see more of the list or the table) and pushed down. The height
// is a share of the editor, is remembered on the device, and is always brought back inside the
// limits, also when the window gets lower (the phone is turned). No DOM. A laptop has the width
// handle instead (panel-width.ts).
import type { StorageLike } from '#lib/i18n/translate.ts';
import { deviceStorage } from './tour.ts';

export const PANEL_HEIGHT_KEY = 'webtomata.panel.height';
/** The height today, as a share of the editor (percent). */
export const DEFAULT_PCT = 40;
export const MIN_PCT = 30;
const MAX_PCT = 80;
/** The editor keeps at least this much: 7 rem for the canvas, and room for the bar over it and the tools under the panel. */
const CANVAS_MIN_PX = 15 * 16;
/** A finger that moves less than this on the bar is a tap (it shows or hides the panel). */
export const TAP_PX = 8;
const STEP_PCT = 5;

const round = (pct: number) => Math.round(pct * 10) / 10;

/** The tallest panel for an editor of `containerPx`: 80%, and 15 rem stay for the canvas, its bar and the tools. */
export function maxPct(containerPx: number): number {
	const room = ((containerPx - CANVAS_MIN_PX) / containerPx) * 100;
	return Math.max(MIN_PCT, Math.floor(Math.min(MAX_PCT, room) * 10) / 10);
}

/** A height inside the limits. What is not a number is the default. */
export function clampPct(pct: number, containerPx: number): number {
	if (Number.isNaN(pct)) return DEFAULT_PCT;
	return Math.min(maxPct(containerPx), Math.max(MIN_PCT, pct));
}

/** The height while a finger drags the bar from `startY` to `y`: up is taller. */
export function dragPct(startPct: number, startY: number, y: number, containerPx: number): number {
	return round(clampPct(startPct + ((startY - y) / containerPx) * 100, containerPx));
}

/** The height after a key on the bar, or null for a key that is not a step. Up is taller. */
export function stepPct(current: number, key: string, containerPx: number): number | null {
	if (key === 'ArrowUp') return clampPct(current + STEP_PCT, containerPx);
	if (key === 'ArrowDown') return clampPct(current - STEP_PCT, containerPx);
	if (key === 'Home') return MIN_PCT;
	if (key === 'End') return maxPct(containerPx);
	return null;
}

export function readHeight(
	containerPx: number,
	storage: StorageLike | undefined = deviceStorage()
): number {
	try {
		const saved = storage?.getItem(PANEL_HEIGHT_KEY);
		if (saved === null || saved === undefined || saved.trim() === '') return DEFAULT_PCT;
		return clampPct(Number(saved), containerPx);
	} catch {
		return DEFAULT_PCT;
	}
}

export function saveHeight(pct: number, storage: StorageLike | undefined = deviceStorage()): void {
	try {
		storage?.setItem(PANEL_HEIGHT_KEY, String(round(pct)));
	} catch {
		// Not remembered, and that is all.
	}
}
