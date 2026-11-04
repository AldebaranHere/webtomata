import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets.ts';

describe('PRESETS (language)', () => {
	it('provides non-empty, distinct id and en text for each preset (AC1)', () => {
		for (const preset of PRESETS) {
			expect(preset.nameId.trim().length).toBeGreaterThan(0);
			expect(preset.nameEn.trim().length).toBeGreaterThan(0);
			expect(preset.descriptionId.trim().length).toBeGreaterThan(0);
			expect(preset.descriptionEn.trim().length).toBeGreaterThan(0);

			// En text must not equal Id text unless the text has no letters other than math symbols
			expect(preset.nameEn).not.toEqual(preset.nameId);
			expect(preset.descriptionEn).not.toEqual(preset.descriptionId);
		}
	});

	it('contains all expected preset ids and valid formulas', () => {
		const ids = PRESETS.map((p) => p.id);
		expect(ids).toEqual([
			'L1',
			'L2',
			'L3',
			'L4',
			'L5',
			'L6',
			'L7',
			'L8',
			'L9',
			'L10',
			'L11',
			'L23',
			'L35',
			'L47',
			'L55',
			'L59'
		]);

		for (const preset of PRESETS) {
			expect(preset.formula.trim().length).toBeGreaterThan(0);
		}
	});
});
