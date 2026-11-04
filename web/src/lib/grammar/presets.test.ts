import { describe, expect, it } from 'vitest';
import { GRAMMAR_PRESETS } from './presets.ts';

describe('GRAMMAR_PRESETS', () => {
	it('contains the five original CNF presets and four CFG presets', () => {
		const ids = GRAMMAR_PRESETS.map((p) => p.id);
		expect(ids).toEqual([
			'CNF_ORDER',
			'CNF_NULLABLE',
			'CNF_START_LONG',
			'CNF_UNIT_CHAIN',
			'CNF_SHARED_TAIL',
			'CFG_PAL',
			'CFG_PAREN',
			'CFG_ANBN',
			'CFG_EQ'
		]);
	});

	it('does not contain any course homework or fasilkom references', () => {
		for (const preset of GRAMMAR_PRESETS) {
			expect(preset.titleId).not.toMatch(/hw05|fasilkom|homework/i);
			expect(preset.titleEn).not.toMatch(/hw05|fasilkom|homework/i);
			expect(preset.descriptionId).not.toMatch(/hw05|fasilkom|homework/i);
			expect(preset.descriptionEn).not.toMatch(/hw05|fasilkom|homework/i);
			expect(preset.id).not.toMatch(/hw05|fasilkom/i);
		}
	});

	it('provides non-empty, distinct id and en text for each preset (AC1)', () => {
		for (const preset of GRAMMAR_PRESETS) {
			expect(preset.titleId.trim().length).toBeGreaterThan(0);
			expect(preset.titleEn.trim().length).toBeGreaterThan(0);
			expect(preset.descriptionId.trim().length).toBeGreaterThan(0);
			expect(preset.descriptionEn.trim().length).toBeGreaterThan(0);

			// En text must not equal Id text unless the text has no letters other than math symbols
			expect(preset.titleEn).not.toEqual(preset.titleId);
			expect(preset.descriptionEn).not.toEqual(preset.descriptionId);
		}
	});

	it('preserves the four standard CFG presets', () => {
		const cfgPal = GRAMMAR_PRESETS.find((p) => p.id === 'CFG_PAL');
		expect(cfgPal).toBeDefined();
		expect(cfgPal?.grammar).toContain('S -> aSa | bSb | a | b | λ');

		const cfgParen = GRAMMAR_PRESETS.find((p) => p.id === 'CFG_PAREN');
		expect(cfgParen).toBeDefined();
		expect(cfgParen?.grammar).toContain('S -> (S)S | λ');

		const cfgAnbn = GRAMMAR_PRESETS.find((p) => p.id === 'CFG_ANBN');
		expect(cfgAnbn).toBeDefined();
		expect(cfgAnbn?.grammar).toContain('S -> aSb | ab');

		const cfgEq = GRAMMAR_PRESETS.find((p) => p.id === 'CFG_EQ');
		expect(cfgEq).toBeDefined();
		expect(cfgEq?.grammar).toContain('S -> aSbS | bSaS | λ');
	});
});
