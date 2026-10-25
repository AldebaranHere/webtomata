// The tabs of the side panel, and which one was open last on this device. A blocked or missing
// `localStorage` means "Simulasi", and nothing else (like the tour, tour.ts).
import type { StorageLike } from '#lib/i18n/translate.ts';
import { deviceStorage } from './tour.ts';

export const PANEL_TAB_KEY = 'webtomata.panel.tab';
export const PANEL_TABS = ['simulation', 'table', 'definition'] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

const isTab = (value: unknown): value is PanelTab =>
	typeof value === 'string' && (PANEL_TABS as readonly string[]).includes(value);

export function readTab(storage: StorageLike | undefined = deviceStorage()): PanelTab {
	try {
		const saved = storage?.getItem(PANEL_TAB_KEY);
		return isTab(saved) ? saved : 'simulation';
	} catch {
		return 'simulation';
	}
}

export function saveTab(tab: PanelTab, storage: StorageLike | undefined = deviceStorage()): void {
	try {
		storage?.setItem(PANEL_TAB_KEY, tab);
	} catch {
		// Not remembered, and that is all.
	}
}

/** The tab that an arrow key, Home or End goes to, or null for any other key. The arrows go round. */
export function nextTab(current: PanelTab, key: string): PanelTab | null {
	const at = PANEL_TABS.indexOf(current);
	if (key === 'ArrowRight') return PANEL_TABS[(at + 1) % PANEL_TABS.length]!;
	if (key === 'ArrowLeft') return PANEL_TABS[(at + PANEL_TABS.length - 1) % PANEL_TABS.length]!;
	if (key === 'Home') return PANEL_TABS[0];
	if (key === 'End') return PANEL_TABS[PANEL_TABS.length - 1]!;
	return null;
}
