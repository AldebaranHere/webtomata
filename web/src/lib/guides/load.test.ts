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
		const contoh = guides[0]!.sections.find((s) => s.id === 'contoh');
		expect(contoh?.blocks.some((b) => b.kind === 'machine')).toBe(true);
	});

	it('parses a machine block referencing an example and a caption', () => {
		const md = `${VALID_GUIDE}\n\`\`\`machine\nexample: berakhiran-01\ncaption: "q0: awal. \`q2\`: accepting."\n\`\`\`\n`;
		const { guide, problems } = parseGuideFile(md, validate);
		expect(problems).toEqual([]);
		const lastSection = guide!.sections.at(-1)!;
		const embed = lastSection.blocks.at(-1)!;
		expect(embed.kind).toBe('machine');
		if (embed.kind === 'machine') {
			expect(embed.doc.states).toHaveLength(3);
			expect(embed.openHref).toBe('/sandbox?example=berakhiran-01');
			expect(embed.caption).toEqual([
				{ kind: 'text', text: 'q0: awal. ' },
				{ kind: 'code', text: 'q2' },
				{ kind: 'text', text: ': accepting.' }
			]);
		}
	});

	it('parses an inline machine block into a document and share link', () => {
		const md = `${VALID_GUIDE}
\`\`\`machine
title: Satu state
kind: dfsm
alphabet: ["0"]
states:
  - { name: q0, x: 160, y: 200 }
start: q0
accepting: ["q0"]
transitions:
  - { from: q0, on: "0", to: q0 }
caption: "Mesin satu state."
\`\`\`
`;
		const { guide, problems } = parseGuideFile(md, validate);
		expect(problems).toEqual([]);
		const embed = guide!.sections.at(-1)!.blocks.at(-1)!;
		expect(embed.kind).toBe('machine');
		if (embed.kind === 'machine') {
			expect(embed.doc.title).toBe('Satu state');
			expect(embed.doc.states).toHaveLength(1);
			expect(embed.openHref).toMatch(/^\/sandbox#m1u=[A-Za-z0-9_-]+$/);
		}
	});

	it('reports the line for unknown examples, invalid inline machines, or unclosed machine fences', () => {
		const unknownEx = `${VALID_GUIDE}\n\`\`\`machine\nexample: tidak-ada\n\`\`\`\n`;
		const r1 = parseGuideFile(unknownEx, validate);
		expect(r1.problems[0]?.message).toMatch(/unknown example "tidak-ada"/);
		expect(r1.problems[0]?.line).toBeGreaterThan(30);

		const unclosed = `${VALID_GUIDE}\n\`\`\`machine\nexample: berakhiran-01\n`;
		const r2 = parseGuideFile(unclosed, validate);
		expect(r2.problems[0]?.message).toMatch(/unclosed ```machine block/);

		const badInline = `${VALID_GUIDE}\n\`\`\`machine\ntitle: Rusak\nkind: pda\n\`\`\`\n`;
		const r3 = parseGuideFile(badInline, validate);
		expect(r3.problems[0]?.message).toMatch(/kind/);
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
