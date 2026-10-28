// Sitemap XML builder, Open Graph constants, and canonical site origin for SEO (G1).
export const SITE_ORIGIN = 'https://webtomata.workers.dev';
export const OG_TYPE_WEBSITE = 'website';
export const OG_TYPE_ARTICLE = 'article';

export const ogLocale = (locale: 'id' | 'en'): string => (locale === 'en' ? 'en_US' : 'id_ID');

function escapeXml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

/** Builds a valid XML sitemap for the given route paths (each starting with `/`). */
export function buildSitemapXml(paths: readonly string[], origin = SITE_ORIGIN): string {
	const base = origin.replace(/\/+$/, '');
	const unique = [...new Set(paths)];
	const urls = unique
		.map((path) => {
			const normalized = path.startsWith('/') ? path : `/${path}`;
			return `\t<url><loc>${escapeXml(`${base}${normalized}`)}</loc></url>`;
		})
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
