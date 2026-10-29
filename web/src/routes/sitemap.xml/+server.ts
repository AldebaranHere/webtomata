// Prerendered XML sitemap (/sitemap.xml) listing the main pages, every question and every guide (G1).
import { buildSitemapXml } from '#lib/seo.ts';
import { allGuides } from '#lib/server/guides.ts';
import { allQuestions } from '#lib/server/questions.ts';

export const prerender = true;

export function GET() {
	const paths = [
		'/',
		'/sandbox',
		'/soal',
		'/panduan',
		'/tentang',
		...allQuestions().map((q) => `/soal/${q.id}`),
		...allGuides().map((g) => `/panduan/${g.id}`)
	];
	return new Response(buildSitemapXml(paths), {
		headers: {
			'content-type': 'application/xml; charset=utf-8'
		}
	});
}
