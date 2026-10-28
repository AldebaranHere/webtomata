// Preloads the three core Latin fonts (UI 400/600 and mono 400) in the prerendered HTML head so
// the browser fetches them alongside the stylesheets instead of discovering them after first paint
// (which caused a font-swap layout shift on prose guide pages). The Greek subset stays lazy.
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		preload: ({ type, path }) =>
			type === 'js' ||
			type === 'css' ||
			(type === 'font' && !path.includes('greek') && !path.includes('jetbrains-mono-latin-600'))
	});
