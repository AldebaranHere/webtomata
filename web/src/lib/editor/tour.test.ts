import { describe, expect, it } from 'vitest';
import { MESSAGES } from '#lib/i18n/translate.ts';
import type { StorageLike } from '#lib/i18n/translate.ts';
import type { MessageKey } from '#lib/i18n/id.ts';
import { TOOLS } from './tools.ts';
import { TOUR, TOUR_KEY, TOUR_STEPS, markTourSeen, nameKeys, tourKeys, tourSeen } from './tour.ts';

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

describe('remembering that the tour was seen', () => {
	it('starts as not seen, and is seen after it is marked', () => {
		const storage = memory();
		expect(tourSeen(storage)).toBe(false);
		markTourSeen(storage);
		expect(tourSeen(storage)).toBe(true);
		expect(storage.data.get(TOUR_KEY)).toBe('seen');
	});

	it('reads only its own value: anything else is not seen', () => {
		const storage = memory();
		storage.setItem(TOUR_KEY, 'maybe');
		expect(tourSeen(storage)).toBe(false);
	});

	it('never throws when the storage is blocked, or missing: not seen, and no error', () => {
		expect(tourSeen(blocked)).toBe(false);
		expect(() => markTourSeen(blocked)).not.toThrow();
		expect(tourSeen(undefined)).toBe(false);
		expect(() => markTourSeen(undefined)).not.toThrow();
	});
});

describe('the steps of the tour', () => {
	const textOf = (locale: 'id' | 'en', key: MessageKey) => MESSAGES[locale][key];

	it('are five, and every text they use exists in both languages', () => {
		expect(TOUR).toHaveLength(TOUR_STEPS);
		expect(TOUR_STEPS).toBe(5);
		for (const step of TOUR) {
			for (const key of tourKeys(step)) {
				expect(Object.hasOwn(MESSAGES.id, key), `id ${key}`).toBe(true);
				expect(Object.hasOwn(MESSAGES.en, key), `en ${key}`).toBe(true);
			}
		}
	});

	it('every step shows the control that it is about, so that a beginner can find it', () => {
		for (const step of TOUR) expect(step.items.length, step.title).toBeGreaterThan(0);
	});

	it('a tool that is shown is a real tool of the rail, with its own name, icon and key', () => {
		const shown = TOUR.flatMap((s) => s.items).filter((i) => i.kind === 'tool');
		expect(shown.map((i) => i.tool)).toEqual(['addState', 'transition', 'select']);
		for (const item of shown) {
			const real = TOOLS.find((t) => t.tool === item.tool);
			expect(real, item.tool).toBeDefined();
		}
	});

	it('the text of a step names the control with the same word as the control, in both languages', () => {
		for (const locale of ['id', 'en'] as const) {
			for (const step of TOUR) {
				const body = textOf(locale, step.body);
				for (const item of step.items) {
					const names = nameKeys(item).map((key) => textOf(locale, key));
					for (const name of names) {
						expect(body, `${locale} ${step.title} must say "${name}"`).toContain(name);
					}
				}
			}
		}
	});

	it('says where the controls are, for a wide and for a narrow screen', () => {
		for (const step of TOUR) {
			expect(['tools', 'panel']).toContain(step.where);
		}
		for (const key of [
			'tour.where_tools_wide',
			'tour.where_tools_narrow',
			'tour.where_panel_wide',
			'tour.where_panel_narrow'
		] as const) {
			expect(Object.hasOwn(MESSAGES.id, key)).toBe(true);
			expect(Object.hasOwn(MESSAGES.en, key)).toBe(true);
		}
	});
});
