import { describe, expect, it } from 'vitest';
import { buildSitemapXml } from './seo.ts';

describe('buildSitemapXml', () => {
	it('builds a valid sitemap with deduplicated routes and escaped XML characters', () => {
		const xml = buildSitemapXml(
			['/', '/sandbox', '/soal', '/panduan', '/panduan/berakhiran-x', '/soal'],
			'https://example.com/'
		);
		expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(xml).toContain('<loc>https://example.com/</loc>');
		expect(xml).toContain('<loc>https://example.com/panduan/berakhiran-x</loc>');
		expect(xml.match(/<loc>https:\/\/example\.com\/soal<\/loc>/g)).toHaveLength(1);
	});
});
