// The tabs of the side panel, and which one was open last on this device. A blocked or missing
// `localStorage` means "Simulasi", and nothing else (like the tour, tour.ts).
import type { StorageLike } from '#lib/i18n/translate.ts';
import { deviceStorage } from './tour.ts';

export const PANEL_TAB_KEY = 'webtomata.panel.tab';
export const PANEL_TABS = ['simulation', 'table', 'definition', 'conversion'] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

const isTab = (value: unknown): value is PanelTab =>
	typeof value === 'string' && (PANEL_TABS as readonly string[]).includes(value);

/** The tab that was open last, when the panel has it (`tabs` is the list of tabs of this panel); else the first. */
export function readTab(
	storage: StorageLike | undefined = deviceStorage(),
	tabs: readonly PanelTab[] = PANEL_TABS
): PanelTab {
	try {
		const saved = storage?.getItem(PANEL_TAB_KEY);
		return isTab(saved) && tabs.includes(saved) ? saved : tabs[0]!;
	} catch {
		return tabs[0]!;
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
export function nextTab(
	current: PanelTab,
	key: string,
	tabs: readonly PanelTab[] = PANEL_TABS
): PanelTab | null {
	const at = tabs.indexOf(current);
	if (key === 'ArrowRight') return tabs[(at + 1) % tabs.length]!;
	if (key === 'ArrowLeft') return tabs[(at + tabs.length - 1) % tabs.length]!;
	if (key === 'Home') return tabs[0]!;
	if (key === 'End') return tabs[tabs.length - 1]!;
	return null;
}
