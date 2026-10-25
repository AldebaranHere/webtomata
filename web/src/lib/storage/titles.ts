// The titles of machines that come from our own content. Such a machine has its title in both
// languages, and the page shows the one of the language that is active, as long as the title of the
// document is still one of them. A title that the user chooses is the user's, and is never translated.
import type { Titles } from './store.ts';

type Locale = 'id' | 'en';

/** The title to show for a machine: the one of the language, or the title as it is. */
export function localizedTitle(titles: Titles | undefined, title: string, locale: Locale): string {
	if (titles && (title === titles.id || title === titles.en)) return titles[locale];
	return title;
}
