// Preloads the two UI fonts (Plus Jakarta Sans 400/600) on prose guide pages (/panduan) so the
// browser fetches them alongside the stylesheets instead of discovering them after first paint
// (which caused a font-swap layout shift on /panduan/berakhiran-x). App routes (/sandbox, /soal)
// do not preload fonts upfront so their initial JS chunks are not delayed on throttled connections.
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		preload: ({ type, path }) =>
			type === 'js' ||
			type === 'css' ||
			(type === 'font' &&
				event.url.pathname.startsWith('/panduan') &&
				path.includes('plus-jakarta-sans-latin-'))
	});
