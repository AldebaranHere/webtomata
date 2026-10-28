import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSchemaValidator } from '#lib/questions/load.ts';
import schema from '../../../../content/guides/schema.json';
import { loadGuides, parseGuideFile } from './load.ts';

const validate = createSchemaValidator(schema);

const VALID_GUIDE = `---
schemaVersion: 1
id: berakhiran-x
order: 1
topic: dfsm
readingMinutes: 6
cardTitle:
  id: String berakhiran x
  en: Strings ending with x
title:
  id: Cara membuat DFSM untuk string berakhiran x
  en: How to build a DFSM for strings ending with x
summary:
  id: State mengingat akhiran terpanjang yang cocok dengan awal x.
references:
  rich: ["5.2"]
  sipser: ["1.1"]
---

Soal "diakhiri \`x\`" muncul berulang.

## Ide dasarnya {#ide}

Mesin hanya perlu tahu awalan \`x\` terpanjang.

## Langkah merancang {#langkah}

1. Tulis \`x\` dan semua awalannya.
2. Buat satu state untuk setiap awalan.

## Kesalahan umum {#salah}

- Lupa transisi dari accepting state.
- Mengira state harus menghitung panjang string.
`;

describe('parseGuideFile', () => {
	it('parses a valid guide with frontmatter, intro, headings, paragraphs, code and lists', () => {
		const { guide, problems } = parseGuideFile(VALID_GUIDE, validate);
		expect(problems).toEqual([]);
		expect(guide).toBeDefined();
		expect(guide!.id).toBe('berakhiran-x');
		expect(guide!.topic).toBe('dfsm');
		expect(guide!.readingMinutes).toBe(6);
		expect(guide!.intro).toEqual([
			[
				{ kind: 'text', text: 'Soal "diakhiri ' },
				{ kind: 'code', text: 'x' },
				{ kind: 'text', text: '" muncul berulang.' }
			]
		]);
		expect(guide!.sections.map((s) => ({ id: s.id, heading: s.heading }))).toEqual([
			{ id: 'ide', heading: 'Ide dasarnya' },
			{ id: 'langkah', heading: 'Langkah merancang' },
			{ id: 'salah', heading: 'Kesalahan umum' }
		]);
		expect(guide!.sections[1]!.blocks[0]!.kind).toBe('ordered-list');
		expect(guide!.sections[2]!.blocks[0]!.kind).toBe('unordered-list');
	});

	it('validates the real content/guides/berakhiran-x.md file', () => {
		const raw = readFileSync(
			new URL('../../../../content/guides/berakhiran-x.md', import.meta.url),
			'utf8'
		);
		const guides = loadGuides({ 'content/guides/berakhiran-x.md': raw }, validate);
		expect(guides).toHaveLength(1);
		expect(guides[0]!.id).toBe('berakhiran-x');
		expect(guides[0]!.sections.length).toBeGreaterThanOrEqual(3);
	});

	it('refuses a file without YAML frontmatter fences', () => {
		const { guide, problems } = parseGuideFile('## Ide\n\nHalo.', validate);
		expect(guide).toBeUndefined();
		expect(problems[0]?.message).toMatch(/frontmatter/);
	});

	it('refuses unknown topics, missing fields, and YAML aliases', () => {
		const badTopic = VALID_GUIDE.replace('topic: dfsm', 'topic: pda');
		expect(parseGuideFile(badTopic, validate).problems.length).toBeGreaterThan(0);

		const aliased = VALID_GUIDE.replace('topic: dfsm', 'topic: &t dfsm\nextra: *t');
		expect(parseGuideFile(aliased, validate).problems[0]?.message).toMatch(/anchors and aliases/);
	});

	it('refuses raw HTML tags in the Markdown body and reports the line', () => {
		const withHtml = `${VALID_GUIDE}\n<script>alert(1)</script>\n`;
		const { guide, problems } = parseGuideFile(withHtml, validate);
		expect(guide).toBeUndefined();
		expect(problems[0]?.message).toMatch(/raw HTML tags/);
		expect(problems[0]?.line).toBeGreaterThan(20);
	});

	it('allows < and > inside backtick code spans', () => {
		const withCode = `${VALID_GUIDE}\nSimbol \`<state>\` di dalam kode aman.\n`;
		const { guide, problems } = parseGuideFile(withCode, validate);
		expect(problems).toEqual([]);
		expect(guide).toBeDefined();
	});

	it('refuses a guide whose id does not match its filename', () => {
		expect(() => loadGuides({ 'content/guides/lain.md': VALID_GUIDE }, validate)).toThrow(
			/must be the name of the file/
		);
	});
});
