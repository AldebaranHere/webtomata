import { describe, expect, it } from 'vitest';
import type { StorageLike } from '#lib/i18n/translate.ts';
import { PANEL_TAB_KEY, PANEL_TABS, nextTab, readTab, saveTab } from './panel-tab.ts';

const memory = (): StorageLike & { data: Map<string, string> } => {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => void data.set(key, value)
	};
};
const blocked: StorageLike = {
	getItem() {
		throw new Error('SecurityError');
	},
	setItem() {
		throw new Error('SecurityError');
	}
};

describe('the tabs of the panel', () => {
	it('are Simulasi, Tabel, Definisi and Konversi, in that order', () => {
		expect(PANEL_TABS).toEqual(['simulation', 'table', 'definition', 'conversion']);
	});

	it('start on Simulasi, and remember the last choice on this device', () => {
		const storage = memory();
		expect(readTab(storage)).toBe('simulation');
		saveTab('definition', storage);
		expect(readTab(storage)).toBe('definition');
		expect(storage.data.get(PANEL_TAB_KEY)).toBe('definition');
	});

	it('a value that is not a tab is Simulasi', () => {
		const storage = memory();
		storage.setItem(PANEL_TAB_KEY, 'konversi');
		expect(readTab(storage)).toBe('simulation');
	});

	it('never throws when the storage is blocked or missing', () => {
		expect(readTab(blocked)).toBe('simulation');
		expect(() => saveTab('table', blocked)).not.toThrow();
		expect(readTab(undefined)).toBe('simulation');
		expect(() => saveTab('table', undefined)).not.toThrow();
	});

	it('the arrow keys go round, and Home and End go to the ends', () => {
		expect(nextTab('simulation', 'ArrowRight')).toBe('table');
		expect(nextTab('definition', 'ArrowRight')).toBe('conversion');
		expect(nextTab('conversion', 'ArrowRight')).toBe('simulation');
		expect(nextTab('simulation', 'ArrowLeft')).toBe('conversion');
		expect(nextTab('table', 'ArrowLeft')).toBe('simulation');
		expect(nextTab('table', 'Home')).toBe('simulation');
		expect(nextTab('table', 'End')).toBe('conversion');
		expect(nextTab('table', 'Enter')).toBeNull();
	});
});

describe('a panel with fewer tabs', () => {
	const three = ['simulation', 'table', 'definition'] as const;

	it('moves round the tabs that it has', () => {
		expect(nextTab('definition', 'ArrowRight', three)).toBe('simulation');
		expect(nextTab('simulation', 'ArrowLeft', three)).toBe('definition');
		expect(nextTab('simulation', 'End', three)).toBe('definition');
		expect(nextTab('table', 'Home', three)).toBe('simulation');
	});

	it('opens the first tab when the one that was saved is not among them', () => {
		const storage = { getItem: () => 'conversion', setItem: () => undefined };
		expect(readTab(storage, three)).toBe('simulation');
		expect(readTab({ getItem: () => 'table', setItem: () => undefined }, three)).toBe('table');
	});
});
