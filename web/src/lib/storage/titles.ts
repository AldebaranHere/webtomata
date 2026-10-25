// The titles of machines that come from our own content. Such a machine has its title in both
// languages, and the page shows the one of the language that is active, as long as the title of the
// document is still one of them. A title that the user chooses is the user's, and is never translated.
import { endsWith01 } from '../editor/diagram/samples.ts';
import type { Sample } from './machines.ts';
import type { Titles } from './store.ts';

type Locale = 'id' | 'en';

/** The sample that the Sandbox opens the first time. X1 (the examples) replaces it with a list. */
export const SAMPLE_TITLES: Titles = { id: 'Berakhiran 01', en: 'Ending in 01' };

/** The title to show for a machine: the one of the language, or the title as it is. */
export function localizedTitle(titles: Titles | undefined, title: string, locale: Locale): string {
	if (titles && (title === titles.id || title === titles.en)) return titles[locale];
	return title;
}

/** The sample, with the title of the language that is active now, and both titles for the record. */
export function makeSample(locale: Locale): Sample {
	return { doc: endsWith01(SAMPLE_TITLES[locale]), titles: SAMPLE_TITLES };
}
