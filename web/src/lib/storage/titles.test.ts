import { describe, expect, it } from 'vitest';
import { localizedTitle } from './titles.ts';

describe('localizedTitle', () => {
	const titles = { id: 'Berakhiran 01', en: 'Ending in 01' };

	it('shows the title of the language, while the title is still one that the content gave', () => {
		expect(localizedTitle(titles, 'Berakhiran 01', 'en')).toBe('Ending in 01');
		expect(localizedTitle(titles, 'Berakhiran 01', 'id')).toBe('Berakhiran 01');
		// A machine that was made in English has the English title in its document.
		expect(localizedTitle(titles, 'Ending in 01', 'id')).toBe('Berakhiran 01');
		expect(localizedTitle(titles, 'Ending in 01', 'en')).toBe('Ending in 01');
	});

	it('a title that the user chose is shown as it is, in any language', () => {
		expect(localizedTitle(titles, 'Genap a', 'en')).toBe('Genap a');
		expect(localizedTitle(titles, '', 'en')).toBe('');
	});

	it('a machine without titles shows its own title', () => {
		expect(localizedTitle(undefined, 'Berakhiran 01', 'en')).toBe('Berakhiran 01');
	});
});
